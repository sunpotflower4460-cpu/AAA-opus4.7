import type { Messages } from "./i18n";
import type { SaveResult } from "./storage";

/**
 * conflict は専用の競合UIで扱うため null を返す。
 * それ以外の保存失敗は、表示場所に依存しない共通メッセージへ正規化する。
 */
export function getSaveFailureMessage(
  copy: Messages,
  result: SaveResult | null | undefined,
  options: { deletePending?: boolean } = {},
): string | null {
  if (!result || result.ok) return null;

  // 削除が保存先に確定していない時は、「削除しました」の印象を残さず、確定していないと伝える。
  if (options.deletePending && result.reason !== "conflict" && result.reason !== "recovery_archive_full") {
    return copy.deleteSaveFailed;
  }

  switch (result.reason) {
    case "conflict":
      return null;
    case "recovery_archive_full":
      return copy.recoveryArchiveFull;
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
