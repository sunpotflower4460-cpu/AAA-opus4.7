import { useEffect, useRef, useState } from "react";
import { BRUSHES, setBrush, useBrush, useBrushWriteFailed } from "../lib/brushPreference";
import { useI18n } from "../i18n/useI18n";
import type { BrushId } from "../lib/brushPreference";
import { clearEverydayBrush, useEveryday } from "../tsuzuri/everyday";
import { ALL_BRUSHES, BRUSH_NAMES } from "../tsuzuri/catalog";
import { tsuzuriMessages } from "../tsuzuri/messages";
import { handleModalKeyDown } from "./modalKeyboard";

type Props = {
  /** ボタンの見た目。list は文字つき、icon は丸い単独ボタン。 */
  variant?: "list" | "icon";
  className?: string;
};

/**
 * 筆あとを選ぶボタンとシート。
 * 設定はどの画面からでも同じ場所に置き、選んだ瞬間に画面全体の字が変わる。
 */
export function BrushPicker({ variant = "icon", className = "" }: Props) {
  const { copy, locale } = useI18n();
  const extraBrush = useEveryday().brush;
  const [everydayWriteFailed, setEverydayWriteFailed] = useState(false);
  const brush = useBrush();
  const writeFailed = useBrushWriteFailed();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const index = ALL_BRUSHES.findIndex((id) => id === extraBrush);
  const currentName = index >= 0 ? tsuzuriMessages[locale][BRUSH_NAMES[index]] : copy.brushes[brush].label;

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function choose(id: BrushId) {
    setEverydayWriteFailed(!clearEverydayBrush());
    setBrush(id);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={copy.brushCurrent({ brushName: currentName })}
        title={copy.brush}
        className={[
          "zanshin-brush-trigger",
          variant === "icon"
            ? "zanshin-brush-trigger--icon flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink-muted transition-soft hover:text-sumi active:scale-95"
            : "zanshin-brush-trigger--list flex min-h-[44px] items-center gap-gr-2 rounded-full px-gr-3 text-[12px] tracking-[0.12em] text-ink-muted transition-soft hover:text-sumi active:scale-[0.98]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {variant === "list" ? (
          <span className="zanshin-brush-glyph font-mincho">{copy.brush}</span>
        ) : (
          <span className="zanshin-brush-glyph" aria-hidden="true" lang="ja">筆</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="zanshin-brush-title"
          className="fixed inset-0 z-30 flex items-end justify-center bg-sumi/35 px-gr-4 pb-gr-5 backdrop-blur-[2px] sm:items-center animate-fadeIn"
          onClick={close}
          onKeyDown={(event) => handleModalKeyDown(event, close)}
        >
          <div
            className="zanshin-brush-sheet w-full max-w-[420px] rounded-[13px] border border-[color:var(--color-line)] bg-paper p-gr-5 shadow-paper-hover animate-softUp"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="zanshin-brush-title"
              className="font-mincho text-[18px] tracking-mincho text-sumi"
            >
              {copy.brush}
            </h2>
            <p className="mt-gr-2 text-[12px] leading-ample text-ink-muted">
              {copy.brushDescription}
            </p>

            <div role="radiogroup" aria-label={copy.brush} className="mt-gr-4 flex flex-col gap-gr-2">
              {BRUSHES.map((id) => {
                const item = copy.brushes[id];
                const selected = !extraBrush && id === brush;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(id)}
                    data-brush-option={id}
                    className={[
                      "zanshin-brush-option flex w-full flex-col gap-[3px] rounded-[10px] border px-gr-4 py-gr-3 text-left transition-soft active:scale-[0.995]",
                      selected
                        ? "border-gold/60 bg-washi/80"
                        : "border-[color:var(--color-line)] bg-transparent hover:bg-washi/50",
                    ].join(" ")}
                  >
                    <span className="flex items-baseline justify-between gap-gr-3">
                      <span className="font-mincho text-[13px] tracking-[0.12em] text-ink-muted">
                        {item.label}
                        <span className="ml-gr-2 text-[10px] tracking-[0.1em] opacity-80">
                          {item.description}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={[
                          "zanshin-brush-check h-[9px] w-[9px] shrink-0 rounded-full",
                          selected ? "bg-gold" : "border border-sumi/20",
                        ].join(" ")}
                      />
                    </span>
                    <span
                      className="zanshin-brush-sample text-[20px] leading-[1.7] text-sumi"
                      data-sample-brush={id}
                    >
                      {copy.brushSample}
                    </span>
                  </button>
                );
              })}
            </div>

            {(writeFailed || everydayWriteFailed) && <p role="status" className="mt-gr-2 text-sm text-ink-muted">{copy.preferenceWriteFailed}</p>}
            <div className="mt-gr-4 flex justify-end">
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="min-h-[44px] whitespace-nowrap rounded-full px-gr-4 py-gr-2 font-mincho text-[14px] text-ink-muted transition-soft hover:bg-paper/60 hover:text-sumi"
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BrushPicker;
