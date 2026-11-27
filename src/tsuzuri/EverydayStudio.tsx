import { useState } from "react";
import { useBrush, setBrush, BRUSHES, type BrushId } from "../lib/brushPreference";
import type { Note } from "../types/note";
import { BookPage } from "./BookPage";
import { PAPER_IDS, PAPER_NAMES, LETTERING_SAMPLE, requiresPurchase } from "./catalog";
import { BASIC_APPEARANCE, type Appearance } from "./model";
import { hasVerifiedPurchase } from "./entitlements";
import { saveEveryday, useEveryday } from "./everyday";
import { MaterialFields } from "./StylePicker";
import type { TsuzuriCopy, TsuzuriMessage } from "./messages";

export function EverydayStudio({ c, note, direction, owned, onPurchase, onStatus }: {
  c: TsuzuriCopy; note?: Note; direction: Appearance["direction"]; owned: boolean;
  onPurchase: () => void; onStatus: (value: TsuzuriMessage) => void;
}) {
  const current = useEveryday();
  const currentBrush = useBrush();
  const [prospect, setProspect] = useState<Appearance>({ ...BASIC_APPEARANCE, direction, paper: current.paper, brush: current.brush ?? currentBrush });
  const [write, setWrite] = useState(current.write);
  const [subdued, setSubdued] = useState(current.subdued);
  const [dark, setDark] = useState(current.dark);
  const [standard, setStandard] = useState(!note);
  const [compare, setCompare] = useState(false);
  const text = standard || !note ? LETTERING_SAMPLE : note;
  const alreadyApplied = prospect.paper === current.paper && prospect.brush === (current.brush ?? currentBrush);
  const blocked = requiresPurchase(prospect) && !owned && !alreadyApplied;
  function apply() {
    if (!alreadyApplied && requiresPurchase(prospect) && !hasVerifiedPurchase()) return;
    const basic = BRUSHES.includes(prospect.brush as BrushId);
    const ok = saveEveryday({ paper: prospect.paper, brush: basic ? null : prospect.brush, write, subdued, dark });
    if (ok && basic && currentBrush !== prospect.brush) setBrush(prospect.brush as BrushId);
    onStatus(ok ? "everydaySaved" : "saveFailed");
  }
  return (
    <>
      <div className="ts-intro"><h1>{c.everyday}</h1>{!owned && <p>{c.paidPreview}</p>}</div>
      {note && <button type="button" onClick={() => setStandard(!standard)}>{standard ? c.ownText : c.standardSample}</button>}
      <div className="ts-reader" data-texture={subdued ? "reduced" : undefined} data-dark={dark ? "yes" : undefined}>
        <BookPage appearance={prospect} text={text} />
      </div>
      <details>
        <summary>{c.originalBrush}</summary>
        <BookPage appearance={{ ...prospect, brush: current.brush ?? currentBrush }} text={text} />
      </details>
      <MaterialFields value={prospect} c={c} update={setProspect} everyday />
      <button type="button" aria-expanded={compare} onClick={() => setCompare(!compare)}>{c.comparePaper}</button>
      {compare && <div className="ts-style-grid ts-neutral-papers">
        {PAPER_IDS.map((id, index) => <div key={id}><h2>{c[PAPER_NAMES[index]]}</h2>
          <div className="ts-mini-book"><BookPage appearance={{ ...prospect, paper: id, direction: "horizontal" }} text={text} /></div></div>)}
      </div>}
      <label><input type="checkbox" checked={write} onChange={(event) => setWrite(event.target.checked)} /> {c.applyWriting}</label>
      <label><input type="checkbox" checked={subdued} onChange={(event) => setSubdued(event.target.checked)} /> {c.texture}</label>
      <label><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /> {c.darkReading}</label>
      {blocked ? <><button type="button" onClick={onPurchase}>{c.purchaseInfo}</button>
        <button type="button" onClick={() => setProspect({ ...BASIC_APPEARANCE, direction })}>{c.useFree}</button></>
        : <button className="ts-primary" type="button" onClick={apply}>{c.applyEveryday}</button>}
    </>
  );
}
