import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zanshin.notes",
  appName: "残心",
  webDir: "dist",
  ios: {
    // 起動直後・ゴムバンド時に白が見えないよう、紙の色を敷く。
    backgroundColor: "#F7F1E5",
  },
  server: {
    // 本番ビルドでは外部 URL を使わずバンドルを使用する
    androidScheme: "https",
  },
};

export default config;
