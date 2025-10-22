import React, { useState, useEffect } from 'react';
import type { ReconciliationRecord } from '../types';
import DataTable from './DataTable';

interface SystemDataPanelProps {
  isFetching: boolean;
  data: ReconciliationRecord[];
  filterRange: { start: string | null; end: string | null };
  onFilterChange: (newRange: { start: string; end: string }) => void;
  canFilter: boolean;
}

const SystemDataPanel: React.FC<SystemDataPanelProps> = ({ isFetching, data, filterRange, onFilterChange, canFilter }) => {
  const [localRange, setLocalRange] = useState({ start: '', end: '' });

  useEffect(() => {
    setLocalRange({
      start: filterRange.start || '',
      end: filterRange.end || '',
    });
  }, [filterRange]);
  
  const handleFilter = () => {
    if (localRange.start && localRange.end) {
      onFilterChange(localRange);
    }
  };

  const totalItems = data.reduce((acc, record) => {
    if (record.items && record.items.length > 0) {
      return acc + record.items.length;
    }
    return acc + 1; // Assuming a record without items is a single line
  }, 0);

  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-md p-6 flex flex-col lg:w-1/2 border dark:border-border">
      <div className="flex justify-between items-center mb-4 flex-shrink-0 flex-wrap gap-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">2. Dữ liệu trên Wecare</h2>
         <div className="flex items-center gap-2">
            <input
              type="date"
              value={localRange.start}
              onChange={(e) => setLocalRange(prev => ({...prev, start: e.target.value}))}
              disabled={!canFilter || isFetching}
              className="bg-white dark:bg-input border border-slate-300 dark:border-border rounded-md p-1.5 text-sm text-gray-700 dark:text-foreground focus:ring-2 focus:ring-ring focus:border-primary disabled:opacity-50"
              aria-label="Từ ngày"
            />
            <span className="text-gray-500 dark:text-muted-foreground">-</span>
            <input
              type="date"
              value={localRange.end}
              onChange={(e) => setLocalRange(prev => ({...prev, end: e.target.value}))}
              disabled={!canFilter || isFetching}
              className="bg-white dark:bg-input border border-slate-300 dark:border-border rounded-md p-1.5 text-sm text-gray-700 dark:text-foreground focus:ring-2 focus:ring-ring focus:border-primary disabled:opacity-50"
              aria-label="Đến ngày"
            />
            <button 
              onClick={handleFilter} 
              disabled={!canFilter || isFetching || !localRange.start || !localRange.end}
              className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg shadow-sm hover:bg-accent-hover disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              Lọc
            </button>
          </div>
      </div>
      <div className="flex-grow min-h-0">
        {isFetching ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-3 text-slate-500 dark:text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : (
          <DataTable 
            title="Lịch sử mua hàng"
            data={data} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 20 20"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>}
            totalCount={totalItems}
          />
        )}
      </div>
    </div>
  );
};

export default SystemDataPanel;