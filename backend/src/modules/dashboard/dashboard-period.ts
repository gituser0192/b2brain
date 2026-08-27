type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const parts = (date: Date, timezone: string): ZonedDateParts => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return values as ZonedDateParts;
};

export function zonedDateToUtc(year: number, month: number, day: number, timezone: string) {
  const target = Date.UTC(year, month - 1, day);
  let guess = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = parts(guess, timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess = new Date(guess.getTime() + target - represented);
  }
  return guess;
}

export function dashboardMonths(now: Date, timezone: string, count = 6) {
  const current = parts(now, timezone);
  const starts = Array.from({ length: count + 1 }, (_, index) => {
    const date = new Date(Date.UTC(current.year, current.month - count + index, 1));
    return zonedDateToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, timezone);
  });
  return { currentStart: starts.at(-2)!, currentEnd: starts.at(-1)!, historyStart: starts[0]!, boundaries: starts };
}

export function monthKey(date: Date, timezone: string) {
  const value = parts(date, timezone);
  return `${value.year}-${String(value.month).padStart(2, "0")}`;
}
