declare var XLSX: any;

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

export interface ExistingMapping {
  crdfd_product_name: string;
  crdfd_supplier_product_name: string;
  crdfd_supplier: string;
}

// FIX: Add missing types for the reconciliation result display component.
export interface ComparedItem {
  supplierItem?: ProductItem | null;
  systemItem?: ProductItem | null;
  status: string;
  details: string;
}

export interface ReconciliationResult {
  totalSupplierAmount: number;
  totalSystemAmount: number;
  difference: number;
  comparedItems: ComparedItem[];
  summary: string;
}