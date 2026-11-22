import assert from 'node:assert/strict';
import test from 'node:test';

import { darkColors, heroGradient, heroGradientDark, lightColors } from '@/theme/tokens';

function relativeLuminance(hex: string): number {
  const srgb = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [0, 0, 0];

  const [r, g, b] = srgb.map((value) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
  );

  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

test('light and dark palettes expose the same keys', () => {
  const lightKeys = Object.keys(lightColors).sort();
  const darkKeys = Object.keys(darkColors).sort();
  assert.deepEqual(lightKeys, darkKeys);
});

test('light theme text over surface meets AA contrast', () => {
  assert.ok(contrast(lightColors.text, lightColors.background) >= 4.5);
});

test('dark theme text over surface meets AA contrast', () => {
  assert.ok(contrast(darkColors.text, darkColors.background) >= 4.5);
});

test('primary button text has sufficient contrast in both themes', () => {
  assert.ok(contrast(lightColors.textOnPrimary, lightColors.primary) >= 4.5);
  assert.ok(contrast(darkColors.textOnPrimary, darkColors.primary) >= 4.5);
});

test('accent and danger text tokens have sufficient contrast', () => {
  assert.ok(contrast(lightColors.onAccent, lightColors.accent) >= 4.5);
  assert.ok(contrast(darkColors.onAccent, darkColors.accent) >= 4.5);
  assert.ok(contrast(lightColors.onDanger, lightColors.danger) >= 4.5);
  assert.ok(contrast(darkColors.onDanger, darkColors.danger) >= 4.5);
});

test('hero text meets AA contrast against the hero gradient', () => {
  for (const bg of heroGradient) {
    assert.ok(contrast(lightColors.onHero, bg) >= 4.5);
    assert.ok(contrast(darkColors.onHero, bg) >= 4.5);
  }
});

test('toast success background meets AA contrast with white in both themes', () => {
  assert.ok(contrast(lightColors.toastSuccess, '#FFFFFF') >= 4.5);
  assert.ok(contrast(darkColors.toastSuccess, '#FFFFFF') >= 4.5);
});

test('warning text meets AA contrast on the surface and background in both themes', () => {
  for (const palette of [lightColors, darkColors]) {
    assert.ok(contrast(palette.warning, palette.surface) >= 4.5, `surface ${palette.warning}`);
    assert.ok(contrast(palette.warning, palette.background) >= 4.5, `background ${palette.warning}`);
  }
});

test('muted text stays readable on the cream canvas', () => {
  assert.ok(contrast(lightColors.textMuted, lightColors.background) >= 4.5);
  assert.ok(contrast(darkColors.textMuted, darkColors.background) >= 4.5);
});

test('text stays readable over the tinted macro backgrounds in both themes', () => {
  for (const palette of [lightColors, darkColors]) {
    for (const tint of [
      palette.proteinLight,
      palette.carbohydratesLight,
      palette.fatLight,
      palette.waterLight,
    ]) {
      assert.ok(contrast(palette.text, tint) >= 4.5, `${palette.text} on ${tint}`);
    }
  }
});

test('hero gradient keeps three stops, all readable with white text', () => {
  assert.equal(heroGradient.length, 3);
  for (const stop of heroGradient) {
    assert.ok(contrast('#FFFFFF', stop) >= 4.5, stop);
  }
});

test('both hero gradients keep white and the muted hero text readable (AA)', () => {
  for (const gradient of [heroGradient, heroGradientDark]) {
    for (const stop of gradient) {
      assert.ok(contrast('#FFFFFF', stop) >= 4.5, `white on ${stop}`);
      for (const palette of [lightColors, darkColors]) {
        assert.ok(contrast(palette.onHeroMuted, stop) >= 4.5, `${palette.onHeroMuted} on ${stop}`);
      }
    }
  }
});

test('success text is readable on the surfaces of both themes', () => {
  for (const palette of [lightColors, darkColors]) {
    assert.ok(contrast(palette.successText, palette.surface) >= 4.5, `surface ${palette.successText}`);
    assert.ok(contrast(palette.successText, palette.surfaceMuted) >= 4.5, `muted ${palette.successText}`);
  }
});

test('the selected segment stands out from the muted track in dark mode', () => {
  assert.ok(contrast(darkColors.surfaceRaised, darkColors.surfaceMuted) >= 1.3);
  assert.ok(contrast(darkColors.text, darkColors.surfaceRaised) >= 4.5);
  assert.ok(contrast(lightColors.text, lightColors.surfaceRaised) >= 4.5);
});

test('text on the danger and primary swipe backgrounds meets AA in dark mode', () => {
  assert.ok(contrast(darkColors.onDanger, darkColors.danger) >= 4.5);
  assert.ok(contrast(darkColors.textOnPrimary, darkColors.primary) >= 4.5);
});
