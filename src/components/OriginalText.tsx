import { useId } from "react";

export function OriginalText({ label, text, rows }: { label: string; text: string; rows: number }) {
  const id = useId();
  return (
    <div className="w-full min-w-0">
      <label className="mb-gr-1 block text-sm text-ink-muted" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        readOnly
        lang=""
        dir="auto"
        value={text}
        rows={rows}
        onFocus={(event) => event.currentTarget.select()}
        className="zanshin-copy-fallback w-full rounded-[8px] border border-[color:var(--color-line)] bg-paper px-gr-3 py-gr-2 text-[16px] leading-ample text-sumi"
      />
    </div>
  );
}
