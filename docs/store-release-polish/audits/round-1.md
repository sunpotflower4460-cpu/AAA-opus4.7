# 残心 / Zanshin — ストア公開前ブラッシュアップ監査

確認日：2026年11月26日  
対象：sunpotflower4460-cpu/AAA-opus4.7  
基準コミット：481e57d8bc041e573353d3ed312d9a626913db42（main）  
対象プラットフォーム：現在の実装方針であるiPhone / App Store

## 1. 結論

公開前に最も効果が大きいのは、文字・紙・余白の表現を支える実装の整合を取り、書く・保存する・読み返すという中心体験を確実にすることです。

和紙、墨、金のしるし、横書きでの入力と縦書きでの読み返しという核は明確です。保存には中断保存の記録、競合検知、複数世代の端末内予備保存まで実装されています。その上で、生成CSSの上書きと画面を往復したときの状態表示に、公開前に直したい点が残っています。

最優先は次の4点です。

1. 縦書き画面の横スクロール指定が後のCSSに打ち消されている。
2. 保存失敗後に編集画面を開き直すと、失敗表示と再試行が消える。
3. 復帰時の保存データ再読込みには、起動時と同じ版比較を通らない経路がある。
4. 用意済みのプライバシーポリシーへ、アプリ内から到達できない。

続いて、見えない装飾が占める編集余白、生成されない色指定、薄すぎる入力案内、長いタイトル、無題メモの見分けやすさ、検索結果の抜粋を整えると、日常の使いやすさが上がります。

## 2. 調査方法と検証の限界

### 実施したこと

- mainの実コード、デザイン設計、Phase 42までの改修記録、iOS設定を調査。
- 現在読み込まれる11ファイルのCSSについて、順序と上書きを確認。
- 本番ビルドに含まれるCSSを解析し、Tailwindクラスの生成有無を確認。
- 型検査、lint、本番ビルドを実行。
- 既存の169テストを、検証用の一時設定で実行。
- 保存失敗の再入場、復帰時の版比較、未入力メモについて、3件の状態・操作再現テストを実行。
- Appleの現行公式資料で、アクセシビリティ、プライバシー導線、提出用SDK要件を確認。

### 結果

| 項目 | 結果 |
|---|---|
| npm ci | 成功 |
| TypeScript型検査 | 成功 |
| ESLint | 成功 |
| npm run build | 成功 |
| 通常のnpm run check | 型検査・lint後、テスト起動で環境エラー |
| エラー内容 | Cloudflare Vite pluginがネットワークインターフェースを取得する際の uv_interface_addresses エラー |
| 一時設定での既存テスト | 21ファイル、169件成功 |
| 追加の監査用再現 | 3件で、問題を示す現在の挙動を確認 |
| アプリの追跡ファイル | 変更なし |

テスト用の一時設定ではCloudflareプラグインを外し、React/TypeScriptとjsdomでアプリのロジックを検証しました。通常のnpm run checkがそのまま最後まで成功した、とは扱っていません。本番ビルドは元の設定で成功しています。

追加3件は「問題のある現在の挙動が起きる」というアサーションです。テストが通ったことは、問題が修正された意味ではありません。

### 未実施のこと

実ブラウザからローカル実行環境へ接続できなかったため、実画面の描画・横スワイプを直接確認できていません。iPhone、iOSシミュレーター、Xcode Archive、TestFlight、App Store Connectも未確認です。

以下では、コード・生成CSSで確認した事実、状態を注入して再現した挙動、デザイン提案、実機で確かめる項目を分けています。jsdomにはレイアウト計算やCSSの省略形の展開に限界があり、その結果を実機の見た目として扱っていません。

## 3. すでに備わっている点

- 本文18pxを基点にした入力画面と、縦書きの読み返し画面。
- 日本語の禁則処理と、入力した改行・空白を読み返しにも残す実装。
- 500msの自動保存、連続入力時の最大3秒待機、非表示・離脱・ネイティブinactive時の保存。
- 保存成功を実際の保存結果から表示する仕組み。
- 保存の中断記録、復旧候補、競合時の上書き防止、端末内の複数世代保存。
- 検索クリア、主要アイコン操作などの44pxの操作領域。
- 削除確認のフォーカス循環、Escape、キャンセル時のフォーカス復帰。
- 動きを減らす設定への対応。
- 初回版では広告・Premiumの導線を無効化。
- iOSプロジェクト、ブランドアイコン、Launch Screen、Privacy Manifest。

