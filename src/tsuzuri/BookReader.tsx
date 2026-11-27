import { useEffect, useRef, useState } from "react";
import { captureReadingPosition, restoreReadingPosition } from "../lib/readingPosition";
import { CopyTextButton } from "../components/CopyTextButton";
import { rescueMessages } from "../i18n/rescueMessages";
import type { UiLocale } from "../i18n/locales";
import { BookPage } from "./BookPage";
import { tsuzuriMessages } from "./messages";
import { editionText, pieceText, type Book, type BookEdition, type Bookmark, type Library } from "./model";

export function BookReader({ library, book, edition, locale, onBookmark, onOutput, onOriginal, onArrange, onDelete, onHistory, onDuplicate }: {
  library: Library; book: Book; edition: BookEdition; locale: UiLocale;
  onBookmark: (bookmark: Bookmark) => void;
  onOutput: (kind: "basic" | "styled" | "image", passage: number) => void;
  onOriginal: (pieces: ReturnType<typeof editionText>) => void;
  onArrange?: () => void; onDelete?: () => void; onHistory?: (editionId: string) => void; onDuplicate?: () => void;
}) {
  const c = tsuzuriMessages[locale];
  const pieces = editionText(library, edition);
  const [index, setIndex] = useState(() => Math.max(0, pieces.findIndex((item) => item.id === book.bookmark?.passageId)));
  const [overview, setOverview] = useState(false);
  const [dimTexture, setDimTexture] = useState(false);
  const [dark, setDark] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  const piece = pieces[Math.min(index, pieces.length - 1)];
  const bookmark = book.bookmark;
  const [mode, setMode] = useState(edition.appearance.direction);
  const openingBookmark = useRef(bookmark);
  useEffect(() => {
    const node = pane.current;
    if (!node || overview) return;
    const position = openingBookmark.current;
    openingBookmark.current = null;
    if (position?.passageId === piece.id) {
      restoreReadingPosition(node, piece.body, mode, {
        mode: mode === "horizontal" ? "vertical" : "horizontal", body: piece.body,
        offset: position.offset, distance: 0, progress: position.progress,
      });
    } else node.scrollTo?.(0, 0);
  }, [piece.id, piece.body, mode, overview]);
  const number = new Intl.NumberFormat(locale);
  return (
    <>
      <div className="ts-intro">
        <p>{edition.appearance.format === "BK02" ? c.format02 : edition.appearance.format === "BK03" ? c.format03 : c.format01}</p>
        <h1 dir="auto" lang={edition.cover.title ? "" : locale}>{edition.cover.title || c.untitled}</h1>
      </div>
      <div className="ts-row">
        {onArrange && <button type="button" onClick={onArrange}>{c.arrange}</button>}
        <a href="#ts-book-export">{c.export}</a>
        {edition.appearance.format === "BK03" && <button type="button" onClick={() => onOutput("image", index)}>{c.image}</button>}
        {edition.appearance.format === "BK02" && <button aria-pressed={overview} type="button" onClick={() => setOverview((value) => !value)}>{overview ? c.reading : c.overview}</button>}
      </div>
      <details>
        <summary>{c.toc}</summary>
        <ol className="ts-list">{pieces.map((item, step) => <li key={item.id}>
          <button type="button" aria-current={step === index ? "location" : undefined} onClick={() => { setIndex(step); setOverview(false); }}>
            {number.format(step + 1)} · <span dir="auto" lang={item.title ? "" : locale}>{item.title || c.untitled}</span>
          </button>
        </li>)}</ol>
      </details>
      <div className="ts-reader" data-texture={dimTexture ? "reduced" : undefined} data-dark={dark ? "yes" : undefined}>
        {overview ? (
          <div className="ts-fold-overview" dir={edition.appearance.binding === "right" ? "rtl" : "ltr"}>
            {pieces.map((item, i) => <button type="button" key={item.id} onClick={() => { setIndex(i); setOverview(false); }}>
              <span>{number.format(i + 1)}</span><span dir="auto" lang="">{item.title || item.body}</span>
            </button>)}
          </div>
        ) : (
          <>
            {index === 0 && edition.cover.front && <pre className="ts-book-aside" dir="auto" lang="">{edition.cover.front}</pre>}
            <BookPage text={piece} appearance={{ ...edition.appearance, direction: mode }} viewport={pane} cover={index === 0 ? edition.cover : undefined} />
            {index === pieces.length - 1 && (edition.cover.closing || edition.cover.after) && <pre className="ts-book-aside" dir="auto" lang="">{[edition.cover.closing, edition.cover.after].filter(Boolean).join("\n\n")}</pre>}
          </>
        )}
      </div>
      <div className="ts-row ts-paging" dir={edition.appearance.binding === "right" ? "rtl" : "ltr"}>
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>{c.previousPage}</button>
        <span dir="ltr">{number.format(index + 1)} / {number.format(pieces.length)}</span>
        <button type="button" disabled={index >= pieces.length - 1} onClick={() => setIndex(index + 1)}>{c.nextPage}</button>
      </div>
      {!overview && <button type="button" onClick={() => {
        if (!pane.current) return;
        const position = captureReadingPosition(pane.current, piece.body, mode);
        onBookmark({ passageId: piece.id, offset: position.offset, progress: position.progress });
      }}>{c.bookmark}</button>}
      <details>
        <summary>{c.reading}</summary>
        <div className="ts-controls">
          <div role="group" aria-label={c.direction} className="ts-row">
            {(["vertical", "horizontal"] as const).map((direction) => <button type="button" key={direction}
              aria-pressed={mode === direction} onClick={() => {
                if (pane.current) {
                  const position = captureReadingPosition(pane.current, piece.body, mode);
                  openingBookmark.current = { passageId: piece.id, offset: position.offset, progress: position.progress };
                }
                setMode(direction);
              }}>{c[direction]}</button>)}
          </div>
          <label><input type="checkbox" checked={dimTexture} onChange={(event) => setDimTexture(event.target.checked)} /> {c.texture}</label>
          <label><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /> {c.darkReading}</label>
        </div>
      </details>
      <section className="ts-controls" id="ts-book-export" aria-label={c.export}>
        <h2>{c.export}</h2>
        <button type="button" onClick={() => onOutput("basic", index)}>{c.basicPdf}</button>
        <button type="button" onClick={() => onOutput("styled", index)}>{c.styledPdf}</button>
        {edition.appearance.format !== "BK03" && <button type="button" onClick={() => onOutput("image", index)}>{c.image}</button>}
        <CopyTextButton label={c.copyOriginal} text={pieces.map(pieceText).join("\n\n")} feedback={rescueMessages[locale]} />
        <details><summary>{c.currentPiece}</summary>
          {piece.title && <CopyTextButton label={c.copyPieceTitle} text={piece.title} feedback={rescueMessages[locale]} />}
          <CopyTextButton label={c.copyPieceBody} text={piece.body} feedback={rescueMessages[locale]} />
        </details>
        <button type="button" onClick={() => onOriginal(pieces)}>{c.originalFile}</button>
      </section>
      {onHistory && <details><summary>{c.history}</summary>{library.editions.filter((item) => item.bookId === book.id && item.id !== book.editionId).reverse().map((item) => (
        <button type="button" key={item.id} onClick={() => onHistory(item.id)}>
          {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
        </button>
      ))}</details>}
      {onDuplicate && <button type="button" onClick={onDuplicate}>{c.duplicate}</button>}
      {onDelete && <details><summary>{c.deleteBook}</summary><p>{c.deleteBookHint}</p>
        <button type="button" onClick={onDelete}>{c.deleteBook}</button></details>}
    </>
  );
}
