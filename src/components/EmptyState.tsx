import { useI18n } from "../i18n/useI18n";
import { ZanshinMark } from "./ZanshinMark";
import { PoeticLines } from "./PoeticLines";

type Props = {
  /** 検索結果としての空状態か */
  searching?: boolean;
};

export function EmptyState({ searching = false }: Props) {
  const { copy } = useI18n();
  if (searching) {
    return (
      <div className="flex flex-col items-center gap-gr-3 py-gr-7 text-center animate-fadeIn">
        <span
          aria-hidden="true"
          className="block h-px w-gr-5 bg-gradient-to-r from-transparent via-ink-muted/40 to-transparent"
        />
        <p className="font-mincho text-base tracking-mincho text-ink-muted jp-text-discipline">
          {copy.noSearchResult}
        </p>
        <p className="text-[14px] leading-ample text-ink-muted">{copy.noSearchResultHint}</p>
      </div>
    );
  }

  return (
    <div className="zanshin-empty-state flex flex-col items-center gap-gr-4 py-gr-7 text-center animate-fadeIn">
      <ZanshinMark size={55} className="text-sumi/72" />
      <div className="flex flex-col gap-gr-3">
        <PoeticLines
          as="p"
          lines={copy.emptyTitleLines}
          className="max-w-[15em] font-mincho text-[16px] leading-[1.82] tracking-[0.02em] text-sumi/90 jp-poetic-copy"
        />
        <PoeticLines
          as="p"
          lines={copy.emptySubtitleLines}
          className="max-w-[14em] font-mincho text-[13px] leading-[1.9] tracking-[0.02em] text-ink-muted jp-poetic-copy"
        />
      </div>
      {/* 作成操作は、常設の「メモを書く」に一つだけ置く。空状態に別の同名ボタンを重ねない（D01）。 */}
    </div>
  );
}

export default EmptyState;
