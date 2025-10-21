
import { GoogleGenAI, Type } from "@google/genai";
import type { ReconciliationRecord, ReconciliationResult, ProductItem, ComparedItem } from '../types';

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

const fileToGenerativePart = (file: File) => {
  return new Promise<{ inlineData: { data: string, mimeType: string } }>((resolve, reject) => {
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
  let imagePart;
  try {
      imagePart = await fileToGenerativePart(file);
  } catch (fileError: any) {
      console.error(`Error processing file ${file.name}:`, fileError);
      throw new Error(`Không thể xử lý tệp "${file.name}". Lỗi: ${fileError.message || 'Lỗi không xác định'}`);
  }
  
  const extractPrompt = `Phân tích tệp đính kèm và trích xuất tất cả các mục giao dịch.
HƯỚNG DẪN QUAN TRỌNG:
1.  **Gộp Tên Sản Phẩm**: Nếu tên sản phẩm và quy cách (hoặc mô tả chi tiết) nằm ở hai cột riêng biệt (ví dụ: cột 'Mặt hàng' và cột 'Quy cách'), bạn PHẢI gộp chúng lại thành một tên sản phẩm duy nhất trong trường 'name'. Ví dụ: nếu 'Mặt hàng' là 'Cổ dê bulong inox 304' và 'Quy cách' là 'D55', thì tên sản phẩm trích xuất phải là 'Cổ dê bulong inox 304 D55'.
2.  **Bỏ qua dòng bị gạch**: Bỏ qua và không trích xuất bất kỳ dòng nào có dấu hiệu bị gạch bỏ hoặc gạch ngang. Chỉ trích xuất những mục hợp lệ.

Đối với mỗi mục, cung cấp mã, ngày, mô tả, tổng số tiền, và danh sách sản phẩm chi tiết nếu có. Toàn bộ phản hồi của bạn BẮT BUỘC phải là một mảng JSON hợp lệ, không chứa bất kỳ văn bản giải thích nào khác.`;

  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { 
          parts: [
              { text: extractPrompt },
              imagePart,
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

export const reconcileData = async (supplierData: ReconciliationRecord[], systemData: ReconciliationRecord[]): Promise<ReconciliationResult> => {
  const allSupplierItems = supplierData.flatMap(record =>
    (record.items && record.items.length > 0)
      ? record.items
      : [{ name: record.description, quantity: 1, unitPrice: record.amount, totalPrice: record.amount }]
  );
  const allSystemItems = systemData.flatMap(record => record.items || []);

  const prompt = `Bạn là một AI kiểm toán viên tài chính chuyên nghiệp. Nhiệm vụ của bạn là đối chiếu dữ liệu từ Nhà Cung Cấp (NCC) với dữ liệu trên hệ thống Wecare.

**Quy trình:**
Với MỖI MỘT sản phẩm từ "Dữ liệu NCC", bạn phải:
1.  **Tìm kiếm** trong "Dữ liệu Wecare" để tìm sản phẩm tương ứng. Việc so khớp nên dựa trên tên (cho phép sai khác nhỏ về chính tả/mô tả).
2.  **So sánh** số lượng và đơn giá nếu tìm thấy.
3.  **Phân loại** kết quả cho sản phẩm NCC đó vào một trong các trạng thái sau:
    *   'Khớp': Nếu tìm thấy sản phẩm tương ứng trong Wecare và cả số lượng và đơn giá đều khớp.
    *   'Chênh lệch': Nếu tìm thấy sản phẩm tương ứng nhưng số lượng hoặc đơn giá không khớp.
    *   'Chỉ có ở NCC': Nếu không tìm thấy bất kỳ sản phẩm nào tương ứng trong dữ liệu Wecare.

**Dữ liệu đầu vào:**

Dữ liệu NCC:
\`\`\`json
${JSON.stringify(allSupplierItems, null, 2)}
\`\`\`

Dữ liệu Wecare:
\`\`\`json
${JSON.stringify(allSystemItems, null, 2)}
\`\`\`

**YÊU CẦU ĐẦU RA:**
1.  **Tạo danh sách kết quả**: Danh sách này phải có cùng số lượng mục với "Dữ liệu NCC". Mỗi mục trong danh sách kết quả tương ứng với một mục trong "Dữ liệu NCC".
2.  **Tạo tóm tắt**: Cung cấp một bản tóm tắt ngắn gọn bằng tiếng Việt về kết quả đối chiếu.
3.  **Tính toán tổng hợp**: Tính tổng số tiền từ dữ liệu NCC, tổng số tiền từ các mục Wecare đã được so khớp, và chênh lệch.
4.  **Ghi chú chi tiết**: Chỉ điền thông tin vào trường \`details\` khi có 'Chênh lệch' hoặc 'Chỉ có ở NCC'. Để trống cho các mục 'Khớp'.

QUAN TRỌNG: Toàn bộ phản hồi của bạn BẮT BUỘC phải là một đối tượng JSON hợp lệ duy nhất, tuân thủ nghiêm ngặt schema đã cho. Không thêm bất kỳ văn bản giải thích nào ngoài JSON.`;

  const nullableProductItemSchema = {
    ...productItemSchema,
    nullable: true,
  };

  const comparedItemSchema = {
    type: Type.OBJECT,
    properties: {
        status: { type: Type.STRING, enum: ['Khớp', 'Chênh lệch', 'Chỉ có ở NCC'] },
        supplierItem: productItemSchema,
        systemItem: nullableProductItemSchema,
        details: { type: Type.STRING, description: 'Chỉ cung cấp giải thích khi có chênh lệch hoặc thiếu sót. Để trống nếu trạng thái là "Khớp".' }
    },
    required: ['status', 'details', 'supplierItem']
  };

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
                summary: { type: Type.STRING, description: 'Tóm tắt kết quả đối chiếu bằng tiếng Việt' },
                totalSupplierAmount: { type: Type.NUMBER, description: 'Tổng số tiền từ dữ liệu nhà cung cấp' },
                totalSystemAmount: { type: Type.NUMBER, description: 'Tổng số tiền từ dữ liệu Wecare đã được so khớp' },
                difference: { type: Type.NUMBER, description: 'Chênh lệch (supplier - wecare matched)' },
                comparedItems: {
                    type: Type.ARRAY,
                    items: comparedItemSchema,
                    description: 'Danh sách chi tiết các mục đã được đối chiếu'
                },
            },
            required: ['summary', 'totalSupplierAmount', 'totalSystemAmount', 'difference', 'comparedItems']
        }
    }
  });

  const rawResponseText = response.text;
  let repairedJson = "";
  try {
      repairedJson = repairJson(rawResponseText);
      const aiResult = JSON.parse(repairedJson) as ReconciliationResult;
      return aiResult;
  } catch (e) {
      console.error({
        message: "Failed to parse Gemini response for reconciliation.",
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
