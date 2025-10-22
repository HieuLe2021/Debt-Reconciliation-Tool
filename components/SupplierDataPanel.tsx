import React from 'react';
import type { ReconciliationRecord } from '../types';
import DataTable from './DataTable';
import Spinner from './Spinner';

interface SupplierDataPanelProps {
  onFilesSelected: (files: File[]) => void;
  onReadFile: () => void;
  onClear: () => void;
  onRemoveFile: (index: number) => void;
  onDateChange: (date: string | null) => void;
  uploadedFiles: File[];
  processedFiles: File[];
  extractedData: ReconciliationRecord[];
  isReadingFile: boolean;
  isReconciling: boolean;
  supplierDateRange: { start: string | null; end: string | null };
}

const SupplierDataPanel: React.FC<SupplierDataPanelProps> = (props) => {
  const totalItems = props.extractedData.reduce((acc, record) => {
    if (record.items && record.items.length > 0) {
      return acc + record.items.length;
    }
    return acc + 1;
  }, 0);

  const datePickerControl = props.extractedData.length > 0 ? (
    <div className="flex items-center text-sm">
      <label htmlFor="start-date-filter" className="font-semibold whitespace-nowrap text-gray-600 dark:text-muted-foreground">Ngày HD:</label>
      <input
        id="start-date-filter"
        type="date"
        value={props.supplierDateRange.start || ''}
        onChange={(e) => props.onDateChange(e.target.value || null)}
        className="ml-2 bg-white dark:bg-input border border-slate-300 dark:border-border rounded-md p-1.5 text-sm text-gray-700 dark:text-foreground focus:ring-2 focus:ring-ring focus:border-primary"
      />
    </div>
  ) : null;

  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-md p-6 flex flex-col lg:w-1/2 border dark:border-border">
      <h2 className="text-xl font-bold text-gray-800 dark:text-foreground mb-4 flex-shrink-0">1. Dữ liệu Nhà Cung Cấp (Tải lên)</h2>
      <div className="flex items-start space-x-4 flex-shrink-0 mb-4">
        <div className="flex-grow flex items-center flex-wrap gap-2">
          <label htmlFor="file-upload" className="cursor-pointer py-2 px-4 rounded-full border-0 text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 inline-block whitespace-nowrap">Chọn tệp</label>
          <input id="file-upload" type="file" onChange={(e) => e.target.files && props.onFilesSelected(Array.from(e.target.files))} accept=".xlsx,.xls,.pdf,image/*" multiple className="hidden" />
          {props.processedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center text-sm bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-300 pl-2 pr-3 py-1 rounded-full border border-green-200 dark:border-green-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={file.name}>{file.name}</span>
            </div>
          ))}
          {props.uploadedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center text-sm bg-slate-50 dark:bg-secondary pl-3 pr-1 py-1 rounded-full border border-slate-200 dark:border-border">
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={file.name}>{file.name}</span>
              <button onClick={() => props.onRemoveFile(index)} className="ml-2 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 text-xl font-light leading-none flex items-center justify-center h-5 w-5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" aria-label={`Remove ${file.name}`}>&times;</button>
            </div>
          ))}
        </div>
        <div className="flex space-x-2 flex-shrink-0">
          <button onClick={props.onReadFile} disabled={props.isReadingFile || props.uploadedFiles.length === 0} className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:bg-accent-hover disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200">
            {props.isReadingFile ? <Spinner /> : 'Đọc File'}
          </button>
          <button onClick={props.onClear} disabled={(props.extractedData.length === 0 && props.uploadedFiles.length === 0 && props.processedFiles.length === 0) || props.isReadingFile || props.isReconciling} className="flex items-center justify-center px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200">Xoá</button>
        </div>
      </div>

      <div className="mt-0 flex-grow min-h-0">
        <DataTable 
          title="Dữ liệu trích xuất" 
          data={props.extractedData} 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 20 20"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>} 
          totalCount={totalItems}
          headerControls={datePickerControl}
        />
      </div>
    </div>
  );
};

export default SupplierDataPanel;
