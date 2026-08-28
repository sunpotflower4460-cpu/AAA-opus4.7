import { shouldShowAds } from "../lib/monetization";
import { copy } from "../lib/i18n";
import type { MonetizationState } from "../types/monetization";

type Props = {
  monetization: MonetizationState;
  currentScreen: "notes-list" | "editor";
  isEditing?: boolean;
  isSearching?: boolean;
  hasVisibleNotes?: boolean;
  onOpenPremium?: () => void;
};

export function AdSlot({
  monetization,
  currentScreen,
  isEditing = false,
  isSearching = false,
  hasVisibleNotes = true,
  onOpenPremium,
}: Props) {
  if (
    !shouldShowAds({
      monetization,
      currentScreen,
      isEditing,
      isSearching,
      hasVisibleNotes,
    })
  ) {
    return null;
  }

  return (
    <aside
      aria-label={copy.adSectionLabel}
      className="paper-ad-slot px-gr-4 py-gr-4 animate-fadeIn"
      style={{ borderRadius: "5px 10px 6px 9px" }}
    >
      <div className="flex items-start justify-between gap-gr-4">
        <div className="min-w-0">
          <span className="inline-flex border border-[color:var(--color-line)] px-gr-2 py-[3px] text-[10px] tracking-[0.24em] text-ink-muted/75" style={{ borderRadius: "5px" }}>
            {copy.adLabel.toUpperCase()} / {copy.adLabelEn.toUpperCase()}
          </span>
          <p className="mt-gr-3 font-mincho text-[13px] leading-[1.85] text-sumi/88">
            {copy.adSlotBody}
          </p>
        </div>

        {onOpenPremium && (
          <button
            type="button"
            onClick={onOpenPremium}
            className="min-h-[44px] shrink-0 border border-[color:var(--color-line)] px-gr-3 py-gr-2 font-mincho text-[12px] tracking-mincho text-sumi transition-soft hover:bg-paper/70 active:scale-[0.98]"
            style={{ borderRadius: "6px 10px 7px 9px" }}
          >
            {copy.removeAds}
          </button>
        )}
      </div>
    </aside>
  );
}

export default AdSlot;
