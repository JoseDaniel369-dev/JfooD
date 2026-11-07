import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeName } from '@/features/foods/utils/normalize';

describe('normalizeName', () => {
  it('lowercases and trims names', () => {
    assert.equal(normalizeName('  Manzana  '), 'manzana');
  });

  it('removes diacritics', () => {
    assert.equal(normalizeName('Aceite de Oliva Virgen Extra'), 'aceite de oliva virgen extra');
    assert.equal(normalizeName('Arándanos'), 'arandanos');
    assert.equal(normalizeName('Jamón Ibérico'), 'jamon iberico');
  });

  it('replaces ñ with n', () => {
    assert.equal(normalizeName('Niño'), 'nino');
    assert.equal(normalizeName('Café con leche'), 'cafe con leche');
  });

  it('collapses multiple spaces', () => {
    assert.equal(normalizeName('Leche   semi   desnatada'), 'leche semi desnatada');
  });

  it('returns an empty string for empty input', () => {
    assert.equal(normalizeName(''), '');
    assert.equal(normalizeName('   '), '');
  });
});
