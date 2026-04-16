import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface TriageResult {
  orderId: string;
  category: "Devolución" | "Cambio de Talla" | "Entrega Fallida" | "Facturación";
  sentiment: "Calmado" | "Frustrado" | "Urgente";
  requiresHumanIntervention: boolean;
  summary: string;
  status?: "pending" | "resolved";
  createdAt?: string;
  id?: string;
  emailText?: string;
}

export async function triageEmail(emailText: string): Promise<TriageResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analiza el siguiente correo de un cliente de Zalando y extrae los datos estructurados:

Correo:
"""
${emailText}
"""`,
    config: {
      systemInstruction: `Eres el Agente de Triaje Inteligente de Zalando.
Tu objetivo es procesar correos de clientes que llegan desordenados y convertirlos en datos estructurados.

INSTRUCCIONES:
1. Extrae el 'Order ID' (formato esperado: ZA-XXXX). Si no existe, pon "FALTANTE".
2. Clasifica la categoría principal: [Devolución, Cambio de Talla, Entrega Fallida, Facturación].
3. Detecta el Sentimiento: [Calmado, Frustrado, Urgente].
4. Si faltan datos críticos o hay excepciones (ej. mezcla temas), marca 'requiresHumanIntervention: true'.
5. Proporciona un breve resumen de la solicitud.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          orderId: {
            type: Type.STRING,
            description: "The Order ID in ZA-XXXX format or 'FALTANTE'.",
          },
          category: {
            type: Type.STRING,
            enum: ["Devolución", "Cambio de Talla", "Entrega Fallida", "Facturación"],
            description: "The main category of the request.",
          },
          sentiment: {
            type: Type.STRING,
            enum: ["Calmado", "Frustrado", "Urgente"],
            description: "The detected sentiment of the customer.",
          },
          requiresHumanIntervention: {
            type: Type.BOOLEAN,
            description: "Whether the request requires human intervention.",
          },
          summary: {
            type: Type.STRING,
            description: "A brief summary of the request.",
          },
        },
        required: ["orderId", "category", "sentiment", "requiresHumanIntervention", "summary"],
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return result as TriageResult;
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    throw new Error("Failed to parse triage result.");
  }
}
