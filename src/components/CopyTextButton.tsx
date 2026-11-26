import { useState } from "react";
import { copy } from "../lib/i18n";

type Props = {
  /** ボタンの表示名（例：本文をコピー） */
  label: string;
  /** コピーする原文。整形・trim しない。 */
  text: string;
  className?: string;
};

type Status = "idle" | "copied" | "failed";

/**
 * 原文をクリップボードへコピーする。
 * 「コピーしました」はクリップボードへの書込みが成功した時だけ。保存成功とは無関係。
 * Clipboard API が使えない・拒否された場合は成功を出さず、手動で選択できる原文を示す。
 */
export function CopyTextButton({ label, text, className = "" }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  async function handleCopy() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-gr-2">
      <button
        type="button"
        onClick={handleCopy}
        className={[
          "zanshin-copy-button min-h-[44px] whitespace-nowrap rounded-full border border-[color:var(--color-line)] px-gr-4 py-gr-2 font-mincho text-[13px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-[12px] leading-ample text-ink-muted">
        {status === "copied" ? copy.copied : null}
        {status === "failed" ? copy.copyFailed : null}
      </span>
      {status === "failed" && (
        <textarea
          readOnly
          aria-label={label}
          value={text}
          rows={4}
          onFocus={(event) => event.currentTarget.select()}
          className="zanshin-copy-fallback w-full max-w-[420px] rounded-[8px] border border-[color:var(--color-line)] bg-paper px-gr-3 py-gr-2 text-[14px] leading-ample text-sumi"
        />
      )}
    </span>
  );
}

export default CopyTextButton;
