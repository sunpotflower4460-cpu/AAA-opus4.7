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
};

const includedItems = [
  copy.premiumBenefitAdsFree,
  copy.premiumBenefitCalm,
  copy.premiumBenefitSupport,
];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function PremiumSheet({
  open,
  monetization,
  product,
  onClose,
  onPurchase,
  onRestore,
}: Props) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = window.requestAnimationFrame(() => {
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusables?.[0]?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => element.offsetParent !== null);

      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirst);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
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
      aria-describedby="zanshin-premium-description"
      className="fixed inset-0 z-20 flex items-end justify-center bg-sumi/28 px-gr-4 pb-gr-5 backdrop-blur-[2px] sm:items-center animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="zanshin-premium-sheet w-full max-w-[440px] border border-[color:var(--color-line)] bg-paper p-gr-5 shadow-paper-hover animate-softUp focus:outline-none"
        style={{ borderRadius: "8px 16px 9px 14px" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-gr-4">
          <div>
            <span
              aria-hidden="true"
              className="mb-gr-4 block h-px w-gr-5 bg-gradient-to-r from-gold/45 to-transparent"
            />
            <h2
              id="zanshin-premium-title"
              className="font-mincho text-[22px] tracking-[0.08em] text-sumi"
            >
              {copy.premiumName}
            </h2>
            <p
              id="zanshin-premium-description"
              className="mt-gr-3 font-mincho text-[15px] leading-ample text-sumi/90"
            >
              {copy.premiumSheetBody}
            </p>
            <p className="mt-gr-2 text-[11px] tracking-[0.14em] text-ink-muted/68">
              {copy.premiumSheetBodyEn}
            </p>
          </div>

          <div
            className="border border-[color:var(--color-line)] bg-washi/45 px-gr-4 py-gr-4 text-[13px] leading-ample text-ink-muted"
            style={{ borderRadius: "5px 11px 6px 9px" }}
          >
            <p className="font-mincho text-[14px] tracking-mincho text-sumi">
              {copy.premiumIncluded}
            </p>
            <ul className="mt-gr-3 flex flex-col gap-gr-2 pl-gr-3 text-sumi/86">
              {includedItems.map((item) => (
                <li key={item} className="list-disc marker:text-gold/70">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-gr-4 border-t border-[color:var(--color-line)] pt-gr-3 text-[12px] text-ink-muted/85">
              <p>{product?.priceLabel ?? copy.premiumPriceNote}</p>
            </div>
          </div>

          {monetization.purchaseStatus === "error" && (
            <p role="alert" className="text-[12px] leading-ample text-vermilion">
              {copy.premiumError}
            </p>
          )}

          {monetization.isPremium && (
            <div
              className="border border-[color:var(--color-line)] bg-paper/75 px-gr-4 py-gr-4 text-[13px] leading-ample text-sumi/85"
              style={{ borderRadius: "5px 11px 6px 9px" }}
            >
              <p className="font-mincho text-[14px] text-sumi">{copy.premiumActiveBody}</p>
              <p className="mt-gr-2 text-[11px] tracking-[0.16em] text-ink-muted/72">
                {copy.premiumActiveBodyEn}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-gr-2">
            {!monetization.isPremium && (
              <button
                type="button"
                onClick={() => {
                  void onPurchase();
                }}
                disabled={isBusy}
                className="min-h-[48px] bg-sumi px-gr-5 py-gr-3 font-mincho text-[15px] tracking-[0.08em] text-washi shadow-paper-soft transition-soft hover:bg-indigo active:scale-[0.99] disabled:cursor-default disabled:opacity-60"
                style={{ borderRadius: "7px 12px 8px 10px" }}
              >
                {isBusy ? copy.premiumLoading : copy.premiumCta}
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
              className="min-h-[44px] self-center rounded-[8px] px-gr-4 font-mincho text-[13px] tracking-mincho text-ink-muted transition-soft hover:bg-paper/55 hover:text-sumi"
            >
              {copy.later}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PremiumSheet;
