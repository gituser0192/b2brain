import { z } from "zod";
import { metaId } from "./meta-lead.validation.js";

export const metaConnectionReturnPath = z.string().trim().max(200).regex(/^\/automation(?:[?#][^\s]*)?$/).default("/automation");
export const metaConnectionStartSchema = z.object({ returnPath: metaConnectionReturnPath.optional() }).strict();
export const metaConnectionCallbackSchema = z.object({ state: z.string().min(40).max(200), code: z.string().min(3).max(200) }).strict();
export const metaPageSelectionSchema = z.object({ pageId: metaId }).strict();
export const metaFormSelectionSchema = z.object({ formIds: z.array(metaId).min(1).max(100) }).strict();

export type MetaConnectionStartInput = z.infer<typeof metaConnectionStartSchema>;
export type MetaConnectionCallbackInput = z.infer<typeof metaConnectionCallbackSchema>;
export type MetaPageSelectionInput = z.infer<typeof metaPageSelectionSchema>;
export type MetaFormSelectionInput = z.infer<typeof metaFormSelectionSchema>;
