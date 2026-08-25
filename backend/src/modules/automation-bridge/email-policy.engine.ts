import type { EmailDeliveryPolicyInput } from "./bridge.validation.js";
export const defaultEmailPolicy: EmailDeliveryPolicyInput = { mode: "MANUAL", dailyContactLimit: 50, quietHoursEnabled: true, quietHoursStart: "20:00", quietHoursEnd: "08:00", timezone: "Asia/Kolkata", maxAttempts: 3, emergencyPaused: false };
export function emailPolicy(value: unknown): EmailDeliveryPolicyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultEmailPolicy;
  const policy = (value as Record<string, unknown>).emailDeliveryPolicy;
  return policy && typeof policy === "object" && !Array.isArray(policy) ? { ...defaultEmailPolicy, ...(policy as Partial<EmailDeliveryPolicyInput>) } : defaultEmailPolicy;
}
function localMinutes(timezone: string, date: Date) { const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: timezone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); return Number(parts.hour) * 60 + Number(parts.minute); }
const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour! * 60 + minute!; };
export function isQuietHours(policy: EmailDeliveryPolicyInput, now = new Date()) { if (!policy.quietHoursEnabled) return false; const current = localMinutes(policy.timezone, now), start = minutes(policy.quietHoursStart), end = minutes(policy.quietHoursEnd); return start === end || (start < end ? current >= start && current < end : current >= start || current < end); }
