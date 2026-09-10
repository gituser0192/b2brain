import { z } from "zod";

const providerId = z.string().trim().regex(/^\d{5,32}$/);

export const whatsappConnectionReturnPath = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/automation(?:[?#][^\s]*)?$/)
  .default("/automation");
export const whatsappConnectionStartSchema = z
  .object({ returnPath: whatsappConnectionReturnPath.optional() })
  .strict();
export const whatsappConnectionCallbackSchema = z
  .object({ state: z.string().min(40).max(200), code: z.string().min(3).max(200) })
  .strict();
export const whatsappAccountSelectionSchema = z.object({ wabaId: providerId }).strict();
export const whatsappNumberSelectionSchema = z.object({ phoneNumberId: providerId }).strict();

export type WhatsappConnectionStartInput = z.infer<typeof whatsappConnectionStartSchema>;
export type WhatsappConnectionCallbackInput = z.infer<typeof whatsappConnectionCallbackSchema>;
export type WhatsappAccountSelectionInput = z.infer<typeof whatsappAccountSelectionSchema>;
export type WhatsappNumberSelectionInput = z.infer<typeof whatsappNumberSelectionSchema>;
