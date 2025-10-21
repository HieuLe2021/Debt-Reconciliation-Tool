

import { GoogleGenAI, Type } from "@google/genai";
import type { ReconciliationRecord } from '../types';

// FIX: Declare the XLSX variable, which is expected to be available globally from a script tag.
declare var XLSX: any;

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. This application cannot function without an API key.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Custom error class to hold details about a failed AI response parse.
 */
export class GeminiParseError extends Error {
  rawResponse: string;
  repairedAttempt: string;

  constructor(message: string, rawResponse: string, repairedAttempt: string) {
    super(message);
    this.name = 'GeminiParseError';
    this.rawResponse = rawResponse;
    this.repairedAttempt = repairedAttempt;
  }
}

/**
 * Pre-processes a file before sending it to the Gemini API.
 * - For Excel files, it reads the content and converts the first sheet to a CSV string.
 * - For other files (PDF, images), it converts them to a base64 string.
 * @param file The file to process.
 * @returns A promise that resolves to a part object suitable for the Gemini API.
 */
const fileToPart = async (file: File): Promise<{ text: string } | { inlineData: { data: string, mimeType: string } }> => {
    // Check for Excel MIME types
    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = event.target?.result;
                    if (!data) {
                        throw new Error("File reader result is empty.");
                    }
                    const workbook = XLSX.read(data, { type: 'array' });
                    // Get the first sheet name
                    const sheetName = workbook.SheetNames[0];
                    if (!sheetName) {
                        throw new Error("Excel file contains no sheets.");
                    }
                    const worksheet = workbook.Sheets[sheetName];
                    // Convert the sheet to CSV format
                    const csvData = XLSX.utils.sheet_to_csv(worksheet);
                    resolve({ text: csvData });
                } catch (e: any) {
                    reject(new Error(`Lỗi khi đọc tệp Excel: ${e.message}`));
                }
            };
            reader.onerror = () => reject(new Error(`Không thể đọc tệp: ${reader.error?.message}`));
            reader.readAsArrayBuffer(file);
        });
    }

    // Default behavior for PDF/Images: convert to base64
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result !== 'string') {
                return reject(new Error("Failed to read file as base64 string."));
            }
            const base64Data = reader.result.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = () => reject(new Error(`Error reading file: ${reader.error?.message || 'Unknown FileReader error'}`));
        reader.readAsDataURL(file);
    });
};


const productItemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: 'Tên sản phẩm/dịch vụ' },
        quantity: { type: Type.NUMBER, description: 'Số lượng' },
        unitPrice: { type: Type.NUMBER, description: 'Đơn giá' },
        totalPrice: { type: Type.NUMBER, description: 'Thành tiền (số lượng * đơn giá)' },
    },
    required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
};

const recordSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: 'Mã số chứng từ, hóa đơn (e.g., "PNK001", "HD-123")' },
        date: { type: Type.STRING, description: 'Ngày giao dịch, định dạng "YYYY-MM-DD"' },
        description: { type: Type.STRING, description: 'Nội dung/diễn giải giao dịch' },
        amount: { type: Type.NUMBER, description: 'Tổng số tiền của chứng từ, phải bằng tổng thành tiền của các sản phẩm' },
        items: {
            type: Type.ARRAY,
            description: 'Danh sách chi tiết các mặt hàng trong chứng từ (nếu có)',
            items: productItemSchema,
        },
    },
    required: ['id', 'description', 'amount'],
};

/**
 * Attempts to repair a potentially malformed JSON string.
 * It extracts the main JSON object/array and fixes common errors like trailing commas.
 * This version robustly finds the end of the JSON by balancing brackets/braces.
 * @param jsonString The raw string response from the AI.
 * @returns A cleaned-up string that is more likely to be valid JSON.
 */
const repairJson = (jsonString: string): string => {
    let repaired = jsonString.trim();

    // 1. Extract content within markdown code blocks if they exist
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = repaired.match(jsonBlockRegex);
    if (match && match[1]) {
        repaired = match[1].trim();
    }

    // 2. Find the start of the main JSON object or array
    const firstBrace = repaired.indexOf('{');
    const firstBracket = repaired.indexOf('[');
    
    let startIndex = -1;
    if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
        startIndex = firstBracket;
    } else if (firstBrace !== -1) {
        startIndex = firstBrace;
    }

    // If no JSON object/array found, just return the repaired string and let it fail downstream
    if (startIndex === -1) {
        return repaired;
    }

    const startChar = repaired[startIndex];
    const endChar = startChar === '{' ? '}' : ']';
    
    let depth = 0;
    let endIndex = -1;

    // 3. Balance brackets/braces to find the true end of the JSON, ignoring them inside strings
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < repaired.length; i++) {
        const char = repaired[i];

        if (inString) {
            if (escape) {
                escape = false;
            } else if (char === '\\') {
                escape = true;
            } else if (char === '"') {
                inString = false;
            }
            continue; // Ignore brackets/braces inside strings
        }

        if (char === '"') {
            inString = true;
        } else if (char === startChar) {
            depth++;
        } else if (char === endChar) {
            depth--;
        }

        if (depth === 0) {
            endIndex = i;
            break; // Found the end of the main structure
        }
    }

    if (endIndex !== -1) {
        repaired = repaired.substring(startIndex, endIndex + 1);
    } else {
       // Fallback for unbalanced JSON: use the old, less reliable method
       const lastBracketOrBrace = startChar === '{' ? repaired.lastIndexOf('}') : repaired.lastIndexOf(']');
       if (lastBracketOrBrace > startIndex) {
         repaired = repaired.substring(startIndex, lastBracketOrBrace + 1);
       }
       // If still no valid end is found, we'll just use the substring from the start
       else {
         repaired = repaired.substring(startIndex);
       }
    }

    // 4. Fix common syntax errors, like trailing commas
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    return repaired;
};


