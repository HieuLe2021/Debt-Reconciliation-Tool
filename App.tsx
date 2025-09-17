
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Supplier, ReconciliationRecord, ReconciliationResult } from './types';
import { POWER_AUTOMATE_URL, DYNAMICS_API_BASE_URL } from './constants';
import { extractDataFromFile, reconcileData } from './services/geminiService';
import DataTable from './components/DataTable';
import Spinner from './components/Spinner';
import ReconciliationResultDisplay from './components/ReconciliationResultDisplay';

// --- Local UI Components for better structure ---

const AppHeader: React.FC<{
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierChange: (id: string) => void;
  isLoading: boolean;
}> = ({ suppliers, selectedSupplierId, onSupplierChange, isLoading }) => {
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
    <header className="bg-white shadow-sm flex-shrink-0">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-[#04A1B3]">Đối Chiếu Công Nợ Phải Trả</h1>
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
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-[#04A1B3] focus:border-[#04A1B3] block p-2.5"
            disabled={isLoading}
          />
          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto border border-slate-200">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSupplierChange(s.id);
                      setIsDropdownOpen(false);
                    }}
                    className="cursor-pointer hover:bg-[#E6F6F8] p-2.5 text-sm"
                  >
                    {s.name}
                  </div>
                ))
              ) : (
                <div className="p-2.5 text-sm text-slate-500">Không tìm thấy nhà cung cấp.</div>
              )}
            </div>
          )}
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
  uploadedFiles: File[];
  processedFiles: File[];
  extractedData: ReconciliationRecord[];
  isReadingFile: boolean;
  isReconciling: boolean;
  supplierDateRange: { start: string | null };
}> = (props) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 flex flex-col lg:w-1/2">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex-shrink-0">1. Dữ liệu Nhà Cung Cấp (Tải lên)</h2>
      <div className="flex items-start space-x-4 flex-shrink-0 mb-4">
        <div className="flex-grow flex items-center flex-wrap gap-2">
          <label htmlFor="file-upload" className="cursor-pointer py-2 px-4 rounded-full border-0 text-sm font-semibold bg-[#E6F6F8] text-[#04A1B3] hover:bg-[#C2E9EF] inline-block whitespace-nowrap">Chọn tệp</label>
          <input id="file-upload" type="file" onChange={(e) => e.target.files && props.onFilesSelected(Array.from(e.target.files))} accept=".xlsx,.xls,.pdf,image/*" multiple className="hidden" />
          {props.processedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center text-sm bg-green-50 text-green-800 pl-2 pr-3 py-1 rounded-full border border-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-700 truncate max-w-[200px]" title={file.name}>{file.name}</span>
            </div>
          ))}
          {props.uploadedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center text-sm bg-slate-50 pl-3 pr-1 py-1 rounded-full border border-slate-200">
              <span className="text-slate-700 truncate max-w-[200px]" title={file.name}>{file.name}</span>
              <button onClick={() => props.onRemoveFile(index)} className="ml-2 text-red-400 hover:text-red-600 text-xl font-light leading-none flex items-center justify-center h-5 w-5 rounded-full hover:bg-red-100" aria-label={`Remove ${file.name}`}>&times;</button>
            </div>
          ))}
        </div>
        <div className="flex space-x-2 flex-shrink-0">
          <button onClick={props.onReadFile} disabled={props.isReadingFile || props.uploadedFiles.length === 0} className="flex items-center justify-center px-4 py-2 bg-[#04A1B3] text-white font-semibold rounded-lg shadow-md hover:bg-[#038a9a] disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200">
            {props.isReadingFile ? <Spinner /> : 'Đọc File'}
          </button>
          <button onClick={props.onClear} disabled={(props.extractedData.length === 0 && props.uploadedFiles.length === 0 && props.processedFiles.length === 0) || props.isReadingFile || props.isReconciling} className="flex items-center justify-center px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200">Xoá</button>
        </div>
      </div>

      {props.supplierDateRange.start && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex-shrink-0">
          <span className="font-semibold">Lọc dữ liệu hệ thống từ ngày:</span> {props.supplierDateRange.start}
        </div>
      )}

      <div className="mt-0 flex-grow min-h-0">
        <DataTable title="Dữ liệu trích xuất" data={props.extractedData} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#04A1B3]" fill="none" viewBox="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
      </div>
    </div>
  );
};

