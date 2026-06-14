import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Conditional ES module / CommonJS path resolution
let currentFilename = "";
let currentDirname = "";

try {
  if (typeof __dirname !== "undefined") {
    currentDirname = __dirname;
  } else {
    currentFilename = fileURLToPath(import.meta.url);
    currentDirname = path.dirname(currentFilename);
  }
} catch (e) {
  // Safe fallback for edge environments
  currentDirname = process.cwd();
}

// Initialize Gemini SDK lazily to ensure it doesn't crash if key is missing initially
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required on the backend");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

const SYSTEM_INSTRUCTION = `
Considérate una Inteligencia Artificial avanzada llamada Cora, experta consultora estratégica corporativa para "Business Case AI Pro" y dotada de conocimiento general absoluto idéntica a Gemini.

Tu personalidad es inteligente, ágil, empática, profesional y sumamente útil.

Directrices principales de tu comportamiento:
1. CAPACIDAD GENERAL DE IA (COMO GEMINI): Debes responder a cualquier pregunta, duda, consulta o curiosidad que te formule el usuario, sin importar el tema (historia, ciencia, programación, finanzas generales, ideas de negocio, traducción, redacción, de todo). No te limites únicamente a preguntar sobre el caso de negocio. Responde con profundidad y soltura científica, corporativa o casual según demande el tema, tal y como lo haría Gemini.
2. PROPÓSITO ADICIONAL (RECOPILAR DATOS DEL CASO DE NEGOCIO): Aunque puedes responder de todo, tu propósito operativo constante es guiar sutilmente la conversación o aprovechar las respuestas para recopilar/completar los datos del caso de negocio de distribución que el usuario quiere crear.

Los campos clave del caso de negocio que se buscan rellenar son:
- Nombre / Título del proyecto del caso de negocio.
- Años de duración o simulación (ej. 3, 5, 7, 10 años).
- Referencias del Catálogo de Productos a incorporar (nombres de marcas o productos, litros/año estimados, precio neto, aportación neta, rappel comercial).
- Tipo de logística deseado: capilar (última milla), camion (tráiler completo), medio_camion (camión compartido con suplemento) o pallet (coste por bulto).
- Cobertura Geográfica (% de reparto en diferentes regiones, por ejemplo: Madrid 40% y Barcelona 60%).
- Instalación de Equipos de Frío requeridos (tipo de equipo como Neveras expositoras, Grifos de cerveza, etc., y cantidades).

Lógica de costes logísticos prioritarias:
- Camión: Coste por KM según distancias.
- ½ Camión: Coste camión + suplemento de doble descarga de reparto.
- Pallet: Coste por pallet por kilómetro.
- Capilar: Coste camión central (hasta almacén receptor) + tasa de reparto por unidad de caja.

Sé perspicaz. Si el usuario te hace una pregunta general, respóndesela de forma brillante, explicativa y completa. Luego, con total elegancia y fluidez humana, pregúntale o indícale cómo podemos seguir avanzando con su caso de negocio si lo desea (o simplemente mantente a su disposición con naturalidad para lo que necesite). Si introduce múltiples datos del caso, acéptalos automáticamente de forma inteligente y continúa amablemente con lo que falte.
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use body-parsing middleware
  app.use(express.json({ limit: "5mb" }));

  // --- API Routes ---

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Secure Gemini Chat Route (Proxy)
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { history } = req.body;
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "El historial de chat debe ser un arreglo." });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: history.map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      res.json({ text: response.text || "Lo siento, no he podido procesar tu solicitud." });
    } catch (error: any) {
      console.error("Error in /api/gemini/chat proxy:", error);
      res.status(500).json({ error: error.message || "Error interno al procesar el chat de Gemini." });
    }
  });

  // Secure Gemini Case Extraction Route (Proxy)
  app.post("/api/gemini/extract", async (req, res) => {
    try {
      const { history } = req.body;
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "El historial de chat debe ser un arreglo." });
      }

      const prompt = `Analiza la siguiente conversación y extrae los datos del caso de negocio en formato JSON.
  
      Estructura esperada:
      {
        "title": "string",
        "years": number,
        "references": [
          { "name": "string", "litersPerYear": number, "netPrice": number, "contribution": number, "rappel": number }
        ],
        "logisticsType": "capilar" | "camion" | "medio_camion" | "pallet",
        "geographicService": [
          { "region": "string", "percentage": number }
        ],
        "equipmentSelection": {
          "Nombre de equipo (ej: Nevera o Grifo)": cantidad_numero
        }
      }

      CHAT:
      ${history.map((m: any) => `${m.role}: ${m.text}`).join("\n")}
      `;

      const ai = getGeminiClient();
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
              equipmentSelection: {
                type: Type.OBJECT,
                description: "Un mapa de cantidad por tipo de equipo de frío solicitado. Ejemplo: {'Nevera': 1, 'Grifo': 2}",
                additionalProperties: {
                  type: Type.NUMBER
                }
              },
              summary: { type: Type.STRING, description: "Un breve resumen ejecutivo en español sobre la viabilidad y puntos clave del caso de negocio." }
            }
          }
        }
      });

      let extractedData = {};
      try {
        extractedData = JSON.parse(response.text || "{}");
      } catch (parseError) {
        console.error("Error parsing response JSON in extract route:", parseError);
      }

      res.json({ data: extractedData });
    } catch (error: any) {
      console.error("Error in /api/gemini/extract proxy:", error);
      res.status(500).json({ error: error.message || "Error interno al extraer datos de Gemini." });
    }
  });

  // --- Serve Frontend Application ---

  if (process.env.NODE_ENV !== "production") {
    // Development mode: Integrate Vite development middleware
    console.log("Starting server in DEVELOPMENT mode with Vite proxy...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve pre-built static assets from /dist
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Application server running securely on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
