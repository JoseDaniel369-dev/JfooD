/**
 * Generates every brand image of the app from one glyph (a calorie ring with a
 * leaf), so icon, adaptive icon, splash and notification icon always match.
 *
 *   node apps/mobile/scripts/generate-brand-assets.mjs
 *
 * Needs only `sharp` (dev dependency). The SVG sources are also written to
 * assets/brand/ so they can be edited in any vector tool.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const brand = join(assets, 'brand');
mkdirSync(brand, { recursive: true });

const SIZE = 1024;

const palette = {
  mintLight: '#34D399',
  emerald: '#10B981',
  emeraldDark: '#047857',
  forest: '#064E3B',
  orange: '#FF7A1A',
  white: '#FFFFFF',
  mint: '#A7F3D0',
};

/**
 * The glyph. Everything stays inside the central 62 % of the canvas, which is
 * the safe zone Android adaptive icons keep visible after masking.
 */
function glyph({ ring, leaf, dot }) {
  const radius = 250;
  const circumference = 2 * Math.PI * radius;
  const arc = (circumference * 300) / 360;
  const gap = circumference - arc;
  // The arc starts at -60° and runs clockwise: the opening sits at the top and
  // the orange dot marks the end of the progress.
  const endAngle = (240 * Math.PI) / 180;
  const dotX = 512 + radius * Math.cos(endAngle);
  const dotY = 512 + radius * Math.sin(endAngle);

  return `
    <defs>
      <mask id="vein" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">
        <rect width="${SIZE}" height="${SIZE}" fill="#FFFFFF"/>
        <path d="M 392 628 Q 500 520 622 404" fill="none" stroke="#000000" stroke-width="22" stroke-linecap="round"/>
      </mask>
    </defs>
    <circle cx="512" cy="512" r="${radius}" fill="none" stroke="${ring}" stroke-width="64"
      stroke-linecap="round" stroke-dasharray="${arc.toFixed(1)} ${gap.toFixed(1)}"
      transform="rotate(-60 512 512)"/>
    <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="46" fill="${dot}"/>
    <path d="M 360 640 C 340 480 470 380 650 372 C 670 540 560 660 360 640 Z"
      fill="${leaf}" mask="url(#vein)"/>`;
}

const gradient = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.mintLight}"/>
      <stop offset="0.55" stop-color="${palette.emerald}"/>
      <stop offset="1" stop-color="${palette.emeraldDark}"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>`;

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;
}

const white = { ring: palette.white, leaf: palette.white, dot: palette.white };

const variants = {
  // Full icon: gradient background + white ring and leaf + orange dot.
  icon: svg(
    gradient + glyph({ ring: palette.white, leaf: palette.white, dot: palette.orange }),
  ),
  // Adaptive icon layers (Android masks the foreground into any shape).
  'android-icon-background': svg(gradient),
  'android-icon-foreground': svg(
    glyph({ ring: palette.white, leaf: palette.white, dot: palette.orange }),
  ),
  // Themed icon: a single colour; Android only reads the alpha channel.
  'android-icon-monochrome': svg(glyph(white)),
  // Splash: coloured glyph for the light background, mint for the dark one.
  'splash-icon': svg(
    glyph({ ring: palette.emerald, leaf: palette.emeraldDark, dot: palette.orange }),
  ),
  'splash-icon-dark': svg(
    glyph({ ring: palette.mint, leaf: palette.mintLight, dot: palette.orange }),
  ),
  // Status-bar icon of notifications: pure white on transparent.
  'notification-icon': svg(glyph(white)),
  favicon: svg(
    gradient + glyph({ ring: palette.white, leaf: palette.white, dot: palette.orange }),
  ),
};

const pixelSizes = { 'notification-icon': 96, favicon: 96 };

for (const [name, source] of Object.entries(variants)) {
  writeFileSync(join(brand, `${name}.svg`), source);
  const size = pixelSizes[name] ?? SIZE;
  await sharp(Buffer.from(source), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(assets, `${name}.png`));
  console.log(`assets/${name}.png (${size}px)`);
}
