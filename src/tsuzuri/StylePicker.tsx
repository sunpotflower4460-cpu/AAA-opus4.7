import { useState } from "react";
import {
  ALL_BRUSHES, BRUSH_NAMES, COVERS, COVER_NAMES, FORMATS, FORMAT_NAMES, PAPER_IDS, PAPER_NAMES, PRESETS, PRESET_NAMES,
  freeAppearance, sameAppearance, LETTERING_SAMPLE,
} from "./catalog";
import { BookPage } from "./BookPage";
import type { TsuzuriCopy, TsuzuriMessage } from "./messages";
import type { Appearance, Cover, SavedPreset, TextSnapshot } from "./model";

type Text = Pick<TextSnapshot, "title" | "body">;


export function Choice({ label, value, items, names, c, onChange }: {
  label: string; value: string; items: readonly string[]; names: readonly TsuzuriMessage[];
  c: TsuzuriCopy; onChange: (value: string) => void;
}) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>
    {!items.includes(value) && <option value={value}>{value}</option>}
    {items.map((item, index) => <option key={item} value={item}>{c[names[index]]}</option>)}
  </select></label>;
}

export function MaterialFields({ value, c, update, everyday }: {
  value: Appearance; c: TsuzuriCopy; update: (value: Appearance) => void; everyday?: boolean;
}) {
  return (
    <div className="ts-controls">
      <Choice label={c.paper} value={value.paper} items={PAPER_IDS} names={PAPER_NAMES} c={c} onChange={(paper) => update({ ...value, paper })} />
      <Choice label={c.brush} value={value.brush} items={ALL_BRUSHES} names={BRUSH_NAMES} c={c} onChange={(brush) => update({ ...value, brush })} />
      {!everyday && <>
        <Choice label={c.cover} value={value.cover} items={COVERS} names={COVER_NAMES} c={c} onChange={(cover) => update({ ...value, cover })} />
        <Choice label={c.format} value={value.format} items={FORMATS} names={FORMAT_NAMES} c={c} onChange={(format) => update({ ...value, format })} />
        <Choice label={c.ink} value={value.ink} items={["clear", "soft"]} names={["clear", "soft"]} c={c}
          onChange={(ink) => update({ ...value, ink: ink as Appearance["ink"] })} />
      </>}
    </div>
  );
}

export function StylePicker({ appearance, cover, text, presets, c, owned, update, onSavePreset, onDeletePreset, onPurchase }: {
  appearance: Appearance; cover: Cover; text: Text; presets: SavedPreset[]; c: TsuzuriCopy;
  owned: boolean; update: (value: Appearance) => void;
  onSavePreset?: (name: string) => void; onDeletePreset?: (id: string) => void; onPurchase?: () => void;
}) {
  const [name, setName] = useState("");
  const [standard, setStandard] = useState(false);
  const sample = standard ? LETTERING_SAMPLE : text;
  return (
    <details className="ts-style-details">
      <summary>{c.appearance}</summary>
      {!owned && <p>{c.paidPreview}</p>}
      <button type="button" aria-pressed={standard} onClick={() => setStandard(!standard)}>{standard ? c.ownText : c.standardSample}</button>
      <div className="ts-style-grid">
        {[{ name: c.basicPreset, value: freeAppearance(appearance), id: "basic" },
          ...Object.entries(PRESETS).map(([id, material], index) => ({
            id, name: c[PRESET_NAMES[index]], value: { ...appearance, ...material },
          }))].map(({ id, name, value }) => (
          <div key={id} className="ts-style-option">
            <div className="ts-mini-book" aria-hidden="true"><BookPage appearance={value} cover={cover} text={sample} /></div>
            <button type="button" aria-pressed={sameAppearance(appearance, value)} onClick={() => update(value)}>{name}</button>
          </div>
        ))}
      </div>
      {(presets.length > 0 || onSavePreset) && <details>
        <summary>{c.presets}</summary>
        <div className="ts-list">
          {presets.map((value) => <div className="ts-row" key={value.id}>
            <button type="button" dir="auto" lang="" onClick={() => update(value.appearance)}>{value.name}</button>
            {onDeletePreset && <button type="button" onClick={() => onDeletePreset(value.id)}>{c.deletePreset}</button>}
          </div>)}
          {owned && onSavePreset ? (
            <label>{c.presetName}<input value={name} lang="" dir="auto" onChange={(event) => setName(event.target.value)} />
              <button type="button" disabled={!name.trim()} onClick={() => { onSavePreset(name); setName(""); }}>{c.presetSave}</button>
            </label>
          ) : onPurchase ? <button type="button" onClick={onPurchase}>{c.purchaseInfo}</button> : null}
        </div>
      </details>}
    </details>
  );
}
