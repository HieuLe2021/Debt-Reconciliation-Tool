import React from 'react';
import type { ReconciliationResult } from '../types';

interface ReconciliationResultDisplayProps {
  result: ReconciliationResult;
  executionTime: number | null;
  onStartOver: () => void;
  supplierName: string;
}

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')} VNĐ`;

const ReconciliationResultDisplay: React.FC<ReconciliationResultDisplayProps> = ({ result, executionTime, onStartOver, supplierName }) => {
  const { totalSupplierAmount, totalSystemAmount, difference, comparedItems, summary } = result;

  // Display all items for a comprehensive view
  const itemsToDisplay = comparedItems;

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Khớp': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'Chênh lệch': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'Chỉ có ở NCC': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'Đang xử lý': return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-secondary dark:text-muted-foreground';
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'STT',
      'Sản phẩm (NCC)',
      'Số lượng (NCC)',
      'Đơn giá (NCC)',
      'Sản phẩm (Wecare)',
      'Số lượng (Wecare)',
      'Đơn giá (Wecare)',
      'Trạng thái',
      'Ghi chú'
    ];

    const escapeCSV = (str: string | number | null | undefined): string => {
      const s = str === null || str === undefined ? '' : String(str);
      // Wrap in quotes if it contains a comma, a quote, or a newline
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return `"${s}"`; // Always wrap to be safe
    };
    
    // Export all items, not just the supplier-centric view for completeness
    const csvRows = [headers.join(',')];
    comparedItems.forEach((item, index) => {
      const row = [
        index + 1,
        item.supplierItem?.name,
        item.supplierItem?.quantity,
        item.supplierItem?.unitPrice,
        item.systemItem?.name,
        item.systemItem?.quantity,
        item.systemItem?.unitPrice,
        item.status,
        item.details
      ].map(escapeCSV).join(',');
      csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    // Add BOM for Excel to recognize UTF-8 characters correctly
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const sanitizedSupplierName = supplierName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('href', url);
      link.setAttribute('download', `doi-chieu_${sanitizedSupplierName}_${date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
            <div className="flex items-center gap-4">
                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Xuất CSV</span>
                </button>
                <button
                    onClick={onStartOver}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg shadow-md hover:bg-accent-hover transition-colors"
                >
                    Thực hiện đối chiếu mới
                </button>
            </div>
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
                <p className="text-sm text-gray-500 dark:text-muted-foreground">Tổng Wecare (đã khớp)</p>
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
                    Chi Tiết Đối Chiếu ({itemsToDisplay.length} dòng)
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-muted-foreground">
                    <div className="flex items-center">
                        <span className="h-4 w-4 rounded-full bg-amber-400 mr-2 border border-amber-500"></span>
                        <span>Chứng từ NCC</span>
                    </div>
                    <div className="flex items-center">
                        <span className="h-4 w-4 rounded-full mr-2 border bg-primary border-primary/80"></span>
                        <span>Data Wecare</span>
                    </div>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-muted-foreground table-fixed">
                    <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase sticky top-0 bg-gray-50 dark:bg-secondary/50 z-10">
                        <tr>
                            <th scope="col" className="px-2 py-3 text-center align-middle w-[4%]">STT</th>
                            
                            <th scope="col" className="px-4 py-3 text-left bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-300 font-semibold w-[20%]">Sản phẩm</th>
                            <th scope="col" className="px-4 py-3 text-right bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-300 font-semibold w-[6%]">SL</th>
                            <th scope="col" className="px-4 py-3 text-right bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-300 font-semibold w-[7%]">Đơn giá</th>
                            
                            <th scope="col" className="px-4 py-3 text-left font-semibold w-[20%] bg-primary text-primary-foreground">Sản phẩm</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold w-[6%] bg-primary text-primary-foreground">SL</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold w-[7%] bg-primary text-primary-foreground">Đơn giá</th>
                            
                            <th scope="col" className="px-4 py-3 align-middle w-[8%]">Trạng thái</th>
                            <th scope="col" className="px-4 py-3 align-middle w-[22%]">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsToDisplay.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-10 text-gray-500 dark:text-muted-foreground">
                                Không có dữ liệu để hiển thị.
                                </td>
                            </tr>
                        ) : (
                            itemsToDisplay.map((item, index) => (
                                <tr key={index} className="border-b dark:border-border">
                                    <td className="px-2 py-2 text-center text-gray-500 dark:text-muted-foreground font-medium">{index + 1}</td>

                                    {/* Supplier Data */}
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground bg-amber-50 dark:bg-amber-900/40 break-words">{item.supplierItem?.name || '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-amber-50 dark:bg-amber-900/40">{item.supplierItem?.quantity?.toLocaleString('vi-VN') ?? '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-amber-50 dark:bg-amber-900/40">{item.supplierItem?.unitPrice?.toLocaleString('vi-VN') ?? '-'}</td>
                                    
                                    {/* System Data */}
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground break-words bg-blue-50 dark:bg-primary/10">{item.systemItem?.name || '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-blue-50 dark:bg-primary/10">{item.systemItem?.quantity?.toLocaleString('vi-VN') ?? '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono bg-blue-50 dark:bg-primary/10">{item.systemItem?.unitPrice?.toLocaleString('vi-VN') ?? '-'}</td>
                                    
                                    <td className="px-4 py-2">
                                        <span className={`inline-flex items-center justify-center w-full px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(item.status)}`}>
                                            {item.status === 'Đang xử lý' ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    {item.status}
                                                </>
                                            ) : (
                                                item.status
                                            )}
                                        </span>
                                    </td>
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