export function nextDailyOccurrence(timezone: string, localTime: string, after = new Date()) {
  const [hour, minute] = localTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("Invalid local schedule time.");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const start = new Date(Math.floor(after.getTime() / 60_000) * 60_000 + 60_000);
  for (let index = 0; index < 60 * 49; index += 1) {
    const candidate = new Date(start.getTime() + index * 60_000), parts = Object.fromEntries(formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    if (Number(parts.hour) === hour && Number(parts.minute) === minute) return candidate;
  }
  throw new Error("Unable to calculate the next scheduled time.");
}
