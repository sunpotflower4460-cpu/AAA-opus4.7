import { useMemo, useState } from "react";
import { matchesNote, sortNotes } from "../lib/notesLogic";
import { CopyTextButton } from "../components/CopyTextButton";
import { OriginalText } from "../components/OriginalText";
import { rescueMessages } from "../i18n/rescueMessages";
import type { UiLocale } from "../i18n/locales";
import type { Note } from "../types/note";
import { BookPage } from "./BookPage";
import { BASIC_APPEARANCE, adoptSource, passageFromNote, pieceText, type BookDraft, type Cover, type DraftPassage } from "./model";
import { tsuzuriMessages, type TsuzuriCopy } from "./messages";
import { preserveUneditedText } from "./originalText";
import { MaterialFields } from "./StylePicker";

export function ChoosePassages({ notes, draft, locale, update, next, onCheck, onBlocked }: {
  notes: Note[]; draft: BookDraft; locale: UiLocale; update: (draft: BookDraft) => void; next: () => void; onCheck: () => Note[] | null; onBlocked: () => void;
}) {
  const c = tsuzuriMessages[locale];
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState(false);
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const visible = useMemo(() => sortNotes(notes.filter((note) => (
    matchesNote(note, query) && (!pinned || note.isFavorite) &&
    (!from || Date.parse(note.createdAt) >= new Date(`${from}T00:00:00`).getTime()) &&
    (!through || Date.parse(note.createdAt) <= new Date(`${through}T23:59:59.999`).getTime())
  ))), [notes, query, pinned, from, through]);
  const selected = new Set(draft.passages.map((piece) => piece.localNoteId));
  return (
    <>
      <div className="ts-intro"><h1>{c.selectTitle}</h1><p>{c.selectHint}</p></div>
      <label>{c.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <details>
        <summary>{c.pinnedOnly} · {c.fromDate}</summary>
        <div className="ts-controls">
          <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> {c.pinnedOnly}</label>
          <label>{c.fromDate}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>{c.throughDate}<input type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
        </div>
      </details>
      <section className="ts-list" aria-label={c.selectTitle}>
        {visible.map((note) => (
          <label key={note.id} className="ts-note-pick">
            <input type="checkbox" checked={selected.has(note.id)} onChange={(event) => {
              const confirmed = onCheck()?.find((item) => item.id === note.id);
              if (event.target.checked && !confirmed) { onBlocked(); return; }
              update({
                ...draft,
                passages: event.target.checked && confirmed
                  ? [...draft.passages, passageFromNote(confirmed)]
                  : draft.passages.filter((piece) => piece.localNoteId !== note.id),
              });
            }} />
            <span><strong dir="auto" lang={note.title ? "" : locale}>{note.title || c.untitled}</strong>
              <span className="ts-note-clip" dir="auto" lang="">{note.body}</span></span>
          </label>
        ))}
      </section>
      <button type="button" className="ts-primary" disabled={draft.passages.length === 0} onClick={next}>
        {c.next} · {new Intl.NumberFormat(locale).format(draft.passages.length)}
      </button>
    </>
  );
}

function movePassage(draft: BookDraft, index: number, delta: number) {
  const passages = [...draft.passages];
  const [piece] = passages.splice(index, 1);
  passages.splice(index + delta, 0, piece);
  return { ...draft, passages };
}

const optional: Array<keyof Cover> = ["title", "author", "date", "front", "after", "detail", "address", "closing"];

export function DraftStudio({ draft, notes, locale, update, selectMore, onBind, saving, paidState, children }: {
  draft: BookDraft; notes: Note[] | null; locale: UiLocale; update: (draft: BookDraft) => void;
  selectMore: () => void; onBind: (thenExport: boolean) => void; saving: boolean; paidState?: string;
  children?: React.ReactNode;
}) {
  const c = tsuzuriMessages[locale];
  const a = draft.appearance;
  const updatePiece = (updated: DraftPassage) => update({
    ...draft, passages: draft.passages.map((item) => item.id === updated.id ? updated : item),
  });
  return (
    <>
      <div className="ts-intro"><h1>{c.appearance}</h1><p>{c.fixedOriginal}</p></div>
      {draft.passages[0] && <BookPage appearance={a} text={draft.passages[0]} cover={draft.cover} />}
      {children}
      <details>
        <summary>{c.options}</summary>
        <div className="ts-controls">
          {optional.map((key) => <label key={key}>{c[key]}
            <textarea rows={1} dir="auto" value={draft.cover[key]} onChange={(event) => update({
              ...draft, cover: { ...draft.cover, [key]: preserveUneditedText(draft.cover[key], event.target.value) },
            })} />
          </label>)}
          <MaterialFields value={a} c={c} update={(appearance) => update({ ...draft, appearance })} />
          <label>{c.direction}<select aria-label={c.direction} value={a.direction} onChange={(event) => {
            const direction = event.target.value as typeof a.direction;
            update({ ...draft, appearance: { ...a, direction } });
          }}>
            <option value="horizontal">{c.horizontal}</option><option value="vertical">{c.vertical}</option>
          </select></label>
          <label>{c.binding}<select aria-label={c.binding} value={a.binding} onChange={(event) => update({ ...draft, appearance: { ...a, binding: event.target.value as typeof a.binding } })}>
            <option value="left">{c.left}</option><option value="right">{c.right}</option>
          </select></label>
        </div>
      </details>
      <details open={draft.passages.length > 1 || undefined}>
        <summary>{c.arranged} · {new Intl.NumberFormat(locale).format(draft.passages.length)}</summary>
        <div className="ts-list">
          {draft.passages.map((piece, index) => (
            <div className="ts-piece" key={piece.id}>
              <p dir="auto" lang={piece.title ? "" : locale}>{piece.title || c.untitled}</p>
              <details className="ts-piece-details">
                <summary>{c.currentPiece}</summary>
                <pre dir="auto" lang="">{piece.body}</pre>
              </details>
              <div className="ts-row">
                <button type="button" disabled={index === 0} onClick={() => update(movePassage(draft, index, -1))}>{c.moveEarlier}</button>
                <button type="button" disabled={index === draft.passages.length - 1} onClick={() => update(movePassage(draft, index, 1))}>{c.moveLater}</button>
                <button type="button" onClick={() => update({ ...draft, passages: draft.passages.filter((item) => item.id !== piece.id) })}>{c.removePassage}</button>
              </div>
              <PieceEditor piece={piece} source={notes?.find((note) => note.id === piece.localNoteId)} confirmed={notes !== null} c={c} update={updatePiece} />
            </div>
          ))}
          <button type="button" onClick={selectMore}>{c.selectMore}</button>
        </div>
      </details>
      {paidState && <p role="status">{paidState}</p>}
      <div className="ts-row">
        <button className="ts-primary" type="button" disabled={saving || !draft.passages.length || !!paidState}
          onClick={() => onBind(false)}>{draft.bookId ? c.saveEdition : c.bind}</button>
        {draft.bookId && <button type="button" disabled={saving || !draft.passages.length || !!paidState}
          onClick={() => onBind(true)}>{c.saveAndExport}</button>}
        <button type="button" onClick={() => update({ ...draft, appearance: { ...BASIC_APPEARANCE,
          direction: a.direction, binding: a.binding } })}>{c.useFree}</button>
      </div>
    </>
  );
}

function PieceEditor({ piece, source, c, update, confirmed }: {
  piece: DraftPassage; source?: Note; confirmed: boolean; c: TsuzuriCopy; update: (piece: DraftPassage) => void;
}) {
  const changed = source && piece.sourceBase &&
    (source.title !== piece.sourceBase.title || source.body !== piece.sourceBase.body);
  return (
    <>
      <details>
        <summary>{c.editPiece}</summary>
        <div className="ts-controls">
          <label>{c.noteTitle}<textarea dir="auto" lang="" rows={2} value={piece.title} onChange={(event) => update({
            ...piece, title: preserveUneditedText(piece.title, event.target.value),
          })} /></label>
          <label>{c.noteBody}<textarea dir="auto" lang="" rows={5} value={piece.body} onChange={(event) => update({
            ...piece, body: preserveUneditedText(piece.body, event.target.value),
          })} /></label>
        </div>
      </details>
      {confirmed && piece.sourceBase && !source && <p>{c.sourceMissing}</p>}
      {source && changed && piece.sourceBase && (
        <details>
          <summary>{c.sourceChanged} · {c.compare}</summary>
          <div className="ts-controls">
            <OriginalText label={c.previousSource} text={pieceText(piece.sourceBase)} rows={4} />
            <OriginalText label={c.currentPiece} text={pieceText(piece)} rows={4} />
            <OriginalText label={c.currentSource} text={pieceText(source)} rows={4} />
            <button type="button" onClick={() => update(adoptSource(piece, source))}>{c.useSource}</button>
            <button type="button" onClick={() => update(adoptSource(piece, source, true))}>{c.keepPiece}</button>
          </div>
        </details>
      )}
    </>
  );
}

export function DraftRescue({ draft, locale }: { draft: BookDraft; locale: UiLocale }) {
  const c = tsuzuriMessages[locale];
  return (
    <div className="ts-list">
      {draft.passages.map((piece) => (
        <div key={piece.id}>
          <OriginalText label={c.currentPiece} text={pieceText(piece)} rows={4} />
          <CopyTextButton label={c.copyOriginal} text={pieceText(piece)} feedback={rescueMessages[locale]} />
        </div>
      ))}
    </div>
  );
}
