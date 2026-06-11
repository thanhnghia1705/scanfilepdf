import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const upload = multer({ storage: multer.memoryStorage() });

// 6. parse_vnd_amount(amount_text)
function parse_vnd_amount(amountText: string): number | null {
  if (!amountText) return null;
  const numStr = amountText.replace(/[^\d]/g, '');
  if (!numStr) return null;
  return parseInt(numStr, 10);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Gemini backend instance
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  app.post('/api/extract', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let extractedData: any = null;
    let readMethod = '';

    try {
      console.log(`[DEBUG] Attempting Gemini OCR for: ${file.originalname}`);
      const prompt = `Extract the following receipt/invoice information and return it as JSON:
- receiptNumber: (string) The receipt sequence number, e.g. VNAC...
- receiptDate: (string) The receipt date string.
- creatorName: (string) The creator name or "Bill To" person name.
- creatorUsername: (string) The creator username.
- billingAddress: (string) The billing address.
- totalAmount: (string) The total amount string.

If a field is not found, leave it as an empty string.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });
      console.log(`[DEBUG] Gemini OCR JSON success for ${file.originalname}`);
      const text = response.text || "{}";
      extractedData = JSON.parse(text);
      readMethod = file.mimetype === 'application/pdf' ? 'Gemini PDF OCR JSON' : 'Gemini Image OCR JSON';
    } catch (e: any) {
      console.error(`[DEBUG] Gemini OCR error on ${file.originalname}:`, e.message);
      extractedData = null;
    }

    if (!extractedData) {
      return res.json({ status: 'Lỗi', note: 'Không trích xuất được text từ file: lỗi OCR', readMethod: 'Lỗi đọc file' });
    }

    try {
      let receiptDateConverted = '';
      if (extractedData.receiptDate) {
        try {
          const d = new Date(extractedData.receiptDate);
          if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            receiptDateConverted = `${dd}/${mm}/${yyyy}`;
          }
        } catch {}
      }

      const totalAmount = parse_vnd_amount(extractedData.totalAmount);
      const isSuccess = extractedData.receiptNumber && extractedData.receiptDate && extractedData.creatorName && extractedData.totalAmount;
      const status = isSuccess ? 'Đọc thành công' : 'Thiếu thông tin';

      const notes = [];
      if (!extractedData.receiptNumber) notes.push('Thiếu Receipt Number');
      if (!extractedData.receiptDate) notes.push('Thiếu Receipt Date');
      if (!extractedData.creatorName) notes.push('Thiếu Creator name');
      if (!extractedData.totalAmount) notes.push('Thiếu Total Amount');

      res.json({
        receiptNumber: extractedData.receiptNumber || '',
        receiptDate: extractedData.receiptDate || '',
        receiptDateConverted,
        creatorName: extractedData.creatorName || '',
        creatorUsername: extractedData.creatorUsername || '',
        billingAddress: extractedData.billingAddress || '',
        totalAmountRaw: extractedData.totalAmount || '',
        totalAmount: totalAmount ?? '',
        status,
        note: notes.join(', '),
        readMethod
      });
    } catch (error: any) {
      console.error('Data mapping error:', error);
      res.json({
         status: 'Lỗi', 
         note: 'Exception: ' + (error.message || 'Lỗi xử lý file'),
         readMethod
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
