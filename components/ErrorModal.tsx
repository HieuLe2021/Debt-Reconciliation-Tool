import React from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  rawErrorData: string | null;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, rawErrorData, onClose }) => {
  if (!isOpen || !rawErrorData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b dark:border-border">
          <h3 className="text-lg font-bold text-gray-800 dark:text-foreground">Phản hồi Gốc từ AI</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-2xl font-bold leading-none" aria-label="Đóng">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
            Dưới đây là toàn bộ nội dung AI đã trả về. Dữ liệu này không hợp lệ (thường do lỗi cú pháp JSON như thiếu/thừa dấu ngoặc, dấu phẩy, hoặc chứa văn bản giải thích không mong muốn) và không thể được ứng dụng xử lý.
          </p>
          <pre className="bg-slate-100 dark:bg-secondary text-slate-800 dark:text-foreground text-sm p-4 rounded-md whitespace-pre-wrap break-all">
            <code>{rawErrorData}</code>
          </pre>
        </div>
        <div className="p-4 border-t dark:border-border text-right">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
