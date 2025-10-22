import { useState, useCallback } from 'react';
import { POWER_AUTOMATE_URL } from '../constants';

export const useAuth = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchAccessToken = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
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
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message.includes('Failed to fetch') 
        ? 'Lỗi Mạng: Không thể kết nối đến Power Automate để lấy token. Vui lòng kiểm tra cấu hình CORS.' 
        : (err.message || 'Không thể lấy token xác thực.');
      return { success: false, error: errorMessage };
    }
  }, []);

  return { accessToken, fetchAccessToken };
};
