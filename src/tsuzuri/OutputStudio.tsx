import { useEffect, useRef, useState } from "react";
import type { UiLocale } from "../i18n/locales";
import { freeAppearance } from "./catalog";
import { hasVerifiedPurchase } from "./entitlements";
import { offerFile } from "./exportFile";
import type { BookEdition } from "./model";
import { bookPdf, imagesZip, pagePng, paintPage, prepareLayout } from "./output";
import type { Layout, OutputText, PageSize, Surface } from "./pageLayout";
import { selectedOriginal } from "./originalText";
import { tsuzuriMessages, type TsuzuriMessage } from "./messages";

export type OutputKind = "basic" | "styled" | "image";

export type OutputRequest = {
  edition: BookEdition;
  pieces: OutputText[];
  kind: OutputKind;
  index: number;
};

export function OutputStudio({ request, locale, epoch, owned, onPurchase, onBusy }: {
  request: OutputRequest; locale: UiLocale; epoch: string | null; owned: boolean; onPurchase: () => void; onBusy: (busy: boolean) => void;
}) {
  const c = tsuzuriMessages[locale];
  const { edition, pieces, kind, index } = request;
  const [size, setSize] = useState<PageSize>(kind === "image" ? "portrait" : "A5");
  const [direction, setDirection] = useState(edition.appearance.direction);
  const [surface, setSurface] = useState<Surface>(kind === "basic" ? "white" : "paper");
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [status, setStatus] = useState<TsuzuriMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [toc, setToc] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [excerpt, setExcerpt] = useState<string | null>(null);
  const selection = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const imageText = pieces[index];

  useEffect(() => {
    let stale = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(null);
    setPage(0);
    setStatus(null);
    const appearance = { ...(kind === "basic" ? freeAppearance(edition.appearance) : edition.appearance), direction };
    const text = kind === "image" ? [excerpt === null ? imageText : { title: "", body: excerpt }] : pieces;
    const cover = kind === "image" ? undefined : edition.cover;
    void prepareLayout({ text, cover, appearance, size, surface, contents: toc }).then(
      (value) => { if (!stale) setLayout(value); },
      () => { if (!stale) setStatus("fontLoad"); },
    );
    return () => { stale = true; };
  }, [edition, kind, size, surface, direction, pieces, imageText, excerpt, toc, attempt]);

  useEffect(() => {
    if (layout) preview.current?.replaceChildren(paintPage(layout, page, 880));
  }, [layout, page]);

  async function generate(all = false) {
    if (busy || !layout || (kind !== "basic" && !hasVerifiedPurchase())) return;
    setBusy(true);
    onBusy(true);
    setStatus(null);
    try {
      const file = kind !== "image" ? await bookPdf(layout) : all ? await imagesZip(layout) : await pagePng(layout, page);
      if (kind !== "basic" && !hasVerifiedPurchase()) {
        setStatus("purchaseRevoked");
        return;
      }
      const name = kind !== "image" ? "zanshin-book.pdf" : all ? "zanshin-pages.zip" : `zanshin-page-${page + 1}.png`;
      setStatus(await offerFile(file, name, epoch));
    } catch {
      setStatus("exportFailed");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <>
      <div className="ts-intro"><h1>{c.outputPreview}</h1><p>{c.outputHint}</p><p>{c.outputFont}</p>
        {edition.appearance.format === "BK02" && kind === "styled" && <p>{c.orderedPdf}</p>}</div>
      {kind !== "basic" && !owned && <p>{c.paidPreview}</p>}
      <fieldset className="ts-controls" disabled={busy}>
        <label>{c.direction}<select aria-label={c.direction} value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}>
          <option value="horizontal">{c.horizontal}</option><option value="vertical">{c.vertical}</option>
        </select></label>
        <label>{c.paperSize}<select aria-label={c.paperSize} value={size} onChange={(event) => setSize(event.target.value as PageSize)}>
          {kind === "image" && <><option value="square">{c.sizeSquare}</option><option value="portrait">{c.sizePortrait}</option></>}
          <option value="A5">A5{kind === "image" ? ` · ${c.sizePaper}` : ""}</option>
          {kind !== "image" && <option value="A6">A6</option>}
        </select></label>
        {kind !== "basic" && <label>{c.surface}<select aria-label={c.surface} value={surface} onChange={(event) => setSurface(event.target.value as Surface)}>
          <option value="paper">{c.paperSurface}</option><option value="light">{c.lightSurface}</option>
          <option value="white">{c.whiteSurface}</option>
        </select></label>}
        {kind !== "image" && <label><input type="checkbox" checked={toc} onChange={(event) => setToc(event.target.checked)} /> {c.toc}</label>}
        {kind === "image" && <details>
          <summary>{c.excerpt}</summary>
          <label>{c.excerptHint}<textarea rows={4} dir="auto" lang="" readOnly value={imageText.body} ref={selection} /></label>
          <div className="ts-row"><button type="button" onClick={() => {
            const field = selection.current;
            if (field && field.selectionStart !== field.selectionEnd) setExcerpt(selectedOriginal(imageText.body, field.selectionStart, field.selectionEnd));
          }}>{c.captureSelection}</button><button type="button" onClick={() => setExcerpt(null)}>{c.wholePiece}</button></div>
          {excerpt !== null && <pre dir="auto" lang="">{excerpt}</pre>}
        </details>}
      </fieldset>
      {kind === "image" && <p>{excerpt === null ? c.wholePiece : c.excerpt}</p>}
      {layout && <div className="ts-output">
        <div className="ts-output-paper" aria-hidden="true" ref={preview} />
        <details><summary>{c.currentPiece} · {c.page} {page + 1}</summary><pre dir="auto" lang="">{layout.pages[page].lines.map((line) => line.text).join("\n")}</pre></details>
        <div className="ts-row ts-paging">
          <button type="button" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>{c.previousSheet}</button>
          <span>{page + 1} / {layout.pages.length}</span>
          <button type="button" disabled={busy || page === layout.pages.length - 1} onClick={() => setPage(page + 1)}>{c.nextSheet}</button>
        </div>
        {kind === "image" && <p>{Math.round(layout.width / Math.max(layout.width, layout.height) * 2048)} × {Math.round(layout.height / Math.max(layout.width, layout.height) * 2048)} px</p>}
      </div>}
      {kind !== "basic" && !owned
        ? <button type="button" onClick={onPurchase}>{c.purchaseInfo}</button>
        : <button className="ts-primary" type="button" disabled={busy || !layout} onClick={() => void generate()}>
          {kind === "image" ? c.savePageImage : c.generate}</button>}
      {owned && kind === "image" && layout && layout.pages.length > 1 && <button type="button" disabled={busy}
        onClick={() => void generate(true)}>{c.saveAllImages}</button>}
      <span role="status">{busy ? c.generating : status ? c[status] : !layout ? c.loading : ""}</span>
      {status === "fontLoad" && <button type="button" onClick={() => setAttempt((value) => value + 1)}>{c.retry}</button>}
    </>
  );
}
