import React, { useState, useEffect } from 'react';
import type { ProductItem } from '../types';
import Spinner from './Spinner';

interface SkuMapping {
  supplierItem: ProductItem;
  systemItem: ProductItem;
}

interface SkuMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: SkuMapping[];
  onSave: (mappingsToSave: SkuMapping[]) => Promise<{success: boolean, error?: string}>;
  supplierName: string;
}

const SkuMappingModal: React.FC<SkuMappingModalProps> = ({
  isOpen,
  onClose,
  mappings,
  onSave,
  supplierName,
}) => {
  const [currentMappings, setCurrentMappings] = useState<SkuMapping[]>([]);
  const [isSavingSingle, setIsSavingSingle] = useState<number | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset local state when the modal is opened with new mappings
    if (isOpen) {
      setCurrentMappings(mappings);
      setError(null);
    }
  }, [isOpen, mappings]);

  if (!isOpen) {
    return null;
  }

  const handleSaveOne = async (mapping: SkuMapping, index: number) => {
    setError(null);
    setIsSavingSingle(index);
    const result = await onSave([mapping]);
    if (result.success) {
      setCurrentMappings(prev => prev.filter((_, i) => i !== index));
    } else {
        setError(result.error || 'Đã xảy ra lỗi không xác định.');
    }
    setIsSavingSingle(null);
  };

  const handleSaveAll = async () => {
    if (currentMappings.length === 0) return;
    setError(null);
    setIsSavingAll(true);
    try {
      const result = await onSave(currentMappings);
      if (result.success) {
        // Clear the list and perhaps close the modal after a short delay
        setCurrentMappings([]);
        setTimeout(onClose, 1000); // Close after 1s to show the empty state
      } else {
          setError(result.error || 'Đã xảy ra lỗi không xác định.');
      }
    } finally {
        setIsSavingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-card rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b dark:border-border flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-foreground">
            SKU Mapping: <span className="text-primary">{supplierName}</span>
          </h3>
          <button onClick={onClose} disabled={isSavingAll || isSavingSingle !== null} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50 text-2xl font-bold leading-none" aria-label="Đóng">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto flex-grow">
          <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
            Danh sách các sản phẩm khớp về <strong className="font-semibold">Số lượng</strong> và <strong className="font-semibold">Đơn giá</strong> giữa chứng từ NCC và dữ liệu Wecare. Bấm Lưu để tạo liên kết cho các lần đối chiếu sau.
          </p>
          <div className="border dark:border-border rounded-lg">
            <table className="w-full text-sm text-left text-gray-600 dark:text-muted-foreground">
              <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-secondary/80 sticky top-0">
                <tr>
                  <th scope="col" className="px-4 py-3 w-2/5">Sản phẩm (NCC)</th>
                  <th scope="col" className="px-4 py-3 w-2/5">Sản phẩm (Wecare)</th>
                  <th scope="col" className="px-4 py-3 text-right">Số lượng</th>
                  <th scope="col" className="px-4 py-3 text-right">Đơn giá</th>
                  <th scope="col" className="px-4 py-3 text-center">Lưu</th>
                </tr>
              </thead>
              <tbody>
                {currentMappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-muted-foreground">
                      {mappings.length > 0 ? 'Tất cả các mapping đã được lưu.' : 'Không tìm thấy sản phẩm nào khớp.'}
                    </td>
                  </tr>
                ) : (
                  currentMappings.map((item, index) => (
                    <tr key={`${item.supplierItem.name}-${index}`} className="border-b dark:border-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-secondary/60">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground">{item.supplierItem.name}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-foreground">{item.systemItem.name}</td>
                      <td className="px-4 py-2 text-right font-mono">{item.supplierItem.quantity.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-2 text-right font-mono">{item.supplierItem.unitPrice.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleSaveOne(item, index)}
                          disabled={isSavingAll || isSavingSingle !== null}
                          className="text-green-600 hover:text-green-800 disabled:text-gray-400 dark:disabled:text-gray-600 p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900/50"
                          aria-label="Lưu mapping này"
                        >
                          {isSavingSingle === index ? <Spinner/> : (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 2a5 5 0 00-5 5v3H4a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H7V7a3 3 0 013-3z" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t dark:border-border flex-shrink-0 flex justify-end items-center gap-4">
          <div className="flex-grow text-left text-sm text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
          <button onClick={onClose} disabled={isSavingAll || isSavingSingle !== null} className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-secondary dark:text-secondary-foreground font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-secondary/80 disabled:opacity-50 transition-colors">
            Đóng
          </button>
          <button 
            onClick={handleSaveAll} 
            disabled={isSavingAll || isSavingSingle !== null || currentMappings.length === 0}
            className="flex items-center justify-center min-w-[120px] px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:bg-accent-hover disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSavingAll ? <><Spinner /> <span className="ml-2">Đang lưu...</span></> : `Lưu tất cả (${currentMappings.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkuMappingModal;