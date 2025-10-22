import React from 'react';

interface ErrorAlertProps {
  error: string;
  hasRawData: boolean;
  onViewDetails: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, hasRawData, onViewDetails }) => {
  return (
    <div className="bg-red-100 border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-700/60 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6 flex-shrink-0" role="alert">
      <div className="flex justify-between items-start">
        <div>
          <strong className="font-bold">Lỗi!</strong>
          <span className="block sm:inline ml-2 whitespace-pre-wrap">{error}</span>
        </div>
        {hasRawData && (
          <button
            onClick={onViewDetails}
            className="ml-4 flex-shrink-0 px-3 py-1 border border-red-500 hover:bg-red-200 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-800/50 text-sm font-semibold rounded-md transition-colors"
          >
            Xem chi tiết
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlert;
