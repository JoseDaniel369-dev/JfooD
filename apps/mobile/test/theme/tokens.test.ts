import assert from 'node:assert/strict';
import test from 'node:test';

import { darkColors, heroGradient, lightColors } from '@/theme/tokens';

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
