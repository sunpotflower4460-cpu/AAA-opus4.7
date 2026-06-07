/**
 * App Store 初回リリース用フィーチャーフラグ。
 * 広告・課金モックを本番ビルドから除外するために使用する。
 *
 * 将来 StoreKit / 広告 SDK を導入する際は各フラグを true に変更し、
 * 対応する実装と差し替える。
 */
export const APP_STORE_INITIAL_RELEASE = true;

/** 広告スロットを表示するか。初回リリースでは false。 */
export const ADS_ENABLED = false;

/** Premium（課金）機能の導線を表示するか。初回リリースでは false。 */
export const PREMIUM_ENABLED = false;