export const extractDataFromFile = async (file: File): Promise<ReconciliationRecord[]> => {
  let part;
  try {
      part = await fileToPart(file);
  } catch (fileError: any) {
      console.error(`Error processing file ${file.name}:`, fileError);
      throw new Error(`Không thể xử lý tệp "${file.name}". Lỗi: ${fileError.message || 'Lỗi không xác định'}`);
  }
  
  const promptInstructions = `Phân tích tài liệu và trích xuất tất cả các mục giao dịch.

QUY TẮC BẮT BUỘC:
1.  **Ghép Tên và Quy Cách**: Nếu có cột 'Tên sản phẩm'/'Mặt hàng' và cột 'Quy cách' riêng biệt, bạn PHẢI ghép chúng thành một tên sản phẩm duy nhất. Ví dụ: 'Mặt hàng' là 'Bulong inox 304' và 'Quy cách' là '6x30' thì tên sản phẩm trích xuất phải là "Bulong inox 304 6x30".
2.  **Bỏ qua dòng bị gạch**: Không trích xuất bất kỳ dòng nào có dấu hiệu bị gạch bỏ hoặc gạch ngang.
3.  **Cung cấp đầy đủ thông tin**: Đối với mỗi mục, cung cấp mã, ngày, mô tả, tổng số tiền, và danh sách sản phẩm chi tiết nếu có.
4.  **Chỉ trả về JSON**: Toàn bộ phản hồi của bạn BẮT BUỘC phải là một mảng JSON hợp lệ, không chứa bất kỳ văn bản giải thích nào khác.
`;

    const isTextData = 'text' in part;
    const extractPrompt = isTextData 
        ? `${promptInstructions}\n\nDữ liệu cần phân tích là văn bản CSV sau (được trích xuất từ một bảng tính):` 
        : promptInstructions;

  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { 
          parts: [
              { text: extractPrompt },
              part,
          ] 
      },
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: recordSchema
          },
      },
  });
  
  const rawResponseText = response.text;
  let repairedJson = "";
  try {
      repairedJson = repairJson(rawResponseText);
      const result = JSON.parse(repairedJson);
      return result as ReconciliationRecord[];
  } catch (e) {
      console.error({
        message: "Failed to parse Gemini response for extraction.",
        rawResponse: rawResponseText,
        repairedAttempt: repairedJson,
        error: e,
      });
      throw new GeminiParseError(
        "AI đã trả về một định dạng không hợp lệ và không thể tự động sửa chữa. Vui lòng thử lại, AI có thể cho kết quả tốt hơn ở lần sau.",
        rawResponseText,
        repairedJson
      );
  }
};

export const analyzeFeedback = async (feedbackText: string, userSelectedType: 'bug' | 'suggestion'): Promise<{ category: string; summary: string; }> => {
    const prompt = `Bạn là một AI phân tích phản hồi người dùng. Hãy phân loại phản hồi sau đây thành 'bug', 'feature_request', hoặc 'other'. Sau đó, tóm tắt ý chính của phản hồi trong một câu.
Phản hồi: "${feedbackText}"
Loại người dùng chọn: "${userSelectedType}"

QUAN TRỌNG: Toàn bộ phản hồi của bạn BẮT BUỘC phải là một đối tượng JSON hợp lệ duy nhất, tuân thủ nghiêm ngặt schema đã cho. Không thêm bất kỳ văn bản giải thích nào ngoài JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        category: {
                            type: Type.STRING,
                            description: "Loại phản hồi: 'bug', 'feature_request', hoặc 'other'.",
                            enum: ['bug', 'feature_request', 'other']
                        },
                        summary: {
                            type: Type.STRING,
                            description: "Tóm tắt phản hồi trong một câu."
                        }
                    },
                    required: ['category', 'summary']
                }
            }
        });
        
        const rawResponseText = response.text;
        let repairedJson = "";
        try {
            repairedJson = repairJson(rawResponseText);
            const result = JSON.parse(repairedJson);
            return result as { category: string; summary: string; };
        } catch (e) {
             console.error({
                message: "Failed to parse Gemini response for feedback analysis.",
                rawResponse: rawResponseText,
                repairedAttempt: repairedJson,
                error: e,
            });
            // Fallback to a simple structure if parsing fails
            return {
                category: userSelectedType,
                summary: feedbackText.substring(0, 100) + (feedbackText.length > 100 ? '...' : '')
            };
        }

    } catch (apiError: any) {
        console.error("Gemini API error during feedback analysis:", apiError);
        throw new Error("Lỗi khi giao tiếp với AI để phân tích phản hồi.");
    }
};