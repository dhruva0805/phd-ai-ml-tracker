import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, genId, clampLevel, todayISO, daysSince } from '../src/util.js';

test('escapeHtml escapes the five dangerous characters', () => {
  assert.equal(escapeHtml(`<script>alert("x")&'y'</script>`), '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;y&#39;&lt;/script&gt;');
});
test('escapeHtml treats null/undefined as empty string', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});
test('escapeHtml coerces non-strings', () => {
  assert.equal(escapeHtml(42), '42');
});

test('genId includes the given prefix and is unique across calls', () => {
  const a = genId('ev'), b = genId('ev');
  assert.match(a, /^ev-/);
  assert.notEqual(a, b);
});

test('clampLevel rounds and clamps into [0,4]', () => {
  assert.equal(clampLevel(2.6), 3);
  assert.equal(clampLevel(-5), 0);
  assert.equal(clampLevel(99), 4);
  assert.equal(clampLevel('not a number'), 0);
  assert.equal(clampLevel(undefined), 0);
});

test('todayISO returns a YYYY-MM-DD string matching the local date', () => {
  const iso = todayISO();
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
  const now = new Date();
  const expected = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  assert.equal(iso, expected);
});

// Regression test for the UTC-vs-local mismatch fixed in c1026ae: daysSince must treat a plain
// YYYY-MM-DD date string as local midnight (matching todayISO's own local-date output), not as
// UTC midnight — otherwise a date recorded "today" west of UTC could read as 1 day old.
test('daysSince(todayISO()) is always 0, never 1, regardless of local timezone offset from UTC', () => {
  assert.equal(daysSince(todayISO()), 0);
});
test('daysSince a date-only string is measured from local midnight, not UTC midnight', () => {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const threeDaysAgo = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  assert.equal(daysSince(threeDaysAgo), 3);
});
test('daysSince never returns a negative number for a same-day timestamp', () => {
  assert.equal(daysSince(new Date().toISOString()), 0);
});
test('daysSince returns null for empty/invalid input', () => {
  assert.equal(daysSince(null), null);
  assert.equal(daysSince(''), null);
  assert.equal(daysSince('not a date'), null);
  assert.equal(daysSince(42), null);
});
