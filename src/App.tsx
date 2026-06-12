import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import ResultsTable from './components/ResultsTable';
import { ReceiptData } from './types';
import { exportToExcel } from './utils/excelExport';

const SUCCESS_STATUS = 'Đọc thành công';

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function createEmptyResult(file: File, note: string): ReceiptData {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    receiptNumber: '',
    receiptDate: '',
    receiptDateConverted: '',
    creatorName: '',
    creatorUsername: '',
    billingAddress: '',
    totalAmountRaw: '',
    totalAmount: '',
    readMethod: '',
    status: 'Lỗi',
    note,
  };
}

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReceiptData[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [uploadError, setUploadError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metrics = useMemo(() => {
    const successCount = results.filter((r) => r.status === SUCCESS_STATUS).length;
    const reviewCount = results.length - successCount;
    const totalAmount = results.reduce((sum, item) => {
      const value =
        typeof item.totalAmount === 'number'
          ? item.totalAmount
          : Number(String(item.totalAmount).replace(/[^\d.-]/g, ''));
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    return {
      successCount,
      reviewCount,
      totalAmount,
      successRate: results.length ? Math.round((successCount / results.length) * 100) : 0,
    };
  }, [results]);

  const processFile = async (file: File): Promise<ReceiptData> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Server chưa xử lý được file này.');
      }

      return {
        id: crypto.randomUUID(),
        fileName: file.name,
        receiptNumber: data.receiptNumber || '',
        receiptDate: data.receiptDate || '',
        receiptDateConverted: data.receiptDateConverted || '',
        creatorName: data.creatorName || '',
        creatorUsername: data.creatorUsername || '',
        billingAddress: data.billingAddress || '',
        totalAmountRaw: data.totalAmountRaw || '',
        totalAmount: data.totalAmount || '',
        readMethod: data.readMethod || 'Gemini OCR',
        status: data.status || 'Thiếu thông tin',
        note: data.note || '',
      };
    } catch (error) {
      return createEmptyResult(
        file,
        error instanceof Error ? error.message : 'Không thể đọc file. Vui lòng thử lại.',
      );
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (file) => file.type === 'application/pdf' || file.type.startsWith('image/'),
    );

    if (fileArray.length === 0) {
      setUploadError('Vui lòng chọn file PDF, PNG, JPG hoặc WEBP.');
      return;
    }

    const filesToProcess = fileArray;
    setUploadError('');
    setExportMessage(null);
    setIsProcessing(true);
    setProgress({ current: 0, total: filesToProcess.length, fileName: '' });

    const newResults: ReceiptData[] = [];
    for (let index = 0; index < filesToProcess.length; index += 1) {
      const file = filesToProcess[index];
      setProgress({ current: index, total: filesToProcess.length, fileName: file.name });
      const result = await processFile(file);
      newResults.push(result);
      setProgress({ current: index + 1, total: filesToProcess.length, fileName: file.name });
    }

    setResults((prev) => [...newResults, ...prev]);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateResult = (id: string, field: keyof ReceiptData, value: string) => {
    setResults((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeResult = (id: string) => {
    setResults((prev) => prev.filter((item) => item.id !== id));
  };

  const removeIncomplete = () => {
    setResults((prev) => prev.filter((item) => item.status === SUCCESS_STATUS));
  };

  const handleReset = () => {
    setResults([]);
    setUploadError('');
    setExportMessage(null);
    setProgress({ current: 0, total: 0, fileName: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async () => {
    if (results.length === 0) return;
    setIsExporting(true);
    setExportMessage(null);

    try {
      const fileName = await exportToExcel(results);
      setExportMessage({ type: 'success', text: `Đã tạo file ${fileName}. Vui lòng kiểm tra thư mục Downloads.` });
    } catch (error) {
      setExportMessage({
        type: 'error',
        text: error instanceof Error ? `Không xuất được Excel: ${error.message}` : 'Không xuất được Excel.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] min-w-0 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700">
              <FileSpreadsheet className="h-4 w-4" />
              ReceiptToSheet Pro
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
              Quét hóa đơn và tổng hợp dữ liệu xuất Excel
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Dành cho xử lý hàng loạt biên nhận TikTok Shop, creator invoice và chứng từ bán hàng.
              Có thể rà soát thủ công trước khi xuất file tổng hợp.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:min-w-[560px] xl:max-w-[620px]">
            <Metric label="Tổng file" value={String(results.length)} />
            <Metric label="Đọc đúng" value={`${metrics.successRate}%`} tone="success" />
            <Metric label="Cần rà soát" value={String(metrics.reviewCount)} tone="warning" />
            <Metric label="Tổng tiền" value={formatVnd(metrics.totalAmount)} compact />
          </div>
        </header>

        <main className="grid min-w-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="flex min-h-[420px] min-w-0 flex-col gap-3 lg:min-h-0">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (event.dataTransfer.files) void handleFiles(event.dataTransfer.files);
              }}
              className={`relative flex flex-1 flex-col justify-between rounded-lg border-2 border-dashed bg-white p-5 transition ${
                isDragging ? 'border-teal-500 bg-teal-50' : 'border-slate-300'
              } ${isProcessing ? 'pointer-events-none opacity-80' : 'hover:border-teal-400'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                disabled={isProcessing}
                onChange={(event) => event.target.files && void handleFiles(event.target.files)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Chọn file hóa đơn"
              />

              <div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                  {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
                </div>
                <h2 className="text-lg font-semibold">Tải file cần xử lý</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Kéo thả hoặc chọn nhiều file PDF, PNG, JPG, WEBP. App xử lý tuần tự để giảm lỗi giới hạn API.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {isProcessing ? (
                  <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
                    <div className="flex items-center justify-between text-sm font-medium text-teal-900">
                      <span>Đang xử lý</span>
                      <span>
                        {progress.current}/{progress.total}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all"
                        style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-2 truncate text-xs text-teal-800" title={progress.fileName}>
                      {progress.fileName || 'Đang chuẩn bị file...'}
                    </p>
                  </div>
                ) : (
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
                    <UploadCloud className="h-4 w-4" />
                    Chọn file
                  </button>
                )}

                {uploadError ? (
                  <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Hàng đợi gần nhất</h2>
                <span className="text-xs text-slate-500">{results.length} file</span>
              </div>
              <div className="custom-scrollbar max-h-52 space-y-2 overflow-y-auto pr-1">
                {results.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    Chưa có file nào. Tải hóa đơn lên để bắt đầu.
                  </div>
                ) : (
                  results.slice(0, 12).map((result) => (
                    <div key={result.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2">
                      {result.status === SUCCESS_STATUS ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-700" title={result.fileName}>
                          {result.fileName}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{result.note || result.status}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => removeResult(result.id)}
                        title="Xóa dòng này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  Bảng kiểm tra dữ liệu
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Chỉnh trực tiếp từng ô trước khi xuất Excel. Các dòng thiếu thông tin được đánh dấu màu vàng.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={removeIncomplete}
                  disabled={metrics.reviewCount === 0 || isProcessing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  Giữ dòng hợp lệ
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={results.length === 0 || isProcessing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Làm mới
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={results.length === 0 || isProcessing || isExporting}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isExporting ? 'Đang xuất' : 'Xuất Excel'}
                </button>
              </div>
            </div>

            {exportMessage ? (
              <div
                className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${
                  exportMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {exportMessage.text}
              </div>
            ) : null}

            <div className="custom-scrollbar flex-1 overflow-auto">
              <ResultsTable data={results} onUpdate={updateResult} onRemove={removeResult} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  compact = false,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning';
  compact?: boolean;
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : 'text-slate-900';

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 truncate font-semibold ${compact ? 'text-sm' : 'text-xl'} ${toneClass}`} title={value}>
        {value}
      </p>
    </div>
  );
}
