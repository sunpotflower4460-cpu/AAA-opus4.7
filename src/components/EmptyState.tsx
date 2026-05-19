import { copy } from "../lib/i18n";
import { ZanshinMark } from "./ZanshinMark";

type Props = {
  onCreate: () => void;
  /** 検索結果としての空状態か */
  searching?: boolean;
};

export function EmptyState({ onCreate, searching = false }: Props) {
  if (searching) {
    return (
      <div className="flex flex-col items-center gap-gr-3 py-gr-7 text-center animate-fadeIn">
        <span
          aria-hidden="true"
          className="block h-px w-gr-5 bg-gradient-to-r from-transparent via-ink-muted/40 to-transparent"
        />
        <p className="font-mincho text-base tracking-mincho text-ink-muted">
          {copy.noSearchResult}
        </p>
        <p className="english-subcopy">
          {copy.noSearchResultEn}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-gr-5 py-gr-7 text-center animate-fadeIn">
      <ZanshinMark size={89} breathing className="text-sumi/80" />
      <div className="flex flex-col gap-gr-3">
        <p className="font-mincho text-[17px] tracking-mincho text-sumi/90">
          {copy.emptyTitle}
        </p>
        <p className="font-mincho text-[13px] leading-ample text-ink-muted whitespace-pre-line">
          {copy.emptySubtitle}
        </p>
        <p className="english-subcopy">{copy.emptySubtitleEn}</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        aria-label={copy.emptyAction}
        className="
          mt-gr-3 rounded-full border border-[color:var(--color-line)]
          bg-paper/90 px-gr-5 py-gr-3 font-mincho text-[15px] tracking-mincho text-sumi
          shadow-paper-soft transition-soft
          hover:bg-paper hover:shadow-paper hover:-translate-y-[1px]
          active:translate-y-0 active:scale-[0.99]
        "
      >
        {copy.emptyAction}
      </button>
    </div>
  );
}

export default EmptyState;
