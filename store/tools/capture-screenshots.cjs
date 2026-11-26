/**
 * App Store 用スクリーンショット生成。
 *
 * 使い方（リポジトリ直下で、dev サーバー起動後）:
 *   npm run dev -- --port 5173 --host 127.0.0.1
 *   NODE_PATH=$(npm root -g) FONT_DIR=<@fontsource/noto-serif-jp のパス> \
 *     node store/tools/capture-screenshots.cjs
 *
 * - playwright（グローバル）と @fontsource/noto-serif-jp が必要。プロジェクトの依存には追加しない。
 * - 実機では Hiragino Mincho が使われる。ここでは同系統の Noto Serif JP を "Hiragino Mincho ProN" として差し込む。
 * - 提出前に、可能なら Xcode Simulator / 実機の撮影へ差し替えること（docs/app-store-submission-pack.md 参照）。
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173/";
const FONT_DIR = process.env.FONT_DIR;
const OUT = path.join(__dirname, "..", "screenshots");
const RAW = path.join(require("os").tmpdir(), "zanshin-raw-shots"); // 生の撮影画像はコミットしない

const SIZES = [
  { name: "6.9inch-1320x2868", w: 440, h: 956 },
  { name: "6.5inch-1284x2778", w: 428, h: 926 },
];

const at = (daysAgo, hour) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
};
const note = (id, title, body, daysAgo, hour, fav = false) => ({
  id, title, body, createdAt: at(daysAgo, hour), updatedAt: at(daysAgo, hour), isFavorite: fav, locale: "ja",
});
const NOTES = [
  note("s1", "朝の庭", "霜の降りた庭に、\n小さな足跡がひとつ。\n静かな朝だった。", 0, 6, true),
  note("s2", "夕立のあと", "雨上がりの匂い。\n濡れた石段に、空が映っている。", 1, 18, true),
  note("s3", "駅のベンチで", "発車のベルが鳴っても、立ち上がらなかった。\n次の電車まで、あと十二分。", 3, 14),
  note("s4", "今日の一杯", "ほうじ茶。\n湯気の向こうで、窓がやわらかく白んでいく。", 5, 21),
  note("s5", "覚え書き", "来週のこと。\n古本屋で詩集を探す。\n祖母に手紙を書く。", 8, 10),
];

const CAPTIONS = {
  home: ["書いたあとにも、", "心が残る。"],
  edit: ["心の余白に、", "言葉を置く。"],
  read: ["縦書きで、", "静かに読み返す。"],
  search: ["残した言葉を、", "手繰り寄せる。"],
};

async function shimFonts(ctx) {
  if (!FONT_DIR) return;
  let css = fs.readFileSync(path.join(FONT_DIR, "400.css"), "utf8") + fs.readFileSync(path.join(FONT_DIR, "500.css"), "utf8");
  css = css.replace(/font-family:\s*'Noto Serif JP'/g, "font-family:'Hiragino Mincho ProN'").replace(/url\(\.\/files\//g, "url(/__fonts/");
  await ctx.route("**/__fonts/*", (r) => r.fulfill({ body: fs.readFileSync(path.join(FONT_DIR, "files", path.basename(new URL(r.request().url()).pathname))), contentType: "font/woff2" }));
  await ctx.route("**/__fonts.css", (r) => r.fulfill({ body: css, contentType: "text/css" }));
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/__fonts.css"; document.head.appendChild(l);
  }));
}

async function capture(browser, size, key, steps) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "ja-JP" });
  await ctx.addInitScript((n) => { if (!localStorage.getItem("zanshin.notes.v1")) localStorage.setItem("zanshin.notes.v1", JSON.stringify(n)); }, NOTES);
  await shimFonts(ctx);
  const p = await ctx.newPage();
  await p.goto(BASE); await p.waitForTimeout(1600);
  await steps(p);
  await p.waitForTimeout(900);
  const raw = path.join(RAW, `${size.name}-${key}.png`);
  await p.screenshot({ path: raw });
  await ctx.close();
  return raw;
}

async function compose(browser, size, key, rawPath) {
  const W = size.w * 3, H = size.h * 3;
  const img = "data:image/png;base64," + fs.readFileSync(rawPath).toString("base64");
  const [l1, l2] = CAPTIONS[key];
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await shimFonts(ctx);
  const p = await ctx.newPage();
  const phoneW = Math.round(W * 0.78), phoneH = Math.round(phoneW * (H / W));
  await p.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#f3ead7;font-family:'Hiragino Mincho ProN','Noto Serif JP',serif;}
    body{background:radial-gradient(120% 70% at 20% 0%,#fbf6ea 0%,#f3ead7 55%,#e6d9bd 100%);position:relative}
    .cap{position:absolute;top:${Math.round(H*0.05)}px;left:0;right:0;text-align:center;color:#1f1b18;font-size:${Math.round(W*0.062)}px;letter-spacing:.14em;line-height:1.7}
    .cap small{display:block;margin-top:${Math.round(H*0.012)}px;font-size:${Math.round(W*0.026)}px;letter-spacing:.34em;color:#8a7f70}
    .rule{position:absolute;top:${Math.round(H*0.205)}px;left:50%;width:${Math.round(W*0.09)}px;height:3px;margin-left:-${Math.round(W*0.045)}px;background:linear-gradient(90deg,transparent,#c9a646,transparent)}
    .phone{position:absolute;left:${Math.round((W-phoneW)/2)}px;top:${Math.round(H*0.235)}px;width:${phoneW}px;height:${phoneH}px;border-radius:${Math.round(W*0.075)}px;overflow:hidden;box-shadow:0 ${Math.round(H*0.012)}px ${Math.round(H*0.04)}px rgba(60,44,24,.28),0 0 0 3px rgba(60,44,24,.12)}
    .phone img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
  </style></head><body><div class="cap">${l1}<br>${l2}<small>ZANSHIN NOTES</small></div><div class="rule"></div><div class="phone"><img src="${img}"></div></body></html>`);
  await p.waitForTimeout(800);
  // App Store は alpha なしの PNG / JPEG を受け付ける。容量を抑えるため JPEG で出力する。
  await p.screenshot({ path: path.join(OUT, `${size.name}-${key}.jpg`), type: "jpeg", quality: 92 });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const size of SIZES) {
    const shots = {
      home: async () => {},
      edit: async (p) => { await p.getByText("朝の庭").first().click(); await p.waitForTimeout(700); await p.getByRole("button", { name: "言葉を直す" }).click(); },
      read: async (p) => { await p.getByText("朝の庭").first().click(); },
      search: async (p) => { await p.locator(".zanshin-search-input").fill("雨"); },
    };
    for (const [key, steps] of Object.entries(shots)) {
      const raw = await capture(browser, size, key, steps);
      await compose(browser, size, key, raw);
      console.log("ok", size.name, key);
    }
  }
  await browser.close();
})();
