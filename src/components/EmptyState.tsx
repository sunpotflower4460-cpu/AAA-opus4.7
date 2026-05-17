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
      <div className="flex flex-col items-center gap-gr-3 py-gr-7 text-center">
        <p className="font-mincho text-base text-ink-muted">
          {copy.noSearchResult}
        </p>
        <p className="text-[13px] text-ink-muted/80">{copy.noSearchResultEn}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-gr-5 py-gr-7 text-center animate-fadeIn">
      <ZanshinMark size={89} breathing className="text-sumi/80" />
      <div className="flex flex-col gap-gr-2">
        <p className="font-mincho text-[17px] text-sumi/90">
          {copy.emptyTitle}
        </p>
        <p className="text-[13px] tracking-wide text-ink-muted">
          {copy.emptySubtitle}
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        aria-label={copy.emptyAction}
        className="
          mt-gr-3 rounded-full border border-[color:var(--color-line)]
          bg-paper px-gr-5 py-gr-3 font-mincho text-[15px] text-sumi
          shadow-paper transition-soft hover:bg-paper/80 active:scale-[0.99]
        "
      >
        {copy.emptyAction}
      </button>
    </div>
  );
}

export default EmptyState;
