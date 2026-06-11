import React from 'react';
import { ReceiptData } from '../types';
import { Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  data: ReceiptData[];
  onUpdate: (id: string, field: keyof ReceiptData, value: string) => void;
  onRemove: (id: string) => void;
}

export default function ResultsTable({ data, onUpdate, onRemove }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-stone-400 italic">
        Upload files to see extraction preview.
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 bg-[#fbfbf9] text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-100 z-10">
        <tr>
          <th className="px-4 py-3 font-medium whitespace-nowrap">STT</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[200px]">File Name</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[150px]">Receipt #</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[100px]">Date</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[100px]">Converted</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[150px]">Creator</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[120px]">Username</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[250px]">Address</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[100px]">Total Raw</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[100px]">Total (Num)</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[100px]">Method</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[120px]">Status</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[150px]">Note</th>
          <th className="px-4 py-3 font-medium whitespace-nowrap w-12 text-center text-transparent">Actions</th>
        </tr>
      </thead>
      <tbody className="text-[12px] text-stone-700">
        {data.map((row, index) => (
          <tr 
            key={row.id} 
            className={cn(
              "border-b border-stone-50 transition-colors",
              row.status === 'Đọc thành công' ? "hover:bg-stone-50/80" : "bg-amber-50/30 hover:bg-amber-50/50"
            )}
          >
            <td className="px-4 py-3 text-stone-500 w-12 text-center">
              {(index + 1).toString().padStart(2, '0')}
            </td>
            <td className="px-4 py-3 italic max-w-[200px] truncate" title={row.fileName}>
              {row.fileName}
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.receiptNumber || ''}
                onChange={(e) => onUpdate(row.id, 'receiptNumber', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 font-mono text-[11px] focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all text-stone-800"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.receiptDate || ''}
                onChange={(e) => onUpdate(row.id, 'receiptDate', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.receiptDateConverted || ''}
                onChange={(e) => onUpdate(row.id, 'receiptDateConverted', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.creatorName || ''}
                onChange={(e) => onUpdate(row.id, 'creatorName', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 font-medium text-stone-800 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.creatorUsername || ''}
                onChange={(e) => onUpdate(row.id, 'creatorUsername', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.billingAddress || ''}
                onChange={(e) => onUpdate(row.id, 'billingAddress', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.totalAmountRaw || ''}
                onChange={(e) => onUpdate(row.id, 'totalAmountRaw', e.target.value)}
                className="w-full text-left font-semibold text-stone-600 bg-transparent border-transparent rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2">
              <input
                type="number"
                value={row.totalAmount || ''}
                onChange={(e) => onUpdate(row.id, 'totalAmount', e.target.value)}
                className="w-full text-left font-semibold text-[#5A5A40] bg-transparent border-transparent rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all"
              />
            </td>
            <td className="px-2 py-2 font-mono text-[10px] text-stone-500 text-center">
              {row.readMethod}
            </td>
            <td className="px-2 py-2">
              <div className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-[10px] text-center font-medium",
                  row.status === 'Đọc thành công' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                )}>
                  {row.status === 'Đọc thành công' ? 'Success' : 'Incomplete'}
              </div>
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={row.note || ''}
                onChange={(e) => onUpdate(row.id, 'note', e.target.value)}
                className="w-full bg-transparent border-transparent rounded-lg px-2 py-1.5 text-amber-700/80 focus:ring-1 focus:ring-[#5A5A40] focus:bg-white transition-all text-xs"
              />
            </td>
            <td className="px-4 py-2 text-center">
              <button 
                onClick={() => onRemove(row.id)}
                className="p-1.5 rounded-md hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
                title="Xóa hóa đơn"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
