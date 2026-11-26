/**
 * 手で書いた紙の「不完全さ」を、毎回同じ形で再現するための小さな乱数。
 * 見た目だけの揺らぎで、メモの内容・保存・検索には一切関わらない。
 * 同じ seed なら必ず同じ値になるので、再描画や再起動で字が動いて見えることはない。
 */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 0〜1 の決定的な乱数列。 */
export function seededRandom(seed: string): () => number {
  let a = hashSeed(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: number, min: number, max: number) => min + r * (max - min);

export type LineWobble = {
  x: number;
  y: number;
  rotate: number;
  opacity: number;
};

/** 縦書きの1行（1列）ごとの、ごく小さなズレ。px / deg。 */
export function lineWobble(seed: string, index: number): LineWobble {
  const rand = seededRandom(`${seed}:line:${index}`);
  return {
    x: Number(between(rand(), -0.7, 0.7).toFixed(2)),
    y: Number(between(rand(), -1.2, 1.2).toFixed(2)),
    rotate: Number(between(rand(), -0.35, 0.35).toFixed(2)),
    opacity: Number(between(rand(), 0.86, 1).toFixed(2)),
  };
}

const RADIUS_VARIANTS = [
  "13px 9px 15px 11px / 11px 14px 9px 13px",
  "10px 14px 11px 15px / 14px 10px 13px 9px",
  "15px 11px 9px 14px / 9px 13px 14px 11px",
  "11px 15px 13px 9px / 13px 9px 11px 15px",
] as const;

export type CardImperfection = {
  tiltDeg: number;
  radius: string;
};

/** 一覧カード1枚ごとの、わずかな傾きと角の丸みの違い。 */
export function cardImperfection(seed: string): CardImperfection {
  const rand = seededRandom(`${seed}:card`);
  return {
    tiltDeg: Number(between(rand(), -0.28, 0.28).toFixed(2)),
    radius: RADIUS_VARIANTS[Math.floor(rand() * RADIUS_VARIANTS.length)],
  };
}
