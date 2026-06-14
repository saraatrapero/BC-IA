import { BusinessCase } from "../types";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

/**
 * Sends chat message history to the backend proxy for a secure AI assistant response.
 */
export async function getNextAgentResponse(history: ChatMessage[]): Promise<string> {
  try {
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ history })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.text || "Lo siento, no he podido procesar tu solicitud.";
  } catch (error) {
    console.error("Error calling getNextAgentResponse proxy:", error);
    return "Lo siento, ha ocurrido un error al conectar con el asistente de seguridad Cora.";
  }
}

/**
 * Submits conversational history to the backend proxy to securely parse and extract structured Business Case data.
 */
export async function extractBusinessCaseData(history: ChatMessage[]): Promise<Partial<BusinessCase>> {
  try {
    const response = await fetch("/api/gemini/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ history })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    const json = await response.json();
    return json.data || {};
  } catch (error) {
    console.error("Error calling extractBusinessCaseData proxy:", error);
    return {};
  }
}
