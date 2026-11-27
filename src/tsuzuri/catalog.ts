import { BASIC_APPEARANCE, type Appearance } from "./model";
import { BRUSHES } from "../lib/brushPreference";

export const PAPERS = {
  washi: { ground: "#fbf8ef", ink: "#27231e", rgb: "93,77,51" },
  PA01: { ground: "#f5f4ee", ink: "#272724", rgb: "107,116,123" },
  PA02: { ground: "#f5ecd7", ink: "#2b221b", rgb: "83,61,44" },
  PA03: { ground: "#fbfaf5", ink: "#252620", rgb: "89,91,70" },
  PA04: { ground: "#efe9d9", ink: "#352821", rgb: "91,69,56" },
  PA05: { ground: "#f8f2df", ink: "#2e261c", rgb: "145,103,44" },
  PA06: { ground: "#f1e3c8", ink: "#312217", rgb: "108,69,37" },
  PA07: { ground: "#edeedf", ink: "#27291e", rgb: "87,103,75" },
  PA08: { ground: "#33302d", ink: "#f8f2dd", rgb: "250,239,213" },
} as const;

export const BRUSH_FILES = {
  base: "ShipporiMincho-Regular.ttf",
  BR01: "YujiMai-Regular.ttf", BR02: "KaiseiOpti-Regular.ttf",
  BR03: "ZenKurenaido-Regular.ttf", BR04: "Yomogi-Regular.ttf",
} as const;

export const COVERS = ["plain", "CV01", "CV02", "CV03", "CV04", "CV05", "CV06"] as const;
export const FORMATS = ["BK01", "BK02", "BK03"] as const;
export const ALL_BRUSHES = [...BRUSHES, "BR01", "BR02", "BR03", "BR04"] as const;
export const PAPER_IDS = Object.keys(PAPERS) as (keyof typeof PAPERS)[];
export const PRESETS = {
  ST01: { paper: "PA01", brush: "BR04", format: "BK03", cover: "plain" },
  ST02: { paper: "PA02", brush: "BR03", format: "BK01", cover: "CV05" },
  ST03: { paper: "PA07", brush: "BR01", format: "BK02", cover: "CV04" },
  ST04: { paper: "PA03", brush: "BR02", format: "BK01", cover: "CV01" },
  ST05: { paper: "PA04", brush: "BR03", format: "BK03", cover: "CV03" },
  ST06: { paper: "PA06", brush: "tegaki", format: "BK02", cover: "CV06" },
} satisfies Record<string, Partial<Appearance>>;

export function paperId(id: string): keyof typeof PAPERS {
  return Object.prototype.hasOwnProperty.call(PAPERS, id) ? id as keyof typeof PAPERS : "washi";
}

export function freeAppearance(appearance: Appearance): Appearance {
  return { ...BASIC_APPEARANCE, direction: appearance.direction, binding: appearance.binding,
    brush: BRUSHES.some((id) => id === appearance.brush) ? appearance.brush : BASIC_APPEARANCE.brush };
}

export function sameAppearance(a: Appearance, b: Appearance): boolean {
  return a.paper === b.paper && a.brush === b.brush && a.cover === b.cover &&
    a.format === b.format && a.direction === b.direction && a.binding === b.binding && a.ink === b.ink;
}

export function requiresPurchase(appearance: Appearance): boolean {
  return !sameAppearance(appearance, freeAppearance(appearance));
}

export function brushFamily(brush: string, output = false): string {
  switch (brush) {
    case "fude": return '"Yuji Syuku", serif';
    case "boku": return '"Yuji Boku", serif';
    case "tegaki": return '"Klee One", serif';
    case "BR01":
    case "BR02":
    case "BR03":
    case "BR04": return `"Tsuzuri-${brush}", serif`;
    default: return output ? '"Tsuzuri-base", serif' : 'var(--font-mincho, serif)';
  }
}

export function paperTexture(id: string): string | undefined {
  const paper = paperId(id);
  return paper === "washi" ? undefined : `/papers/tsuzuri/${paper}.png`;
}

export const PAPER_NAMES = ["paperWashi", "paper01", "paper02", "paper03", "paper04", "paper05", "paper06", "paper07", "paper08"] as const;
export const BRUSH_NAMES = ["brushMincho", "brushFude", "brushBoku", "brushTegaki", "brush01", "brush02", "brush03", "brush04"] as const;
export const COVER_NAMES = ["plain", "cover01", "cover02", "cover03", "cover04", "cover05", "cover06"] as const;
export const FORMAT_NAMES = ["format01", "format02", "format03"] as const;
export const PRESET_NAMES = ["preset01", "preset02", "preset03", "preset04", "preset05", "preset06"] as const;

export const LETTERING_SAMPLE = { title: "残心 / Zanshin", body: "ゆっくりと、こころに残しておく。\n窓の向こうに、木の影と白い月。\nA quiet thought stays. Café · 123" };

export const SAMPLE_IDS = ["scenes", "month"] as const;
