// Runs runIntegrity() against the REAL curriculum content (not a fixture) — this is the one
// test that should fail the moment a content edit introduces a duplicate id, an item pointing
// at a section that doesn't exist, an unknown type, or a malformed URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/data/items/index.js';
import { SECTIONS } from '../src/data/sections.js';
import { runIntegrity } from '../src/calc.js';

test('the real curriculum content has no structural integrity issues', () => {
  const r = runIntegrity(ITEMS, SECTIONS);
  assert.deepEqual(r.issues, []);
  assert.equal(r.total, ITEMS.length);
});

test('every item id is unique', () => {
  const ids = new Set();
  for (const it of ITEMS) {
    assert.ok(!ids.has(it.id), `duplicate id: ${it.id}`);
    ids.add(it.id);
  }
});

test('every item references a real section', () => {
  const secKeys = new Set(SECTIONS.map(s => s.key));
  for (const it of ITEMS) assert.ok(secKeys.has(it.ph), `${it.id} references unknown section "${it.ph}"`);
});

test('every section has at least one item', () => {
  for (const s of SECTIONS) assert.ok(ITEMS.some(i => i.ph === s.key), `section "${s.key}" has no items`);
});

test('the dataset has the expected item count (guards against a bad extraction dropping content)', () => {
  assert.equal(ITEMS.length, 287);
});
