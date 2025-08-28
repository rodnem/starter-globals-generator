// src/ui-react/exportUtils.ts

export type Palette = Record<number | string, string | undefined>;

function isHexString(x: unknown): x is string {
  return typeof x === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(x.trim());
}

function normalizeHex(input: string): string {
  let s = input.trim();
  if (s[0] !== "#") s = "#" + s;
  if (s.length === 4) {
    // #abc -> #aabbcc
    s = (
      "#" +
      s
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    ).toLowerCase();
  }
  // on garde #RRGGBB (on ignore alpha pour export)
  if (s.length >= 7) return s.slice(0, 7).toLowerCase();
  return "#000000";
}

function hexToRgb(hex: string) {
  const h = normalizeHex(hex).slice(1);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function baseHslVar(h: number, s: number, l: number) {
  return `${h} ${s}% ${l}%`;
}

/**
 * Construit CALCSS comme ton exemple :
 * :root {
 *   --c1-base: 85 100% 23%;
 *   ...
 *   --c1-25: hsl(from hsl(var(--c1-base)) h calc(s + ΔS) calc(l + ΔL));
 * }
 */
export function buildCalcss(
  bases: { c1: string; c2: string; c3: string; neutral: string },
  palettes: { c1: Palette; c2: Palette; c3: Palette; neutral: Palette },
  steps: number[]
) {
  const b1 = hexToHsl(bases.c1);
  const b2 = hexToHsl(bases.c2);
  const b3 = hexToHsl(bases.c3);
  const bn = hexToHsl(bases.neutral);

  const out: string[] = [];
  out.push(`:root {`);
  out.push(`  --c1-base: ${baseHslVar(b1.h, b1.s, b1.l)};`);
  out.push(`  --c2-base: ${baseHslVar(b2.h, b2.s, b2.l)};`);
  out.push(`  --c3-base: ${baseHslVar(b3.h, b3.s, b3.l)};`);
  out.push(`  --neutral-base: ${baseHslVar(bn.h, bn.s, bn.l)};`);
  out.push(``);

  const emit = (key: "c1" | "c2" | "c3" | "neutral", base: { s: number; l: number }) => {
    const varName = key; // identique
    for (const step of steps) {
      const raw = palettes[key]?.[step] ?? palettes[key]?.[String(step)];
      if (!isHexString(raw)) continue;
      const hex = normalizeHex(raw);
      const { s, l } = hexToHsl(hex);
      const ds = clamp(Math.round(s - base.s), -100, 100);
      const dl = clamp(Math.round(l - base.l), -100, 100);
      out.push(
        `  --${varName}-${step}: hsl(from hsl(var(--${varName}-base)) h calc(s + ${ds}) calc(l + ${dl}));`
      );
    }
    out.push(``);
  };

  emit("c1", b1);
  emit("c2", b2);
  emit("c3", b3);
  emit("neutral", bn);

  out.push(`}`);
  return out.join("\n");
}

/** SCSS simple : $c1-25: #XXXXXX; ... (ordre selon steps) */
export function buildScss(
  palettes: { c1: Palette; c2: Palette; c3: Palette; neutral: Palette },
  steps: number[]
) {
  const out: string[] = [];
  const emit = (key: "c1" | "c2" | "c3" | "neutral") => {
    out.push(`// ${key.toUpperCase()}`);
    for (const step of steps) {
      const raw = palettes[key]?.[step] ?? palettes[key]?.[String(step)];
      if (!isHexString(raw)) continue;
      const hex = normalizeHex(raw).toUpperCase();
      out.push(`$${key}-${step}: ${hex};`);
    }
    out.push(``);
  };
  emit("c1");
  emit("c2");
  emit("c3");
  emit("neutral");
  return out.join("\n");
}
