import writeXlsxFile, { type Row } from 'write-excel-file/browser';
import { ReceiptData } from '../types';

const headers = [
  'STT',
  'Tên file',
  'Số hóa đơn',
  'Ngày hóa đơn gốc',
  'Ngày hóa đơn chuẩn',
  'Tên creator/người nhận',
  'Username',
  'Địa chỉ thanh toán',
  'Tổng tiền gốc',
  'Tổng tiền chuẩn',
  'Cách đọc',
  'Trạng thái',
  'Ghi chú',
];

function toNumber(value: number | string): number | undefined {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildFileName() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `tong_hop_hoa_don_${yyyy}${mm}${dd}.xlsx`;
}

function createHeaderRow(): Row {
  return headers.map((header) => ({
    value: header,
    fontWeight: 'bold',
    backgroundColor: '#E2E8F0',
    color: '#0F172A',
    align: 'center',
  }));
}

function createDataRow(item: ReceiptData, index: number): Row {
  const totalAmount = toNumber(item.totalAmount);

  return [
    index + 1,
    item.fileName || '',
    item.receiptNumber || '',
    item.receiptDate || '',
    item.receiptDateConverted || '',
    item.creatorName || '',
    item.creatorUsername || '',
    item.billingAddress || '',
    item.totalAmountRaw || '',
    totalAmount === undefined
      ? ''
      : {
          value: totalAmount,
          type: Number,
          format: '#,##0',
        },
    item.readMethod || '',
    item.status || '',
    item.note || '',
  ];
}

export async function exportToExcel(data: ReceiptData[]) {
  const rows: Row[] = [createHeaderRow(), ...data.map(createDataRow)];

  const blob = await writeXlsxFile(rows, {
    sheet: 'Tong_hop_hoa_don',
    columns: [
      { width: 6 },
      { width: 28 },
      { width: 24 },
      { width: 18 },
      { width: 18 },
      { width: 26 },
      { width: 18 },
      { width: 42 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 36 },
    ],
    stickyRowsCount: 1,
  }).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName();
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return link.download;
}
