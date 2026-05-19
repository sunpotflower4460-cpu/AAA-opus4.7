/**
 * 残心の日付印 — 日付を管理情報ではなく、紙に残ったしるしとして扱う。
 *
 * Phase 13:
 * - 日付は YYYY.MM.DD 形式（点区切り、静かで紙の印に合う）
 * - 時間帯ラベルは「朝/昼/夕/夜の余白」として表示
 * - createdAt を基準に、そのメモが置かれた時の余白を示す
 */

/**
 * ISO文字列を残心の日付表記に変換する。
 * 例: "2026-05-19T12:30:00.000Z" → "2026.05.19"
 */
export function formatZanshinDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/**
 * ISO文字列から時間帯ラベルを生成する。
 * - 朝の余白: 5:00 - 10:59
 * - 昼の余白: 11:00 - 15:59
 * - 夕の余白: 16:00 - 18:59
 * - 夜の余白: 19:00 - 4:59
 */
export function getYohakuLabel(isoString: string): string {
  const hour = new Date(isoString).getHours();
  if (hour >= 5 && hour < 11) return "朝の余白";
  if (hour >= 11 && hour < 16) return "昼の余白";
  if (hour >= 16 && hour < 19) return "夕の余白";
  return "夜の余白";
}

/**
 * 日付印のための情報をまとめて返す。
 * メモカード・エディタで日付印UIを表示するときに使う。
 */
export function getZanshinStamp(isoString: string): {
  date: string;
  label: string;
} {
  return {
    date: formatZanshinDate(isoString),
    label: getYohakuLabel(isoString),
  };
}
