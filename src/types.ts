export interface ReceiptData {
  id: string; // for internal mapping
  fileName: string;
  receiptNumber: string;
  receiptDate: string;
  receiptDateConverted: string;
  creatorName: string;
  creatorUsername: string;
  billingAddress: string;
  totalAmountRaw: string;
  totalAmount: number | string;
  readMethod: string;
  status: string;
  note: string;
}
