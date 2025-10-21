
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Supplier, ReconciliationRecord, ProductItem, ExistingMapping } from './types';
import { POWER_AUTOMATE_URL, DYNAMICS_API_BASE_URL } from './constants';
import { extractDataFromFile, GeminiParseError } from './services/geminiService';
import DataTable from './components/DataTable';
import Spinner from './components/Spinner';
import SkuMappingModal from './components/SkuMappingModal';
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
        <h1 className="text-2xl font-bold text-primary">SKU Mapping</h1>
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
  onClear: () => void;
  onDateChange: (date: string | null) => void;
  processedFiles: File[];
  extractedData: ReconciliationRecord[];
  isReadingFile: boolean;
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
      <label htmlFor="start-date-filter" className="font-semibold whitespace-nowrap text-gray-600 dark:text-muted-foreground">Ngày HĐ:</label>
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
           <label htmlFor="file-upload" className={`cursor-pointer py-2 px-4 rounded-full border-0 text-sm font-semibold bg-primary/10 text-primary ${props.isReadingFile ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/20'} inline-flex items-center justify-center whitespace-nowrap`}>
              {props.isReadingFile ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  <span>Đang đọc...</span>
                </>
              ) : (
                'Chọn tệp'
              )}
            </label>
            <input id="file-upload" type="file" onChange={(e) => e.target.files && props.onFilesSelected(Array.from(e.target.files))} accept=".xlsx,.xls,.pdf,image/*" multiple className="hidden" disabled={props.isReadingFile}/>

          {props.processedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center text-sm bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-300 pl-2 pr-3 py-1 rounded-full border border-green-200 dark:border-green-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={file.name}>{file.name}</span>
            </div>
          ))}
        </div>
        <div className="flex space-x-2 flex-shrink-0">
          <button onClick={props.onClear} disabled={(props.extractedData.length === 0 && props.processedFiles.length === 0) || props.isReadingFile} className="flex items-center justify-center px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200">Xoá</button>
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
        title = `Dữ liệu Wecare (Ngày tạo đơn ${formatDate(supplierDateRange.start)} ±10 ngày)`;
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
  
  const [processedFiles, setProcessedFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ReconciliationRecord[]>([]);
  const [systemData, setSystemData] = useState<ReconciliationRecord[]>([]);
  const [supplierDateRange, setSupplierDateRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });

  const [isSkuMappingModalOpen, setIsSkuMappingModalOpen] = useState(false);
  const [skuMappingsToShow, setSkuMappingsToShow] = useState<SkuMapping[]>([]);
  const [existingMappings, setExistingMappings] = useState<ExistingMapping[]>([]);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState({ suppliers: true, systemData: false, readingFile: false, existingMappings: false });
  
  const [error, setError] = useState<string | null>(null);
  const [rawErrorData, setRawErrorData] = useState<string | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const setErrorMessage = useCallback((message: string | null) => {
    setError(message);
    if (message === null) {
      setRawErrorData(null);
    }
  }, []);

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
  }, [setErrorMessage]);

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
  }, [setErrorMessage]);

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

    try {
        const centerDate = new Date(dateRange.start);
        
        const startDate = new Date(centerDate);
        startDate.setDate(centerDate.getDate() - 10);
        const startDateString = startDate.toISOString().split('T')[0];

        const endDate = new Date(centerDate);
        endDate.setDate(centerDate.getDate() + 10);
        const endDateString = endDate.toISOString().split('T')[0];

        const filters = [
            `crdfd_nhacungcap eq '${supplier.name.replace(/'/g, "''")}'`,
            `createdon ge ${startDateString}T00:00:00Z`,
            `createdon le ${endDateString}T23:59:59Z`
        ];
        
        const filterString = filters.join(' and ');
        const filterQuery = `$filter=${encodeURIComponent(filterString)}`;
        const selectQuery = `$select=crdfd_gia,crdfd_soluongsanpham,crdfd_tensanphamtext2,createdon`;
        const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_buyorderdetailses?${selectQuery}&${filterQuery}`;
        
        const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error(`Lỗi tải dữ liệu hệ thống: ${await getApiErrorMessage(response)}`);
        
        const result = (await response.json());
        const records = result.value;
        if (!Array.isArray(records)) {
            setSystemData([]);
            return;
        }

        const mappedData: ReconciliationRecord[] = records.map((item: any) => {
            const date = (item.createdon).split('T')[0];
            const quantity = parseFloat(item.crdfd_soluongsanpham) || 0;
            const unitPrice = parseFloat(item.crdfd_gia) || 0;
            const totalPrice = quantity * unitPrice;
            const name = item.crdfd_tensanphamtext2 || 'N/A';
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
}, [accessToken, suppliers, setErrorMessage]);

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
      const filterString = `crdfd_supplier eq '${supplierName}'`;
      const filterQuery = `$filter=${encodeURIComponent(filterString)}`;
      const selectQuery = `$select=crdfd_product_name,crdfd_supplier_product_name,crdfd_supplier`;
      const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_mapping_sku_2025s?${selectQuery}&${filterQuery}`;
  
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
  }, [accessToken, suppliers, setErrorMessage]);


  // --- Effect Chain ---
  useEffect(() => { fetchAccessToken(); }, [fetchAccessToken]);
  useEffect(() => { if (accessToken) fetchSuppliers(accessToken); }, [accessToken, fetchSuppliers]);
  useEffect(() => { 
    if (selectedSupplierId && accessToken) {
      fetchSystemData(selectedSupplierId, supplierDateRange); 
      fetchExistingMappings(selectedSupplierId);
    }
  }, [selectedSupplierId, supplierDateRange, fetchSystemData, fetchExistingMappings, accessToken]);

  const handleReadFile = async (filesToRead: File[]) => {
    if (filesToRead.length === 0) return;
    setIsLoading(prev => ({ ...prev, readingFile: true }));
    setErrorMessage(null);

    const results = await Promise.allSettled(filesToRead.map(extractDataFromFile));
    const successfulData: ReconciliationRecord[] = [];
    const errorMessages: string[] = [];
    let firstRawError: string | null = null;

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        successfulData.push(...result.value);
      } else {
        const reason = result.reason as Error;
        errorMessages.push(`Tệp "${filesToRead[i].name}": ${reason.message}`);
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
        const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
        
        setSupplierDateRange({ 
            start: maxDate.toISOString().split('T')[0],
            end: null,
        });
      } else {
        setSupplierDateRange({ start: null, end: null });
      }
    }
    
    setProcessedFiles(prev => [...prev, ...filesToRead]);
    setIsLoading(prev => ({ ...prev, readingFile: false }));
  };
  
  const handleFileChange = async (files: File[]) => {
    setErrorMessage(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    await handleReadFile(files);
  };

  const handleClear = () => {
    setExtractedData([]);
    setProcessedFiles([]);
    setErrorMessage(null);
    setSupplierDateRange({ start: null, end: null });
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
  
  const sortedSystemData = useMemo(() => {
    return [...systemData].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [systemData]);

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
                  processedFiles={processedFiles}
                  extractedData={extractedData}
                  isReadingFile={isLoading.readingFile}
                  supplierDateRange={supplierDateRange}
                  onFilesSelected={handleFileChange}
                  onClear={handleClear}
                  onDateChange={handleSupplierDateChange}
                />
                <SystemDataPanel
                  isFetching={isLoading.systemData}
                  data={sortedSystemData}
                  supplierDateRange={supplierDateRange}
                />
              </div>

              <div className="py-8 flex-shrink-0">
                <div className="flex justify-center">
                  <button
                    onClick={handleOpenSkuMappingModal}
                    disabled={isLoading.existingMappings || extractedData.length === 0 || systemData.length === 0}
                    className="flex items-center justify-center w-full max-w-lg md:max-w-xs px-6 py-3 bg-green-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-green-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
                  >
                     {isLoading.existingMappings ? <><Spinner /> <span className="ml-2">Đang kiểm tra...</span></> : 'SKU Mapping'}
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
      <FeedbackModal 
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  );
};

export default App;
