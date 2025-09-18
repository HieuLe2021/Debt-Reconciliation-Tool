
import React from 'react';
import type { ReconciliationResult } from '../types';

interface ReconciliationResultDisplayProps {
  result: ReconciliationResult;
  executionTime: number | null;
  onStartOver: () => void;
}

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')} VNĐ`;

const ReconciliationResultDisplay: React.FC<ReconciliationResultDisplayProps> = ({ result, executionTime, onStartOver }) => {
  const { totalSupplierAmount, totalSystemAmount, difference, comparedItems, summary } = result;

  // Filter out items that only exist in the system data
  const supplierCentricItems = comparedItems.filter(item => item.supplierItem !== null);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Khớp': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'Chênh lệch': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'Chỉ có ở NCC': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'Chỉ có ở Wecare': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-secondary dark:text-muted-foreground';
    }
  };
  
  return (
    <div className="absolute inset-0 bg-slate-200 dark:bg-background flex flex-col p-4 sm:p-6 lg:p-8">
        <div className="flex-shrink-0 flex justify-between items-center mb-4 bg-white dark:bg-card p-4 rounded-xl shadow-md">
            <div>
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-foreground">Kết Quả Đối Chiếu</h2>
                 {executionTime !== null && (
                    <span className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                        Hoàn thành sau <strong className="font-mono">{executionTime.toFixed(2)} giây</strong>
                    </span>
                 )}
            </div>
            <button
                onClick={onStartOver}
                className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
            >
                Thực hiện đối chiếu mới
            </button>
        </div>
        
        <div className="flex-shrink-0 bg-white dark:bg-card p-4 rounded-lg shadow mb-4">
            <h4 className="font-semibold text-gray-700 dark:text-muted-foreground mb-2">Tóm tắt từ AI:</h4>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">{summary || "AI không cung cấp tóm tắt."}</p>
        </div>

        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white dark:bg-card p-4 rounded-lg shadow">
                <p className="text-sm text-gray-500 dark:text-muted-foreground">Tổng NCC</p>
                <p className="text-xl font-bold text-gray-800 dark:text-foreground font-mono">{formatCurrency(totalSupplierAmount)}</p>
            </div>
            <div className="bg-white dark:bg-card p-4 rounded-lg shadow">
                <p className="text-sm text-gray-500 dark:text-muted-foreground">Tổng Wecare</p>
                <p className="text-xl font-bold text-gray-800 dark:text-foreground font-mono">{formatCurrency(totalSystemAmount)}</p>
            </div>
            <div className="bg-white dark:bg-card p-4 rounded-lg shadow">
                <p className="text-sm text-gray-500 dark:text-muted-foreground">Chênh lệch</p>
                <p className={`text-xl font-bold font-mono ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(difference)}</p>
            </div>
        </div>
        
        <div className="flex-grow bg-white dark:bg-card rounded-xl shadow-md p-4 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3 flex-shrink-0 px-2">
                <h3 className="text-xl font-bold text-gray-800 dark:text-foreground">
                    Chi Tiết Đối Chiếu ({supplierCentricItems.length} dòng)
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-muted-foreground">
                    <div className="flex items-center">
                        <span className="h-4 w-4 rounded-full bg-amber-400 mr-2 border border-amber-500"></span>
                        <span>Chứng từ NCC</span>
                    </div>
                    <div className="flex items-center">
                        <span className="h-4 w-4 rounded-full mr-2 border bg-[#3899B4] border-[#308099]"></span>
                        <span>Data Wecare</span>
                    </div>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-muted-foreground table-fixed">
                    <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase sticky top-0 bg-gray-50 dark:bg-secondary/50 z-10">
                        <tr>
                            <th scope="col" className="px-2 py-3 text-center align-middle w-[4%]">STT</th>
                            <th scope="col" className="px-4 py-3 align-middle w-[8%]">Trạng thái</th>
                            
                            <th scope="col" className="px-4 py-3 text-left bg-amber-200 dark:bg-amber-800/30 text-amber-900 dark:text-amber-200 font-semibold w-[20%]">Sản phẩm</th>
                            <th scope="col" className="px-4 py-3 text-right bg-amber-200 dark:bg-amber-800/30 text-amber-900 dark:text-amber-200 font-semibold w-[6%]">SL</th>
                            <th scope="col" className="px-4 py-3 text-right bg-amber-200 dark:bg-amber-800/30 text-amber-900 dark:text-amber-200 font-semibold w-[7%]">Đơn giá</th>
                            
                            <th scope="col" className="px-4 py-3 text-left text-white font-semibold w-[20%] bg-[#3899B4]">Sản phẩm</th>
                            <th scope="col" className="px-4 py-3 text-right text-white font-semibold w-[6%] bg-[#3899B4]">SL</th>
                            <th scope="col" className="px-4 py-3 text-right text-white font-semibold w-[7%] bg-[#3899B4]">Đơn giá</th>
                            
                            <th scope="col" className="px-4 py-3 align-middle w-[22%]">Ghi chú AI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {supplierCentricItems.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-10 text-gray-500 dark:text-muted-foreground">
                                Không có dữ liệu để hiển thị.
                                </td>
                            </tr>
                        ) : (
                            supplierCentricItems.map((item, index) => (
                                <tr key={index} className="border-b dark:border-border">
                                    <td className="px-2 py-2 text-center text-gray-500 dark:text-muted-foreground font-medium">{index + 1}</td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    {/* Supplier Data */}
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground bg-amber-50 dark:bg-amber-900/20 break-words">{item.supplierItem?.name || '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-amber-50 dark:bg-amber-900/20">{item.supplierItem?.quantity?.toLocaleString('vi-VN') ?? '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-amber-50 dark:bg-amber-900/20">{item.supplierItem?.unitPrice?.toLocaleString('vi-VN') ?? '-'}</td>
                                    
                                    {/* System Data */}
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground break-words bg-cyan-50 dark:bg-cyan-900/30">{item.systemItem?.name || '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-cyan-50 dark:bg-cyan-900/30">{item.systemItem?.quantity?.toLocaleString('vi-VN') ?? '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-cyan-50 dark:bg-cyan-900/30">{item.systemItem?.unitPrice?.toLocaleString('vi-VN') ?? '-'}</td>
                                    
                                    <td className="px-4 py-2 text-xs italic text-gray-500 dark:text-muted-foreground break-words">{item.details}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ReconciliationResultDisplay;
