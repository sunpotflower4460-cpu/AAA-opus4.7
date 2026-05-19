import { copy } from "../lib/i18n";
import { ZanshinMark } from "./ZanshinMark";
import { PoeticLines } from "./PoeticLines";

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
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-gr-4 py-gr-7 text-center animate-fadeIn">
      <ZanshinMark size={55} className="text-sumi/72" />
      <div className="flex flex-col gap-gr-3">
        <PoeticLines
          as="p"
          lines={copy.emptyTitleLines}
          className="max-w-[15em] font-mincho text-[16px] leading-[1.82] tracking-[0.02em] text-sumi/90"
        />
        <PoeticLines
          as="p"
          lines={copy.emptySubtitleLines}
          className="max-w-[14em] font-mincho text-[13px] leading-[1.9] tracking-[0.02em] text-ink-muted"
        />
      </div>
      <button
        type="button"
        onClick={onCreate}
        aria-label={copy.emptyAction}
        className="
          mt-gr-2 rounded-full border border-[color:var(--color-line)]
          bg-paper/82 px-gr-5 py-[10px] font-mincho text-[14px] tracking-mincho text-sumi
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
