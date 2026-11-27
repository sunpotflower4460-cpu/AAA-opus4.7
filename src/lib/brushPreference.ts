import { useSyncExternalStore } from "react";
import { readDisplaySetting, writeDisplaySetting } from "./displayStorage";

/**
 * 「筆あと」— 書いた言葉の字の表情を選ぶ設定。
 * メモ本体の保存キーとは完全に分離し、壊れても・消えてもメモに影響しない。
 */
export type BrushId = "mincho" | "fude" | "boku" | "tegaki";

export const BRUSHES: readonly BrushId[] = ["mincho", "fude", "boku", "tegaki"];

export const BRUSH_STORAGE_KEY = "zanshin.prefs.brush.v1";
export const DEFAULT_BRUSH: BrushId = "mincho";

function isBrushId(value: unknown): value is BrushId {
  return BRUSHES.some((brush) => brush === value);
}

export function readStoredBrush(): BrushId {
  const { value } = readDisplaySetting(BRUSH_STORAGE_KEY);
  return isBrushId(value) ? value : DEFAULT_BRUSH;
}

let current: BrushId = DEFAULT_BRUSH;
let initialized = false;
let brushWriteFailed = false;
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
  const saved = writeDisplaySetting(BRUSH_STORAGE_KEY, id);
  brushWriteFailed = !saved;
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

export function useBrushWriteFailed(): boolean {
  return useSyncExternalStore(subscribe, () => brushWriteFailed, () => false);
}
