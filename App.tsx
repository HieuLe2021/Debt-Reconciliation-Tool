import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Supplier, ReconciliationRecord, ReconciliationResult, ProductItem, ExistingMapping, ComparedItem } from './types';
import { POWER_AUTOMATE_URL, DYNAMICS_API_BASE_URL } from './constants';
import { extractDataFromFile, reconcileData, GeminiParseError } from './services/geminiService';
import DataTable from './components/DataTable';
import Spinner from './components/Spinner';
import ReconciliationResultDisplay from './components/ReconciliationResultDisplay';
import SkuMappingModal from './components/SkuMappingModal';
import { ComparisonStatus } from './types';
import FeedbackModal from './components/FeedbackModal';


// --- Helper Functions ---
const getApiErrorMessage = async (response: Response): Promise<string> => {
  if (response.status === 401) {
    return 'Lỗi xác thực (401). Token của bạn có thể đã hết hạn. Vui lòng làm mới trang và thử lại.';
  }
  try {
    const body = await response.json();
    const message = body?.error?.message;
    if (typeof message === 'string') {
      return message;
    }
  } catch (e) {
    // Response body is not JSON or is malformed, ignore and use statusText.
  }
  return response.statusText || `Request failed with status ${response.status}`;
};

interface SkuMapping {
  supplierItem: ProductItem;
  systemItem: ProductItem;
}


// --- Local UI Components for better structure ---

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-offset-background dark:focus:ring-offset-card"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  );
};

