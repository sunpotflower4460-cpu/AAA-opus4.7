import { Component, type ErrorInfo, type ReactNode } from "react";
import { getLastUiLocale } from "../i18n/locales";
import { rescueMessages } from "../i18n/rescueMessages";
import { getBookRescue } from "../tsuzuri/bookRescue";
import { tsuzuriMessages } from "../tsuzuri/messages";
import { OriginalText } from "./OriginalText";
import { getDraftRescue, getRescueNotes } from "../lib/draftRescue";
import { CopyTextButton } from "./CopyTextButton";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * 描画例外の受け皿。
 *
 * 再読み込みを促す前に、最後に受け取った「保存できていない内容」を読み取り専用で示し、
 * コピーへ進める（R33）。取り出した事実は保存成功とは別で、ここから保存先へは何も書かない
 * （競合判定を飛ばす force-save や、保存データの初期化は行わない）。
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("React error boundary caught unhandled error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const locale = getLastUiLocale();
    const copy = rescueMessages[locale];
    const snapshot = getDraftRescue();
    const originals = getRescueNotes(snapshot);
    const bookDraft = getBookRescue();
    const hasUnsavedEdits = originals.some(({ kind }) => kind === "edited");

    return (
      <div lang={locale} className="flex min-h-dvh items-start justify-center px-gr-4 py-gr-6 text-center sm:items-center">
        <div
          className="w-full max-w-[460px] border border-[color:var(--color-line)] bg-paper px-gr-4 py-gr-5 shadow-paper-soft sm:px-gr-5"
          style={{ borderRadius: "8px 16px 9px 14px" }}
          role="alert"
        >
          <h1 className="font-mincho text-[20px] leading-[1.7] tracking-[0.06em] text-sumi">
            {copy.renderFailureTitle}
          </h1>

          <p className="mt-gr-3 text-[14px] leading-ample text-sumi jp-text-discipline">
            {hasUnsavedEdits
              ? copy.renderFailureUnsaved
              : snapshot?.savedNotes && !bookDraft
                ? copy.renderFailureNoUnsaved
                : copy.renderFailureUnknown}
          </p>

          {originals.length > 0 && (
            <ul className="mt-gr-4 flex flex-col gap-gr-4 text-left">
              {originals.map(({ note, kind }, index) => (
                <li
                  key={`${note.id}-${index}`}
                  className="flex flex-col gap-gr-2 border-t border-[color:var(--color-line)] pt-gr-3"
                >
                  <span className="text-[12px] text-ink-muted">
                    {kind === "edited" ? copy.unsavedNoteLabel : copy.unconfirmedNoteLabel}
                  </span>
                  {note.title !== "" && (
                    <OriginalText label={copy.originalTitle} text={note.title} rows={3} />
                  )}
                  {note.body !== "" && (
                    <OriginalText label={copy.originalText} text={note.body} rows={6} />
                  )}
                  <div className="flex flex-wrap gap-gr-3">
                    {note.body !== "" && (
                      <CopyTextButton label={copy.copyBody} text={note.body} feedback={copy} />
                    )}
                    {note.title !== "" && (
                      <CopyTextButton label={copy.copyTitle} text={note.title} feedback={copy} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {bookDraft && <section className="mt-gr-4 space-y-3 text-left">
            <h2>{tsuzuriMessages[locale].draftRescue}</h2>
            {bookDraft.cover.title && <CopyTextButton label={tsuzuriMessages[locale].title} text={bookDraft.cover.title} feedback={copy} />}
            {bookDraft.passages.map((piece) => <div key={piece.id} className="space-y-2">
              {piece.title && <CopyTextButton label={tsuzuriMessages[locale].copyPieceTitle} text={piece.title} feedback={copy} />}
              <OriginalText label={tsuzuriMessages[locale].currentPiece} text={piece.body} rows={4} />
              <CopyTextButton label={tsuzuriMessages[locale].copyPieceBody} text={piece.body} feedback={copy} />
            </div>)}
          </section>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-gr-5 min-h-[48px] bg-sumi px-gr-5 py-gr-3 font-mincho text-[14px] tracking-[0.08em] text-washi transition-soft hover:bg-indigo active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sumi/35 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            style={{ borderRadius: "7px 12px 8px 10px" }}
          >
            {copy.renderFailureReload}
          </button>
        </div>
      </div>
    );
  }
}
