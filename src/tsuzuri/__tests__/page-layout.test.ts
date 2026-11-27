import { expect, it } from "vitest";
import { BASIC_APPEARANCE } from "../model";
import { layoutPages } from "../pageLayout";

const context = {
  measureText: (text: string) => ({ width: text.length * 12 }),
} as CanvasRenderingContext2D;

it("keeps wrapped vertical URLs sideways without changing their original text", () => {
  const url = "https://example.test/" + "long-path/".repeat(40) + "?key=word";
  const original = `窓辺。 ${url} 次の一行。`;
  const layout = layoutPages(context, {
    text: [{ title: "", body: original }],
    appearance: { ...BASIC_APPEARANCE, direction: "vertical" }, size: "A6", surface: "white",
  });
  const lines = layout.pages.flatMap((page) => page.lines);
  const turned = lines.flatMap((line) => line.sideways.map((run) => line.text.slice(run.start, run.end)));

  expect(layout.pages.length).toBeGreaterThan(1);
  expect(turned.length).toBeGreaterThan(1);
  expect(turned.join("")).toBe(url);
  expect(lines.map((line) => line.text).join("")).toBe(original);
});

it("preserves spaces and grapheme clusters when laying out a mixed horizontal line", () => {
  const body = "  Café e\u0301 👩🏽‍💻 𠮷\u{E0100}　".repeat(12) + "  ";
  const layout = layoutPages(context, {
    text: [{ title: "", body }], appearance: BASIC_APPEARANCE, size: "A6", surface: "white",
  });
  const lines = layout.pages.flatMap((page) => page.lines);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.map((line) => line.text).join("")).toBe(body);
  expect(lines.every((line) => !line.text.startsWith("\u0301") && !line.text.endsWith("\u200d"))).toBe(true);
});