const SystemDataPanel: React.FC<{
  isFetching: boolean;
  data: ReconciliationRecord[];
  supplierName: string;
}> = ({ isFetching, data, supplierName }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 flex flex-col lg:w-1/2">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex-shrink-0">2. Dữ liệu trên Wecare</h2>
      <div className="flex-grow min-h-0">
        {isFetching ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#04A1B3]"></div>
              <p className="mt-3 text-slate-500">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : (
          <DataTable title={`Lịch sử mua hàng: ${supplierName}`} data={data} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>} />
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
  const [supplierDateRange, setSupplierDateRange] = useState<{ start: string | null }>({ start: null });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState({ suppliers: true, systemData: false, readingFile: false, reconciling: false });
  const [error, setError] = useState<string | null>(null);

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
      setError(err.message.includes('Failed to fetch') ? 'Lỗi Mạng: Không thể kết nối đến Power Automate để lấy token. Vui lòng kiểm tra cấu hình CORS.' : (err.message || 'Không thể lấy token xác thực.'));
      setIsLoading(prev => ({ ...prev, suppliers: false }));
    }
  }, []);

  const fetchSuppliers = useCallback(async (token: string) => {
    try {
      const filter = `$filter=statecode eq 0 and crdfd_suppliername ne null and crdfd_nhacungcap eq true and crdfd_loaioituong eq 191920000`;
      const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_suppliers?$select=crdfd_supplierid,crdfd_suppliername&${filter}&$orderby=createdon desc`;
      const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Lỗi khi tải danh sách NCC: ${response.statusText}`);
      const result = await response.json();
      if (!Array.isArray(result.value)) throw new Error('Dữ liệu NCC trả về không đúng định dạng.');
      const mappedSuppliers: Supplier[] = result.value.map((s: any) => ({ id: s.crdfd_supplierid, name: s.crdfd_suppliername }));
      setSuppliers(mappedSuppliers);
      if (mappedSuppliers.length > 0) setSelectedSupplierId(mappedSuppliers[0].id);
    } catch (err: any) {
      setError(err.message.includes('Failed to fetch') ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM để tải NCC. Vui lòng kiểm tra cấu hình CORS.' : (err.message || 'Không thể tải danh sách nhà cung cấp.'));
    } finally {
      setIsLoading(prev => ({ ...prev, suppliers: false }));
    }
  }, []);

  const fetchSystemData = useCallback(async (supplierId: string, dateStart: string | null) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!accessToken || !supplier) { setSystemData([]); return; }
    
    setIsLoading(prev => ({ ...prev, systemData: true }));
    setError(null);
    setReconciliationResult(null);

    try {
      let dateFilter = '';
      if (dateStart) {
        dateFilter = ` and cr44a_ngayhachtoan ge ${dateStart}T00:00:00Z`;
      } else {
        const year = new Date().getFullYear();
        dateFilter = ` and cr44a_ngayhachtoan ge ${year}-01-01T00:00:00Z and cr44a_ngayhachtoan lt ${year + 1}-01-01T00:00:00Z`;
      }

      const parentFilter = `$filter=cr44a_nhacungcaptext eq '${supplier.name.replace(/'/g, "''")}' and statecode eq 0${dateFilter}`;
      const parentUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/cr44a_muahangs?$select=cr44a_muahangid,cr44a_ngayhachtoan&${parentFilter}`;
      const parentRes = await fetch(parentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!parentRes.ok) throw new Error(`Lỗi tải dữ liệu hệ thống (1): ${(await parentRes.json()).error?.message || parentRes.statusText}`);
      
      const parentRecords = (await parentRes.json()).value;
      if (!Array.isArray(parentRecords) || parentRecords.length === 0) { setSystemData([]); return; }

      const idToDateMap = new Map(parentRecords.map((r: any) => [r.cr44a_muahangid, r.cr44a_ngayhachtoan]));
      const childFilter = `$filter=${Array.from(idToDateMap.keys()).map(id => `_cr44a_sochungtulk_value eq ${id}`).join(' or ')}`;
      const childUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/cr44a_muahangchitiets?$select=cr44a_muahangchitietid,cr44a_tenhangcal,cr44a_soluongtheoon,cr44a_gia,_cr44a_sochungtulk_value,createdon&${childFilter}`;
      const childRes = await fetch(childUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!childRes.ok) throw new Error(`Lỗi tải dữ liệu hệ thống (2): ${(await childRes.json()).error?.message || childRes.statusText}`);

      const childRecords = (await childRes.json()).value;
      if (!Array.isArray(childRecords)) throw new Error('Dữ liệu chi tiết trả về không đúng định dạng.');
      
      const mappedData: ReconciliationRecord[] = childRecords.map((item: any) => {
        const parentId = item._cr44a_sochungtulk_value;
        const date = (idToDateMap.get(parentId) || item.createdon).split('T')[0];
        const quantity = parseFloat(item.cr44a_soluongtheoon) || 0;
        const unitPrice = parseFloat(item.cr44a_gia) || 0;
        const totalPrice = quantity * unitPrice;
        const name = item.cr44a_tenhangcal || 'N/A';
        return {
          id: item.cr44a_muahangchitietid, date, amount: totalPrice, description: name,
          items: [{ name, quantity, unitPrice, totalPrice }],
        };
      });
      setSystemData(mappedData);
    } catch (err: any) {
      setError(err.message.includes('Failed to fetch') ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM. Vui lòng kiểm tra cấu hình CORS.' : (err.message || "Lỗi khi tải dữ liệu từ hệ thống."));
      setSystemData([]);
    } finally {
      setIsLoading(prev => ({ ...prev, systemData: false }));
    }
  }, [accessToken, suppliers]);

  // --- Effect Chain ---
  useEffect(() => { fetchAccessToken(); }, [fetchAccessToken]);
  useEffect(() => { if (accessToken) fetchSuppliers(accessToken); }, [accessToken, fetchSuppliers]);
  useEffect(() => { if (selectedSupplierId && accessToken) fetchSystemData(selectedSupplierId, supplierDateRange.start); }, [selectedSupplierId, supplierDateRange.start, fetchSystemData, accessToken]);

  const handleFileChange = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
    setReconciliationResult(null);
    setError(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleReadFile = async () => {
    if (uploadedFiles.length === 0) return;
    setIsLoading(prev => ({ ...prev, readingFile: true }));
    setError(null);

    const results = await Promise.allSettled(uploadedFiles.map(extractDataFromFile));
    const successfulData: ReconciliationRecord[] = [];
    const errorMessages: string[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') successfulData.push(...result.value);
      else errorMessages.push(`Tệp "${uploadedFiles[i].name}": ${result.reason.message}`);
    });

    if (errorMessages.length > 0) setError(errorMessages.join('\n'));
    if (successfulData.length > 0) {
      const combinedData = [...extractedData, ...successfulData];
      setExtractedData(combinedData);
      const dates = combinedData.map(d => new Date(d.date)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        setSupplierDateRange({ start: minDate.toISOString().split('T')[0] });
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
    setError(null);
    setSupplierDateRange({ start: null });
    setReconciliationTime(null);
  };
  
  const handleReconcile = async () => {
    if (extractedData.length === 0 || systemData.length === 0) return;
    setIsLoading(prev => ({ ...prev, reconciling: true }));
    setError(null);
    setReconciliationTime(null);
    const startTime = performance.now();

    try {
      const result = await reconcileData(extractedData, systemData);
      setReconciliationResult(result);
    } catch (err: any) {
      setError(err.message || "Lỗi trong quá trình đối chiếu.");
    } finally {
      const endTime = performance.now();
      setReconciliationTime((endTime - startTime) / 1000); // in seconds
      setIsLoading(prev => ({ ...prev, reconciling: false }));
    }
  };

  return (
    <div className="h-screen bg-slate-200 text-slate-800 flex flex-col relative">
      {reconciliationResult ? (
        <ReconciliationResultDisplay
          result={reconciliationResult}
          executionTime={reconciliationTime}
          onStartOver={handleClear}
        />
      ) : (
        <>
          <AppHeader
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            onSupplierChange={setSelectedSupplierId}
            isLoading={isLoading.suppliers || isLoading.systemData}
          />

          <main className="flex-grow px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6 flex-shrink-0 whitespace-pre-wrap" role="alert">
                <strong className="font-bold">Lỗi!</strong>
                <span className="block sm:inline ml-2">{error}</span>
              </div>
            )}

            {isLoading.suppliers && !error ? (
              <div className="text-center py-10 bg-white rounded-xl shadow-md flex-grow flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#04A1B3]"></div>
                  <p className="mt-3 text-slate-500">{!accessToken ? 'Đang lấy token xác thực...' : 'Đang tải danh sách nhà cung cấp...'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`flex-grow flex flex-col lg:flex-row gap-8 min-h-0`}>
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
                  />
                  <SystemDataPanel
                    isFetching={isLoading.systemData}
                    data={systemData}
                    supplierName={suppliers.find(s => s.id === selectedSupplierId)?.name || '...'}
                  />
                </div>

                <div className={`py-8 flex-shrink-0`}>
                  <div className="flex flex-col items-center">
                    <button onClick={handleReconcile} disabled={isLoading.reconciling || extractedData.length === 0 || systemData.length === 0} className="flex items-center justify-center w-full max-w-lg px-6 py-3 bg-green-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200">
                      {isLoading.reconciling ? <><Spinner /> <span className="ml-2">Đang đối chiếu...</span></> : 'Đối chiếu'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
};

export default App;