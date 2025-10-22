import React, { useState, useEffect } from 'react';
import type { ReconciliationRecord, ReconciliationResult, ProductItem } from './types';
import { extractDataFromFile, reconcileData, GeminiParseError } from './services/geminiService';
import Spinner from './components/Spinner';
import ReconciliationResultDisplay from './components/ReconciliationResultDisplay';
import SkuMappingModal from './components/SkuMappingModal';
import SystemDataPanel from './components/SystemDataPanel';
import AppHeader from './components/AppHeader';
import SupplierDataPanel from './components/SupplierDataPanel';
import ErrorModal from './components/ErrorModal';
import ErrorAlert from './components/ErrorAlert';
import { ComparisonStatus } from './types';
import { useAuth } from './hooks/useAuth';
import { useSuppliers } from './hooks/useSuppliers';
import { useSystemData } from './hooks/useSystemData';
import { useMappings } from './hooks/useMappings';
import { 
  calculateValidDates, 
  calculateDateRange, 
  flattenSupplierItems, 
  preprocessItemsWithMappings,
  findSkuMappings 
} from './utils/reconciliationHelpers';

interface SkuMapping {
  supplierItem: ProductItem;
  systemItem: ProductItem;
}

// --- Main App Component ---

const App: React.FC = () => {
  // Custom hooks
  const { accessToken, fetchAccessToken } = useAuth();
  const { suppliers, selectedSupplierId, setSelectedSupplierId, fetchSuppliers } = useSuppliers();
  const { systemData, setSystemData, fetchSystemData } = useSystemData();
  const { existingMappings, fetchExistingMappings, saveMappings } = useMappings();
  
  // Local state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ReconciliationRecord[]>([]);
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [reconciliationTime, setReconciliationTime] = useState<number | null>(null);
  const [supplierDateRange, setSupplierDateRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const [systemFilter, setSystemFilter] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });

  const [isSkuMappingModalOpen, setIsSkuMappingModalOpen] = useState(false);
  const [skuMappingsToShow, setSkuMappingsToShow] = useState<SkuMapping[]>([]);

  const [isLoading, setIsLoading] = useState({ suppliers: true, systemData: false, readingFile: false, reconciling: false, existingMappings: false });
  
  const [error, setError] = useState<string | null>(null);
  const [rawErrorData, setRawErrorData] = useState<string | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const setErrorMessage = (message: string | null) => {
    setError(message);
    if (message === null) {
      setRawErrorData(null);
    }
  }

  // --- Effect Chain ---
  useEffect(() => {
    const initAuth = async () => {
      const result = await fetchAccessToken();
      if (!result.success && result.error) {
        setErrorMessage(result.error);
        setIsLoading(prev => ({ ...prev, suppliers: false }));
      }
    };
    initAuth();
  }, [fetchAccessToken]);

  useEffect(() => {
    const initSuppliers = async () => {
      if (accessToken) {
        const result = await fetchSuppliers(accessToken);
        if (!result.success && result.error) {
          setErrorMessage(result.error);
        }
        setIsLoading(prev => ({ ...prev, suppliers: false }));
      }
    };
    initSuppliers();
  }, [accessToken, fetchSuppliers]);
  
  useEffect(() => {
    const loadSystemData = async () => {
      if (selectedSupplierId && accessToken && systemFilter.start && systemFilter.end) {
        setIsLoading(prev => ({ ...prev, systemData: true }));
        setErrorMessage(null);
        setReconciliationResult(null);
        const result = await fetchSystemData(selectedSupplierId, systemFilter, accessToken, suppliers);
        if (!result.success && result.error) {
          setErrorMessage(result.error);
        }
        setIsLoading(prev => ({ ...prev, systemData: false }));
      } else {
        setSystemData([]);
      }
    };
    loadSystemData();
  }, [selectedSupplierId, systemFilter, accessToken, fetchSystemData, suppliers, setSystemData]);

  useEffect(() => {
    const loadMappings = async () => {
      if (selectedSupplierId && accessToken) {
        setIsLoading(prev => ({ ...prev, existingMappings: true }));
        const result = await fetchExistingMappings(selectedSupplierId, accessToken, suppliers);
        if (!result.success && result.error) {
          setErrorMessage(result.error);
        }
        setIsLoading(prev => ({ ...prev, existingMappings: false }));
      }
    };
    loadMappings();
  }, [selectedSupplierId, accessToken, fetchExistingMappings, suppliers]);


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
      
      const validDates = calculateValidDates(combinedData);
      const dateRange = calculateDateRange(validDates);

      if (dateRange) {
        setSupplierDateRange({ 
          start: dateRange.supplierDate,
          end: null,
        });
        setSystemFilter({
          start: dateRange.systemStart,
          end: dateRange.systemEnd,
        });
      } else {
        setSupplierDateRange({ start: null, end: null });
        setSystemFilter({ start: null, end: null });
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
    setSystemFilter({ start: null, end: null });
    setReconciliationTime(null);
  };
  
  const handleReconcile = async () => {
    if (extractedData.length === 0) return;
    setIsLoading(prev => ({ ...prev, reconciling: true }));
    setErrorMessage(null);
    setReconciliationTime(null);
    const startTime = performance.now();

    try {
        // 1. Flatten and preprocess data
        const allSupplierItems = flattenSupplierItems(extractedData);
        const allSystemItems = systemData.flatMap(record => record.items || []);
        
        const { preProcessedItems, itemsForAI_Supplier, itemsForAI_System } = preprocessItemsWithMappings(
          allSupplierItems,
          allSystemItems,
          existingMappings
        );

        // 2. Set up initial UI with pre-processed results and placeholders for AI
        const totalSupplierAmount = allSupplierItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const preProcessedSystemAmount = preProcessedItems.reduce((sum, item) => sum + (item.systemItem?.totalPrice || 0), 0);
        
        const aiProcessingPlaceholders = itemsForAI_Supplier.map(item => ({
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
    
    const newMappings = findSkuMappings(extractedData, systemData, existingMappings);
    
    if (newMappings.length === 0) {
        alert("Không tìm thấy sản phẩm nào mới để tạo mapping. Tất cả các cặp khớp (về số lượng, đơn giá) có thể đã được lưu trước đó.");
        return;
    }

    setSkuMappingsToShow(newMappings);
    setIsSkuMappingModalOpen(true);
  };

  const handleSaveMappings = async (mappingsToSave: SkuMapping[]): Promise<{success: boolean, error?: string}> => {
    const result = await saveMappings(mappingsToSave, selectedSupplierId, accessToken, suppliers);
    if (result.success) {
      // Refresh existing mappings after successful save
      await fetchExistingMappings(selectedSupplierId, accessToken, suppliers);
    }
    return result;
  };


  const handleSupplierDateChange = (date: string | null) => {
    setSupplierDateRange({ start: date, end: null });
  };

  const selectedSupplierName = suppliers.find(s => s.id === selectedSupplierId)?.name || 'Không rõ';

  return (
    <div className="h-screen bg-slate-200 dark:bg-background text-slate-800 dark:text-foreground flex flex-col relative">
      <ErrorModal 
        isOpen={isErrorModalOpen}
        rawErrorData={rawErrorData}
        onClose={() => setIsErrorModalOpen(false)}
      />

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
          />

          <main className="flex-grow px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
            {error && (
              <ErrorAlert 
                error={error}
                hasRawData={!!rawErrorData}
                onViewDetails={() => setIsErrorModalOpen(true)}
              />
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
                    onDateChange={handleSupplierDateChange}
                  />
                  <SystemDataPanel
                    isFetching={isLoading.systemData}
                    data={systemData}
                    filterRange={systemFilter}
                    onFilterChange={setSystemFilter}
                    canFilter={!!selectedSupplierId}
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
    </div>
  );
};

export default App;