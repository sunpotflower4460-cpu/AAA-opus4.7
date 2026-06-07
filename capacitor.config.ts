import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zanshin.notes",
  appName: "残心",
  webDir: "dist",
  server: {
    // 本番ビルドでは外部 URL を使わずバンドルを使用する
    androidScheme: "https",
  },
};

export default config;
