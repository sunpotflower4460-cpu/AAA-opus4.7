import { useSyncExternalStore } from "react";

/**
 * 「筆あと」— 書いた言葉の字の表情を選ぶ設定。
 * メモ本体の保存キーとは完全に分離し、壊れても・消えてもメモに影響しない。
 */
export type BrushId = "mincho" | "fude" | "boku" | "tegaki";

export type BrushOption = {
  id: BrushId;
  label: string;
  labelEn: string;
  note: string;
  sample: string;
};

export const BRUSHES: readonly BrushOption[] = [
  {
    id: "mincho",
    label: "明朝",
    labelEn: "Mincho",
    note: "端正で、静かな活字",
    sample: "心が、静かに残る。",
  },
  {
    id: "fude",
    label: "筆",
    labelEn: "Brush",
    note: "筆のかすれと、はらい",
    sample: "心が、静かに残る。",
  },
  {
    id: "boku",
    label: "墨",
    labelEn: "Ink",
    note: "太く、墨の溜まる字",
    sample: "心が、静かに残る。",
  },
  {
    id: "tegaki",
    label: "手書き",
    labelEn: "Handwriting",
    note: "ペンで書いたような温もり",
    sample: "心が、静かに残る。",
  },
];

export const BRUSH_STORAGE_KEY = "zanshin.prefs.brush.v1";
export const DEFAULT_BRUSH: BrushId = "mincho";

function isBrushId(value: unknown): value is BrushId {
  return BRUSHES.some((brush) => brush.id === value);
}

export function readStoredBrush(): BrushId {
  try {
    const raw = window.localStorage.getItem(BRUSH_STORAGE_KEY);
    return isBrushId(raw) ? raw : DEFAULT_BRUSH;
  } catch {
    return DEFAULT_BRUSH;
  }
}

let current: BrushId = DEFAULT_BRUSH;
let initialized = false;
const listeners = new Set<() => void>();

function applyToDocument(id: BrushId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-brush", id);
}

/** 描画前（main.tsx）に呼び、初回表示で字体が切り替わるちらつきを防ぐ。 */
export function initBrush(): BrushId {
  if (!initialized) {
    current = readStoredBrush();
    initialized = true;
  }
  applyToDocument(current);
  return current;
}

export function getBrush(): BrushId {
  return initialized ? current : initBrush();
}

export function setBrush(id: BrushId): void {
  current = id;
  initialized = true;
  applyToDocument(id);
  try {
    window.localStorage.setItem(BRUSH_STORAGE_KEY, id);
  } catch {
    // 保存できなくても、この起動中は選んだ字体で使える。
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBrush(): BrushId {
  return useSyncExternalStore(subscribe, getBrush, () => DEFAULT_BRUSH);
}
