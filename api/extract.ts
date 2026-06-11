import type { IncomingMessage, ServerResponse } from 'node:http';
import multer from 'multer';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 30,
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === 'application/pdf') {
      callback(null, true);
      return;
    }

    callback(new Error('Vercel deployment hiện chỉ đọc PDF có text. File scan ảnh cần OCR backend riêng.'));
  },
});

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

type UploadedFile = {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
};

type ExtractedReceipt = {
  receiptNumber?: string;
  receiptDate?: string;
  creatorName?: string;
  creatorUsername?: string;
  billingAddress?: string;
  totalAmount?: string;
};

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

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function parseVndAmount(amountText: string): number | '' {
  const digits = amountText.replace(/[^\d]/g, '');
  if (!digits) return '';
  const amount = Number.parseInt(digits, 10);
  return Number.isFinite(amount) ? amount : '';
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return '';
}

function extractReceiptNumberFromFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim();
  const vnacMatch = baseName.match(/\b(VNAC[A-Z0-9_-]{6,})\b/i);
  if (vnacMatch?.[1]) return vnacMatch[1].toUpperCase();

  const invoiceMatch = baseName.match(/\b((?:INV|RECEIPT|BILL)[A-Z0-9_-]{5,})\b/i);
  if (invoiceMatch?.[1]) return invoiceMatch[1].toUpperCase();

  return /^[A-Z0-9_-]{8,}$/i.test(baseName) ? baseName.toUpperCase() : '';
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
    if (!receiptDateLabelRegex.test(lines[index])) continue;
    const sameLine = matchDateValue(lines[index]);
    if (sameLine) return sameLine;
    const nextLines = `${lines[index + 1] || ''} ${lines[index + 2] || ''}`;
    const nextLineDate = matchDateValue(nextLines);
    if (nextLineDate) return nextLineDate;
  }

  return matchDateValue(cleanText(text));
}

function normalizeDate(dateText: string): string {
  if (!dateText) return '';
  const value = dateText.trim().replace(/,/g, '').replace(/\s+/g, ' ');
  const dmyMatch = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (dmyMatch) {
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${year}`;
  }

  const ymdMatch = value.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (ymdMatch) return `${ymdMatch[3].padStart(2, '0')}/${ymdMatch[2].padStart(2, '0')}/${ymdMatch[1]}`;

  const monthDayYear = value.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})\b/i);
  if (monthDayYear) {
    const month = monthNameToNumber[monthDayYear[1].toLowerCase()];
    const year = monthDayYear[3].length === 2 ? `20${monthDayYear[3]}` : monthDayYear[3];
    if (month) return `${monthDayYear[2].padStart(2, '0')}/${month}/${year}`;
  }

  const dayMonthYear = value.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/i);
  if (dayMonthYear) {
    const month = monthNameToNumber[dayMonthYear[2].toLowerCase()];
    const year = dayMonthYear[3].length === 2 ? `20${dayMonthYear[3]}` : dayMonthYear[3];
    if (month) return `${dayMonthYear[1].padStart(2, '0')}/${month}/${year}`;
  }

  return '';
}

function extractFromPlainText(text: string): ExtractedReceipt {
  const compactText = text.replace(/\r/g, '\n');
  const singleLine = cleanText(text);

  return {
    receiptNumber:
      firstMatch(compactText, [
        /(?:receipt|invoice|sequence|document|transaction)\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{5,})/i,
        /\b(VN[A-Z0-9][A-Z0-9\-_/]{5,})\b/i,
        /\b(INV[A-Z0-9\-_/]{4,})\b/i,
      ]) || '',
    receiptDate: extractReceiptDate(compactText),
    creatorName: firstMatch(compactText, [
      /(?:bill to|creator name|creator|customer|name|recipient)\s*[:\-]\s*([^\n]{2,80})/i,
    ]),
    creatorUsername: firstMatch(compactText, [
      /(?:username|handle|creator username)\s*[:\-]?\s*(@?[A-Za-z0-9._-]{2,})/i,
      /\B(@[A-Za-z0-9._-]{2,})\b/,
    ]),
    billingAddress: firstMatch(compactText, [/(?:billing address|address)\s*[:\-]\s*([^\n]{8,180})/i]),
    totalAmount: firstMatch(singleLine, [
      /(?:grand total|total amount|amount due|total payment|total)\s*[:\-]?\s*([A-Z$₫đ ]?\s*[\d.,]{4,}(?:\s*(?:VND|VNĐ|đ|₫))?)/i,
      /\b([0-9]{1,3}(?:[.,][0-9]{3})+(?:\s*(?:VND|VNĐ|đ|₫))?)\b/i,
    ]),
  };
}

function buildResponse(extractedData: ExtractedReceipt, fileName: string, extraNote = '') {
  const receiptNumber = cleanText(extractedData.receiptNumber) || extractReceiptNumberFromFileName(fileName);
  const receiptDate = cleanText(extractedData.receiptDate);
  const creatorName = cleanText(extractedData.creatorName);
  const totalAmountRaw = cleanText(extractedData.totalAmount);

  const missingFields = [
    !receiptNumber ? 'Thiếu số hóa đơn' : '',
    !receiptDate ? 'Thiếu ngày hóa đơn' : '',
    !creatorName ? 'Thiếu tên creator/người nhận' : '',
    !totalAmountRaw ? 'Thiếu tổng tiền' : '',
  ].filter(Boolean);

  return {
    receiptNumber,
    receiptDate,
    receiptDateConverted: normalizeDate(receiptDate),
    creatorName,
    creatorUsername: cleanText(extractedData.creatorUsername),
    billingAddress: cleanText(extractedData.billingAddress),
    totalAmountRaw,
    totalAmount: parseVndAmount(totalAmountRaw),
    status: missingFields.length === 0 ? 'Đọc thành công' : 'Thiếu thông tin',
    note: [extraNote || 'Đọc từ text PDF trên Vercel', ...missingFields].filter(Boolean).join(', '),
    readMethod: 'Vercel PDF text fallback',
  };
}

async function runMiddleware(req: IncomingMessage, res: ServerResponse) {
  await new Promise<void>((resolve, reject) => {
    upload.single('file')(req as never, res as never, (error: unknown) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function extractPdfText(file: UploadedFile) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

export default async function handler(req: IncomingMessage & { file?: UploadedFile }, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ hỗ trợ POST.' });
    return;
  }

  try {
    await runMiddleware(req, res);
    if (!req.file) {
      res.status(400).json({ error: 'Chưa nhận được file upload.' });
      return;
    }

    const text = await extractPdfText(req.file);
    if (!text.trim()) {
      res
        .status(200)
        .json(
          buildResponse(
            {},
            req.file.originalname,
            'PDF không có text để đọc trên Vercel; đã lấy số hóa đơn từ tên file nếu nhận diện được',
          ),
        );
      return;
    }

    res.status(200).json(buildResponse(extractFromPlainText(text), req.file.originalname));
  } catch (error) {
    const fallback = buildResponse(
      {},
      req.file?.originalname || '',
      error instanceof Error
        ? `Không đọc được text PDF trên Vercel: ${error.message}; đã lấy số hóa đơn từ tên file nếu nhận diện được`
        : 'Không đọc được text PDF trên Vercel; đã lấy số hóa đơn từ tên file nếu nhận diện được',
    );

    res.status(200).json(fallback);
  }
}
