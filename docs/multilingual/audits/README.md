# 多言語調査の履歴

2026-11-26に行った2回の調査を、根拠と検討過程が失われないよう全文収録する。

| 資料 | 内容 | 当時の基準 |
|---|---|---|
| [round-1.md](round-1.md) | 言語分離、日英基盤、保存、読み方、native/ストア、ML01〜24 | `6b40f44fe630b094aa0aad4fb1e79f5def3bc5b9` |
| [round-2.md](round-2.md) | 入力、空白、混在段落、原文、意味の確認、翻訳更新、ML25〜44 | 同上 |
| [確認用データ](../fixtures/round-2.json) | 24例の合成テキスト、復旧意味、文字数・地域書式の例 | 同上。合格記録ではない |

現在の採用仕様は [DESIGN.md](../DESIGN.md)、現在地は [BASELINE.md](../BASELINE.md)。PR #51で題名入力、カード、読書本文、復旧画面、native言語宣言等が変わったため、旧調査の実関数再現結果を新しいmainの証拠へ流用しない。

収録時に各調査の先頭へ履歴表示を追加した。第2回から第1回への個人用ファイルリンクだけ、同フォルダの相対リンクへ置換した。調査本文・一次資料・未確認範囲は残している。

## 元資料の識別

| 元ファイル | バイト数 | 元のSHA-256 |
|---|---:|---|
| zanshin-multilingual-design-research-2026-11-26.md | 53214 | `baa0819d595881c775b80963287016964c1a60468866a9d806132e8e407280c1` |
| zanshin-multilingual-round2-deep-dive-2026-11-26.md | 42240 | `6ab166a82dd8b3f7a124b895514d53f10733a3daf4836e22109328d09ff6dcb2` |
| zanshin-multilingual-round2-fixtures-2026-11-26.json | 28518 | `ab0dea3595050b720bff7b10613f77e172f5f1a1ac49750f5154d74c2bc74dfa` |

SHAは履歴表示追加前の元資料を識別する値。JSONは元のバイト列を保持している。資料中の技術参照はApple、WHATWG、W3C、Unicode、WebKit、React、Capacitor等の一次資料。実装時に採用するAPIのバージョン・最低OSと公式資料を再照合する。