これらを最初から作り直す必要はありません。修正済みの安全対策を保ちながら、残った不整合を直す方針が適切です。

根拠：[featureFlags](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/featureFlags.ts)、[保存と画面の制御](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx)、[Phase 42](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/docs/phase-42-native-startup-divergence-report.md)、[編集画面](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx)。

## 4. 公開前の優先修正

### R01 — 縦書きの横スクロールがCSSで打ち消される

**優先度：最優先。生成CSSで確認。実スワイプは未確認。**

phase19.cssでは読み返しの紙面に overflow-x:auto、overflow-y:hidden、writing-mode:vertical-rl を指定しています。後から読み込むphase27.cssとphase28.cssが、同じ要素へ overflow:hidden !important を指定しています。

このため、長文を横に送る設計と、紙の装飾を切り抜く指定が衝突しています。プログラムでスクロールできるかどうかと、指・ホイールで普通に読めるかは別です。

**修正仕様**

紙の形・テクスチャを扱う外側と、本文をスクロールする内側を分けます。本文のコンテナだけに横スクロールを設定し、装飾の指定が操作を変えない構造にします。

**完了条件**

375 / 390 / 430幅で、1行、10行、2,000字、10,000字の文章を先頭から末尾まで読めること。短文では不要な横スクロールが出ず、長いタイトルや日付も失われないこと。

根拠：src/phase19.css 105–118、src/phase27.css 53–60、src/phase28.css 56–63、src/main.tsx 5–15。  
[読み返しの指定](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/phase19.css) / [後から入る上書き](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/phase28.css)

### R02 — 未保存なのに編集画面へ戻るとエラーが消える

**優先度：最優先。操作再現済み。**

保存済みメモを編集し、保存領域がいっぱいの状態を模擬すると、最初は失敗と再試行が表示されます。しかし一覧へ戻り、同じメモを読み返し、再び編集に入ると、未保存の本文は表示されたまま、失敗表示と再試行が消えます。保存先の本文は古いままです。

NoteEditorの表示状態が初期値idleに戻る一方、App側は編集画面にいる間は共通のエラーバナーを出さないためです。

**修正仕様**

保存状態は画面の一時的な演出と分離します。未保存・失敗はAppが保持する状態を優先し、画面を移動しても解消したように見せません。実際の保存成功または明示的な解決まで再試行へ到達できるようにします。

**完了条件**

失敗→一覧→読み返し→編集、別メモへ移動、変更せず再試行、再試行再失敗を確認し、保存成功時だけ失敗表示が消えること。

根拠：NoteEditor.tsx 36、52–79、91–103。App.tsx 1027–1033、1330–1337。  
[編集側の状態](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx) / [共通状態](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx)

### R03 — 復帰時に正常形式の別版を比較せず採用する経路

**優先度：最優先の安全性確認。状態注入による再現。**

起動時にはlocalStorageと端末内ファイルの版を比較します。一方、バックグラウンドから戻る経路では、localStorageが正常な形式で読めると、その内容を採用してネイティブ予備保存へ渡します。

同じ正常版で起動後、localStorageだけを構造上正常な旧版へ模擬差替えし、pageshowを送ると、ネイティブの再読込みなしで旧版の保存が呼ばれることを確認しました。実iPhoneでデータ消失を観測したものではありません。また予備世代が残る可能性があり、この検証だけで全データが消えるとはいえません。

Phase 42の文書にも、復帰経路は別途確認が必要な点として残っています。

**修正仕様**

復帰時に既知の正本と異なる保存先を見つけたら、採用・書込み前に版の整合を確認します。読込失敗は再試行、異なる有効候補は比較・選択へ回します。日時だけで正しい版を推測しません。

**完了条件**

native active、pageshow、visibilitychangeの各入口で、古いlocal、異なるlocal、native読込失敗、未保存編集中を確認すること。

根拠：App.tsx 309–338、720–754、Phase 42文書のKnown limits。  
[実装](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx) / [既知の確認点](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/docs/phase-42-native-startup-divergence-report.md)

### R04 — プライバシーポリシーがアプリ内から開けない

**優先度：公開前。コードとApple公式要件で確認。**

