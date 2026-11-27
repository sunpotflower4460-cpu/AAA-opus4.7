import { useSyncExternalStore, type CSSProperties } from "react";
import { readDisplaySetting, writeDisplaySetting } from "../lib/displayStorage";
import { brushFamily, paperId, paperTexture, PAPERS } from "./catalog";

const KEY = "zanshin.prefs.everyday-materials.v1";
export type Everyday = { paper: string; brush: string | null; write: boolean; subdued: boolean; dark: boolean };
const DEFAULT: Everyday = { paper: "washi", brush: null, write: false, subdued: false, dark: false };
const listeners = new Set<() => void>();
let current: Everyday | undefined;

function read() {
  if (current !== undefined) return current;
  const entry = readDisplaySetting(KEY).value;
  try {
    const value: Partial<Everyday> = JSON.parse(entry ?? "{}");
    current = {
      paper: typeof value.paper === "string" ? value.paper : "washi",
      brush: typeof value.brush === "string" ? value.brush : null,
      write: value.write === true, subdued: value.subdued === true, dark: value.dark === true,
    };
  } catch {
    current = DEFAULT;
  }
  return current;
}

export function useEveryday() {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function saveEveryday(value: Everyday): boolean {
  if (!writeDisplaySetting(KEY, JSON.stringify(value))) return false;
  current = value;
  listeners.forEach((listener) => listener());
  return true;
}

export function useEverydaySurface(writing: boolean) {
  const prefs = useEveryday();
  const paper = PAPERS[paperId(prefs.paper)];
  const texture = paperTexture(prefs.paper);
  const useBrush = prefs.brush && (!writing || prefs.write);
  const applyPaper = !!texture || prefs.subdued || prefs.dark;
  const style = {
    "--ts-everyday-paper": prefs.dark ? "#262320" : paper.ground,
    "--ts-everyday-ink": prefs.dark ? "#fff8e8" : paper.ink,
    "--ts-everyday-texture": texture && !prefs.subdued && !prefs.dark ? `url("${texture}")` : "none",
    "--font-brush": useBrush ? brushFamily(prefs.brush!) : undefined,
  } as CSSProperties;
  return { "data-ts-everyday": applyPaper ? "" : undefined, style };
}
