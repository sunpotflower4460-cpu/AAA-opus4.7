import { getZanshinStamp } from "../lib/zanshinDate";

type ZanshinDateStampProps = {
  isoString: string;
  /** true のとき、横並びコンパクト表示 */
  compact?: boolean;
  /** aria-label に追加する説明文（任意） */
  ariaLabel?: string;
};

/**
 * 残心の日付印コンポーネント。
 * 日付を管理情報ではなく、紙に残ったしるしとして表示する。
 *
 * Phase 13:
 * - 「朝/昼/夕/夜の余白」ラベルと日付を控えめに表示
 * - compact=true で横並び、false（デフォルト）で縦並び
 * - 日付が主役になりすぎないよう、サイズと色を抑える
 */
export function ZanshinDateStamp({
  isoString,
  compact = false,
  ariaLabel,
}: ZanshinDateStampProps) {
  const { label, date } = getZanshinStamp(isoString);

  return (
    <div
      className={
        compact
          ? "zanshin-date-stamp zanshin-date-stamp--compact"
          : "zanshin-date-stamp"
      }
      aria-label={ariaLabel || `${label} ${date}`}
    >
      <span className="zanshin-yohaku-label">{label}</span>
      <span className="zanshin-date">{date}</span>
    </div>
  );
}

export default ZanshinDateStamp;
