import { GoogleGenAI, Type } from "@google/genai";
import { BusinessCase, LogisticsType, ReferenceInput } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const SYSTEM_INSTRUCTION = `
Eres un experto consultor financiero para "Business Case AI Pro". Tu objetivo es entrevistar al usuario para recopilar datos para un caso de negocio.

Debes preguntar secuencialmente (una por una o agrupadas lógicamente):
1. Nombre del caso de negocio.
2. Años de duración del proyecto.
3. Detalles de las referencias (Productos): Nombre, Litros/año, Precio neto, Aportación (€) y Rappel (%).
4. Tipo de logística: capilar, camion o pallet.
5. Distribución geográfica en % (ej. 20% Madrid, 30% Valencia, 50% Barcelona).

Sé profesional, amable y eficiente. Si el usuario proporciona varios datos a la vez, acéptalos y continúa con lo que falte. Solo pregunta por lo que no sepas.

Al final, cuando tengas todos los datos, confirma con el usuario y resume la información.
`;

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function getNextAgentResponse(history: ChatMessage[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    })),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  return response.text || "Lo siento, no he podido procesar tu solicitud.";
}

export async function extractBusinessCaseData(history: ChatMessage[]): Promise<Partial<BusinessCase>> {
  const prompt = `Analiza la siguiente conversación y extrae los datos del caso de negocio en formato JSON.
  
  Estructura esperada:
  {
    "title": "string",
    "years": number,
    "references": [
      { "name": "string", "litersPerYear": number, "netPrice": number, "contribution": number, "rappel": number }
    ],
    "logisticsType": "capilar" | "camion" | "pallet",
    "geographicService": [
      { "region": "string", "percentage": number }
    ]
  }

  CHAT:
  ${history.map(m => `${m.role}: ${m.text}`).join("\n")}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          years: { type: Type.NUMBER },
          references: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                litersPerYear: { type: Type.NUMBER },
                netPrice: { type: Type.NUMBER },
                contribution: { type: Type.NUMBER },
                rappel: { type: Type.NUMBER }
              }
            }
          },
          logisticsType: { type: Type.STRING },
          geographicService: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                region: { type: Type.STRING },
                percentage: { type: Type.NUMBER }
              }
            }
          },
          summary: { type: Type.STRING, description: "Un breve resumen ejecutivo en español sobre la viabilidad y puntos clave del caso de negocio." }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return {};
  }
}
