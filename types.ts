export interface ProductItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface ReconciliationRecord {
  id: string;
  date?: string;
  description: string;
  amount: number;
  items?: ProductItem[];
}

export enum ComparisonStatus {
  MATCHED = 'Khớp',
  DISCREPANCY = 'Chênh lệch',
  SUPPLIER_ONLY = 'Chỉ có ở NCC',
  PROCESSING = 'Đang xử lý',
}

export interface ComparedItem {
  status: ComparisonStatus;
  supplierItem: ProductItem | null;
  systemItem: ProductItem | null;
  details: string;
}

export interface ReconciliationResult {
  summary: string;
  totalSupplierAmount: number;
  totalSystemAmount: number;
  difference: number;
  comparedItems: ComparedItem[];
}

export interface ExistingMapping {
  crdfd_product_name: string;
  crdfd_supplier_product_name: string;
  crdfd_supplier: string;
}