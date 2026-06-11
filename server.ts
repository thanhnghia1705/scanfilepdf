import { config } from 'dotenv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { createServer as createViteServer } from 'vite';

config({ path: '.env.local' });
config();

const PORT = Number(process.env.PORT || 3000);
const MAX_FILE_SIZE_MB = 20;
const SUCCESS_STATUS = 'Đọc thành công';
const REVIEW_STATUS = 'Thiếu thông tin';
const ERROR_STATUS = 'Lỗi';
const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('Chỉ hỗ trợ PDF, PNG, JPG hoặc WEBP.'));
  },
});

type ExtractedReceipt = {
  receiptNumber?: string;
  receiptDate?: string;
  creatorName?: string;
  creatorUsername?: string;
  billingAddress?: string;
  totalAmount?: string;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function parseVndAmount(amountText: string): number | '' {
  if (!amountText) return '';
  const digits = amountText.replace(/[^\d]/g, '');
  if (!digits) return '';
  const amount = Number.parseInt(digits, 10);
  return Number.isFinite(amount) ? amount : '';
}

const monthNameToNumber: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const numericDatePattern = String.raw`\d{1,4}[./-]\d{1,2}[./-]\d{1,4}`;
const monthDatePattern = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{2,4}`;
const dateMonthPattern = String.raw`\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?[,]?\s+\d{2,4}`;
const dateValueRegex = new RegExp(`(${numericDatePattern}|${monthDatePattern}|${dateMonthPattern})`, 'i');
const receiptDateLabelRegex =
  /(?:receipt\s*date|date\s*of\s*receipt|invoice\s*date|issue\s*date|issued\s*(?:date|on)?|created\s*(?:date|time)?|payment\s*date|transaction\s*date|ngày\s*(?:hóa đơn|lập|giao dịch|thanh toán)?)/i;

function normalizeDate(dateText: string): string {
  if (!dateText) return '';
  const value = dateText.trim().replace(/,/g, '').replace(/\s+/g, ' ');

  const dmyMatch = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    return `${day}/${month}/${year}`;
  }

  const ymdMatch = value.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (ymdMatch) {
    return `${ymdMatch[3].padStart(2, '0')}/${ymdMatch[2].padStart(2, '0')}/${ymdMatch[1]}`;
  }

  const monthDayYearMatch = value.match(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})\b/i,
  );
  if (monthDayYearMatch) {
    const month = monthNameToNumber[monthDayYearMatch[1].toLowerCase()];
    if (month) {
      const day = monthDayYearMatch[2].padStart(2, '0');
      const year = monthDayYearMatch[3].length === 2 ? `20${monthDayYearMatch[3]}` : monthDayYearMatch[3];
      return `${day}/${month}/${year}`;
    }
  }

  const dayMonthYearMatch = value.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/i,
  );
  if (dayMonthYearMatch) {
    const month = monthNameToNumber[dayMonthYearMatch[2].toLowerCase()];
    if (month) {
      const day = dayMonthYearMatch[1].padStart(2, '0');
      const year = dayMonthYearMatch[3].length === 2 ? `20${dayMonthYearMatch[3]}` : dayMonthYearMatch[3];
      return `${day}/${month}/${year}`;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return [
      String(parsed.getDate()).padStart(2, '0'),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      parsed.getFullYear(),
    ].join('/');
  }

  return '';
}

function matchDateValue(text: string): string {
  const match = text.match(dateValueRegex);
  return match?.[1] ? cleanText(match[1]) : '';
}

function extractReceiptDate(text: string): string {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!receiptDateLabelRegex.test(line)) continue;

    const dateOnSameLine = matchDateValue(line);
    if (dateOnSameLine) return dateOnSameLine;

    const nextLine = lines[index + 1] || '';
    const followingLine = lines[index + 2] || '';
    const dateOnNextLine = matchDateValue(`${nextLine} ${followingLine}`);
    if (dateOnNextLine) return dateOnNextLine;
  }

  return matchDateValue(cleanText(text));
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return '';
}

function parseJsonResponse(text: string): ExtractedReceipt {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  }
}

function extractFromPlainText(text: string): ExtractedReceipt {
  const compactText = text.replace(/\r/g, '\n');
  const singleLine = cleanText(text);

  const receiptNumber =
    firstMatch(compactText, [
      /(?:receipt|invoice|sequence|document|transaction)\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{5,})/i,
      /\b(VN[A-Z0-9][A-Z0-9\-_/]{5,})\b/i,
      /\b(INV[A-Z0-9\-_/]{4,})\b/i,
    ]) || '';

  const receiptDate = extractReceiptDate(compactText);

  const creatorName = firstMatch(compactText, [
    /(?:bill to|creator name|creator|customer|name|recipient)\s*[:\-]\s*([^\n]{2,80})/i,
  ]);

  const creatorUsername = firstMatch(compactText, [
    /(?:username|handle|creator username)\s*[:\-]?\s*(@?[A-Za-z0-9._-]{2,})/i,
    /\B(@[A-Za-z0-9._-]{2,})\b/,
  ]);

  const billingAddress = firstMatch(compactText, [
    /(?:billing address|address)\s*[:\-]\s*([^\n]{8,180})/i,
  ]);

  const totalAmount = firstMatch(singleLine, [
    /(?:grand total|total amount|amount due|total payment|total)\s*[:\-]?\s*([A-Z$₫đ ]?\s*[\d.,]{4,}(?:\s*(?:VND|VNĐ|đ|₫))?)/i,
    /\b([0-9]{1,3}(?:[.,][0-9]{3})+(?:\s*(?:VND|VNĐ|đ|₫))?)\b/i,
  ]);

  return {
    receiptNumber,
    receiptDate,
    creatorName,
    creatorUsername,
    billingAddress,
    totalAmount,
  };
}

function buildResponse(extractedData: ExtractedReceipt, readMethod: string, extraNote = '') {
  const receiptNumber = cleanText(extractedData.receiptNumber);
  const receiptDate = cleanText(extractedData.receiptDate);
  const creatorName = cleanText(extractedData.creatorName);
  const creatorUsername = cleanText(extractedData.creatorUsername);
  const billingAddress = cleanText(extractedData.billingAddress);
  const totalAmountRaw = cleanText(extractedData.totalAmount);
  const totalAmount = parseVndAmount(totalAmountRaw);
  const receiptDateConverted = normalizeDate(receiptDate);

  const missingFields = [
    !receiptNumber ? 'Thiếu số hóa đơn' : '',
    !receiptDate ? 'Thiếu ngày hóa đơn' : '',
    !creatorName ? 'Thiếu tên creator/người nhận' : '',
    !totalAmountRaw ? 'Thiếu tổng tiền' : '',
  ].filter(Boolean);

  return {
    receiptNumber,
    receiptDate,
    receiptDateConverted,
    creatorName,
    creatorUsername,
    billingAddress,
    totalAmountRaw,
    totalAmount,
    status: missingFields.length === 0 ? SUCCESS_STATUS : REVIEW_STATUS,
    note: [extraNote, ...missingFields].filter(Boolean).join(', '),
    readMethod,
  };
}

async function extractWithGemini(ai: GoogleGenAI, file: Express.Multer.File): Promise<ExtractedReceipt> {
  const prompt = [
    'Bạn là hệ thống nhập liệu chứng từ cho đội Trade/E-commerce.',
    'Hãy đọc file hóa đơn/biên nhận và trả về JSON đúng schema.',
    'Chỉ trả JSON, không giải thích.',
    'Quy tắc:',
    '- receiptNumber: số hóa đơn/receipt/sequence number, ví dụ VNAC...',
    '- receiptDate: ngày trên hóa đơn, giữ nguyên định dạng nhìn thấy.',
    '- creatorName: tên người nhận, creator hoặc Bill To.',
    '- creatorUsername: username/handle nếu có.',
    '- billingAddress: địa chỉ thanh toán nếu có.',
    '- totalAmount: tổng tiền thanh toán, giữ kèm ký hiệu tiền tệ nếu nhìn thấy.',
    'Nếu không thấy trường nào thì để chuỗi rỗng.',
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: prompt },
      { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          receiptNumber: { type: Type.STRING },
          receiptDate: { type: Type.STRING },
          creatorName: { type: Type.STRING },
          creatorUsername: { type: Type.STRING },
          billingAddress: { type: Type.STRING },
          totalAmount: { type: Type.STRING },
        },
      },
    },
  });

  return parseJsonResponse(response.text || '{}');
}

async function extractPdfText(file: Express.Multer.File): Promise<string> {
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

async function startServer() {
  const app = express();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'receipt-to-sheet-pro' } },
      })
    : null;

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(ai),
      maxFileSizeMb: MAX_FILE_SIZE_MB,
      pdfTextFallback: true,
    });
  });

  app.post(
    '/api/extract',
    (req, res, next) => {
      upload.single('file')(req, res, (error) => {
        if (error) {
          res.status(400).json({ error: error.message || 'File không hợp lệ.' });
          return;
        }
        next();
      });
    },
    async (req, res) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Chưa nhận được file upload.' });
        return;
      }

      if (ai) {
        try {
          const extractedData = await extractWithGemini(ai, file);
          const readMethod = file.mimetype === 'application/pdf' ? 'Gemini PDF OCR' : 'Gemini Image OCR';
          res.json(buildResponse(extractedData, readMethod));
          return;
        } catch (error) {
          console.error(`Gemini extract error for ${file.originalname}:`, error);
          if (file.mimetype !== 'application/pdf') {
            res.status(500).json({
              error:
                error instanceof Error
                  ? `Gemini chưa đọc được hình/scan này: ${error.message}`
                  : 'Gemini chưa đọc được hình/scan này.',
            });
            return;
          }
        }
      }

      if (file.mimetype === 'application/pdf') {
        try {
          const text = await extractPdfText(file);
          if (!text.trim()) {
            res.json({
              ...buildResponse({}, 'PDF text fallback', ai ? 'Gemini lỗi; PDF không có text để đọc dự phòng' : ''),
              status: ERROR_STATUS,
              note: ai
                ? 'Gemini lỗi; PDF này có thể là file scan ảnh nên không có text để đọc dự phòng'
                : 'Chưa cấu hình GEMINI_API_KEY và PDF này có thể là file scan ảnh nên không có text để đọc',
            });
            return;
          }

          const extraNote = ai ? 'Gemini lỗi; đã đọc dự phòng từ text trong PDF' : 'Đọc từ text PDF; file scan ảnh cần Gemini API key';
          res.json(buildResponse(extractFromPlainText(text), 'PDF text fallback', extraNote));
          return;
        } catch (error) {
          console.error(`PDF fallback error for ${file.originalname}:`, error);
          res.status(500).json({
            error:
              error instanceof Error
                ? `Không đọc được PDF: ${error.message}`
                : 'Không đọc được PDF.',
          });
          return;
        }
      }

      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY. File hình ảnh hoặc PDF scan cần Gemini OCR để đọc dữ liệu.',
      });
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReceiptToSheet Pro is running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
