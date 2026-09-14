const replacements: Record<string, string> = {
  custmers: "customers", clients: "customers", client: "customer", bussness: "business", wich: "which",
  followups: "follow ups", kro: "karo", dikhao: "show", batao: "show", kitni: "how many", kitne: "how many",
  hain: "", mere: "my", mera: "my", meri: "my", paisa: "payment", kal: "tomorrow",
};
const protectedToken = /(?:\b\d{4,}\b|[\w.+-]+@[\w.-]+|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|\b[A-Z]{2,}-\d+\b|₹|\$)/i;
const injection = /(?:ignore (?:all |the )?(?:previous|prior)|system prompt|developer message|reveal.*secret|bypass.*(?:permission|confirmation)|act as admin)/i;

export type ResolvedDate = { expression: string; date: string };

export function resolveRelativeDate(message: string, now = new Date(), timeZone = "Asia/Kolkata"): ResolvedDate | null {
  if (/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(message)) return null;
  const local = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)}T00:00:00.000Z`);
  const lower = message.toLowerCase();
  const shift = (days: number, expression: string) => { const date = new Date(local); date.setUTCDate(date.getUTCDate() + days); return { expression, date: date.toISOString().slice(0, 10) }; };
  if (/\b(today|aaj)\b/.test(lower)) return shift(0, "today");
  if (/\b(tomorrow|kal)\b/.test(lower)) return shift(1, "tomorrow");
  if (/\byesterday\b/.test(lower)) return shift(-1, "yesterday");
  if (/\bthis month\b/.test(lower)) return { expression: "this month", date: local.toISOString().slice(0, 7) };
  if (/\blast month\b/.test(lower)) { local.setUTCMonth(local.getUTCMonth() - 1); return { expression: "last month", date: local.toISOString().slice(0, 7) }; }
  const weekday = lower.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekday) { const target = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(weekday[1]!); return shift(((target - local.getUTCDay() + 7) % 7) || 7, weekday[0]); }
  return null;
}

export function normalizeWorkspaceRequest(original: string) {
  const compact = original.normalize("NFKC").replace(/[“”‘’]/g, "'").replace(/\s+/g, " ").trim();
  if (injection.test(compact)) return { original, normalized: compact.toLowerCase(), safe: false, changed: false };
  if (protectedToken.test(compact)) return { original, normalized: compact.toLowerCase(), safe: true, changed: false };
  const normalized = compact.toLowerCase().replace(/[^\p{L}\p{M}\p{N}+' -]/gu, " ").split(/\s+/).map((token) => replacements[token] ?? token).filter(Boolean).join(" ");
  return { original, normalized, safe: true, changed: normalized !== compact.toLowerCase() };
}
