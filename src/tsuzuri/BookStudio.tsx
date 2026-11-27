import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { listProtectedRecoveryCandidates } from "../lib/storage";
import type { Note } from "../types/note";
import { useI18n } from "../i18n/useI18n";
import { handleModalKeyDown } from "../components/modalKeyboard";
import { applyRestoreNotes, makeArchive, planRestore, readArchive, replanRestoreNotes, type Archive } from "./backup";
import { rememberBookDraft } from "./bookRescue";
import { BookPage } from "./BookPage";
import { BookReader } from "./BookReader";
import { SAMPLE_IDS } from "./catalog";
import { ChoosePassages, DraftStudio } from "./DraftStudio";
import { DraftRescue } from "./DraftRescue";
import { eraseAllData } from "./erase";
import { offerFile } from "./exportFile";
import {
  bindDraft, blankDraft, bookOriginalText, editionDraft, editionText, newId, removeBook,
  type BookDraft, type Library,
} from "./model";
import { tsuzuriMessages, type TsuzuriMessage } from "./messages";
import { mirrorLibrary, nativeLibraryCheck, readNativeBookRecoveryCopies } from "./nativeFiles";
import { bindingBlock, hasVerifiedPurchase, useEntitlement } from "./entitlements";
import { PurchasePanel } from "./PurchasePanel";
import { EverydayStudio } from "./EverydayStudio";
import { SampleStudio } from "./SampleStudio";
import { StylePicker } from "./StylePicker";
import { OutputStudio, type OutputKind, type OutputRequest } from "./OutputStudio";
import { validLibrary } from "./validation";
import { adoptLibraryCandidate, LibraryError, readLibrary, readLibraryRecords, sameLibrary, writeLibrary, type RestoreJournal } from "./repository";

type View = "shelf" | "choose" | "draft" | "read" | "output" | "data" | "sample" | "everyday";
type Recovery = { candidate?: Library; local: unknown };
type Props = {
  notes: Note[];
  notesReady: boolean;
  epoch: string | null;
  initialNote?: Note;
  onClose: () => void;
  onNotesApplied: (notes: Note[]) => void;
  onCheckNotes: () => Note[] | null;
};

function errorMessage(error: unknown, fallback: TsuzuriMessage): TsuzuriMessage {
  switch (error instanceof Error ? error.message : "") {
    case "conflict": return "conflict";
    case "invalidArchive": return "invalidArchive";
    case "archiveVersion": return "archiveVersion";
    case "restoreIncomplete": return "restoreIncomplete";
    case "notesWait": return "notesWait";
    case "freeLimit": return "freeLimit";
    case "paidPreview": return "paidPreview";
    default: return fallback;
  }
}

