import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImportedState } from '../src/import-export.js';
import { defaultState } from '../src/state.js';
import { ITEMS } from '../src/data/items/index.js';

test('unrecognized file shapes return null rather than throwing', () => {
  assert.equal(validateImportedState(null), null);
  assert.equal(validateImportedState('a string'), null);
  // An object whose values are themselves objects doesn't "look like" a flat {id: state} map
  // (the shape a bare legacy export would have), so it's rejected outright.
  assert.equal(validateImportedState({ totally: { nested: 'unrelated' } }), null);
});
test('a flat object of unrecognized keys is still treated as a possible legacy {id: state} map (0 known, 0 unknown counted as not-a-map only when combined with no rawFull)', () => {
  // This mirrors the original app's existing (intentionally permissive) behavior: any bare flat
  // object with no nested objects is tried as a legacy progress map — even one whose keys don't
  // match any curriculum item ends up with unknown>0 rather than being rejected as unrecognized.
  const result = validateImportedState({ notARealId: 'done' });
  assert.ok(result);
  assert.equal(result.known, 0);
  assert.equal(result.unknown, 1);
});

test('unknown item ids are dropped and counted, known ids are kept', () => {
  const result = validateImportedState({ progress: { 'p1-la': 'done', 'not-a-real-id': 'done' } });
  assert.ok(result);
  assert.equal(result.known, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.incoming.itemProgress['p1-la'], 'done');
  assert.ok(!('not-a-real-id' in result.incoming.itemProgress));
});

test('the legacy p1-sys -> p1-os alias is applied on import', () => {
  const result = validateImportedState({ progress: { 'p1-sys': 'mastered' } });
  assert.equal(result.incoming.itemProgress['p1-os'], 'mastered');
  assert.ok(!('p1-sys' in result.incoming.itemProgress));
});

test('a bare true progress value is coerced to "done"; an unrecognized value also becomes "done"', () => {
  const result = validateImportedState({ progress: { 'p1-la': true, 'p1-prob': 'bogus-state' } });
  assert.equal(result.incoming.itemProgress['p1-la'], 'done');
  assert.equal(result.incoming.itemProgress['p1-prob'], 'done');
});

test('a legacy items[] array export is accepted', () => {
  const result = validateImportedState({ items: [{ id: 'p1-la', state: 'mastered' }] });
  assert.equal(result.incoming.itemProgress['p1-la'], 'mastered');
});

test('evidence and competency records for unknown unit ids are dropped, valid ones kept and clamped', () => {
  const result = validateImportedState({
    state: {
      competencies: { 'p1-la': { understand: { level: 99 } }, 'not-a-unit': { understand: { level: 2 } } },
      evidence: { 'p1-la': [{ id:'e1', title:'x', type:'Implementation' }], 'not-a-unit': [{ id:'e2', title:'y', type:'Paper' }] },
    },
  });
  assert.equal(result.incoming.competencies['p1-la'].understand.level, 4); // clamped to max
  assert.ok(!('not-a-unit' in result.incoming.competencies));
  assert.equal(result.evidenceCount, 1);
  assert.ok(!('not-a-unit' in result.incoming.evidence));
});

test('string fields are length-clamped rather than rejected outright', () => {
  const longTitle = 'x'.repeat(500);
  const result = validateImportedState({ state: { evidence: { 'p1-la': [{ id:'e1', title: longTitle, type:'Paper' }] } } });
  assert.equal(result.incoming.evidence['p1-la'][0].title.length, 200);
});

test('export -> validate round trip preserves a real default state unchanged in shape', () => {
  const original = defaultState();
  original.itemProgress['p1-la'] = 'done';
  const result = validateImportedState({ schema:'rs-track', version:3, state: original });
  assert.equal(result.incoming.itemProgress['p1-la'], 'done');
  assert.equal(result.incoming.version, 3);
});

test('validateImportedState never references an item id that does not actually exist in ITEMS', () => {
  const validIds = new Set(ITEMS.map(i => i.id));
  const result = validateImportedState({ progress: { 'p1-la': 'done' } });
  for (const id of Object.keys(result.incoming.itemProgress)) assert.ok(validIds.has(id));
});
