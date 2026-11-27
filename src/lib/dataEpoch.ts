export const DATA_EPOCH_KEY = "zanshin.data-epoch.v1";

type DataEpoch = { id: string | null; erasing: boolean };

export function readDataEpoch(): DataEpoch {
  const raw = window.localStorage.getItem(DATA_EPOCH_KEY);
  if (raw === null) return { id: null, erasing: false };
  const state = JSON.parse(raw) as DataEpoch;
  if (typeof state.id !== "string" || typeof state.erasing !== "boolean") throw new Error("dataEpoch");
  return state;
}

export function dataWriteAllowed(expected?: string | null): boolean {
  try {
    const state = readDataEpoch();
    return !state.erasing && (expected === undefined || expected === state.id);
  } catch {
    return false;
  }
}

export function markDataErase(id: string, erasing: boolean): void {
  window.localStorage.setItem(DATA_EPOCH_KEY, JSON.stringify({ id, erasing }));
}
