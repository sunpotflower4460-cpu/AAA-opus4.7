import type { Locale } from "../types/note";

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * 更新日時を静かに表示する。
 * - 今日 / 昨日 はラベルで返す
 * - それ以外は YYYY/MM/DD で返す
 */
export function formatUpdatedAt(
  iso: string,
  locale: Locale = "ja",
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.round((today - target) / 86_400_000);

  if (locale === "en") {
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
  } else {
    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

/** ISO 文字列で「いま」を返す */
export function nowIso(): string {
  return new Date().toISOString();
}