const AppHeader: React.FC<{
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierChange: (id: string) => void;
  isLoading: boolean;
  onOpenFeedback: () => void;
}> = ({ suppliers, selectedSupplierId, onSupplierChange, isLoading, onOpenFeedback }) => {
  const [inputText, setInputText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = suppliers.find(s => s.id === selectedSupplierId);
    setInputText(selected ? selected.name : '');
  }, [selectedSupplierId, suppliers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        const selected = suppliers.find(s => s.id === selectedSupplierId);
        setInputText(selected ? selected.name : '');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedSupplierId, suppliers]);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(inputText.toLowerCase())
  );

  return (
    <header className="bg-white dark:bg-card dark:border-b dark:border-border shadow-sm flex-shrink-0">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-primary">Đối Chiếu Công Nợ Phải Trả</h1>
        <div className="flex items-center gap-2">
            <div className="relative w-full md:w-80" ref={dropdownRef}>
            <input
                type="text"
                value={inputText}
                onChange={(e) => {
                setInputText(e.target.value);
                if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={isLoading ? 'Đang tải NCC...' : 'Tìm kiếm và chọn NCC...'}
                className="w-full bg-slate-50 dark:bg-input border border-slate-300 dark:border-border text-slate-900 dark:text-foreground text-sm rounded-lg focus:ring-2 focus:ring-primary focus:border-primary block p-2.5"
                disabled={isLoading}
            />
            {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-card rounded-md shadow-lg max-h-60 overflow-auto border border-slate-200 dark:border-border">
                {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map(s => (
                    <div
                        key={s.id}
                        onClick={() => {
                        onSupplierChange(s.id);
                        setIsDropdownOpen(false);
                        }}
                        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-primary/20 p-2.5 text-sm"
                    >
                        {s.name}
                    </div>
                    ))
                ) : (
                    <div className="p-2.5 text-sm text-slate-500 dark:text-muted-foreground">Không tìm thấy nhà cung cấp.</div>
                )}
                </div>
            )}
            </div>
            <button
                onClick={onOpenFeedback}
                className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-offset-background dark:focus:ring-offset-card"
                aria-label="Gửi phản hồi"
                title="Gửi phản hồi"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </button>
            <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

const SupplierDataPanel: React.FC<{
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
}> = (props) => {
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
    <div className="bg-white dark:bg-card rounded-xl shadow-md p-6 flex flex-col w-1/2 border dark:border-border">
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

const SystemDataPanel: React.FC<{
  isFetching: boolean;
  data: ReconciliationRecord[];
  supplierDateRange: { start: string | null; end: string | null };
}> = ({ isFetching, data, supplierDateRange }) => {
  const totalItems = data.reduce((acc, record) => {
    if (record.items && record.items.length > 0) {
      return acc + record.items.length;
    }
    return acc + 1; // Assuming a record without items is a single line
  }, 0);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Prevent local timezone from shifting the date
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateString; // Fallback
    }
  };

  let title = '2. Dữ liệu trên Wecare';
    if (supplierDateRange.start) {
        title = `Dữ liệu Wecare (Ngày HĐ ${formatDate(supplierDateRange.start)} ±10 ngày)`;
    }


  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-md p-6 flex flex-col w-1/2 border dark:border-border">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">{title}</h2>
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

// --- Main App Component ---

const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ReconciliationRecord[]>([]);
  const [systemData, setSystemData] = useState<ReconciliationRecord[]>([]);
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [reconciliationTime, setReconciliationTime] = useState<number | null>(null);
  const [supplierDateRange, setSupplierDateRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });

  const [isSkuMappingModalOpen, setIsSkuMappingModalOpen] = useState(false);
  const [skuMappingsToShow, setSkuMappingsToShow] = useState<SkuMapping[]>([]);
  const [existingMappings, setExistingMappings] = useState<ExistingMapping[]>([]);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState({ suppliers: true, systemData: false, readingFile: false, reconciling: false, existingMappings: false });
  
  const [error, setError] = useState<string | null>(null);
  const [rawErrorData, setRawErrorData] = useState<string | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const setErrorMessage = (message: string | null) => {
    setError(message);
    if (message === null) {
      setRawErrorData(null);
    }
  }

  const fetchAccessToken = useCallback(async () => {
    try {
      const response = await fetch(POWER_AUTOMATE_URL, { method: 'POST' });
      if (!response.ok) throw new Error(`Lỗi khi lấy access token: ${response.status}`);
      const textResponse = await response.text();
      
      let token: string | null = null;
      try {
        const json = JSON.parse(textResponse);
        token = json.access_token;
      } catch (e) {
        if (textResponse.trim().startsWith('ey')) {
          token = textResponse.trim();
        }
      }

      if (!token) {
        throw new Error('Phản hồi không chứa access token hợp lệ.');
      }
      setAccessToken(token);
    } catch (err: any) {
      setErrorMessage(err.message.includes('Failed to fetch') ? 'Lỗi Mạng: Không thể kết nối đến Power Automate để lấy token. Vui lòng kiểm tra cấu hình CORS.' : (err.message || 'Không thể lấy token xác thực.'));
      setIsLoading(prev => ({ ...prev, suppliers: false }));
    }
  }, []);

  const fetchSuppliers = useCallback(async (token: string) => {
    try {
      const filter = `$filter=statecode eq 0 and crdfd_suppliername ne null and crdfd_nhacungcap eq true and crdfd_loaioituong eq 191920000`;
      const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_suppliers?$select=crdfd_supplierid,crdfd_suppliername&${filter}&$orderby=createdon desc`;
      const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Lỗi khi tải danh sách NCC: ${await getApiErrorMessage(response)}`);
      const result = await response.json();
      if (!Array.isArray(result.value)) throw new Error('Dữ liệu NCC trả về không đúng định dạng.');
      const mappedSuppliers: Supplier[] = result.value.map((s: any) => ({ id: s.crdfd_supplierid, name: s.crdfd_suppliername }));
      setSuppliers(mappedSuppliers);
      if (mappedSuppliers.length > 0) setSelectedSupplierId(mappedSuppliers[0].id);
    } catch (err: any)
      {
      setErrorMessage(err.message.includes('Failed to fetch') ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM để tải NCC. Vui lòng kiểm tra cấu hình CORS.' : (err.message || 'Không thể tải danh sách nhà cung cấp.'));
    } finally {
      setIsLoading(prev => ({ ...prev, suppliers: false }));
    }
  }, []);

  const fetchSystemData = useCallback(async (supplierId: string, dateRange: {start: string | null}) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!accessToken || !supplier) { 
        setSystemData([]); 
        return; 
    }
    
    // Do not fetch data if there's no valid start date from the invoice.
    if (!dateRange.start) {
        setSystemData([]);
        return;
    }

    setIsLoading(prev => ({ ...prev, systemData: true }));
    setErrorMessage(null);
    setReconciliationResult(null);

    try {
        const centerDate = new Date(dateRange.start);
        
        const startDate = new Date(centerDate);
        startDate.setDate(centerDate.getDate() - 10);
        const startDateString = startDate.toISOString().split('T')[0];

        const endDate = new Date(centerDate);
        endDate.setDate(centerDate.getDate() + 10);
        const endDateString = endDate.toISOString().split('T')[0];

        const filters = [
            `cr44a_tenoituong eq '${supplier.name.replace(/'/g, "''")}'`,
            `createdon ge ${startDateString}T00:00:00Z`,
            `createdon le ${endDateString}T23:59:59Z`
        ];
        
        const filterQuery = `$filter=${filters.join(' and ')}`;
        const selectQuery = `$select=cr44a_ongia,cr44a_vtay,cr44a_tenhangcal,createdon,cr44a_soluongmua,cr44a_ngayhachtoan`;
        const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/cr44a_muahangchitiets?${selectQuery}&${filterQuery}`;
        
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error(`Lỗi tải dữ liệu hệ thống: ${await getApiErrorMessage(response)}`);
        
        const result = (await response.json());
        const records = result.value;
        if (!Array.isArray(records)) {
            setSystemData([]);
            return;
        }

        const mappedData: ReconciliationRecord[] = records.map((item: any) => {
            const date = item.cr44a_ngayhachtoan ? (item.cr44a_ngayhachtoan).split('T')[0] : (item.createdon).split('T')[0];
            const quantity = parseFloat(item.cr44a_soluongmua) || 0;
            const unitPrice = parseFloat(item.cr44a_ongia) || 0;
            const totalPrice = quantity * unitPrice;
            const name = item.cr44a_tenhangcal || 'N/A';
            return {
                id: crypto.randomUUID(),
                date,
                amount: totalPrice,
                description: name,
                items: [{ name, quantity, unitPrice, totalPrice }],
            };
        });
        setSystemData(mappedData);
    } catch (err: any) {
        setErrorMessage(err.message.includes('Failed to fetch') ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM. Vui lòng kiểm tra cấu hình CORS.' : (err.message || "Lỗi khi tải dữ liệu từ hệ thống."));
        setSystemData([]);
    } finally {
        setIsLoading(prev => ({ ...prev, systemData: false }));
    }
}, [accessToken, suppliers]);

  const fetchExistingMappings = useCallback(async (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!accessToken || !supplier) {
      setExistingMappings([]);
      return;
    }
  
    setIsLoading(prev => ({ ...prev, existingMappings: true }));
    setErrorMessage(null); // Clear previous errors on new fetch
    try {
      const supplierName = supplier.name.replace(/'/g, "''");
      const filter = `$filter=crdfd_supplier eq '${supplierName}'`;
      const select = `$select=crdfd_product_name,crdfd_supplier_product_name,crdfd_supplier`;
      const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_mapping_sku_2025s?${select}&${filter}`;
  
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
  
      if (!response.ok) {
        // Throw a detailed error to be caught below
        throw new Error(`Không thể tải mapping đã có: ${await getApiErrorMessage(response)}`);
      }
  
      const result = await response.json();
      if (result.value && Array.isArray(result.value)) {
        setExistingMappings(result.value);
      }
    } catch (err: any) {
      // Set a user-friendly error message in the UI
      setErrorMessage(
        err.message.includes('Failed to fetch')
          ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM để tải mapping. Vui lòng kiểm tra cấu hình CORS.'
          : (err.message || "Lỗi khi tải các mapping đã có.")
      );
      setExistingMappings([]);
    } finally {
      setIsLoading(prev => ({ ...prev, existingMappings: false }));
    }
  }, [accessToken, suppliers]);


  // --- Effect Chain ---
  useEffect(() => { fetchAccessToken(); }, [fetchAccessToken]);
  useEffect(() => { if (accessToken) fetchSuppliers(accessToken); }, [accessToken, fetchSuppliers]);
  useEffect(() => { 
    if (selectedSupplierId && accessToken) {
      fetchSystemData(selectedSupplierId, supplierDateRange); 
      fetchExistingMappings(selectedSupplierId);
    }
  }, [selectedSupplierId, supplierDateRange, fetchSystemData, fetchExistingMappings, accessToken]);

  const handleFileChange = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
    setReconciliationResult(null);
    setErrorMessage(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleReadFile = async () => {
    if (uploadedFiles.length === 0) return;
    setIsLoading(prev => ({ ...prev, readingFile: true }));
    setErrorMessage(null);

    const results = await Promise.allSettled(uploadedFiles.map(extractDataFromFile));
    const successfulData: ReconciliationRecord[] = [];
    const errorMessages: string[] = [];
    let firstRawError: string | null = null;

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        successfulData.push(...result.value);
      } else {
        const reason = result.reason as Error;
        errorMessages.push(`Tệp "${uploadedFiles[i].name}": ${reason.message}`);
        if (reason instanceof GeminiParseError && !firstRawError) {
          firstRawError = reason.rawResponse;
        }
      }
    });
    
    if (errorMessages.length > 0) {
      setError(errorMessages.join('\n'));
      if(firstRawError) {
        setRawErrorData(firstRawError);
      }
    }

    if (successfulData.length > 0) {
      const combinedData = [...extractedData, ...successfulData];
      setExtractedData(combinedData);
      
      const validDates = combinedData
        .map(d => (d.date ? new Date(d.date) : null))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

      if (validDates.length > 0) {
        // Instead of a range, pick the most recent date from the uploaded documents
        // as the primary invoice date for comparison.
        const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
        
        setSupplierDateRange({ 
            start: maxDate.toISOString().split('T')[0],
            end: null, // End date is no longer used for fetching system data
        });
      } else {
        setSupplierDateRange({ start: null, end: null });
      }
    }
    
    setProcessedFiles(prev => [...prev, ...uploadedFiles]);
    setUploadedFiles([]);
    setIsLoading(prev => ({ ...prev, readingFile: false }));
  };

  const handleClear = () => {
    setExtractedData([]);
    setUploadedFiles([]);
    setProcessedFiles([]);
    setReconciliationResult(null);
    setErrorMessage(null);
    setSupplierDateRange({ start: null, end: null });
    setReconciliationTime(null);
  };
  
  const handleReconcile = async () => {
    if (extractedData.length === 0) return;
    setIsLoading(prev => ({ ...prev, reconciling: true }));
    setErrorMessage(null);
    setReconciliationTime(null);
    const startTime = performance.now();

    try {
        // 1. Flatten data and create a case-insensitive lookup map for existing mappings.
        const allSupplierItems = extractedData.flatMap(record =>
            (record.items && record.items.length > 0)
            ? record.items
            : [{ name: record.description, quantity: 1, unitPrice: record.amount, totalPrice: record.amount }]
        );
        const allSystemItems = systemData.flatMap(record => record.items || []);
        const mappingMap = new Map<string, string>(existingMappings.map(m => [m.crdfd_supplier_product_name.toLowerCase(), m.crdfd_product_name]));

        // 2. Pre-processing: Handle items with existing mappings first.
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

        // 3. Set up initial UI with pre-processed results and placeholders for AI.
        const totalSupplierAmount = allSupplierItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const preProcessedSystemAmount = preProcessedItems.reduce((sum, item) => sum + (item.systemItem?.totalPrice || 0), 0);
        
        const aiProcessingPlaceholders: ComparedItem[] = itemsForAI_Supplier.map(item => ({
            status: ComparisonStatus.PROCESSING,
            supplierItem: item,
            systemItem: null,
            details: 'Đang chờ AI phân tích...'
        }));

        const initialComparedItems = [...preProcessedItems, ...aiProcessingPlaceholders];
        
        setReconciliationResult({
            summary: 'Đang xử lý... Kết quả sơ bộ từ mapping đã lưu. Chờ AI hoàn tất...',
            totalSupplierAmount,
            totalSystemAmount: preProcessedSystemAmount,
            difference: totalSupplierAmount - preProcessedSystemAmount,
            comparedItems: initialComparedItems
        });
        
        // 4. Call AI with only the remaining, unmapped items.
        let aiResult: ReconciliationResult = { 
            summary: 'Không có dữ liệu cần AI xử lý.', 
            totalSupplierAmount: 0, 
            totalSystemAmount: 0, 
            difference: 0, 
            comparedItems: [] 
        };

        if (itemsForAI_Supplier.length > 0 || itemsForAI_System.length > 0) {
            const supplierRecordsForAI: ReconciliationRecord[] = [{ id: 'unmatched-sup', amount: 0, description: '', items: itemsForAI_Supplier }];
            const systemRecordsForAI: ReconciliationRecord[] = [{ id: 'unmatched-sys', amount: 0, description: '', items: itemsForAI_System }];
            aiResult = await reconcileData(supplierRecordsForAI, systemRecordsForAI);
        }

        // 5. Combine final results and update the state.
        setReconciliationResult(() => {
            const finalSummary = `${preProcessedItems.length > 0 ? `Đã tự động xử lý ${preProcessedItems.length} sản phẩm dựa trên mapping đã lưu.` : ''} ${aiResult.summary}`;
            const finalComparedItems = [...preProcessedItems, ...aiResult.comparedItems];
            const finalSystemAmount = finalComparedItems.reduce((sum, item) => sum + (item.systemItem?.totalPrice || 0), 0);

            return {
                summary: finalSummary.trim(),
                totalSupplierAmount,
                totalSystemAmount: finalSystemAmount,
                difference: totalSupplierAmount - finalSystemAmount,
                comparedItems: finalComparedItems
            };
        });

    } catch (err: any) {
      setError(err.message || "Lỗi trong quá trình đối chiếu.");
       if (err instanceof GeminiParseError) {
        setRawErrorData(err.rawResponse);
      }
    } finally {
      const endTime = performance.now();
      setReconciliationTime((endTime - startTime) / 1000); // in seconds
      setIsLoading(prev => ({ ...prev, reconciling: false }));
    }
  };
  
  const handleOpenSkuMappingModal = () => {
    if (extractedData.length === 0 || systemData.length === 0) {
        alert("Không có đủ dữ liệu từ NCC và Wecare để tìm mapping.");
        return;
    }
    
    const systemItemsMap = new Map<string, ProductItem[]>();
    systemData.flatMap(rec => rec.items ?? []).forEach(item => {
        const key = `${item.quantity.toFixed(4)}-${item.unitPrice.toFixed(4)}`;
        if (!systemItemsMap.has(key)) {
            systemItemsMap.set(key, []);
        }
        systemItemsMap.get(key)!.push(item);
    });

    const supplierItems: ProductItem[] = extractedData.flatMap(record =>
        (record.items && record.items.length > 0)
        ? record.items
        : [{ name: record.description, quantity: 1, unitPrice: record.amount, totalPrice: record.amount }]
    );

    const mappings: SkuMapping[] = [];
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
    
    if (newMappings.length === 0) {
        alert("Không tìm thấy sản phẩm nào mới để tạo mapping. Tất cả các cặp khớp (về số lượng, đơn giá) có thể đã được lưu trước đó.");
        return;
    }

    setSkuMappingsToShow(newMappings);
    setIsSkuMappingModalOpen(true);
  };

  const handleSaveMappings = async (mappingsToSave: SkuMapping[]): Promise<{success: boolean, error?: string}> => {
      if (!selectedSupplierId || !accessToken) {
          return { success: false, error: "Không thể lưu: Thiếu thông tin nhà cung cấp hoặc token xác thực."};
      }
      
      const supplierName = suppliers.find(s => s.id === selectedSupplierId)?.name;
      if (!supplierName) {
        return { success: false, error: "Không thể tìm thấy tên nhà cung cấp đã chọn." };
      }
      
      try {
          const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_mapping_sku_2025s`;
          const promises = mappingsToSave.map(mapping => {
              const payload = {
                  crdfd_product_name: mapping.systemItem.name,
                  crdfd_supplier_product_name: mapping.supplierItem.name,
                  crdfd_supplier: supplierName
              };
              return fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                      'OData-MaxVersion': '4.0',
                      'OData-Version': '4.0',
                  },
                  body: JSON.stringify(payload)
              });
          });

          const responses = await Promise.all(promises);
          const failedRequests = responses.filter(res => !res.ok);

          if (failedRequests.length > 0) {
              const errorMessages = await Promise.all(failedRequests.map(getApiErrorMessage));
              const combinedError = `Lỗi khi lưu ${failedRequests.length}/${mappingsToSave.length} mapping: ${errorMessages.join(', ')}`;
              return { success: false, error: combinedError };
          } else {
              // Refresh existing mappings after successful save
              fetchExistingMappings(selectedSupplierId);
              return { success: true };
          }

      } catch (err: any) {
          return { success: false, error: err.message || "Đã xảy ra lỗi không xác định khi lưu SKU mapping."};
      }
  };


  const handleSupplierDateChange = (date: string | null) => {
    setSupplierDateRange({ start: date, end: null });
  };

  const selectedSupplierName = suppliers.find(s => s.id === selectedSupplierId)?.name || 'Không rõ';

  return (
    <div className="h-screen bg-slate-200 dark:bg-background text-slate-800 dark:text-foreground flex flex-col relative">
      {isErrorModalOpen && rawErrorData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
          <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-border">
              <h3 className="text-lg font-bold text-gray-800 dark:text-foreground">Phản hồi Gốc từ AI</h3>
              <button onClick={() => setIsErrorModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-2xl font-bold leading-none" aria-label="Đóng">&times;</button>
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
              <button onClick={() => setIsErrorModalOpen(false)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {reconciliationResult ? (
        <ReconciliationResultDisplay
          result={reconciliationResult}
          executionTime={reconciliationTime}
          onStartOver={handleClear}
          supplierName={selectedSupplierName}
        />
      ) : (
        <>
          <AppHeader
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            onSupplierChange={setSelectedSupplierId}
            isLoading={isLoading.suppliers || isLoading.systemData}
            onOpenFeedback={() => setIsFeedbackModalOpen(true)}
          />

          <main className="flex-grow px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
            {error && (
              <div className="bg-red-100 border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-700/60 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6 flex-shrink-0" role="alert">
                <div className="flex justify-between items-start">
                  <div>
                    <strong className="font-bold">Lỗi!</strong>
                    <span className="block sm:inline ml-2 whitespace-pre-wrap">{error}</span>
                  </div>
                  {rawErrorData && (
                    <button
                      onClick={() => setIsErrorModalOpen(true)}
                      className="ml-4 flex-shrink-0 px-3 py-1 border border-red-500 hover:bg-red-200 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-800/50 text-sm font-semibold rounded-md transition-colors"
                    >
                      Xem chi tiết
                    </button>
                  )}
                </div>
              </div>
            )}

            {isLoading.suppliers && !error ? (
              <div className="text-center py-10 bg-white dark:bg-card rounded-xl shadow-md flex-grow flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-3 text-slate-500 dark:text-muted-foreground">{!accessToken ? 'Đang lấy token xác thực...' : 'Đang tải danh sách nhà cung cấp...'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`flex-grow flex flex-row gap-8 min-h-0`}>
                  <SupplierDataPanel
                    uploadedFiles={uploadedFiles}
                    processedFiles={processedFiles}
                    extractedData={extractedData}
                    isReadingFile={isLoading.readingFile}
                    isReconciling={isLoading.reconciling}
                    supplierDateRange={supplierDateRange}
                    onFilesSelected={handleFileChange}
                    onRemoveFile={(index) => setUploadedFiles(files => files.filter((_, i) => i !== index))}
                    onReadFile={handleReadFile}
                    onClear={handleClear}
                    onDateChange={handleSupplierDateChange}
                  />
                  <SystemDataPanel
                    isFetching={isLoading.systemData}
                    data={systemData}
                    supplierDateRange={supplierDateRange}
                  />
                </div>

                <div className="py-8 flex-shrink-0">
                  <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
                    <button
                      onClick={handleOpenSkuMappingModal}
                      disabled={isLoading.reconciling || isLoading.existingMappings || extractedData.length === 0 || systemData.length === 0}
                      className="flex items-center justify-center w-full max-w-lg md:max-w-xs px-6 py-3 bg-green-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-green-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
                    >
                       {isLoading.existingMappings ? <><Spinner /> <span className="ml-2">Đang kiểm tra...</span></> : 'SKU Mapping'}
                    </button>
                    <button
                      onClick={handleReconcile}
                      disabled={isLoading.reconciling || extractedData.length === 0}
                      className="flex items-center justify-center w-full max-w-lg md:max-w-xs px-6 py-3 bg-primary text-primary-foreground text-lg font-bold rounded-lg shadow-lg hover:bg-accent-hover disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
                    >
                      {isLoading.reconciling ? (
                        <>
                          <Spinner />
                          <span className="ml-2">Đang đối chiếu...</span>
                        </>
                        ) : 'Đối chiếu'
                      }
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
          <SkuMappingModal
            isOpen={isSkuMappingModalOpen}
            onClose={() => setIsSkuMappingModalOpen(false)}
            mappings={skuMappingsToShow}
            onSave={handleSaveMappings}
            supplierName={selectedSupplierName}
          />
        </>
      )}
      <FeedbackModal 
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  );
};

export default App;