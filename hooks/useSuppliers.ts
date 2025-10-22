import { useState, useCallback } from 'react';
import type { Supplier } from '../types';
import { DYNAMICS_API_BASE_URL } from '../constants';
import { getApiErrorMessage } from '../utils/apiHelpers';

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const fetchSuppliers = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
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
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message.includes('Failed to fetch') 
        ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM để tải NCC. Vui lòng kiểm tra cấu hình CORS.' 
        : (err.message || 'Không thể tải danh sách nhà cung cấp.');
      return { success: false, error: errorMessage };
    }
  }, []);

  return { suppliers, selectedSupplierId, setSelectedSupplierId, fetchSuppliers };
};