public/privacy.htmlとsupport.htmlはありますが、アプリ内のコンポーネントから開く導線がありません。AppleのApp Review Guidelines 5.1.1(i)では、App Store Connectの項目と、アプリ内の到達しやすい場所の両方にポリシーを求めています。

**修正仕様**

ホームに控えめな「このアプリについて」を設け、保存方法・プライバシー・問い合わせをまとめます。公開URLも用意し、メモの状態を失わず戻れるようにします。

**完了条件**

実機で入口→ポリシー→元の画面へ戻れること。VoiceOverでも入口が分かること。公開URLがサインイン不要で開けること。

根拠：[ポリシー](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/public/privacy.html)、[ホーム](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NotesList.tsx)、[Apple審査ガイドライン](https://developer.apple.com/app-store/review/guidelines/)。

## 5. 文字と余白の具体的な改善

### R05 — 保存演出の透明な要素が入力欄を押し下げる

**優先度：高。生成CSSで確認。**

保存後の円相は本来絶対配置ですが、phase28.cssの「紙面直下の全要素をrelativeにする」指定で通常フローに戻っています。要素には55×55px、opacity:0が設定され、非表示でもレイアウトに参加します。実際の圧縮量はflexの計算と端末サイズ次第で、常にちょうど55px押し下がるとまでは断定しません。

装飾専用レイヤーへ戻し、日付→タイトル→本文の開始位置を明示的な余白だけで決めます。保存前後で文字位置が動かず、演出のために本文領域が減らないことを完了条件にします。

根拠：SaveAfterglow.tsx 12–17、NoteEditor.tsx 231–235、phase19.css 162–171、phase28.css 120–127。  
[円相要素](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/SaveAfterglow.tsx) / [上書き](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/phase28.css)

### R06 — 金のしるしと文字色の指定が一部生成されていない

**優先度：高。Tailwind生成結果で確認。**

bg-gold/72、text-gold/82、text-ink-muted/48、text-ink-muted/54などは現在の設定でCSSが生成されません。お気に入りの背骨に背景色が付かず、丸印が墨色を継承する原因になります。

このため、ソースの透明度の数値を見ただけで「全部の補助文字が薄い」と評価することもできません。

**修正仕様**

正しい任意値指定（例：bg-gold/[0.72]）または意味のある色トークンへ統一します。ただし、誤って無効だった薄い色をそのまま有効化するのではなく、主本文・補助・操作・警告ごとに読みやすい濃さを決め直します。

**完了条件**

本番CSSに必要な指定が存在し、お気に入りが一覧でも分かること。実画面の色と背景合成後のコントラストを確認すること。

根拠：[カード](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)、[一覧](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NotesList.tsx)、[Tailwind設定](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/tailwind.config.js)。

### R07 — 保存エラーまで薄い通常表示の色になる

**優先度：高。生成CSSで確認。**

失敗表示には朱色のクラスがありますが、後の.zanshin-save-statusが薄い墨色を指定し、本文色を上書きしています。成功を静かに見せるルールが、失敗にもかかっています。

error用の状態を独立させ、本文14–16px程度を起点に、読み取れる濃さ、再試行、未保存の意味を明確にします。色だけに依存せず「まだ保存できていません」と読めること、解決前に消えないことを条件にします。サイズは提案です。

根拠：NoteEditor.tsx 280–287、index.css 813–815。  
[編集画面](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx) / [保存表示CSS](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/index.css)

### R08 — 入力案内と日付の透明度が重なっている

**優先度：高。CSSと概算で確認。**

入力案内は色のalpha 0.38に、共通placeholderのopacity 0.7が重なります。日付も文字色と親の透明度が重なり、読み返しではさらに透明度が加わります。

紙の基底色#FBF6EAに重ねる単純計算では、入力案内は約1.76:1、通常の日付は約2.27:1、読み返し日付は約1.86:1です。テクスチャを含む実画面の測定値ではありません。

入力案内・保存状態・日付など読ませる文字は、通常文字4.5:1を設計目標として濃さを確保します。空気感は紙・余白・字間にも担わせます。透明度は一か所で管理するのが分かりやすいです。

根拠：index.css 206–209、413–424、484–491、phase24.css 119–123、phase19.css 124–130。  
[共通CSS](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/index.css) / [Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

### R09 — 本文の読みやすさを保ち、実用情報を少し大きくする

**優先度：高〜中。調整案。**

現状の入力本文18pxは維持する価値があります。一方で、保存表示と端末保存情報は10px、日付は標準rootサイズなら約10.88pxです。文字の小ささと薄さを同時に使うと、必要な情報が見つけにくくなります。

以下は実機調整の開始値です。Appleの強制値や完成した画面の測定値ではありません。

| 役割 | サイズ案 | 行間案 | 配置方針 |
|---|---:|---:|---|
| メモのタイトル | 22–26px | 1.4–1.65 | 編集時は折返し可能 |
| 一覧の見出し | 17–18px | 1.5–1.65 | 原則2行で概要を保つ |
| 入力本文 | 17–18px | 1.85–2.05 | 今の静かな読み心地を起点に調整 |
| 縦書き本文 | 17–19px | 1.9–2.15 | 長文・句読点・欧文混在で確認 |
| 操作名 | 14–16px | 1.45–1.65 | 「押せる・戻れる」がすぐ分かる |
| 日付・件数・保存状態 | 12–13px | 1.45–1.7 | 小ささと薄さを重ねすぎない |
| エラー説明 | 14–16px | 1.6–1.8 | 内容と次の操作を優先 |

なお英語副題はTSXの9px指定より後のCSSが勝ち、最終指定は12pxです。TSXだけを見て9pxと判断しないことが必要です。

根拠：[index.css](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/index.css)、[phase29.css](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/phase29.css)、[NotesList](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NotesList.tsx)。

### R10 — 文字を大きくしたときの全画面設計

**優先度：高。実機検証と設計が必要。**

px固定の文字指定が中心で、ネイティブの文字サイズ設定への追従やアプリ全体の文字倍率の経路が明示されていません。実機でのDynamic Typeの動作は未確認です。

文字の役割別トークンを用意し、OS設定への追従または簡単な文字サイズ設定で大きくできるようにします。単にpxをremへ置換するだけではOS設定への対応は保証されません。

標準・大きめ・200%相当で、作成、検索、読み返し、削除、復旧の全操作を確認します。狭い画面では横並びを縦にし、文字を縮めて押し込まないことが大切です。

根拠：[文字指定](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/index.css)、[Apple Typography](https://developer.apple.com/design/human-interface-guidelines/typography)、[Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)。

### R11 — 長いタイトルを編集・一覧・読み返しで一貫して扱う

**優先度：中。コードで確認。**

タイトルは200文字まで入力可能ですが、編集は単一行のinput、一覧は行数上限のない見出しです。長いタイトルで編集の見通しと一覧の高さが大きく変わります。

編集は2〜3行まで自然に伸びる入力、一覧は原則2行、読み返しは全文を読める配置を提案します。保存される内容を勝手に短くしません。

日本語10/40/200文字、長い英数字、URL、絵文字について、全文を編集でき、一覧が横にはみ出さないことを確認します。

根拠：[NoteEditor](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx)、[NoteCard](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)、[ReadMode](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/ReadMode.tsx)。

### R12 — 縦書きの長文・欧文混在・読み進め方

**優先度：高の実機確認。横書き選択は製品上の提案。**

縦書き要素にはflexが使われています。縦書きでは主軸の意味も横書きと変わるため、日付・見出し・本文の配置を実機で確認する必要があります。

英語、数字、URL、括弧、絵文字、空行が混在しても全文へ到達できることを条件にします。日本語の縦書きを主役にしつつ、実用的な混在メモには横書きで読む選択肢も検討できます。

「横へ静かに読み進める」は、短文でも常に表示する必要はありません。続きがある時だけ案内を出し、文字の切れ端や控えめな位置表示で方向を補う方が自然です。

根拠：[ReadMode](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/ReadMode.tsx)、[縦書きCSS](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/phase19.css)。

### R13 — 紙の形とフォーカス表示を分離する

**優先度：高の実機確認。**

カード・検索面・紙面にはclip-pathがあり、フォーカスリングは外側へ出る指定です。外側の表示が切り取られる可能性があります。

紙形状の切抜きは内側の装飾に限り、操作要素のフォーカスは外側または明確な内側リングで見せます。外部キーボードのTab移動、iOSのフルキーボードアクセス、VoiceOverで現在位置を確認します。

削除確認のフォーカス循環とキャンセル時復帰は既に実装されており、その部分は維持します。

根拠：[フォーカスCSS](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/index.css)、[紙形状のCSS](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/phase29.css)。

## 6. 書く・探す・読み返す体験

### R14 — 初回画面の役割を明確にする

**優先度：中。デザイン提案。**

タイトル、英語副題、短冊コピー、円相、空状態の説明、初回ボタン、固定の作成ボタンがあります。初回には世界観を見せ、メモが増えた後は自分の言葉を探しやすい密度にする設計が向きます。

大きな導入ツアーは不要です。「入力した内容は、この端末に自動保存されます」という一文と、同じ名前の作成操作にそろえることから始められます。低い画面でも最初の行動が見えるかは実機で確認します。

根拠：[一覧](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NotesList.tsx)、[空状態](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/EmptyState.tsx)、[コピー](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/i18n.ts)。

### R15 — 未操作の新規メモを残さない

**優先度：中。再現済み。**

新規作成して何も書かず戻っただけで、空のメモが保存されます。これを繰り返すと「名のない余韻」が増えます。

今回作った未操作の下書きだけを区別し、初回入力まで正式なメモにしない方法が考えられます。既存メモや、利用者が意図して空にした内容まで自動削除しないことが条件です。

作成→未入力で戻るを5回行って一覧が増えず、本文だけ・タイトルだけを入力した場合は正常に保存されることを確認します。

根拠：App.tsx 833–849、1333。  
[作成処理](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx)

### R16 — 無題メモを内容で見分けられるようにする

**優先度：中。コードで確認。**

本文からすぐ書ける設計に対して、タイトル未入力のカードはすべて「名のない余韻」です。

表示上だけ本文の最初の意味ある一行を見出しに使い、保存するタイトルは空のままにする方法が合います。本文もない場合だけ現在の無題名を使います。無題10件から目的のメモを選べることを確認します。

根拠：[新規時の本文フォーカス](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx)、[カードの無題名](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)。

### R17 — 検索中は一致した部分を見せる

**優先度：中。コードで確認。**

検索は本文全体を見ていますが、カードのプレビューは最後の非空行だけです。本文途中の言葉が一致しても、その理由がカードから分かりません。

通常一覧の「最後の余韻」は保ち、検索中だけ一致箇所を含む短い抜粋へ変えます。最初・中間・最後にしか存在しない検索語で、開く前に関係が分かることを条件にします。

全角・半角の扱いは追加検討です。保存内容は変えず、検索用の正規化だけで扱います。

根拠：[検索ロジック](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/notesLogic.ts)、[プレビュー](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)。

### R18 — 検索の解除と件数表記を整える

**優先度：中。コードで確認。**

検索クリア後に入力欄へフォーカスを戻す処理がなく、件数変更の読み上げ通知もありません。また通常の件数は「11つの余韻」のような表記になります。

検索クリア後はそのまま次の語を入力できる状態へ戻し、件数は入力を妨げない頻度で知らせます。通常件数は「11の余韻」や「残した言葉 11件」など、数が増えても自然な形にします。

ゼロ件の文言には「別の言葉でも探せます」のような短い補助を検討します。既に検索解除ボタンがあるため、新しいボタンを増やす必要はありません。

根拠：[SearchBar](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/SearchBar.tsx)、[件数](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NotesList.tsx)。

### R19 — 絵文字を途中で切らない

**優先度：中。文字列処理で再現。**

プレビューは72文字でsliceしていますが、JavaScriptのこの切り方は見た目の一文字単位ではありません。「あ」を71文字置いた後の月の絵文字などで、サロゲートの片側だけ残ることを確認しました。

CSSの行数制限へ寄せるか、文字のまとまりに沿って切ります。家族の絵文字、肌色付き絵文字、結合文字も確認し、保存本文は変えません。

根拠：NoteCard.tsx 10–18。  
[プレビュー処理](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)

### R20 — 金のしるしの意味を初見で伝える

**優先度：中。提案。**

色の不具合を直した上で、金のしるしが「大切なメモとして上に置く」操作であることを短く伝えます。見た目の円相や金点は維持できます。

現在は一覧の印が9px、編集の図形が14pxです。操作領域は44pxありますが、図形の意味の分かりやすさは別に確認が必要です。初回の短い説明、選択状態の形、読み上げ名で補います。

根拠：[編集の操作](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx)、[一覧の印](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)。

### R21 — 戻る先と読み進めた位置を保つ

**優先度：中。コードで確認。**

一覧→読み返し→編集→戻るが、読み返しではなく一覧へ戻ります。一覧の位置・元カードへのフォーカス・読み返しの横位置を記録する仕組みもありません。

新規作成からなら一覧、読み返しから編集したなら元の読み返しへ戻す方針を提案します。30件目を開いて戻った時も、同じカード付近から続けられることを確認します。

検索語の保持は既にあるので維持します。

根拠：App.tsx 1300–1339。  
[画面遷移](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx)

### R22 — 並び順と表示日付の意味を合わせる

**優先度：中。コードで確認。**

一覧はお気に入り優先、その中では更新日時順です。一方、日付印は作成日時を表示します。お気に入りの切替もupdatedAtを更新するため、文章を直していなくても順序が変わり得ます。

日付印の「残した日」は維持し、「最近直したものが上」という意味を必要な場所で示します。お気に入り操作を本文の更新日時に含めるかも整理します。

根拠：[並び順](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/notesLogic.ts)、[日付印](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)、[更新処理](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx)。

### R23 — 復元の説明を、内容を見比べられる形にする

**優先度：高。構造確認。見切れ量は未測定。**

復元候補・未保存編集・端末内の別候補について、長い説明と複数ボタンが上端固定の一つの領域へ入ります。高さ上限や内部スクロールがなく、本文を確認するための空間を確保していません。

短い状態表示から、専用の比較画面へ進む形を提案します。候補ごとに件数・更新情報・異なるメモ・短い本文を見せ、「この内容を残す」と選べるようにします。

保存先／端末内という内部構造の名称だけで選ばせず、内容の違いを判断材料にします。自動で混ぜない既存の保護は保ちます。

375×667相当、文字200%、三候補で本文確認・候補切替・確定に到達できることを条件にします。

根拠：App.tsx 1051、1106–1229、i18n.ts 82–108。  
[復元UI](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx) / [説明文](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/i18n.ts)

### R24 — 保存確認中・保存失敗時にも次の行動を明確にする

**優先度：中。状態設計の提案。**

ネイティブの安全確認中は処理側で作成・編集を止めますが、操作部品へbusy/disabledの状態が渡っていません。確認中の案内を見落とすと、押しても反応しないように感じる可能性があります。

確認中は操作にも状態を反映します。また容量上限で再試行が成功しない場合に備え、未保存の本文を選択・コピーできる出口を確保します。

一括のファイル書出しは製品範囲を少し広げる提案です。初回公開の必須機能と混同せず、次期候補として判断します。端末内の予備保存は、端末故障や機種変更に備える別端末バックアップとは分けて説明します。

根拠：App.tsx 203–217、NoteEditor.tsx、lib/nativeDurableSnapshot.ts。  
[状態制御](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx) / [端末内予備保存](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/nativeDurableSnapshot.ts)

### R25 — 削除と取り消しの条件を分かりやすくする

**優先度：中〜低。仕様の確認と提案。**

取り消しは10秒・直前1件・現在の起動中だけです。確認ダイアログは既にあるため、ゴミ箱を直ちに追加する必要はありません。

ただし文字拡大時のダイアログには高さ上限や内部スクロールがなく、ボタンも横並びです。狭い画面で縦積みへ切り替え、全文と操作へ到達できるようにします。

連続削除、VoiceOver、削除直後のアプリ切替で猶予が十分か確認します。「しばらく元に戻せます」という説明と実際の条件を一致させます。

根拠：App.tsx 48、864–898、NoteEditor.tsx 352–407。  
[削除処理](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/App.tsx) / [削除確認](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx)

### R26 — 読み上げでメモを識別し、執筆を邪魔しない

**優先度：中。コード確認と実機検証。**

カードのaria-labelはタイトルと「読み返す」だけなので、無題のカードは同じ名前になります。本文冒頭・日付・お気に入り状態のうち、識別に必要な情報を簡潔に含めます。

通常の保存中・保存済みは短い入力の区切りごとにaria-liveへ出ます。実際の読み上げ頻度を確認し、通常成功の通知はまとめ、失敗や競合は確実に知らせます。

新しい画面の見出し、戻った元カードへのフォーカス移動も整えます。ロゴと見出しの重複読み上げなど、装飾を音声で繰り返さないことも確認します。

根拠：[カード](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteCard.tsx)、[保存通知](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/NoteEditor.tsx)、[ロゴ](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/components/ZanshinMark.tsx)。

## 7. ストア公開までの仕上げ

### R27 — CSSと設計文書の現在地を一つにする

**優先度：高〜中。**

現在はindex.cssと10個のphase CSSが順に読み込まれます。装飾の修正でoverflowやpositionまで広く上書きする構造が、今回の不整合の原因です。

トークン、紙の装飾、一覧、編集、読み返し、状態表示に役割を整理します。新しいphase CSSを足すだけの修正を続けず、重要なプロパティの定義場所を明確にします。ただし公開直前に保存状態機械まで全面改造する必要はありません。

README・古い提出チェックリストには、初回公開で課金・広告実装が必要なように読める記載があります。現在の無料・広告なしの実装方針へそろえ、最新の公開手順へ一本で辿れるようにします。

根拠：[CSS import](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/main.tsx)、[README](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/README.md)、[初回フラグ](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/featureFlags.ts)。

### R28 — 対応言語・問い合わせ・審査説明を実装と合わせる

**優先度：公開前。**

UIは日本語固定で、英語の文字列が一部用意されていても切替機構はありません。iOSのdevelopment regionはenです。日本語版として出すなら言語宣言とストア情報を合わせ、英語UIまで完成しているようには見せません。

問い合わせは現状GitHub Issuesのみです。一般の利用者が非公開で連絡できる窓口を用意し、機種、iOS、アプリ版、起きた操作だけで相談できるようにします。連絡先は実際に管理するものを使用します。

審査メモの「No analytics, tracking, or third-party SDKs are included.」は、Capacitorを使用している実態と合いません。「広告・分析・追跡のSDKは使用しない。Capacitorと端末内機能を使用する」といった正確な説明へ更新します。

根拠：[言語文字列](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/src/lib/i18n.ts)、[Info.plist](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/ios/App/App/Info.plist)、[サポート](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/public/support.html)、[提出文面](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/docs/app-store-submission-copy-phase-20.md)。

### R29 — ストア画像は、具体的な使い方を先に伝える

**優先度：中。訴求案。**

画像計画はあります。最初の画像で、和紙の雰囲気と「横書きで書き、縦書きで読み返せる」違いが分かると、用途を判断しやすくなります。

| 順番 | コピー案 | 見せる画面 |
|---|---|---|
| 1 | 横書きで書く。縦書きで読み返す。 | 縦書きの本文を主役にする |
| 2 | 開いて、そのまま書ける。 | 本文入力。登録不要・自動保存を短く補足 |
| 3 | 残した言葉に、また会える。 | 検索結果・金のしるし |
| 4 | メモは、この端末の中に。 | 保存の説明。クラウド同期と混同させない |

空状態と紙質感だけの画像を続けるより、生活の中で使う姿が分かる構成を提案します。画像は最終TestFlightビルドの実画面を基にし、修正前のレイアウトを宣伝用に使わないようにします。App Store Connectへの現在の登録状況は未確認です。

根拠：[既存画像計画](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/docs/screenshot-plan-phase-20.md)。

### R30 — 最新の提出環境で実機の完了条件を満たす

**優先度：公開前の検証条件。**

Appleは2026年4月28日以降、App Store ConnectへのアップロードにXcode 26以降とiOS 26以降のSDKを要求しています。runbookにはXcodeがあることだけでなく、使用バージョンとArchive結果を記録します。これはビルド用SDKの条件であり、最低対応OSをiOS 26へ引き上げるという意味ではありません。

Linuxでの型検査・テスト・cap syncは、Xcodeビルドや実機の代わりにはなりません。同じコミットから作成したRelease ArchiveとTestFlightで、次節を確認して完了とします。

根拠：[現在のrunbook](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/docs/ios-testflight-runbook-phase-20.md)、[CI](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/blob/481e57d8bc041e573353d3ed312d9a626913db42/.github/workflows/check.yml)、[Apple SDK要件](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)。

## 8. 修正を進める順番

### 第1段階：読める・保存状態が分かる状態を確定

R01 横スクロール、R02 保存エラーの継続、R03 復帰時の版比較、R04 プライバシー導線、R07 エラーの視認性を扱います。

保存の仕組みは既存の回帰テストを保ったまま、再現した条件を狙って修正します。実行中に正しい版が変わったときの検査を忘れないことが大切です。

### 第2段階：文字と余白の土台

R05 装飾の位置、R06 色指定、R08 透明度、R09 文字階層、R10 文字拡大、R11 長いタイトル、R13 フォーカスを整理します。必要なCSS統合をここに含めます。

### 第3段階：毎日の流れ

R14〜R26から、未操作下書き、無題の識別、検索抜粋、戻り先、復元比較を優先します。書出しなどの範囲を広げる提案は、公開必須の修正と別に判断します。

### 第4段階：実機と提出物

R28〜R30を確定し、TestFlightの同一ビルドで検証、スクリーンショット、サポートURL、プライバシーURL、対応言語、提出文面を一致させます。

## 9. 実機の受入シナリオ

| 条件 | 確認すること |
|---|---|
| 小さいiPhone相当375×667、通常390×844、大きい430幅 | タイトル、本文、作成操作、戻る操作が使える |
| 320幅 | 対応対象に含める場合の追加確認。狭い幅で案内が切れない |
| 標準・大きめ・200%相当の文字 | 一覧、編集、縦書き、削除、復元の全操作へ到達できる |
| キーボード表示・日本語IME変換中 | キャレットが見える。確定前後に戻る、画面ロック、アプリ切替をしても文字が失われない |
| 短文、2,000字、10,000字 | 縦書きの最後まで読める。入力とスクロールが滑らか |
| タイトル200字、長いURL、英語、絵文字、空行 | 原文を保ち、カードの表示だけを適切に省略する |
| 0件、無題10件、30件以上 | 最初の行動が分かり、目的のメモを識別し、戻った位置を保つ |
| 検索語が本文の最初・中間・最後 | 抜粋から一致理由が分かる。解除して次の検索を続けられる |
| 容量上限・保存先一時不調 | 画面移動しても未保存が分かり、再試行または本文の退避ができる |
| local/native不一致・三つの候補 | どの内容を選ぶか確認でき、決定前に自動上書きしない |
| 保存直後の背景化・復帰・強制終了後 | 再起動時のデータと保存表示が一致する |
| 連続削除・直後のアプリ切替 | 取り消しの条件が説明どおりで、復元が別の内容を消さない |
| VoiceOver・外部キーボード | 無題も識別できる。フォーカスが見え、戻る位置を保つ |
| 動きを減らす・低輝度・屋外 | 入力案内・日付・保存失敗を読める。不要な動きが抑制される |
| 機内モードのコールド起動 | 本来のローカルメモ機能を使える |
| Release Archive→TestFlight | Web版だけでなく実配信物で上記が成立する |

iPhone縦向きが現行方針です。iPadや横向き対応を新しく追加することを、この監査の必須条件にはしていません。

## 10. 小さな文言の調整案

| 場所 | 現状 | 案 |
|---|---|---|
| 作成操作 | 言葉を置く / 最初の余白をひらく | 基本名を「言葉を置く」にそろえ、初回だけ「新しいメモ」の意味を補足 |
| タイトル入力 | この余白に名をつける | 詩的表現を保つ場合も、任意であることを小さく伝える |
| 件数 | 11つの余韻 | 11の余韻 / 残した言葉 11件 |
| 保存方法 | 端末内に保存 | 初回・説明画面では「入力した内容は、この端末に自動保存されます」 |
| 保存失敗 | 保存できませんでした | 未保存であることと、再試行・本文退避を明確にする |
| 金のしるし | 主にアイコンとariaで説明 | 「大切なメモとして上に置く」を初回だけ補足 |
| 検索ゼロ件 | その言葉は、まだ見つかっていません。 | 詩的な文に加え「別の言葉でも探せます」 |
| 復元候補 | 保存先 / 端末内 / 未保存編集 | 内容の見本・件数・更新情報を主にし、選ぶ結果を明確にする |

## 11. 一次資料

すべて確認日現在の資料です。外部の一般論をこのアプリの実装済み機能として扱わず、コード上の根拠と組み合わせています。

- [監査対象コミット](https://github.com/sunpotflower4460-cpu/AAA-opus4.7/commit/481e57d8bc041e573353d3ed312d9a626913db42)
- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines — Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple SDK minimum requirements — 2026年4月28日以降](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)

この文書は監査と改善仕様です。アプリのソース修正、コミット、デプロイ、ストア提出は行っていません。

