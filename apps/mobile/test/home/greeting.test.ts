import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  avatarInitial,
  cleanDisplayName,
  greetingForHour,
  greetingLine,
} from '../../src/features/home/greeting';

test('the greeting follows the time of day, including the small hours', () => {
  assert.equal(greetingForHour(6).text, 'Buenos días');
  assert.equal(greetingForHour(12).text, 'Buenos días');
  assert.equal(greetingForHour(13).text, 'Buenas tardes');
  assert.equal(greetingForHour(20).text, 'Buenas tardes');
  assert.equal(greetingForHour(21).text, 'Buenas noches');
  assert.equal(greetingForHour(0).text, 'Buenas noches');
  assert.equal(greetingForHour(5).text, 'Buenas noches');
});

test('the name is trimmed, reduced to its first word and capped', () => {
  assert.equal(cleanDisplayName('  José Daniel '), 'José');
  assert.equal(cleanDisplayName('María'), 'María');
  assert.equal(cleanDisplayName('Maximiliano-Bartolomeo-Fernandez'), 'Maximiliano-Bartolom', 'capped at 20 characters');
  assert.equal(cleanDisplayName('   '), null);
  assert.equal(cleanDisplayName(null), null);
  assert.equal(cleanDisplayName(undefined), null);
});

test('the greeting line adds the name only when there is one', () => {
  assert.equal(greetingLine(9, 'Ana'), 'Buenos días, Ana');
  assert.equal(greetingLine(9, ''), 'Buenos días');
  assert.equal(greetingLine(22, null), 'Buenas noches');
});

test('the avatar shows the first letter of the name, capitalised', () => {
  assert.equal(avatarInitial('josé luis'), 'J');
  assert.equal(avatarInitial('  álvaro '), 'Á');
  assert.equal(avatarInitial(''), null);
  assert.equal(avatarInitial(null), null);
});