export default function BookStudio(props: Props) {
  const { locale, readingMode } = useI18n();
  const c = tsuzuriMessages[locale];
  const { notes, notesReady, epoch, onClose, initialNote, onNotesApplied, onCheckNotes } = props;
  const [view, setView] = useState<View>(initialNote ? "draft" : "shelf");
  const [draft, setDraft] = useState<BookDraft | null>(() => initialNote ? blankDraft(readingMode, initialNote) : null);
  const draftRef = useRef(draft);
  const dialog = useRef<HTMLDivElement>(null);
  const readerReturn = useRef<{ top: number; trigger: HTMLButtonElement } | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const latest = useRef<Library | null>(null);
  const sequence = useRef<Promise<unknown>>(Promise.resolve());
  const [selected, setSelected] = useState<{ id: string; edition?: string } | null>(null);
  const [sample, setSample] = useState<(typeof SAMPLE_IDS)[number]>("scenes");
  const [request, setRequest] = useState<OutputRequest | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [restore, setRestore] = useState<RestoreJournal | undefined>();
  const [archive, setArchive] = useState<Archive | null>(null);
  const fileSelection = useRef(0);
  const [needsRestoreConfirm, setNeedsRestoreConfirm] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<ReturnType<typeof planRestore> | null>(null);
  const [status, setStatus] = useState<TsuzuriMessage | null>(null);
  const [nativeWarning, setNativeWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [purchase, setPurchase] = useState(false);
  const [erasing, setErasing] = useState(false);
  const entitlement = useEntitlement();
  const owned = entitlement.state === "verified";

  const applyLibrary = useCallback((value: Library) => {
    latest.current = value;
    setLibrary(value);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await readLibrary();
      if (result.kind === "damaged") {
        setRecovery({ local: result.raw, candidate: result.previous });
        setStatus("invalidLibrary");
        return;
      }
      try {
        const candidate = await nativeLibraryCheck(result.library, result.stored !== undefined);
        setRecovery(candidate ? { local: result.stored, candidate } : null);
      } catch {
        setRecovery({ local: result.stored });
        setStatus("nativeBackupFailed");
        return;
      }
      setRestore(result.restore);
      setStatus(null);
      applyLibrary(result.library);
    } catch {
      setRecovery({ local: undefined });
      setStatus("invalidLibrary");
    }
  }, [applyLibrary]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refresh(); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    if (draftRef.current) rememberBookDraft(draftRef.current);
  }, []);

  useLayoutEffect(() => {
    const surface = dialog.current;
    if (!surface) return;
    if (view === "read" && readerReturn.current) {
      const { top, trigger } = readerReturn.current;
      readerReturn.current = null;
      surface.scrollTop = top;
      if (trigger.isConnected) {
        trigger.focus({ preventScroll: true });
        return;
      }
    } else {
      surface.scrollTop = 0;
    }
    surface.focus({ preventScroll: true });
  }, [view, selected]);

  function changeDraft(value: BookDraft | null) {
    draftRef.current = value;
    rememberBookDraft(value);
    setDraft(value);
  }

  const commit = useCallback((change: (current: Library) => Library, journal?: RestoreJournal, replacesJournalId?: string) => {
    const operation = sequence.current.then(async () => {
      const previous = latest.current;
      if (!previous) throw new LibraryError("blocked");
      const next = change(previous);
      if (next === previous && !journal) return previous;
      const saved = await writeLibrary(previous, next, epoch, journal, replacesJournalId);
      applyLibrary(saved);
      if (journal) {
        setRestore(journal);
        return saved;
      }
      const mirrored = await mirrorLibrary(saved, epoch);
      setNativeWarning(!mirrored);
      return saved;
    });
    sequence.current = operation.catch(() => {});
    return operation;
  }, [epoch, applyLibrary]);

  const saveDraft = useCallback(async (value: BookDraft) => {
    if (!latest.current || recovery || restore) return false;
    try {
      await commit((current) => {
        if (draftRef.current !== value) return current;
        const saved = current.drafts.find((item) => item.id === value.id);
        if (saved && JSON.stringify(value) === JSON.stringify(saved)) return current;
        return { ...current, drafts: [...current.drafts.filter((item) => item.id !== value.id), value] };
      });
      return true;
    } catch (error) {
      setStatus(errorMessage(error, "saveFailed"));
      return false;
    }
  }, [commit, recovery, restore]);

  useEffect(() => {
    if (!draft || !library || busy || recovery || restore ||
        (draft.passages.length === 0 && !library.drafts.some((entry) => entry.id === draft.id))) return;
    const timer = window.setTimeout(() => void saveDraft(draft), 450);
    return () => window.clearTimeout(timer);
  }, [draft, library, busy, recovery, restore, saveDraft]);

  function createDraft(note?: Note) {
    setStatus(null);
    changeDraft(blankDraft(readingMode, note));
    setView(note ? "draft" : "choose");
  }

  function openBook(id: string, edition?: string) {
    setSelected({ id, edition });
    setStatus(null);
    setView("read");
  }

  function getRequest(source: Library, id: string, kind: OutputKind, index = 0, version?: string) {
    const book = source.books.find((item) => item.id === id)!;
    const edition = source.editions.find((item) => item.id === (version ?? book.editionId))!;
    return { edition, pieces: editionText(source, edition), kind, index };
  }

  function openOutput(kind: OutputKind, index: number, trigger: HTMLButtonElement) {
    if (!library || !selected) return;
    readerReturn.current = { top: dialog.current?.scrollTop ?? 0, trigger };
    setRequest(getRequest(library, selected.id, kind, index, selected.edition));
    setView("output");
  }

  async function bind(thenExport: boolean) {
    if (!draft || busy || !draft.passages.length) return;
    const frozen = draft;
    setBusy(true);
    setStatus(null);
    try {
      let id = "";
      const saved = await commit((current) => {
        const block = bindingBlock(current, frozen, hasVerifiedPurchase());
        if (block) throw new Error(block);
        const next = bindDraft(current, frozen);
        id = next.book.id;
        return next.library;
      });
      changeDraft(null);
      openBook(id);
      setStatus("bookSaved");
      if (thenExport) {
        setRequest(getRequest(saved, id, "basic"));
        setView("output");
      }
    } catch (error) {
      setStatus(errorMessage(error, "saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function leaveDraft(destination: View | "exit") {
    if (busy) return;
    const value = draftRef.current;
    if (value && (value.passages.length > 0 || library?.drafts.some((item) => item.id === value.id))) {
      if (!await saveDraft(value)) return;
    }
    if (draftRef.current !== value) return;
    changeDraft(null);
    if (destination === "exit") onClose();
    else setView(destination);
  }

  function openPurchase() {
    if (!notesReady || restore || recovery || status === "saveFailed" || status === "conflict") {
      setStatus("recoveryUnavailable");
      return;
    }
    setPurchase(true);
  }

  function back() {
    if (busy || erasing) return;
    if (purchase) { setPurchase(false); return; }
    if (view === "output") { setView("read"); return; }
    if (view === "draft" || view === "choose") { void leaveDraft("shelf"); return; }
    if (view === "data") fileSelection.current++;
    if (view !== "shelf") { setView("shelf"); return; }
    onClose();
  }

  async function download(data: string, name: string, type: string) {
    try {
      setStatus(await offerFile(new Blob([data], { type }), name, epoch));
    } catch {
      setStatus("exportFailed");
    }
  }

  async function makeBackup() {
    const currentNotes = onCheckNotes();
    if (!currentNotes || !library) { setStatus("notesWait"); return; }
    if (restore || recovery || draftRef.current) { setStatus("recoveryUnavailable"); return; }
    const records = await readLibrary();
    if (records.kind !== "ready" || records.restore) { setStatus("recoveryUnavailable"); return; }
    const confirmedNotes = onCheckNotes();
    if (!confirmedNotes || JSON.stringify(confirmedNotes) !== JSON.stringify(currentNotes) || draftRef.current) {
      setStatus("notesWait");
      return;
    }
    await download(JSON.stringify(makeArchive(currentNotes, records.library)), "zanshin-backup.json", "application/json;charset=utf-8");
  }

  async function selectArchive(file: File) {
    const selection = ++fileSelection.current;
    setArchive(null);
    setPreviewPlan(null);
    setStatus(null);
    try {
      const value = readArchive(await file.text());
      if (selection !== fileSelection.current) return;
      const currentNotes = onCheckNotes();
      const baseline = latest.current;
      if (!currentNotes || !baseline) throw new Error("notesWait");
      setArchive(value);
      setPreviewPlan(planRestore(currentNotes, baseline, value));
    } catch (error) {
      if (selection !== fileSelection.current) return;
      setStatus(errorMessage(error, "invalidArchive"));
    }
  }

  async function performRestore(resume: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const currentNotes = onCheckNotes();
      if (!currentNotes) throw new Error("notesWait");
      const reviewed = previewPlan;
      let journal = restore;
      if (resume && journal && library) {
        const currentRaw = JSON.stringify(currentNotes);
        if (currentRaw !== JSON.stringify(journal.baseNotes) && currentRaw !== JSON.stringify(journal.nextNotes)) {
          setPreviewPlan(replanRestoreNotes(currentNotes, library, journal));
          setNeedsRestoreConfirm(true);
          return;
        }
      }
      if (!resume && reviewed) {
        if (JSON.stringify(currentNotes) !== JSON.stringify(reviewed.journal.baseNotes)) {
          if (needsRestoreConfirm && restore && library) setPreviewPlan(replanRestoreNotes(currentNotes, library, restore));
          else if (archive && library) setPreviewPlan(planRestore(currentNotes, library, archive));
          throw new Error("conflict");
        }
        journal = reviewed.journal;
        await commit((current) => {
          if (!sameLibrary(current, reviewed.baseLibrary)) throw new Error("conflict");
          return reviewed.library;
        }, journal, needsRestoreConfirm ? restore?.id : undefined);
        setArchive(null);
        setPreviewPlan(null);
        setNeedsRestoreConfirm(false);
      }
      if (!journal) return;
      await applyRestoreNotes(journal.id, epoch, onNotesApplied);
      setNativeWarning(false);
      setRestore(undefined);
      setStatus("restoreDone");
    } catch (error) {
      setStatus(errorMessage(error, "restoreIncomplete"));
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setErasing(true);
    setStatus("erasePending");
    try {
      await eraseAllData();
    } catch {
      setErasing(false);
      setStatus("erasePending");
      return;
    }
    changeDraft(null);
    try { sessionStorage.setItem("zanshin.erased", "1"); } catch { /* Confirmation is optional. */ }
    window.location.reload();
  }

  async function chooseCandidate(candidate: Library, comparison: Recovery) {
    try {
      const saved = await adoptLibraryCandidate(candidate, comparison.local, epoch, comparison.candidate);
      applyLibrary(saved);
      setRecovery(null);
      setStatus(null);
      setNativeWarning(!await mirrorLibrary(saved, epoch));
    } catch (error) {
      setStatus(errorMessage(error, "saveFailed"));
    }
  }

  const book = library?.books.find((item) => item.id === selected?.id);
  const edition = book && library?.editions.find((item) => item.id === (selected?.edition ?? book.editionId));
  const limit = library && draft ? bindingBlock(library, draft, owned) : null;
  const displayStatus = status && c[status];
  const failure = status === "saveFailed" || status === "conflict";
  const readerKey = edition?.id;

  return (
    <div className="ts-dialog" role="dialog" aria-modal="true" aria-label={c.shelf} lang={locale} tabIndex={-1} ref={dialog}
      onKeyDown={(event) => handleModalKeyDown(event, back)}>
      <div className="ts-inner">
        <header className="ts-bar">
          <button type="button" onClick={back} disabled={busy || erasing}>{view === "shelf" ? c.close : c.back}</button>
          <span>{c.shelf}</span>
        </header>
        {displayStatus && <p className={failure ? "ts-alert" : "ts-status"} role={failure ? "alert" : "status"}>{displayStatus}</p>}
        {nativeWarning && <div className="ts-alert"><p>{c.nativeBackupFailed}</p><button type="button" onClick={() => {
          if (library) void mirrorLibrary(library, epoch).then((ok) => setNativeWarning(!ok));
        }}>{c.retry}</button></div>}
        {failure && draft && <details open><summary>{c.copyOriginal}</summary><DraftRescue draft={draft} locale={locale} />
          <button type="button" onClick={() => void download(bookOriginalText(draft.cover, draft.passages), "zanshin-draft.txt", "text/plain;charset=utf-8")}>{c.originalFile}</button>
          <button type="button" onClick={() => void refresh()}>{c.retry}</button></details>}
        {recovery ? (
          <div className="ts-controls">
            <p>{c.invalidLibrary}</p>
            {recovery.local !== undefined && <button type="button" onClick={() => void download(JSON.stringify(recovery.local), "zanshin-local-books.json", "application/json")}>{c.localEdition}</button>}
            {recovery.candidate && <>
              <button type="button" onClick={() => void download(JSON.stringify(recovery.candidate), "zanshin-book-candidate.json", "application/json")}>{c.candidate}</button>
              <details><summary>{c.useCandidate}</summary><p>{c.adoptHint}</p>
                {recovery.candidate.books.map((item) => {
                  const version = recovery.candidate!.editions.find((value) => value.id === item.editionId)!;
                  return <details key={item.id}><summary>{version.cover.title || c.untitled}</summary>
                    <pre dir="auto" lang="">{bookOriginalText(version.cover, editionText(recovery.candidate!, version))}</pre></details>;
                })}
                <button type="button" onClick={() => { if (recovery.candidate) void chooseCandidate(recovery.candidate, recovery); }}>{c.useCandidate}</button>
              </details>
              {validLibrary(recovery.local) && <details>
                <summary>{c.localEdition}</summary><p>{c.adoptHint}</p>
                {recovery.local.books.map((item) => {
                  const local = recovery.local as Library;
                  const version = local.editions.find((value) => value.id === item.editionId)!;
                  return <details key={item.id}><summary>{version.cover.title || c.untitled}</summary>
                    <pre lang="" dir="auto">{bookOriginalText(version.cover, editionText(local, version))}</pre></details>;
                })}
                <button type="button" onClick={() => { if (validLibrary(recovery.local)) void chooseCandidate(recovery.local, recovery); }}>{c.keepLocalEdition}</button>
              </details>}
            </>}
            <button type="button" onClick={() => void refresh()}>{c.retry}</button>
          </div>
        ) : !library ? (
          <p role="status">{c.loading}</p>
        ) : <>
          {restore && view !== "data" && <button type="button" onClick={() => setView("data")}>{c.resumeRestore}</button>}
          {view === "shelf" && <>
            <div className="ts-intro"><h1>{c.shelf}</h1>{library.books.length === 0 && <p>{c.emptyShelf}</p>}</div>
            <div className="ts-list ts-shelf">
              {library.books.map((item) => {
                const version = library.editions.find((value) => value.id === item.editionId)!;
                const passage = editionText(library, version)[0];
                const title = version.cover.title || passage.title;
                return <div key={item.id} className="ts-shelf-card">
                  <BookPage text={passage} appearance={{ ...version.appearance, direction: "horizontal" }} cover={version.cover} />
                  <button type="button" onClick={() => openBook(item.id)}>{c.reading} · <span dir="auto" lang={title ? "" : locale}>{title || c.untitled}</span></button>
                </div>;
              })}
            </div>
            {!notesReady && <p>{c.notesWait}</p>}
            <button className="ts-primary" type="button" disabled={!notesReady || !notes.length || !!restore} onClick={() => { if (onCheckNotes()?.length) createDraft(); else setStatus("notesWait"); }}>{c.newBook}</button>
            {library.drafts.map((value) => (
              <div className="ts-row" key={value.id}>
                <button type="button" onClick={() => { changeDraft(value); setView("draft"); }}>{c.resumeDraft} · {value.cover.title || value.passages[0]?.title || c.untitled}</button>
                <button type="button" disabled={!!restore} onClick={() => void commit((current) => ({
                  ...current, drafts: current.drafts.filter((item) => item.id !== value.id),
                })).catch((error) => setStatus(errorMessage(error, "saveFailed")))}>{c.discardDraft}</button>
              </div>
            ))}
            {SAMPLE_IDS.some((id) => !library.hiddenSamples.includes(id)) && <details>
              <summary>{c.samples}</summary>
              <div className="ts-row">{SAMPLE_IDS.filter((id) => !library.hiddenSamples.includes(id)).map((id) => (
                <button type="button" key={id} onClick={() => { setSample(id); setView("sample"); }}>{id === "scenes" ? c.sampleA : c.sampleB}</button>
              ))}</div>
            </details>}
            <div className="ts-row">
              <button type="button" onClick={() => setView("everyday")}>{c.everyday}</button>
              <button type="button" onClick={() => setView("data")}>{c.backup}</button>
              <button type="button" onClick={openPurchase}>{c.purchaseInfo}</button>
            </div>
          </>}
          {view === "sample" && <SampleStudio id={sample} locale={locale}
            onTry={() => { if (onCheckNotes()?.length) createDraft(); else setStatus("notesWait"); }}
            onHide={() => void commit((current) => ({ ...current, hiddenSamples: [...new Set([...current.hiddenSamples, sample])] }))
              .then(() => setView("shelf")).catch((error) => setStatus(errorMessage(error, "saveFailed")))} />}
          {view === "everyday" && <EverydayStudio c={c} note={notesReady ? notes[0] : undefined}
            direction={readingMode} owned={owned} onStatus={setStatus} onPurchase={openPurchase} />}
          {view === "choose" && draft && <ChoosePassages notes={notesReady ? notes : []} onCheck={onCheckNotes} onBlocked={() => setStatus("notesWait")} draft={draft} locale={locale} update={changeDraft} next={() => setView("draft")} />}
          {view === "draft" && draft && <fieldset className="ts-draft-fields" disabled={busy || !!restore}><DraftStudio draft={draft} notes={notesReady ? notes : null} locale={locale} update={changeDraft}
            selectMore={() => setView("choose")} onBind={(output) => void bind(output)} saving={busy || !!restore} paidState={limit ? c[limit] : undefined}>
            {draft.passages[0] && <StylePicker appearance={draft.appearance} cover={draft.cover}
              text={draft.passages[0]} presets={library.presets} c={c} owned={owned}
              update={(appearance) => changeDraft({ ...draft, appearance })}
              onPurchase={openPurchase} onSavePreset={(name) => {
                if (hasVerifiedPurchase()) void commit((current) => ({
                  ...current, presets: [...current.presets, { id: newId(), name, appearance: { ...draft.appearance } }],
                })).catch((error) => setStatus(errorMessage(error, "saveFailed")));
              }}
              onDeletePreset={(id) => void commit((current) => ({
                ...current, presets: current.presets.filter((preset) => preset.id !== id),
              })).catch((error) => setStatus(errorMessage(error, "saveFailed")))} />}
            {limit && <button type="button" onClick={openPurchase}>{c.purchaseInfo}</button>}
          </DraftStudio></fieldset>}
          {(view === "read" || view === "output") && book && edition && <div className="ts-reader-holder" hidden={view !== "read"}><BookReader library={library} book={book} edition={edition} key={readerKey} locale={locale} visible={view === "read"}
            onArrange={edition.id === book.editionId ? () => {
              changeDraft(library.drafts.find((item) => item.bookId === book.id && item.baseEditionId === book.editionId) ?? editionDraft(library, book));
              setView("draft");
            } : undefined}
            onDelete={edition.id === book.editionId ? () => { void commit((value) => removeBook(value, book.id)).then(() => setView("shelf")).catch((error) => setStatus(errorMessage(error, "saveFailed"))); } : undefined}
            onDuplicate={() => {
              const value = editionDraft(library, book);
              changeDraft({ ...value, id: newId(), bookId: null, baseEditionId: null });
              setView("draft");
            }}
            onHistory={(id) => openBook(book.id, id)}
            onBookmark={(bookmark) => void commit((current) => ({ ...current, books: current.books.map((item) =>
              item.id === book.id ? { ...item, bookmark } : item) })).then(() => setStatus("bookmarked")).catch((error) => setStatus(errorMessage(error, "saveFailed")))}
            onOutput={openOutput} onOriginal={(text) => void download(text, "zanshin-book.txt", "text/plain;charset=utf-8")} /></div>}
          {view === "output" && request && <OutputStudio request={request} locale={locale} epoch={epoch} owned={owned} onPurchase={openPurchase} onBusy={setBusy} />}
          {view === "data" && <>
            <div className="ts-intro"><h1>{c.backup}</h1><p>{c.backupNotice}</p></div>
            {!notesReady && <p>{c.notesWait}</p>}
            {restore && <div role="alert"><p>{c.restoreIncomplete}</p>
              <button type="button" disabled={busy} onClick={() => void performRestore(true)}>{c.resumeRestore}</button></div>}
            <button type="button" disabled={!notesReady || !!restore || busy} onClick={() => void makeBackup().catch(() => setStatus("exportFailed"))}>{c.exportBackup}</button>
            <button type="button" onClick={() => void Promise.all([readLibraryRecords(), readNativeBookRecoveryCopies()]).then(([{ displaced }, nativeRaw]) => {
              if (displaced?.length || nativeRaw !== null) return download(JSON.stringify({ displaced, nativeRaw }), "zanshin-book-recovery.json", "application/json");
              setStatus("noRecoveryCopies");
            }).catch(() => setStatus("exportFailed"))}>{c.exportBookRecovery}</button>
            <button type="button" onClick={() => {
              const protectedCopies = listProtectedRecoveryCandidates();
              if (protectedCopies.length) void download(JSON.stringify(protectedCopies.map(({ slot, raw }) => ({ slot, raw }))), "zanshin-note-recovery.json", "application/json");
              else setStatus("noRecoveryCopies");
            }}>{c.exportNoteRecovery}</button>
            <label>{c.restoreFile}<input type="file" accept=".json,application/json" disabled={!notesReady || !!restore || busy}
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectArchive(file); }} /></label>
            {previewPlan && <section className="ts-controls">
              <h2>{c.restorePlan}</h2>
              <p>{c.restoreNotesCount} · {previewPlan.addedNotes}</p><p>{c.restoreBooksCount} · {previewPlan.addedBooks}</p>
              <p>{c.restoreCopies} · {previewPlan.conflicts}</p><p>{c.restoreDetails}</p>
              <button type="button" className="ts-primary" disabled={busy} onClick={() => void performRestore(false)}>{c.confirmRestore}</button>
              <button type="button" onClick={() => { setArchive(null); setPreviewPlan(null); setNeedsRestoreConfirm(false); }}>{c.cancel}</button>
            </section>}
            <details><summary>{c.erase}</summary><p>{c.eraseHint}</p>
              {!confirmErase ? <button type="button" onClick={() => setConfirmErase(true)}>{c.erase}</button>
                : <div className="ts-row">
                  <button type="button" disabled={busy || erasing} onClick={() => void erase()}>{c.confirmErase}</button>
                  <button type="button" disabled={erasing} onClick={() => setConfirmErase(false)}>{c.cancel}</button>
                </div>}
            </details>
          </>}
        </>}
        {purchase && <PurchasePanel c={c} onClose={() => setPurchase(false)} onResult={setStatus} />}
      </div>
    </div>
  );
}
