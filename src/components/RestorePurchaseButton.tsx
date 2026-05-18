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
        "font-mincho text-[13px] tracking-mincho text-ink-muted transition-soft",
        "hover:text-sumi disabled:cursor-default disabled:opacity-50",
        className ?? "",
      ].join(" ")}
    >
      {copy.restorePurchase}
    </button>
  );
}

export default RestorePurchaseButton;
