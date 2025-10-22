import { useState, useCallback } from 'react';
import type { ReconciliationRecord, Supplier } from '../types';
import { DYNAMICS_API_BASE_URL } from '../constants';
import { getApiErrorMessage } from '../utils/apiHelpers';

export const useSystemData = () => {
  const [systemData, setSystemData] = useState<ReconciliationRecord[]>([]);

  const fetchSystemData = useCallback(async (
    supplierId: string, 
    dateRange: { start: string | null, end: string | null },
    accessToken: string | null,
    suppliers: Supplier[]
  ): Promise<{ success: boolean; error?: string }> => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!accessToken || !supplier) { 
      setSystemData([]); 
      return { success: false, error: 'Thiếu thông tin xác thực hoặc nhà cung cấp' };
    }
    
    if (!dateRange.start || !dateRange.end) {
      setSystemData([]);
      return { success: false, error: 'Thiếu khoảng thời gian' };
    }

    try {
      const startDateString = dateRange.start;
      const endDateString = dateRange.end;

      const filters = [
        `crdfd_nhacungcap eq '${supplier.name.replace(/'/g, "''")}'`,
        `crdfd_trangthaigiaonhan1text ne 'Đã giao'`,
        `createdon ge ${startDateString}T00:00:00Z`,
        `createdon le ${endDateString}T23:59:59Z`
      ];
      
      const filterQuery = `$filter=${filters.join(' and ')}`;
      const selectQuery = `$select=crdfd_gia,crdfd_soluongsanpham,crdfd_tensanphamtext2,createdon`;
      const apiUrl = `${DYNAMICS_API_BASE_URL}/api/data/v9.2/crdfd_buyorderdetailses?${selectQuery}&${filterQuery}`;
      
      const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Lỗi tải dữ liệu hệ thống: ${await getApiErrorMessage(response)}`);
      
      const result = await response.json();
      const records = result.value;
      if (!Array.isArray(records)) {
        setSystemData([]);
        return { success: false, error: 'Dữ liệu không đúng định dạng' };
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
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message.includes('Failed to fetch') 
        ? 'Lỗi Mạng: Không thể kết nối đến Dynamics CRM. Vui lòng kiểm tra cấu hình CORS.' 
        : (err.message || "Lỗi khi tải dữ liệu từ hệ thống.");
      setSystemData([]);
      return { success: false, error: errorMessage };
    }
  }, []);

  return { systemData, setSystemData, fetchSystemData };
};
