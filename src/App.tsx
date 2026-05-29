import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "./types/note";
import type { MonetizationState } from "./types/monetization";
import { loadNotes, saveNotes } from "./lib/storage";
import {
  REMOVE_ADS_PRODUCT,
  clearPremiumMock,
  loadMonetizationState,
  purchasePremiumMock,
  restorePurchasesMock,
} from "./lib/monetization";
import { nowIso } from "./lib/date";
import { createId } from "./lib/id";
import { AppShell } from "./components/AppShell";
import { NotesList } from "./components/NotesList";
import { NoteEditor } from "./components/NoteEditor";
import { PremiumSheet } from "./components/PremiumSheet";

type View = { kind: "list" } | { kind: "editor"; id: string };

const AUTOSAVE_DEBOUNCE_MS = 500;

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [view, setView] = useState<View>({ kind: "list" });
  const [monetization, setMonetization] = useState<MonetizationState>(() =>
    loadMonetizationState(),
  );
  const [isPremiumSheetOpen, setIsPremiumSheetOpen] = useState(false);

  const persistTimer = useRef<number | null>(null);
  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      saveNotes(notes);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [notes]);

  useEffect(() => {
    const flush = () => saveNotes(notes);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [notes]);

  useEffect(() => {
    const syncMonetization = () => setMonetization(loadMonetizationState());
    window.addEventListener("storage", syncMonetization);
    return () => {
      window.removeEventListener("storage", syncMonetization);
    };
  }, []);

  const createNote = useCallback(() => {
    const iso = nowIso();
    const note: Note = {
      id: createId(),
      title: "",
      body: "",
      createdAt: iso,
      updatedAt: iso,
      isFavorite: false,
      locale: "ja",
    };
    setNotes((prev) => [note, ...prev]);
    setView({ kind: "editor", id: note.id });
  }, []);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, "title" | "body" | "isFavorite">>) => {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note,
        ),
      );
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setView({ kind: "list" });
  }, []);

  const openNote = useCallback((id: string) => {
    setView({ kind: "editor", id });
  }, []);

  const openPremiumSheet = useCallback(() => {
    setIsPremiumSheetOpen(true);
  }, []);

  const closePremiumSheet = useCallback(() => {
    setIsPremiumSheetOpen(false);
  }, []);

  const handlePurchase = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    try {
      const next = await purchasePremiumMock();
      setMonetization(next);
      if (next.isPremium) setIsPremiumSheetOpen(false);
    } catch {
      setMonetization((prev) => ({ ...prev, purchaseStatus: "error" }));
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    try {
      const next = await restorePurchasesMock();
      setMonetization(next);
    } catch {
      setMonetization((prev) => ({ ...prev, purchaseStatus: "error" }));
    }
  }, []);

  const handleDisablePremium = useCallback(async () => {
    setMonetization((prev) => ({ ...prev, purchaseStatus: "loading" }));
    try {
      const next = await clearPremiumMock();
      setMonetization(next);
    } catch {
      setMonetization((prev) => ({ ...prev, purchaseStatus: "error" }));
    }
  }, []);

  const currentNote = useMemo<Note | undefined>(() => {
    if (view.kind !== "editor") return undefined;
    return notes.find((note) => note.id === view.id);
  }, [view, notes]);

  useEffect(() => {
    if (view.kind === "editor" && !currentNote) {
      setView({ kind: "list" });
    }
  }, [view, currentNote]);

  return (
    <AppShell>
      {view.kind === "list" || !currentNote ? (
        <>
          <NotesList
            notes={notes}
            monetization={monetization}
            onOpen={openNote}
            onCreate={createNote}
            onOpenPremium={openPremiumSheet}
            onRestorePurchase={handleRestore}
          />
          <PremiumSheet
            open={isPremiumSheetOpen}
            monetization={monetization}
            product={REMOVE_ADS_PRODUCT}
            onClose={closePremiumSheet}
            onPurchase={handlePurchase}
            onRestore={handleRestore}
            onDisableMock={handleDisablePremium}
          />
        </>
      ) : (
        <NoteEditor
          note={currentNote}
          onChange={(patch) => updateNote(currentNote.id, patch)}
          onBack={() => setView({ kind: "list" })}
          onDelete={() => deleteNote(currentNote.id)}
        />
      )}
    </AppShell>
  );
}
