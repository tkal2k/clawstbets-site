// Draws DeeDee's punk margin doodles as static hand-drawn SVGs with Rough.js (MIT).
// Run: node make_doodles.mjs <outdir>
import rough from "roughjs/bundled/rough.esm.js";
import { mkdirSync, writeFileSync } from "node:fs";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const gen = rough.generator();
const BLUE = "#23409a", BLACK = "#1d1d1f", RED = "#d3302b";

function svg(name, w, h, color, shapes, width = 1.5) {
  let seed = 1;
  for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) % 2147483647;
  const paths = [];
  shapes.forEach((make, i) => {
    const opts = { stroke: color, strokeWidth: width, roughness: 1.3, bowing: 1.2, seed: seed + i * 7 };
    const drawables = [].concat(make(opts));
    for (const d of drawables) {
      for (const p of gen.toPaths(d)) {
        const fill = p.fill && p.fill !== "none" ? p.fill : "none";
        paths.push(`<path d="${p.d}" fill="${fill}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
  });
  const file = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none">${paths.join("")}</svg>\n`;
  writeFileSync(`${out}/${name}.svg`, file);
}

// Anarchy-style A in a circle (red sharpie)
svg("anarchy-a", 100, 100, RED, [
  o => gen.circle(50, 50, 84, o),
  o => gen.linearPath([[22, 88], [50, 8], [78, 88]], o),
  o => gen.line(12, 60, 90, 54, o),
], 3);

// Candlestick chart sliding down
svg("candles-down", 120, 100, BLUE, [
  o => gen.line(8, 92, 114, 92, o),
  o => gen.line(8, 92, 8, 6, o),
  o => gen.line(26, 10, 26, 44, o), o => gen.rectangle(20, 16, 12, 20, o),
  o => gen.line(48, 26, 48, 62, o), o => gen.rectangle(42, 32, 12, 22, { ...o, fill: BLUE, fillStyle: "hachure", hachureGap: 3 }),
  o => gen.line(70, 40, 70, 78, o), o => gen.rectangle(64, 46, 12, 24, { ...o, fill: BLUE, fillStyle: "hachure", hachureGap: 3 }),
  o => gen.line(92, 56, 92, 90, o), o => gen.rectangle(86, 62, 12, 22, { ...o, fill: BLUE, fillStyle: "hachure", hachureGap: 3 }),
  o => gen.linearPath([[18, 12], [102, 74]], { ...o, strokeWidth: 1 }),
  o => gen.linearPath([[96, 66], [104, 76], [92, 78]], o),
]);

// Bear with a mohawk (bear market, but make it punk)
svg("mohawk-bear", 110, 110, BLACK, [
  o => gen.circle(55, 66, 70, o),
  o => gen.circle(28, 40, 20, o), o => gen.circle(82, 40, 20, o),
  o => gen.linearPath([[36, 36], [42, 6], [50, 32], [56, 2], [62, 32], [70, 6], [74, 36]], { ...o, stroke: RED, strokeWidth: 2.4 }),
  o => gen.linearPath([[38, 58], [48, 64]], o), o => gen.linearPath([[48, 58], [38, 64]], o),
  o => gen.linearPath([[62, 58], [72, 64]], o), o => gen.linearPath([[72, 58], [62, 64]], o),
  o => gen.ellipse(55, 76, 18, 11, o),
  o => gen.arc(55, 92, 22, 12, Math.PI, Math.PI * 2, false, o),
]);

// GPU chip with X-eyes
svg("chip-x-eyes", 110, 110, BLUE, [
  o => gen.rectangle(24, 24, 62, 62, o),
  ...[34, 48, 62, 76].flatMap(p => [
    o => gen.line(p, 12, p, 24, o), o => gen.line(p, 86, p, 98, o),
    o => gen.line(12, p, 24, p, o), o => gen.line(86, p, 98, p, o),
  ]),
  o => gen.line(36, 40, 48, 52, o), o => gen.line(48, 40, 36, 52, o),
  o => gen.line(62, 40, 74, 52, o), o => gen.line(74, 40, 62, 52, o),
  o => gen.arc(55, 74, 26, 14, Math.PI, Math.PI * 2, false, o),
]);

// Rocket crashing nose-first with smoke and an impact star
svg("rocket-crash", 120, 120, BLACK, [
  o => gen.polygon([[30, 14], [46, 6], [80, 70], [64, 78]], o),
  o => gen.polygon([[64, 78], [80, 70], [82, 92]], { ...o, fill: RED, fillStyle: "solid", stroke: RED }),
  o => gen.polygon([[30, 14], [20, 6], [26, 24]], o),
  o => gen.polygon([[46, 6], [52, 0], [40, 2]], o),
  o => gen.circle(50, 36, 12, o),
  o => gen.curve([[18, 4], [8, 12], [14, 22], [4, 30]], { ...o, strokeWidth: 1 }),
  o => gen.linearPath([[84, 92], [92, 82], [94, 96], [108, 92], [98, 102], [112, 112], [96, 108], [90, 118], [86, 106], [74, 112], [80, 100]], { ...o, stroke: RED, strokeWidth: 2 }),
  o => gen.line(60, 116, 118, 116, o),
]);

// Broken heart with a dollar sign
svg("broken-heart-dollar", 110, 100, RED, [
  o => gen.path("M55 92 C20 66 6 48 10 30 C14 10 40 6 55 26 C70 6 96 10 100 30 C104 48 90 66 55 92 Z", o),
  o => gen.linearPath([[55, 26], [46, 42], [60, 54], [48, 68], [56, 90]], o),
  o => gen.path("M84 34 C78 28 68 30 70 36 C72 42 86 40 84 48 C82 54 72 54 68 48", { ...o, stroke: BLACK, strokeWidth: 1.4 }),
  o => gen.line(77, 24, 77, 58, { ...o, stroke: BLACK, strokeWidth: 1.4 }),
], 2.2);

// Spiked wristband
svg("spiked-wristband", 130, 70, BLACK, [
  o => gen.rectangle(8, 26, 114, 30, o),
  ...[18, 40, 62, 84, 106].map(x => o => gen.polygon([[x - 7, 26], [x, 6], [x + 7, 26]], o)),
  o => gen.line(14, 48, 116, 48, { ...o, strokeWidth: 1 }),
]);

// Cassette tape
svg("cassette", 130, 86, BLUE, [
  o => gen.rectangle(6, 6, 118, 74, o),
  o => gen.rectangle(18, 14, 94, 40, o),
  o => gen.circle(42, 34, 18, o), o => gen.circle(88, 34, 18, o),
  o => gen.line(52, 34, 78, 34, o),
  o => gen.polygon([[34, 80], [42, 62], [88, 62], [96, 80]], o),
  o => gen.line(24, 20, 64, 20, { ...o, stroke: RED, strokeWidth: 1.2 }),
]);

// "SELL?" speech bubble, letters drawn as strokes
svg("sell-bubble", 140, 96, BLACK, [
  o => gen.ellipse(68, 40, 128, 70, o),
  o => gen.linearPath([[46, 70], [30, 92], [64, 74]], o),
  o => gen.path("M38 24 C30 20 22 24 26 31 C30 37 40 37 38 46 C36 54 26 54 22 48", { ...o, stroke: RED, strokeWidth: 2.6 }),
  o => gen.linearPath([[58, 22], [46, 22], [46, 52], [58, 52]], { ...o, stroke: RED, strokeWidth: 2.6 }),
  o => gen.line(46, 37, 56, 37, { ...o, stroke: RED, strokeWidth: 2.6 }),
  o => gen.linearPath([[66, 22], [66, 52], [78, 52]], { ...o, stroke: RED, strokeWidth: 2.6 }),
  o => gen.linearPath([[86, 22], [86, 52], [98, 52]], { ...o, stroke: RED, strokeWidth: 2.6 }),
  o => gen.path("M104 26 C106 16 120 16 118 26 C117 33 110 34 110 42", { ...o, stroke: RED, strokeWidth: 2.6 }),
  o => gen.circle(110, 50, 2, { ...o, stroke: RED, strokeWidth: 2.6 }),
]);

// Hand-drawn arrows
svg("arrow-curly", 120, 70, RED, [
  o => gen.curve([[6, 60], [30, 20], [60, 50], [90, 18], [110, 14]], o),
  o => gen.linearPath([[96, 6], [112, 14], [100, 28]], o),
], 2.2);
svg("arrow-down", 60, 110, BLUE, [
  o => gen.curve([[30, 4], [22, 40], [38, 70], [30, 100]], o),
  o => gen.linearPath([[16, 86], [30, 104], [44, 86]], o),
], 2);

// Stars and squiggles
svg("star", 80, 80, BLACK, [
  o => gen.linearPath([[40, 4], [50, 30], [76, 30], [54, 46], [62, 74], [40, 56], [18, 74], [26, 46], [4, 30], [30, 30], [40, 4]], o),
]);
svg("star-red", 70, 70, RED, [
  o => gen.linearPath([[35, 4], [43, 26], [66, 26], [47, 40], [54, 64], [35, 49], [16, 64], [23, 40], [4, 26], [27, 26], [35, 4]], o),
], 2.2);
svg("squiggle", 140, 40, BLUE, [
  o => gen.curve([[4, 20], [20, 4], [36, 34], [54, 6], [72, 34], [90, 6], [108, 34], [126, 8], [136, 20]], o),
]);
svg("lightning-squiggle", 50, 110, BLACK, [
  o => gen.linearPath([[30, 4], [12, 50], [32, 50], [16, 106], [44, 40], [24, 40], [40, 4]], o),
]);
console.log("ok");
