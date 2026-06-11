import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { ReceiptData } from './types';
import ResultsTable from './components/ResultsTable';
import { exportToExcel } from './utils/excelExport';

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReceiptData[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<ReceiptData> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errText = 'Lỗi từ server';
        try {
          const errJSON = await response.json();
          if (errJSON.error) errText = errJSON.error;
        } catch { }
        throw new Error(errText);
      }

      const data = await response.json();
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
        readMethod: data.readMethod || 'gemini',
        status: data.status || '',
        note: data.note || ''
      };
    } catch (err: any) {
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
        note: err.message || 'Không thể đọc file'
      };
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: fileArray.length });

    const newResults: ReceiptData[] = [];

    // Xử lý từng file một (Sequential) hoặc Promise.all.
    // Dùng tuần tự để tránh rate limit nếu up nhiều file cùng lúc.
    for (let i = 0; i < fileArray.length; i++) {
      const result = await processFile(fileArray[i]);
      newResults.push(result);
      setProgress({ current: i + 1, total: fileArray.length });
    }

    setResults(prev => [...newResults, ...prev]);
    setIsProcessing(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const updateResult = (id: string, field: keyof ReceiptData, value: string) => {
    setResults(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeResult = (id: string) => {
    setResults(prev => prev.filter(item => item.id !== id));
  };

  const handleReset = () => {
    setResults([]);
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const successCount = results.filter(r => r.status === 'Đọc thành công').length;
  const warningCount = results.length - successCount;

  return (
    <div className="h-screen w-full bg-[#f5f5f0] text-[#1c1917] font-sans flex flex-col p-6 overflow-hidden">
      {/* Header Section */}
      <header className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-serif italic text-[#5A5A40] leading-none">ReceiptToSheet</h1>
          <p className="text-xs uppercase tracking-widest text-[#78716c] mt-2">TikTok Shop Creator Invoice Processor</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
            <span className="text-[10px] text-stone-400 uppercase">Processed</span>
            <span className="text-lg font-serif">{results.length}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
            <span className="text-[10px] text-stone-400 uppercase">Success Rate</span>
            <span className="text-lg font-serif text-[#5A5A40]">
              {results.length > 0 ? Math.round((successCount / results.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Sidebar: Upload Zone */}
        <aside className="w-72 flex flex-col gap-4 shrink-0">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 bg-white border-2 border-dashed rounded-[32px] p-6 flex flex-col items-center justify-center text-center transition-all duration-200 relative
              ${isDragging ? 'border-[#5A5A40] bg-[#f5f5f0]' : 'border-stone-300 hover:border-stone-400'}
              ${isProcessing ? 'opacity-70 pointer-events-none' : ''}`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              multiple 
              accept=".pdf,image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-4">
                  <div className="w-6 h-6 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-sm font-medium">Processing...</h3>
                <p className="text-[11px] text-stone-400 mt-1">{progress.current} / {progress.total} files</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-4">
                  <UploadCloud className="w-6 h-6 text-[#5A5A40]" />
                </div>
                <h3 className="text-sm font-medium">Upload Invoices</h3>
                <p className="text-[11px] text-stone-400 mt-1">PDF or Images</p>
                <button className="mt-4 bg-[#5A5A40] text-white text-xs px-6 py-2.5 rounded-full hover:bg-[#4a4a35] transition-colors pointer-events-none">
                  Select Files
                </button>
              </>
            )}
          </div>

          <div className="h-48 bg-white rounded-[32px] border border-stone-200 p-4 overflow-hidden flex flex-col">
            <h4 className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Queue</h4>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {results.map((r) => (
                <div key={r.id} className={`flex items-center gap-3 p-2 rounded-xl border ${r.status === 'Đọc thành công' ? 'bg-[#f5f5f0] border-transparent' : 'border-stone-100'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'Đọc thành công' ? 'bg-[#5A5A40]' : 'bg-amber-400'}`}></div>
                  <span className="text-[11px] truncate flex-1 text-stone-600" title={r.fileName}>{r.fileName}</span>
                </div>
              ))}
              {results.length === 0 && <p className="text-[11px] text-stone-400 italic text-center w-full mt-4">No files processed.</p>}
            </div>
          </div>
        </aside>

        {/* Main Data Table */}
        <main className="flex-1 bg-white rounded-[32px] shadow-sm border border-stone-200 flex flex-col overflow-hidden min-w-0">
          <div className="p-6 border-b border-stone-100 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-serif">Extraction Preview</h2>
            <div className="flex gap-2">
              <span className="text-[10px] bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">{successCount} Success</span>
              <span className="text-[10px] bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">{warningCount} Incomplete</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar">
            <ResultsTable 
              data={results}
              onUpdate={updateResult}
              onRemove={removeResult}
            />
          </div>

          <div className="p-6 bg-[#fbfbf9] border-t border-stone-100 flex justify-between items-center shrink-0">
            <p className="text-[11px] text-stone-500 italic">Double-click or edit any cell to manually correct values before export.</p>
            <div className="flex gap-3">
              <button 
                onClick={handleReset}
                disabled={results.length === 0}
                className="px-6 py-2.5 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium flex items-center gap-2 hover:bg-stone-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button 
                onClick={() => exportToExcel(results)}
                disabled={results.length === 0}
                className="px-8 py-2.5 rounded-full bg-[#5A5A40] text-white text-xs font-medium flex items-center gap-2 hover:bg-[#4a4a35] shadow-lg shadow-[#5a5a40]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export Excel (.xlsx)
              </button>
            </div>
          </div>
        </main>
      </div>

      <footer className="mt-6 flex justify-between items-center text-[10px] text-stone-400 uppercase tracking-[2px] shrink-0">
        <div className="flex gap-6">
          <span>ReceiptToSheet App</span>
          <span>thanhnghiaecommerce</span>
        </div>
        <div>&copy; 2026 Crafted for TikTok Shop Creators</div>
      </footer>
    </div>
  );
}
