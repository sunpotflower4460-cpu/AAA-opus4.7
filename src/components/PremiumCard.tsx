import { copy } from "../lib/i18n";
import type { MonetizationState } from "../types/monetization";
import { RestorePurchaseButton } from "./RestorePurchaseButton";

type Props = {
  monetization: MonetizationState;
  onOpenPremium: () => void;
  onRestorePurchase: () => void | Promise<void>;
};

export function PremiumCard({
  monetization,
  onOpenPremium,
  onRestorePurchase,
}: Props) {
  const isPremium = monetization.isPremium;

  return (
    <aside className="rounded-[21px] border border-[color:var(--color-line)] bg-paper/80 px-gr-5 py-gr-5 shadow-paper-soft animate-fadeIn">
      <div className="flex flex-col gap-gr-4">
        <div className="flex flex-col gap-gr-2">
          <p className="text-[10px] tracking-[0.3em] text-ink-muted/72">
            {copy.premiumName.toUpperCase()}
          </p>
          <h2 className="font-mincho text-[19px] leading-snug text-sumi">
            {copy.premiumName}
          </h2>
          <p className="font-mincho text-[15px] leading-ample whitespace-pre-line text-sumi/88">
            {isPremium ? copy.premiumActiveBody : copy.premiumBody}
          </p>
          <p className="text-[11px] tracking-[0.18em] text-ink-muted/72 whitespace-pre-line">
            {isPremium ? copy.premiumActiveBodyEn : copy.premiumBodyEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-gr-3">
          <button
            type="button"
            onClick={onOpenPremium}
            className="rounded-full bg-sumi px-gr-5 py-gr-3 font-mincho text-[14px] tracking-mincho text-washi shadow-paper-soft transition-soft hover:bg-indigo active:scale-[0.99]"
          >
            {isPremium ? copy.premiumManage : copy.premiumCta}
          </button>

          {!isPremium && (
            <RestorePurchaseButton onRestore={onRestorePurchase} />
          )}
        </div>
      </div>
    </aside>
  );
}

export default PremiumCard;
