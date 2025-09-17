
import React from 'react';
import type { ReconciliationRecord } from '../types';

interface DataTableProps {
  title: string;
  data: ReconciliationRecord[];
  icon: React.ReactNode;
}

const DataTable: React.FC<DataTableProps> = ({ title, data, icon }) => {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  // Create a flattened list of all items for rendering
  const allItems = data.flatMap(record => {
    if (record.items && record.items.length > 0) {
      return record.items.map(item => ({
        key: `${record.id}-${item.name}`,
        date: record.date,
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
      date: record.date,
      productName: record.description,
      quantity: null,
      unitPrice: null,
      totalPrice: record.amount,
    }];
  });

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-full flex flex-col">
      <div className="flex items-center mb-4">
        {icon}
        <h3 className="text-xl font-bold text-gray-800 ml-3">{title}</h3>
      </div>
      <div className="flex-grow overflow-y-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
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
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              allItems.map((item) => (
                <tr key={item.key} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{item.date}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{item.productName}</td>
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
      <div className="mt-4 pt-4 border-t-2 border-gray-200 flex justify-end items-baseline">
        <span className="text-base font-bold text-gray-700">Tổng cộng:</span>
        <span className="text-2xl font-bold text-[#04A1B3] ml-4 font-mono">
          {totalAmount.toLocaleString('vi-VN')} VNĐ
        </span>
      </div>
    </div>
  );
};

export default DataTable;