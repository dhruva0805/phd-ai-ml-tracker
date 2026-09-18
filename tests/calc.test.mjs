// Exercises calc.js against small hand-built fixtures rather than the production dataset —
// this is what actually locks the scoring weights down: a fixture makes the expected number
// easy to work out by hand, so a regression in a weight table shows up as an assertion failure
// instead of a silent drift in a 249-item aggregate nobody is re-deriving by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/state.js';
import {
  calculateResourceCompletion, calculateCompetencyDevelopment, calculateEvidenceStrength,
  calculateCapabilityProfile, calculateMilestoneStage,
} from '../src/calc.js';

const FIXTURE_ITEMS = [
  { id: 'u1', ph: 's1', type: 'course', major: true },
  { id: 'u2', ph: 's1', type: 'book', major: true },
  { id: 'r1', ph: 's1', type: 'paper' },        // not major — ignored by competency/evidence rollups
];
const FIXTURE_SECTIONS = [
  { key: 's1', kind: 'phase' },
];

function stateWith(patch){ return Object.assign(defaultState(), patch); }

test('calculateResourceCompletion counts done/mastered against the given item list only', () => {
  const st = stateWith({ itemProgress: { u1: 'done', u2: 'mastered', r1: 'in_progress' } });
  const rc = calculateResourceCompletion(st, FIXTURE_ITEMS);
  assert.equal(rc.total, 3);
  assert.equal(rc.done, 2);      // done + mastered both count as "done"
  assert.equal(rc.mastered, 1);
  assert.equal(rc.pct, 67);      // round(2/3*100)
});

test('calculateCompetencyDevelopment averages effective (weighted) level across all 6 dims x major units', () => {
  const st = stateWith({ competencies: { u1: { understand: { level: 4, lastPracticed:null, lastDemonstrated:null } } } });
  const dev = calculateCompetencyDevelopment(st, FIXTURE_ITEMS);
  // 2 major units x 6 dims = 12 dim-slots; only one is set, to level 4, self-assessed (weight 0.5)
  // -> effective level 2 out of a possible 4 -> (2)/(12*4)*100 = 4.17% -> rounds to 4
  assert.equal(dev.assessedDims, 1);
  assert.equal(dev.totalDims, 12);
  assert.equal(dev.pct, 4);
});

test('an evidence-backed dimension counts for more than a self-assessed one at the same level', () => {
  const selfOnly = stateWith({ competencies: { u1: { understand: { level: 4, lastPracticed:null, lastDemonstrated:null } } } });
  const withEvidence = stateWith({
    competencies: { u1: { understand: { level: 4, lastPracticed:null, lastDemonstrated:null } } },
    evidence: { u1: [{ id:'e1', type:'Implementation', competencies:['understand'] }] },
  });
  const pctSelf = calculateCompetencyDevelopment(selfOnly, FIXTURE_ITEMS).pct;
  const pctEvidence = calculateCompetencyDevelopment(withEvidence, FIXTURE_ITEMS).pct;
  assert.ok(pctEvidence > pctSelf, `expected evidence-backed (${pctEvidence}%) > self-assessed (${pctSelf}%)`);
});

test('calculateEvidenceStrength classifies self vs evidence-backed vs externally validated', () => {
  const st = stateWith({
    competencies: {
      u1: { understand: { level: 2 }, derive: { level: 3 } },
      u2: { understand: { level: 1 } },
    },
    evidence: {
      u1: [{ id:'e1', type:'Implementation', competencies:['derive'] }],           // -> evidence-backed
      u2: [{ id:'e2', type:'Peer review', competencies:['understand'] }],          // -> externally validated
    },
  });
  const es = calculateEvidenceStrength(st, FIXTURE_ITEMS);
  assert.equal(es.assessed, 3);
  assert.equal(es.self, 1);              // u1.understand — no matching evidence
  assert.equal(es.evidenceBacked, 1);    // u1.derive
  assert.equal(es.externallyValidated, 1); // u2.understand
});

test('a track section marked "not pursuing" is excluded from active-major-unit rollups', () => {
  const trackItems = [...FIXTURE_ITEMS, { id: 'u3', ph: 't1', type: 'course', major: true }];
  const trackSections = [...FIXTURE_SECTIONS, { key: 't1', kind: 'track' }];
  const st = stateWith({
    specializationRoles: { t1: 'not_pursuing' },
    competencies: { u3: { understand: { level: 4 } } },
  });
  const dev = calculateCompetencyDevelopment(st, trackItems, trackSections);
  // u3 (level 4 on one dim) must not appear at all once its track is "not pursuing" — still only
  // the 2 non-track major units x 6 dims = 12 slots, none assessed.
  assert.equal(dev.totalDims, 12);
  assert.equal(dev.assessedDims, 0);
});

test('calculateCapabilityProfile: research_independence cannot be raised by resource completion alone', () => {
  const st = stateWith({ itemProgress: { u1: 'mastered', u2: 'mastered' } }); // no competency/evidence/activity/gates at all
  const cap = calculateCapabilityProfile(st, FIXTURE_ITEMS);
  assert.equal(cap.research_independence.pct, 0);
});

test('calculateMilestoneStage: stage 0 with nothing assessed, stage 1 once anything is', () => {
  const empty = stateWith({});
  assert.equal(calculateMilestoneStage(empty, FIXTURE_ITEMS).stage, 0);
  const oneRating = stateWith({ competencies: { u1: { understand: { level: 1 } } } });
  assert.equal(calculateMilestoneStage(oneRating, FIXTURE_ITEMS).stage, 1);
});
