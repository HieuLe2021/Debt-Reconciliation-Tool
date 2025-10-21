import React from 'react';
import type { ReconciliationRecord } from '../types';

interface DataTableProps {
  title: string;
  data: ReconciliationRecord[];
  icon: React.ReactNode;
  totalCount?: number;
  headerControls?: React.ReactNode;
}

const DataTable: React.FC<DataTableProps> = ({ title, data, icon, totalCount, headerControls }) => {
  // Create a flattened list of all items for rendering
  const allItems = data.flatMap(record => {
    if (record.items && record.items.length > 0) {
      return record.items.map(item => ({
        key: `${record.id}-${item.name}`,
        date: record.date || '-',
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }));
    }
    // This handles records that are already single line items (like from system data)
    // or records without detailed items.
    return [{
      key: record.id,
      date: record.date || '-',
      productName: record.description,
      quantity: null,
      unitPrice: null,
      totalPrice: record.amount,
    }];
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center">
            {icon}
            <h3 className="text-xl font-bold text-gray-800 dark:text-foreground ml-3">{title}</h3>
        </div>
        <div className="flex items-center gap-4">
            {headerControls}
            {totalCount !== undefined && totalCount > 0 && (
                <div className="font-semibold text-sm text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/80 px-3 py-1 rounded-lg whitespace-nowrap">
                    Tổng số: {totalCount} dòng
                </div>
            )}
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-muted-foreground">
          <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-secondary/80 sticky top-0">
            <tr>
              <th scope="col" className="px-4 py-3">Ngày</th>
              <th scope="col" className="px-4 py-3">Sản phẩm</th>
              <th scope="col" className="px-4 py-3 text-right">Số lượng</th>
              <th scope="col" className="px-4 py-3 text-right">Đơn giá</th>
              <th scope="col" className="px-4 py-3 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {allItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              allItems.map((item) => (
                <tr key={item.key} className="border-b dark:border-border hover:bg-gray-50 dark:hover:bg-secondary/60">
                  <td className="px-4 py-2">{item.date}</td>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground">{item.productName}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {item.quantity !== null ? item.quantity.toLocaleString('vi-VN') : '-'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                     {item.unitPrice !== null ? item.unitPrice.toLocaleString('vi-VN') : '-'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{item.totalPrice.toLocaleString('vi-VN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;