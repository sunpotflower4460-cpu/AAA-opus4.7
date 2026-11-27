# 素材と配布ファイル

紙のIDは PA01〜PA08、素材版は1です。480×680の透過PNGを `scripts/build-tsuzuri-papers.py` で固定seedから生成し、入力・読書・出力で使います。制作したデジタル紙で、実物の採取・スキャンは行っていません。

| ID | 表面 |
|---|---|
| PA01 うす雲 | 広い雲状の濃淡と短い繊維 |
| PA02 長繊維 | 不揃いに曲がる長い繊維と柔らかい端 |
| PA03 簀目 | 一方向の細い筋 |
| PA04 布目 | 縦横の織りと交点の明るい糸 |
| PA05 砂子 | 周縁に疎らな金茶の小片 |
| PA06 古色 | 周縁から内側へ移る濃淡 |
| PA07 漉き込み | 繊維と短い素材片 |
| PA08 墨紙 | 炭色の地と細かい繊維 |

基本和紙と既存4筆あとを引き継ぎます。CV01〜CV06は題箋、布背、包み紙、帯、印、窓の形で区別し、ST01〜ST06はDESIGNの組合せを参照します。

## フォント

[Google Fontsの同一コミット](https://github.com/google/fonts/tree/5026800714d07231937d92eb4cceabf06e05d74e/ofl) の配布TTFを無改変で同梱します。著作権表示とOFL本文は各配布フォルダから取得し、`public/licenses/tsuzuri` と同梱サポートページから読めます。

| ID | ファイル、配布フォルダ | SHA-256 |
|---|---|---|
| 基本PDF | ShipporiMincho-Regular.ttf、shipporimincho | `769b5269f0f9bc6534b352c0e6bd856a566e03ff788f107191c2d835863570b2` |
| BR01 候補 | YujiMai-Regular.ttf、yujimai | `05d83b65204a5de6fc34c222057fc082f8c6e2e44c05a0d28f4189b3e54c54c2` |
| BR02 候補 | KaiseiOpti-Regular.ttf、kaiseiopti | `990cfb1fb00f311c8975c2c5f4778b2fe5462fd5eabf0884828a323dad3f18c0` |
| BR03 候補 | ZenKurenaido-Regular.ttf、zenkurenaido | `58b8d930d9fc10c8a5810c085bae378dacb98d0779073ee6d53d919f19ee6a4f` |
| BR04 候補 | Yomogi-Regular.ttf、yomogi | `ec280f473a03187292905618f24fdb08a6dcbf8620b52637e3b589fe745259b9` |

FontTools 4.61.1で5バイナリの縦メトリクスと `あいゆっくり残心木影白月漢字AaZé「」。々` の字形マップを確認しました。合計30,025,616バイトで、紙の透過PNGは約1.5 MiBです。Yuji Maiはかな・欧文の違いを中心に比較し、Yuji系の共通漢字を含みます。Yomogiは短い一篇の候補です。

WKWebViewの縦横、低メモリ、長文と小さい字、端末固有の代替字体、出力結果を見て販売採用を決めます。候補数は販売点数に使用していません。

合成PNGの各画素と墨色からsRGBで計算した場合、やわらかい墨でも追加紙の最小値は5.93:1（PA05）でした。文字の縁や実機の明るさは端末で確認します。
