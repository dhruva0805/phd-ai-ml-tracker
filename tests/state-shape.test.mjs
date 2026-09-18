import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, migrateFlatProgress, sanitizeResearchActivity, migrateState } from '../src/state.js';

test('defaultState() has every top-level field the rest of the app expects', () => {
  const s = defaultState();
  assert.equal(s.version, 3);
  for (const key of ['itemProgress','competencies','evidence','researchActivity','researchQuestions',
    'specializationRoles','researchGates','replicationStatus','frontierTopics','settings']) {
    assert.ok(key in s, `missing ${key}`);
  }
  assert.deepEqual(s.itemProgress, {});
  assert.deepEqual(s.researchQuestions, []);
  assert.ok(s.researchActivity.cadence.paperPerWeek >= 0);
  assert.deepEqual(s.researchActivity.log.papersDeepRead, []);
});

test('migrateFlatProgress wraps a legacy v1/v2 {id: true|state} map into a fresh v3 state', () => {
  const s = migrateFlatProgress({ 'p1-la': true, 'p1-prob': 'in_progress', 'p1-opt': 'mastered', 'p1-bad': 'not_a_real_state' });
  assert.equal(s.itemProgress['p1-la'], 'done');           // legacy `true` -> 'done'
  assert.equal(s.itemProgress['p1-prob'], 'in_progress');
  assert.equal(s.itemProgress['p1-opt'], 'mastered');
  assert.ok(!('p1-bad' in s.itemProgress));                 // unrecognized value dropped, not defaulted
  assert.equal(s.version, 3);                               // still a fully-shaped v3 state otherwise
});
test('migrateFlatProgress on garbage input returns a valid empty state rather than throwing', () => {
  assert.deepEqual(migrateFlatProgress(null).itemProgress, {});
  assert.deepEqual(migrateFlatProgress('not an object').itemProgress, {});
});

test('sanitizeResearchActivity backfills missing cadence/log keys without dropping present ones', () => {
  const out = sanitizeResearchActivity({ cadence: { paperPerWeek: 3 }, log: { papersDeepRead: [{id:'a'}] } });
  assert.equal(out.cadence.paperPerWeek, 3);
  assert.equal(out.cadence.memoPerQuarter, defaultState().researchActivity.cadence.memoPerQuarter); // backfilled
  assert.deepEqual(out.log.papersDeepRead, [{id:'a'}]);
  assert.deepEqual(out.log.ablations, []); // backfilled, not left undefined
});
test('sanitizeResearchActivity on garbage input returns the full default shape', () => {
  const out = sanitizeResearchActivity(null);
  assert.deepEqual(out, defaultState().researchActivity);
});

test('migrateState never throws on malformed/partial input and always returns a fully-shaped v3 state', () => {
  for (const bad of [null, undefined, 'a string', 42, [], {}, {itemProgress: 'not an object'}]) {
    const s = migrateState(bad);
    assert.equal(s.version, 3);
    assert.equal(typeof s.itemProgress, 'object');
    assert.ok(Array.isArray(s.researchQuestions));
  }
});
test('migrateState preserves well-shaped fields from a real v3-ish blob', () => {
  const s = migrateState({ itemProgress: {'p1-la':'done'}, specializationRoles: {'t-prob':'primary'} });
  assert.equal(s.itemProgress['p1-la'], 'done');
  assert.equal(s.specializationRoles['t-prob'], 'primary');
});
