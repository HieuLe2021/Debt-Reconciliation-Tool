export const getApiErrorMessage = async (response: Response): Promise<string> => {
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
