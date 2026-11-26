import { describe, expect, it } from "vitest";
import { cardImperfection, lineWobble, seededRandom } from "../inkJitter";

describe("inkJitter", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRandom("note-1");
    const b = seededRandom("note-1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(lineWobble("note-1", 3)).toEqual(lineWobble("note-1", 3));
    expect(cardImperfection("note-1")).toEqual(cardImperfection("note-1"));
  });

  it("differs between lines and notes", () => {
    expect(lineWobble("note-1", 0)).not.toEqual(lineWobble("note-1", 1));
    expect(lineWobble("note-1", 0)).not.toEqual(lineWobble("note-2", 0));
  });

  it("keeps every wobble tiny and legible", () => {
    for (let i = 0; i < 200; i += 1) {
      const w = lineWobble(`seed-${i}`, i);
      expect(Math.abs(w.x)).toBeLessThanOrEqual(0.7);
      expect(Math.abs(w.y)).toBeLessThanOrEqual(1.2);
      expect(Math.abs(w.rotate)).toBeLessThanOrEqual(0.35);
      expect(w.opacity).toBeGreaterThanOrEqual(0.86);
      expect(w.opacity).toBeLessThanOrEqual(1);
      expect(Math.abs(cardImperfection(`c-${i}`).tiltDeg)).toBeLessThanOrEqual(0.28);
    }
  });
});
