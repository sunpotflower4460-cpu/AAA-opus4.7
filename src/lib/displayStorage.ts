export function readDisplaySetting(key: string): { value: string | null; ok: boolean } {
  try {
    return { value: window.localStorage.getItem(key), ok: true };
  } catch {
    return { value: null, ok: false };
  }
}

export function writeDisplaySetting(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
