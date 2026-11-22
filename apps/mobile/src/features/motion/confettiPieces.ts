export interface ConfettiPiece {
  /** Horizontal start, 0 to 1 of the width. */
  x: number;
  /** Sideways drift while falling, in px (can be negative). */
  drift: number;
  /** Wait before this piece starts, ms. */
  delay: number;
  /** Fall time, ms. */
  duration: number;
  size: number;
  /** Index into the palette. */
  color: number;
  /** Total turn while falling, degrees. */
  spin: number;
  /** Rectangle (confetti) or circle. */
  round: boolean;
}

/** Small deterministic generator (mulberry32): same seed, same shower. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pieces of one confetti shower. Pure, so the layout can be tested. */
export function buildConfettiPieces(
  count: number,
  paletteSize: number,
  seed = 1,
): ConfettiPiece[] {
  const random = seededRandom(seed);
  const pieces: ConfettiPiece[] = [];

  for (let index = 0; index < count; index += 1) {
    pieces.push({
      x: random(),
      drift: (random() - 0.5) * 140,
      delay: Math.round(random() * 450),
      duration: 1500 + Math.round(random() * 1100),
      size: 6 + Math.round(random() * 6),
      color: Math.floor(random() * Math.max(paletteSize, 1)),
      spin: 360 + Math.round(random() * 540),
      round: random() < 0.3,
    });
  }

  return pieces;
}
