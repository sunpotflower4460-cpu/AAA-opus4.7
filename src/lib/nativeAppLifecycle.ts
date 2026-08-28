import { App as CapacitorApp, type AppState } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type NativeAppStateListener = (state: AppState) => void;

/**
 * Native container 上だけ Capacitor App lifecycle を購読する。
 * Web では既存の visibility/pagehide/pageshow を使うため登録しない。
 *
 * addListener() は非同期なので、登録完了より先に React effect が cleanup された場合も
 * 遅れて返った handle を即 remove し、listener leak を残さない。
 */
export function subscribeToNativeAppState(listener: NativeAppStateListener): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let disposed = false;
  let removeListener: (() => void) | null = null;

  void CapacitorApp.addListener("appStateChange", listener)
    .then((handle) => {
      const removeSafely = () => {
        void handle.remove().catch(() => {
          // Listener cleanup の失敗を unhandled rejection にしない。
          // effect はすでに破棄済みなので、画面側で復旧操作を要求する必要はない。
        });
      };

      if (disposed) {
        removeSafely();
        return;
      }
      removeListener = removeSafely;
    })
    .catch(() => {
      // Native plugin 登録だけが失敗しても、DOM lifecycle の保存境界は残る。
      // ここで画面自体をエラー化するとメモ編集を妨げるため、fallback を優先する。
    });

  return () => {
    disposed = true;
    removeListener?.();
  };
}
