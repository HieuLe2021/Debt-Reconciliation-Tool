import type { ReconciliationRecord, ProductItem, ExistingMapping, ComparedItem } from '../types';
import { ComparisonStatus } from '../types';

export const calculateValidDates = (data: ReconciliationRecord[]) => {
  return data
    .map(d => (d.date ? new Date(d.date) : null))
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
};

export const calculateDateRange = (validDates: Date[]) => {
  if (validDates.length === 0) return null;
  
  const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
  const startDate = new Date(maxDate);
  startDate.setDate(maxDate.getDate() - 10);
  const endDate = new Date(maxDate);
  endDate.setDate(maxDate.getDate() + 10);
  
  return {
    supplierDate: maxDate.toISOString().split('T')[0],
    systemStart: startDate.toISOString().split('T')[0],
    systemEnd: endDate.toISOString().split('T')[0],
  };
};

export const flattenSupplierItems = (data: ReconciliationRecord[]): ProductItem[] => {
  return data.flatMap(record =>
    (record.items && record.items.length > 0)
      ? record.items
      : [{ name: record.description, quantity: 1, unitPrice: record.amount, totalPrice: record.amount }]
  );
};

export const preprocessItemsWithMappings = (
  allSupplierItems: ProductItem[],
  allSystemItems: ProductItem[],
  existingMappings: ExistingMapping[]
) => {
  const mappingMap = new Map<string, string>(
    existingMappings.map(m => [m.crdfd_supplier_product_name.toLowerCase(), m.crdfd_product_name])
  );

  const preProcessedItems: ComparedItem[] = [];
  const itemsForAI_Supplier: ProductItem[] = [];
  const usedSystemItemIndices = new Set<number>();

  allSupplierItems.forEach(supplierItem => {
    const systemProductName = mappingMap.get(supplierItem.name.toLowerCase());
    if (systemProductName) {
      const systemItemIndex = allSystemItems.findIndex((sysItem, index) => 
        sysItem.name === systemProductName && !usedSystemItemIndices.has(index)
      );
      
      if (systemItemIndex !== -1) {
        usedSystemItemIndices.add(systemItemIndex);
        const systemItem = allSystemItems[systemItemIndex];
        const isMatched = supplierItem.quantity === systemItem.quantity && supplierItem.unitPrice === systemItem.unitPrice;
        preProcessedItems.push({
          status: isMatched ? ComparisonStatus.MATCHED : ComparisonStatus.DISCREPANCY,
          supplierItem,
          systemItem,
          details: isMatched ? '' : `Chênh lệch SL/ĐG. NCC: ${supplierItem.quantity} @ ${supplierItem.unitPrice}, Wecare: ${systemItem.quantity} @ ${systemItem.unitPrice}`
        });
      } else {
        preProcessedItems.push({
          status: ComparisonStatus.SUPPLIER_ONLY,
          supplierItem,
          systemItem: null,
          details: 'Sản phẩm đã được mapping nhưng không có trong dữ liệu Wecare kỳ này.'
        });
      }
    } else {
      itemsForAI_Supplier.push(supplierItem);
    }
  });

  const itemsForAI_System = allSystemItems.filter((_, index) => !usedSystemItemIndices.has(index));

  return { preProcessedItems, itemsForAI_Supplier, itemsForAI_System, usedSystemItemIndices };
};

export const findSkuMappings = (
  extractedData: ReconciliationRecord[],
  systemData: ReconciliationRecord[],
  existingMappings: ExistingMapping[]
) => {
  const systemItemsMap = new Map<string, ProductItem[]>();
  systemData.flatMap(rec => rec.items ?? []).forEach(item => {
    const key = `${item.quantity.toFixed(4)}-${item.unitPrice.toFixed(4)}`;
    if (!systemItemsMap.has(key)) {
      systemItemsMap.set(key, []);
    }
    systemItemsMap.get(key)!.push(item);
  });

  const supplierItems: ProductItem[] = flattenSupplierItems(extractedData);
  const mappings: Array<{ supplierItem: ProductItem; systemItem: ProductItem }> = [];
  const matchedSystemItems = new Set<ProductItem>();

  for (const supItem of supplierItems) {
    const key = `${supItem.quantity.toFixed(4)}-${supItem.unitPrice.toFixed(4)}`;
    const potentialMatches = systemItemsMap.get(key);
    if (potentialMatches) {
      const match = potentialMatches.find(sysItem => !matchedSystemItems.has(sysItem));
      if (match) {
        mappings.push({
          supplierItem: supItem,
          systemItem: match,
        });
        matchedSystemItems.add(match);
      }
    }
  }

  const newMappings = mappings.filter(potentialMapping => {
    return !existingMappings.some(existing => 
      existing.crdfd_product_name === potentialMapping.systemItem.name &&
      existing.crdfd_supplier_product_name === potentialMapping.supplierItem.name
    );
  });

  return newMappings;
};
