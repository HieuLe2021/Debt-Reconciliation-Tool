import { useState, useCallback } from 'react';
import type { ExistingMapping, Supplier, ProductItem } from '../types';
import { DYNAMICS_API_BASE_URL } from '../constants';
import { getApiErrorMessage } from '../utils/apiHelpers';

interface SkuMapping {
  supplierItem: ProductItem;
  systemItem: ProductItem;
}

export const useMappings = () => {
  const [existingMappings, setExistingMappings] = useState<ExistingMapping[]>([]);

  const fetchExistingMappings = useCallback(async (
    supplierId: string,
    accessToken: string | null,
    suppliers: Supplier[]
  ): Promise<{ success: boolean; error?: string }> => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!accessToken || !supplier) {
      setExistingMappings([]);
      return { success: false, error: 'Thiếu thông tin xác thực' };
    }
  
    try {
      const supplierName = supplier.name.replace(/'/g, "''");
      const filter = `$filter=crdfd_supplier eq '${supplierName}'`;
      const select = `$select=crdfd_product_name,crdfd_supplier_product_name,crdfd_supplier`;
      const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_mapping_sku_2025s?${select}&${filter}`;
  
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
  
      if (!response.ok) {
        throw new Error(`Không thể tải mapping đã có: ${await getApiErrorMessage(response)}`);
      }
  
      const result = await response.json();
      if (result.value && Array.isArray(result.value)) {
        setExistingMappings(result.value);
      }
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message.includes('Failed to fetch')
        ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM để tải mapping. Vui lòng kiểm tra cấu hình CORS.'
        : (err.message || "Lỗi khi tải các mapping đã có.");
      setExistingMappings([]);
      return { success: false, error: errorMessage };
    }
  }, []);

  const saveMappings = useCallback(async (
    mappingsToSave: SkuMapping[],
    selectedSupplierId: string,
    accessToken: string | null,
    suppliers: Supplier[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (!selectedSupplierId || !accessToken) {
      return { success: false, error: "Không thể lưu: Thiếu thông tin nhà cung cấp hoặc token xác thực." };
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
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Đã xảy ra lỗi không xác định khi lưu SKU mapping." };
    }
  }, []);

  return { existingMappings, fetchExistingMappings, saveMappings };
};
