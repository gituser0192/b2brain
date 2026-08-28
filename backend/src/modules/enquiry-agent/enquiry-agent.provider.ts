import { z } from "zod";

export const agentAnalysisSchema = z.object({
  intent: z.enum(["GREETING", "SALES_ENQUIRY", "SERVICE_PRICING", "CUSTOMER_REQUIREMENT", "FOLLOW_UP_REQUEST", "SUPPORT_REQUEST", "COMPLAINT", "REFUND_PAYMENT", "SPAM", "UNKNOWN"]),
  confidence: z.number().min(0).max(1),
  language: z.enum(["ENGLISH", "HINDI", "HINGLISH"]),
  promptInjectionDetected: z.boolean(),
});
export type AgentAnalysis = z.infer<typeof agentAnalysisSchema>;

export interface EnquiryAgentProvider {
  readonly name: string;
  readonly productionModel: boolean;
  analyze(message: string): Promise<AgentAnalysis>;
}

const has = (text: string, words: string[]) => words.some((word) => text.includes(word));
export class DeterministicEnquiryAgentProvider implements EnquiryAgentProvider {
  readonly name = "deterministic-development-fallback-v1";
  readonly productionModel = false;
  analyze(message: string): Promise<AgentAnalysis> {
    const text = message.toLowerCase();
    const promptInjectionDetected = has(text, ["ignore previous", "system prompt", "reveal secret", "show token", "bypass policy", "organizationid"]);
    const language = /[\u0900-\u097f]/.test(message) ? "HINDI" : has(text, ["mujhe", "chahiye", "kya", "hai", "karna", "batao", "kaise"]) ? "HINGLISH" : "ENGLISH";
    let intent: AgentAnalysis["intent"] = "UNKNOWN", confidence = 0.52;
    if (has(text, ["casino", "lottery winner", "free money", "crypto profit", "buy followers"])) [intent, confidence] = ["SPAM", 0.98];
    else if (has(text, ["refund", "payment", "upi", "chargeback", "पैसे वापस", "भुगतान"])) [intent, confidence] = ["REFUND_PAYMENT", 0.96];
    else if (has(text, ["complaint", "fraud", "angry", "legal", "consumer court", "शिकायत"])) [intent, confidence] = ["COMPLAINT", 0.94];
    else if (has(text, ["not working", "error", "support", "problem", "issue", "काम नहीं", "dikkat"])) [intent, confidence] = ["SUPPORT_REQUEST", 0.91];
    else if (has(text, ["follow up", "call me", "contact me", "baat karni", "फोन करना"])) [intent, confidence] = ["FOLLOW_UP_REQUEST", 0.9];
    else if (has(text, ["price", "pricing", "cost", "discount", "available", "कीमत", "kitne ka"])) [intent, confidence] = ["SERVICE_PRICING", 0.92];
    else if (has(text, ["requirement", "need", "want", "chahiye", "ज़रूरत"])) [intent, confidence] = ["CUSTOMER_REQUIREMENT", 0.84];
    else if (has(text, ["service", "demo", "quotation", "interested", "sales", "business grow"])) [intent, confidence] = ["SALES_ENQUIRY", 0.88];
    else if (has(text, ["hello", "hi", "hey", "namaste", "नमस्ते"])) [intent, confidence] = ["GREETING", 0.96];
    if (promptInjectionDetected) confidence = Math.min(confidence, 0.2);
    return Promise.resolve(agentAnalysisSchema.parse({ intent, confidence, language, promptInjectionDetected }));
  }
}
