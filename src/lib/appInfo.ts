import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * アプリ内「このアプリについて」の事実。外部通信はしない。
 * 公開URLは、管理者が実在・サインイン不要を確認してから設定する（未確定のまま仮URLを入れない・D15）。
 */
export const SUPPORT_ISSUES_URL = "https://github.com/sunpotflower4460-cpu/AAA-opus4.7/issues";

/** 公開ポリシー／サポートページの基底URL。未確定の間は空文字（アプリ内の本文だけを案内する）。 */
export const PUBLIC_PAGES_BASE_URL = "";

export type AppVersionInfo = { version: string; build: string | null };

/**
 * 問い合わせに添えるバージョン。ネイティブでは実際のアプリ情報、Web では「開発ビルド」。
 * 取得できなかった時は推測した番号を出さず、取得できなかったと伝える。
 */
export async function getAppVersionInfo(): Promise<AppVersionInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const info = await CapacitorApp.getInfo();
    return { version: info.version, build: info.build ?? null };
  } catch {
    return null;
  }
}
