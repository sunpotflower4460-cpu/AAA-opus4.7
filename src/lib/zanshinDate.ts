function toValidDate(isoString: string): Date | null {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The date stamp is a Gregorian date in the device's current time zone. */
export function formatZanshinDate(isoString: string): string {
  const date = toValidDate(isoString);
  if (!date) return "";

  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export function getTimeOfDay(isoString: string): TimeOfDay | null {
  const date = toValidDate(isoString);
  if (!date) return null;

  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

type DateFormat = {
  formatLocale: string;
  withTime?: boolean;
  calendar?: string;
  numberingSystem?: string;
  timeZone?: string;
};

export function makeNoteDateFormatter({
  formatLocale,
  withTime = false,
  calendar = "gregory",
  numberingSystem = "latn",
  timeZone,
}: DateFormat) {
  const format = new Intl.DateTimeFormat(formatLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: withTime ? "numeric" : undefined,
    minute: withTime ? "2-digit" : undefined,
    calendar,
    numberingSystem,
    timeZone,
  });
  return (isoString: string) => {
    const date = toValidDate(isoString);
    return date ? format.format(date) : null;
  };
}
