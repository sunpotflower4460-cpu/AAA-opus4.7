import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "./types/note";
import { loadNotes, saveNotes } from "./lib/storage";
import { nowIso } from "./lib/date";
import { createId } from "./lib/id";
import { AppShell } from "./components/AppShell";
import { NotesList } from "./components/NotesList";
import { NoteEditor } from "./components/NoteEditor";

type View = { kind: "list" } | { kind: "editor"; id: string };

const AUTOSAVE_DEBOUNCE_MS = 500;

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [view, setView] = useState<View>({ kind: "list" });

  // localStorage への自動保存（変更をデバウンスして書く）
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

  // 離脱時にはフラッシュ
  useEffect(() => {
    const flush = () => saveNotes(notes);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [notes]);

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
        prev.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n,
        ),
      );
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setView({ kind: "list" });
  }, []);

  const openNote = useCallback((id: string) => {
    setView({ kind: "editor", id });
  }, []);

  const currentNote = useMemo<Note | undefined>(() => {
    if (view.kind !== "editor") return undefined;
    return notes.find((n) => n.id === view.id);
  }, [view, notes]);

  // エディタを開いているのに対象が消えた場合（外部からの削除など）は一覧に戻る
  useEffect(() => {
    if (view.kind === "editor" && !currentNote) {
      setView({ kind: "list" });
    }
  }, [view, currentNote]);

  return (
    <AppShell>
      {view.kind === "list" || !currentNote ? (
        <NotesList notes={notes} onOpen={openNote} onCreate={createNote} />
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
