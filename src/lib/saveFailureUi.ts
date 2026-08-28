import { copy } from "./i18n";
import type { SaveResult } from "./storage";

/**
 * conflict は専用の競合UIで扱うため null を返す。
 * それ以外の保存失敗は、表示場所に依存しない共通メッセージへ正規化する。
 */
export function getSaveFailureMessage(
  result: SaveResult | null | undefined,
): string | null {
  if (!result || result.ok) return null;

  switch (result.reason) {
    case "conflict":
      return null;
    case "quota":
      return copy.saveErrorQuota;
    case "unavailable":
      return copy.saveErrorUnavailable;
    case "invalid_data":
      return copy.saveErrorInvalidData;
    case "unknown":
    default:
      return copy.saveError;
  }
}
