import { useState } from "react";
import type { CopyFeedback } from "../i18n/rescueMessages";
import { OriginalText } from "./OriginalText";

type Props = {
  label: string;
  /** Original text from the model. */
  text: string;
  feedback: CopyFeedback;
  className?: string;
};

type CopyResult = { kind: "copying" | "copied" | "copyFailed"; text: string };

export function CopyTextButton({ label, text, feedback, className = "" }: Props) {
  const [result, setResult] = useState<CopyResult | null>(null);
  const status = result?.text === text ? result.kind : null;
  const busy = result?.kind === "copying";

  async function handleCopy() {
    if (busy) return;
    setResult({ kind: "copying", text });
    try {
      await navigator.clipboard.writeText(text);
      setResult({ kind: "copied", text });
    } catch {
      setResult({ kind: "copyFailed", text });
    }
  }

  return (
    <div className="inline-flex min-w-0 max-w-full flex-col items-start gap-gr-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={busy}
        className={`zanshin-copy-button min-h-[44px] rounded-full border border-[color:var(--color-line)] px-gr-4 py-gr-2 font-mincho text-[13px] tracking-mincho text-sumi transition-soft hover:bg-washi active:scale-[0.98] ${className}`}
      >
        {label}
      </button>
      <span role="status" className="text-[12px] leading-ample text-ink-muted">
        {status && feedback[status]}
      </span>
      {status === "copyFailed" && <OriginalText label={label} text={text} rows={4} />}
    </div>
  );
}
