import { useEffect, useRef } from "react";
import { copy } from "../lib/i18n";
import type { MonetizationState, PremiumProduct } from "../types/monetization";
import { RestorePurchaseButton } from "./RestorePurchaseButton";

type Props = {
  open: boolean;
  monetization: MonetizationState;
  product?: PremiumProduct;
  onClose: () => void;
  onPurchase: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onDisableMock?: () => void | Promise<void>;
};

const includedItems = [
  copy.premiumBenefitAdsFree,
  copy.premiumBenefitCalm,
  copy.premiumBenefitSupport,
];

export function PremiumSheet({
  open,
  monetization,
  product,
  onClose,
  onPurchase,
  onRestore,
  onDisableMock,
}: Props) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const isBusy = monetization.purchaseStatus === "loading";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zanshin-premium-title"
      className="fixed inset-0 z-20 flex items-end justify-center bg-sumi/28 px-gr-4 pb-gr-5 backdrop-blur-[2px] sm:items-center animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-[21px] border border-[color:var(--color-line)] bg-paper p-gr-5 shadow-paper-hover animate-softUp"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-gr-3">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-ink-muted/72">
              {copy.premiumName.toUpperCase()}
            </p>
            <h2
              id="zanshin-premium-title"
              className="mt-gr-2 font-mincho text-[22px] tracking-mincho text-sumi"
            >
              {copy.premiumName}
            </h2>
            <p className="mt-gr-3 font-mincho text-[15px] leading-ample text-sumi/90">
              {copy.premiumSheetBody}
            </p>
            <p className="mt-gr-2 text-[11px] tracking-[0.18em] text-ink-muted/72">
              {copy.premiumSheetBodyEn}
            </p>
          </div>

          <div className="rounded-[13px] bg-washi/55 px-gr-4 py-gr-4 text-[13px] leading-ample text-ink-muted">
            <p className="font-mincho text-[14px] text-sumi">{copy.premiumIncluded}</p>
            <ul className="mt-gr-3 flex flex-col gap-gr-2 pl-gr-3 text-sumi/86">
              {includedItems.map((item) => (
                <li key={item} className="list-disc marker:text-gold/70">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-gr-4 border-t border-[color:var(--color-line)] pt-gr-3 text-[12px] text-ink-muted/85">
              <p>{product?.priceLabel ?? copy.premiumPriceNote}</p>
              <p className="mt-gr-2">{copy.premiumMockNote}</p>
              {product && (
                <p className="mt-gr-2 text-[11px] tracking-[0.14em] text-ink-muted/72">
                  Product ID: {product.id}
                </p>
              )}
            </div>
          </div>

          {monetization.purchaseStatus === "error" && (
            <p className="text-[12px] leading-ample text-vermilion">
              {copy.premiumError}
            </p>
          )}

          {monetization.isPremium && (
            <div className="rounded-[13px] border border-[color:var(--color-line)] bg-paper/75 px-gr-4 py-gr-4 text-[13px] leading-ample text-sumi/85">
              <p className="font-mincho text-[14px] text-sumi">{copy.premiumActiveBody}</p>
              <p className="mt-gr-2 text-[11px] tracking-[0.16em] text-ink-muted/72">
                {copy.premiumActiveBodyEn}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-gr-3">
            {!monetization.isPremium && (
              <button
                type="button"
                onClick={() => {
                  void onPurchase();
                }}
                disabled={isBusy}
                className="rounded-full bg-sumi px-gr-5 py-gr-3 font-mincho text-[15px] tracking-mincho text-washi shadow-paper-soft transition-soft hover:bg-indigo disabled:cursor-default disabled:opacity-60"
              >
                {isBusy ? copy.premiumLoading : copy.purchaseMock}
              </button>
            )}

            <RestorePurchaseButton
              onRestore={onRestore}
              disabled={isBusy}
              className="self-center"
            />

            <button
              type="button"
              onClick={onClose}
              className="font-mincho text-[13px] tracking-mincho text-ink-muted transition-soft hover:text-sumi"
            >
              {copy.later}
            </button>

            {monetization.isPremium && onDisableMock && (
              <button
                type="button"
                onClick={() => {
                  void onDisableMock();
                }}
                className="self-center text-[11px] tracking-[0.16em] text-ink-muted/70 transition-soft hover:text-sumi"
              >
                {copy.mockDisablePremium}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PremiumSheet;
