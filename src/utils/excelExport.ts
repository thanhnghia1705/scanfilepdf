import { utils, writeFile } from 'xlsx';
import { ReceiptData } from '../types';

export function exportToExcel(data: ReceiptData[]) {

  const exportData = data.map((item, index) => {
    let numTotal: number | string = item.totalAmount || '';
    if (typeof numTotal === 'string') {
      const parsed = Number(numTotal);
      if (!isNaN(parsed)) numTotal = parsed;
    }
    
    return {
      'STT': index + 1,
      'File Name': item.fileName || '',
      'Receipt Number': item.receiptNumber || '',
      'Receipt Date': item.receiptDate || '',
      'Receipt Date Converted': item.receiptDateConverted || '',
      'Creator name': item.creatorName || '',
      'Creator Username': item.creatorUsername || '',
      'Billing Address': item.billingAddress || '',
      'Total Amount Raw': item.totalAmountRaw || '',
      'Total Amount': numTotal,
      'Read Method': item.readMethod || '',
      'Status': item.status || '',
      'Note': item.note || ''
    };
  });

  const worksheet = utils.json_to_sheet(exportData);
  
  // Format the Total Amount column (J) as number #,##0
  const range = utils.decode_range(worksheet['!ref'] || 'A1:A1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    const cell_address = utils.encode_cell({c: 9, r: R}); // J is index 9
    if(worksheet[cell_address]) {
      worksheet[cell_address].z = '#,##0';
    }
  }

  const workbook = utils.book_new();

  // Đặt chiều rộng cột tự động / hợp lý hơn
  worksheet['!cols'] = [
    { wch: 5 },  // STT
    { wch: 20 }, // File Name
    { wch: 25 }, // Receipt Number
    { wch: 15 }, // Receipt Date
    { wch: 20 }, // Receipt Date Converted
    { wch: 20 }, // Creator Name
    { wch: 15 }, // Creator Username
    { wch: 35 }, // Billing Address
    { wch: 15 }, // Total Amount Raw
    { wch: 15 }, // Total Amount
    { wch: 15 }, // Read Method
    { wch: 15 }, // Status
    { wch: 25 }  // Note
  ];

  utils.book_append_sheet(workbook, worksheet, 'Tong_hop_receipt');
  
  writeFile(workbook, 'tong_hop_hoa_don.xlsx');
}
