import { GoogleGenAI, Type } from "@google/genai";
import type { ReconciliationRecord, ReconciliationResult, ProductItem, ComparedItem } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. This application cannot function without an API key.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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
    required: ['id', 'date', 'description', 'amount'],
};

/**
 * Attempts to repair a potentially malformed JSON string.
 * It extracts the main JSON object/array and fixes common errors like trailing commas.
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

    // 2. Isolate the main JSON object or array
    const firstBrace = repaired.indexOf('{');
    const firstBracket = repaired.indexOf('[');
    const lastBrace = repaired.lastIndexOf('}');
    const lastBracket = repaired.lastIndexOf(']');

    let startIndex = -1;
    let endIndex = -1;

    // Determine the start of the JSON content (either { or [)
    if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
        startIndex = firstBracket;
    } else if (firstBrace !== -1) {
        startIndex = firstBrace;
    }
    
    // Determine the end of the JSON content
    if (startIndex !== -1) {
      if (repaired.startsWith('[')) {
          endIndex = lastBracket;
      } else {
          endIndex = lastBrace;
      }
    }
    
    if (startIndex !== -1 && endIndex > startIndex) {
        repaired = repaired.substring(startIndex, endIndex + 1);
    }

    // 3. Fix common syntax errors, like trailing commas
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
  
  const extractPrompt = `Phân tích tệp đính kèm và trích xuất tất cả các mục giao dịch. Đối với mỗi mục, cung cấp mã, ngày, mô tả, tổng số tiền, và danh sách sản phẩm chi tiết nếu có. Toàn bộ phản hồi của bạn BẮT BUỘC phải là một mảng JSON hợp lệ, không chứa bất kỳ văn bản giải thích nào khác.`;

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
      throw new Error("Lỗi! AI đã trả về một định dạng không hợp lệ và không thể tự động sửa chữa. Vui lòng thử lại, AI có thể cho kết quả tốt hơn ở lần sau.");
  }
};

export const reconcileData = async (supplierData: ReconciliationRecord[], systemData: ReconciliationRecord[]): Promise<ReconciliationResult> => {
  const allSupplierItems = supplierData.flatMap(record =>
    (record.items && record.items.length > 0)
      ? record.items
      : [{ name: record.description, quantity: 1, unitPrice: record.amount, totalPrice: record.amount }]
  );
  const allSystemItems = systemData.flatMap(record => record.items || []);

  const prompt = `Bạn là một AI kiểm toán viên tài chính chuyên nghiệp. Nhiệm vụ của bạn là đối chiếu chi tiết từng dòng sản phẩm giữa hai bộ dữ liệu: Dữ liệu từ Nhà Cung Cấp (NCC) và Dữ liệu trên Wecare của chúng tôi.

Dữ liệu NCC:
\`\`\`json
${JSON.stringify(allSupplierItems, null, 2)}
\`\`\`

Dữ liệu Wecare:
\`\`\`json
${JSON.stringify(allSystemItems, null, 2)}
\`\`\`

YÊU CẦU:
1.  **So khớp thông minh**: So khớp các sản phẩm dựa trên tên (cho phép sai khác nhỏ về chính tả/mô tả), sau đó kiểm tra số lượng và đơn giá.
2.  **Phân loại kết quả**: Với mỗi cặp so khớp hoặc mỗi mục không khớp, hãy phân loại vào một trong các trạng thái sau: 'Khớp', 'Chênh lệch', 'Chỉ có ở NCC', 'Chỉ có ở Wecare'.
3.  **Tạo tóm tắt**: Cung cấp một bản tóm tắt ngắn gọn bằng tiếng Việt về kết quả đối chiếu.
4.  **Tính toán tổng hợp**: Tính tổng số tiền của mỗi bên và chênh lệch.

QUAN TRỌNG: Toàn bộ phản hồi của bạn BẮT BUỘC phải là một đối tượng JSON hợp lệ duy nhất, tuân thủ nghiêm ngặt schema đã cho. Không thêm bất kỳ văn bản giải thích nào ngoài JSON.`;

  const nullableProductItemSchema = {
    ...productItemSchema,
    nullable: true,
  };

  const comparedItemSchema = {
    type: Type.OBJECT,
    properties: {
        status: { type: Type.STRING, enum: ['Khớp', 'Chênh lệch', 'Chỉ có ở NCC', 'Chỉ có ở Wecare'] },
        supplierItem: nullableProductItemSchema,
        systemItem: nullableProductItemSchema,
        details: { type: Type.STRING, description: 'Giải thích ngắn gọn về chênh lệch (nếu có)' }
    },
    required: ['status', 'details']
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
                totalSystemAmount: { type: Type.NUMBER, description: 'Tổng số tiền từ dữ liệu Wecare' },
                difference: { type: Type.NUMBER, description: 'Chênh lệch (supplier - wecare)' },
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
      throw new Error("Lỗi! AI đã trả về một định dạng không hợp lệ và không thể tự động sửa chữa. Vui lòng thử lại, AI có thể cho kết quả tốt hơn ở lần sau.");
  }
};