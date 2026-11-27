import { useState } from "react";
import type { UiLocale } from "../i18n/locales";
import { BookPage } from "./BookPage";
import { PRESETS, SAMPLE_IDS } from "./catalog";
import { blankDraft, type Appearance } from "./model";
import { tsuzuriMessages } from "./messages";
import { MaterialFields, StylePicker } from "./StylePicker";

const pieces = {
  scenes: {
    ja: ["風がやんだあとも、葉だけが少し揺れていた。", "帰り道のパン屋。今日は灯りがついていた。", "うまく言えないまま、ここに置いておく。", "続きは、また。"],
    en: ["The wind fell still. Only a few leaves kept moving.", "The bakery on my way home had its lights on today.", "I can’t quite put it into words. I’ll leave it here for now.", "More, another time."],
  },
  month: {
    ja: ["月が細かった。", "雨の午後、椅子を窓際に寄せた。\n遠くで電車の音がして、思い出しかけていたことをもう一度書いた。", "・新しい紙\n・湯気の立つお茶\n・窓を少し開ける", "A corner of the sky.\nまだ言葉にならない。"],
    en: ["The moon was a sliver.", "I moved the chair to the window on a rainy afternoon.\nA train sounded in the distance, and I wrote down what I had almost remembered.", "• Fresh paper\n• A cup of steaming tea\n• The window ajar", "A corner of the sky.\nまだ言葉にならない。"],
  },
};

export function SampleStudio({ id, locale, onTry, onHide }: {
  id: (typeof SAMPLE_IDS)[number]; locale: UiLocale; onTry: () => void; onHide: () => void;
}) {
  const c = tsuzuriMessages[locale];
  const name = id === "scenes" ? c.sampleA : c.sampleB;
  const [cover] = useState(() => ({ ...blankDraft(locale === "ja" ? "vertical" : "horizontal").cover, title: name }));
  const [appearance, update] = useState<Appearance>(() => ({
    ...blankDraft(locale === "ja" ? "vertical" : "horizontal").appearance,
    ...(id === "scenes" ? PRESETS.ST03 : PRESETS.ST04),
  }));
  const [index, setIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const text = pieces[id][locale].map((body) => ({ title: "", body }));
  return (
    <>
      <div className="ts-intro"><h1>{name}</h1><p>{c.sampleLabel}</p></div>
      <p>{c.paidPreview}</p>
      {appearance.format === "BK02" && <button type="button" onClick={() => setOverview(!overview)}>{overview ? c.reading : c.overview}</button>}
      {appearance.format === "BK02" && overview ? (
        <div className="ts-fold-overview">
          {text.map((piece, n) => <button type="button" key={n} onClick={() => { setIndex(n); setOverview(false); }}>
            <span>{n + 1}</span><span lang="">{piece.body}</span></button>)}
        </div>
      ) : <BookPage text={text[index]} appearance={appearance} cover={index === 0 ? cover : undefined} />}
      <div className="ts-row ts-paging">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>{c.previousPage}</button>
        <span>{index + 1} / {text.length}</span>
        <button type="button" disabled={index >= text.length - 1} onClick={() => setIndex(index + 1)}>{c.nextPage}</button>
      </div>
      <StylePicker appearance={appearance} cover={cover} text={text[index]} presets={[]} c={c} owned={false} update={update} />
      <details><summary>{c.options}</summary><MaterialFields value={appearance} c={c} update={update} /></details>
      <button className="ts-primary" type="button" onClick={onTry}>{c.tryOwn}</button>
      <button type="button" onClick={onHide}>{c.hideSample}</button>
    </>
  );
}
