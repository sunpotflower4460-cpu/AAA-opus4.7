import { useI18n } from "../i18n/useI18n";
import { formatZanshinDate, getTimeOfDay, makeNoteDateFormatter } from "../lib/zanshinDate";

type ZanshinDateStampProps = {
  isoString: string;
  /** true のとき、横並びコンパクト表示 */
  compact?: boolean;
  /** 保存後、紙に定着する短い余韻を出す */
  isSettling?: boolean;
  decorative?: boolean;
};

/**
 * 残心の日付印コンポーネント。
 * 日付を管理情報ではなく、紙に残ったしるしとして表示する。
 */
export function ZanshinDateStamp({
  isoString,
  compact = false,
  isSettling = false,
  decorative = false,
}: ZanshinDateStampProps) {
  const { copy, locale } = useI18n();
  const date = formatZanshinDate(isoString);
  const timeOfDay = getTimeOfDay(isoString);

  // 壊れた日時から「夜の余白」だけが残るような誤表示をしない。
  if (!timeOfDay || !date) return null;
  const displayDate = decorative ? null : makeNoteDateFormatter({ formatLocale: locale })(isoString);

  return (
    <div
      className={[
        "zanshin-date-stamp",
        compact ? "zanshin-date-stamp--compact" : "",
        isSettling ? "settling" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={decorative || undefined}
    >
      <span className="zanshin-moon-seal" aria-hidden="true" />
      <span className="zanshin-date-stamp__text">
        <span className="zanshin-yohaku-label">{copy.timeOfDay[timeOfDay]}</span>
        <time className="zanshin-date" dateTime={isoString} aria-label={displayDate ? copy.creationDate({ displayDate }) : undefined}>
          {date}
        </time>
      </span>
    </div>
  );
}

export default ZanshinDateStamp;
