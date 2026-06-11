import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ReceiptData } from '../types';

const SUCCESS_STATUS = 'Đọc thành công';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  data: ReceiptData[];
  onUpdate: (id: string, field: keyof ReceiptData, value: string) => void;
  onRemove: (id: string) => void;
}

const columns: Array<{
  field: keyof ReceiptData;
  label: string;
  width: string;
  inputType?: 'text' | 'number';
  align?: 'left' | 'right';
}> = [
  { field: 'receiptNumber', label: 'Số hóa đơn', width: 'min-w-[180px]' },
  { field: 'receiptDate', label: 'Ngày gốc', width: 'min-w-[130px]' },
  { field: 'receiptDateConverted', label: 'Ngày chuẩn', width: 'min-w-[130px]' },
  { field: 'creatorName', label: 'Tên creator', width: 'min-w-[180px]' },
  { field: 'creatorUsername', label: 'Username', width: 'min-w-[150px]' },
  { field: 'billingAddress', label: 'Địa chỉ thanh toán', width: 'min-w-[280px]' },
  { field: 'totalAmountRaw', label: 'Số tiền gốc', width: 'min-w-[150px]' },
  { field: 'totalAmount', label: 'Số tiền chuẩn', width: 'min-w-[150px]', inputType: 'number', align: 'right' },
  { field: 'note', label: 'Ghi chú', width: 'min-w-[220px]' },
];

export default function ResultsTable({ data, onUpdate, onRemove }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Chưa có dữ liệu để kiểm tra</h3>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            Tải file PDF hoặc hình ảnh hóa đơn lên. Kết quả đọc sẽ xuất hiện tại đây để bạn rà soát trước khi tải Excel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
        <tr>
          <th className="w-14 whitespace-nowrap px-3 py-3 font-semibold">STT</th>
          <th className="min-w-[240px] whitespace-nowrap px-3 py-3 font-semibold">File</th>
          {columns.map((column) => (
            <th key={column.field} className={cn('whitespace-nowrap px-3 py-3 font-semibold', column.width)}>
              {column.label}
            </th>
          ))}
          <th className="min-w-[150px] whitespace-nowrap px-3 py-3 font-semibold">Trạng thái</th>
          <th className="min-w-[150px] whitespace-nowrap px-3 py-3 font-semibold">Cách đọc</th>
          <th className="w-14 px-3 py-3 text-center font-semibold">Xóa</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.map((row, index) => {
          const isSuccess = row.status === SUCCESS_STATUS;

          return (
            <tr key={row.id} className={cn('transition', isSuccess ? 'hover:bg-slate-50' : 'bg-amber-50/60 hover:bg-amber-50')}>
              <td className="px-3 py-3 text-xs font-medium text-slate-500">{String(index + 1).padStart(2, '0')}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {isSuccess ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className="max-w-[230px] truncate text-xs font-medium text-slate-700" title={row.fileName}>
                    {row.fileName}
                  </span>
                </div>
              </td>

              {columns.map((column) => (
                <td key={column.field} className="px-2 py-2">
                  <input
                    type={column.inputType || 'text'}
                    value={String(row[column.field] ?? '')}
                    onChange={(event) => onUpdate(row.id, column.field, event.target.value)}
                    className={cn(
                      'h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-xs text-slate-800 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100',
                      column.align === 'right' && 'text-right font-semibold tabular-nums',
                      column.field === 'note' && !isSuccess && 'text-amber-800',
                    )}
                  />
                </td>
              ))}

              <td className="px-3 py-2">
                <span
                  className={cn(
                    'inline-flex w-full items-center justify-center rounded-md px-2 py-1.5 text-xs font-semibold',
                    isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {row.status || 'Thiếu thông tin'}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">{row.readMethod || 'Chưa xác định'}</td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onRemove(row.id)}
                  className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                  title="Xóa dòng này"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
