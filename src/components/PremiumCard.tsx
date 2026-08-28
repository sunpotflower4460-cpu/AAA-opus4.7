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
    <aside
      className="paper-premium px-gr-5 py-gr-5 animate-fadeIn"
      style={{ borderRadius: "6px 13px 7px 11px" }}
    >
      <div className="flex flex-col gap-gr-4">
        <div className="flex flex-col gap-gr-2">
          <span
            aria-hidden="true"
            className="block h-px w-gr-4 bg-gradient-to-r from-gold/40 to-transparent"
          />
          <h2 className="font-mincho text-[18px] leading-snug tracking-[0.06em] text-sumi">
            {copy.premiumName}
          </h2>
          <p className="font-mincho text-[14px] leading-[1.9] whitespace-pre-line text-sumi/88">
            {isPremium ? copy.premiumActiveBody : copy.premiumBody}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-gr-2">
          <button
            type="button"
            onClick={onOpenPremium}
            className="min-h-[44px] border border-[color:var(--color-line)] bg-paper/75 px-gr-4 py-gr-2 font-mincho text-[14px] tracking-mincho text-sumi transition-soft hover:border-indigo/25 hover:bg-washi active:scale-[0.99]"
            style={{ borderRadius: "6px 10px 7px 9px" }}
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
