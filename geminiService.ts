import { GoogleGenAI, Type } from "@google/genai";
import { GeminiParsedData, TransactionType } from "../types.ts";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const parseFinancialDocument = async (base64Image: string, mimeType: string): Promise<GeminiParsedData[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this image of a financial document or spreadsheet.
    Extract the items as a list of financial entries.
    For each entry, identify:
    1. The category name (e.g., "Chicken", "Rent", "Salary").
    2. The amount (numeric value).
    3. The type (INCOME or EXPENSE). If it looks like a sale or inbound, it's INCOME. If it looks like a cost or outbound, it's EXPENSE.
    4. An approximate date if visible, otherwise ignore.

    Return the data strictly in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              categoryName: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: [TransactionType.INCOME, TransactionType.EXPENSE] },
              date: { type: Type.STRING, description: "YYYY-MM-DD format if found, otherwise empty" }
            },
            required: ["categoryName", "amount", "type"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as GeminiParsedData[];

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
