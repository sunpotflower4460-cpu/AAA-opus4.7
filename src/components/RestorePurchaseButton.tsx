import { copy } from "../lib/i18n";

type Props = {
  onRestore: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

export function RestorePurchaseButton({
  onRestore,
  disabled = false,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        void onRestore();
      }}
      disabled={disabled}
      className={[
        "inline-flex min-h-[44px] items-center justify-center rounded-[8px] px-gr-3",
        "font-mincho text-[13px] tracking-mincho text-ink-muted transition-soft",
        "hover:bg-paper/55 hover:text-sumi active:scale-[0.98] disabled:cursor-default disabled:opacity-50",
        className ?? "",
      ].join(" ")}
    >
      {copy.restorePurchase}
    </button>
  );
}

export default RestorePurchaseButton;
