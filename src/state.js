// The mutable state singleton: its shape, persistence (localStorage), and every accessor
// that reads or writes it.
//
// Read accessors that calc.js also needs to run against a *fixture* state (not just the live
// singleton) take an explicit `st` parameter defaulting to the singleton: `getUnitCompetency(id,
// st = state)`. Every UI call site keeps calling them with one argument and gets the live
// singleton, unchanged; calc.js and tests pass a fixture explicitly. Pure setters (they always
// mutate the live singleton and call saveState()) are not parameterized — there is exactly one
// state to save progress into.
import { ITEMS } from './data/items/index.js';
import { SECTIONS } from './data/sections.js';
import {
  COMPETENCY_DIMS, EXTERNAL_EVIDENCE_TYPES, EVIDENCE_TIER_WEIGHT,
  GATE_STATUSES, REPLICATION_STATUSES, SPEC_ROLES, FRONTIER_REVIEW_STALE_DAYS, STALE_COMPETENCY_DAYS,
} from './constants.js';
import { genId, clampLevel, todayISO, daysSince } from './util.js';

const STORE_KEY_V3 = 'rs_track_state_v3';
const STORE_KEY_V2 = 'rs_track_progress_v2';   // legacy flat map — read-only, never deleted
const STORE_KEY_V1 = 'rs_track_progress_v1';   // legacy flat map — read-only, never deleted

let state = null;

function defaultState(){
  return {
    version: 3,
    itemProgress: {},
    competencies: {},
    evidence: {},
    researchActivity: {
      cadence: {paperPerWeek:1, reconstructionPerMonth:1, reproductionPerQuarter:1, memoPerQuarter:1},
      log: {papersDeepRead:[],reconstructions:[],reproductions:[],ablations:[],hypothesesTested:[],
            failedExperiments:[],memos:[],peerReviews:[],talks:[],externalValidations:[],publications:[]}
    },
    researchQuestions: [],
    specializationRoles: {},
    researchGates: {},
    replicationStatus: {},
    frontierTopics: [],
    settings: {}
  };
}

// Wrap a legacy flat {id: true|'in_progress'|'done'|'mastered'} map (v1 or v2) into a fresh v3 state.
function migrateFlatProgress(flatMap){
  const s = defaultState();
  if(flatMap && typeof flatMap==='object'){
    Object.keys(flatMap).forEach(id=>{
      let v = flatMap[id];
      if(v===true) v='done';
      if(v==='in_progress'||v==='done'||v==='mastered') s.itemProgress[id]=v;
    });
  }
  return s;
}

function sanitizeResearchActivity(ra){
  const d = defaultState().researchActivity;
  if(!ra||typeof ra!=='object') return d;
  const cadence = Object.assign({}, d.cadence, (ra.cadence&&typeof ra.cadence==='object')?ra.cadence:{});
  const log = {};
  Object.keys(d.log).forEach(k=>{ log[k] = Array.isArray(ra.log&&ra.log[k]) ? ra.log[k] : []; });
  return {cadence, log};
}

// Explicit, versioned migration for anything already shaped like a v3 (or partial/future) state object.
// Always returns a fully-shaped, defensively-sanitized state so a corrupt/partial blob can never crash render().
function migrateState(raw){
  if(!raw || typeof raw!=='object') return defaultState();
  const s = raw;
  return {
    version: 3,
    itemProgress: (s.itemProgress && typeof s.itemProgress==='object') ? s.itemProgress : {},
    competencies: (s.competencies && typeof s.competencies==='object') ? s.competencies : {},
    evidence: (s.evidence && typeof s.evidence==='object') ? s.evidence : {},
    researchActivity: sanitizeResearchActivity(s.researchActivity),
    researchQuestions: Array.isArray(s.researchQuestions) ? s.researchQuestions : [],
    specializationRoles: (s.specializationRoles && typeof s.specializationRoles==='object') ? s.specializationRoles : {},
    researchGates: (s.researchGates && typeof s.researchGates==='object') ? s.researchGates : {},
    replicationStatus: (s.replicationStatus && typeof s.replicationStatus==='object') ? s.replicationStatus : {},
    frontierTopics: Array.isArray(s.frontierTopics) ? s.frontierTopics : [],
    settings: (s.settings && typeof s.settings==='object') ? s.settings : {}
  };
}

function isComplete(id, st=state){ const s=st.itemProgress[id]; return s==='done'||s==='mastered'; }
function isMastered(id, st=state){ return st.itemProgress[id]==='mastered'; }

// loadState(): v3 key first; falls back to legacy v2/v1 flat maps; never deletes legacy keys
// (so a bug found after migration can never lose data — the old keys are always still there).
function loadState(){
  try{
    const rawV3 = localStorage.getItem(STORE_KEY_V3);
    if(rawV3) return migrateState(JSON.parse(rawV3));
  }catch(e){}
  try{
    const rawV2 = localStorage.getItem(STORE_KEY_V2);
    if(rawV2) return migrateFlatProgress(JSON.parse(rawV2));
  }catch(e){}
  try{
    const rawV1 = localStorage.getItem(STORE_KEY_V1);
    if(rawV1) return migrateFlatProgress(JSON.parse(rawV1));
  }catch(e){}
  return defaultState();
}
function saveState(){ try{ localStorage.setItem(STORE_KEY_V3, JSON.stringify(state)); }catch(e){} }
function setState(s){ state = s; }
function resetState(){ state = defaultState(); saveState(); }

/* ---------- competency + evidence data helpers ---------- */
function getUnitCompetency(unitId, st=state){
  const c = st.competencies[unitId];
  const out = {};
  COMPETENCY_DIMS.forEach(dim=>{
    const existing = c && c[dim];
    out[dim] = (existing && typeof existing==='object')
      ? {level:clampLevel(existing.level), lastPracticed:existing.lastPracticed||null, lastDemonstrated:existing.lastDemonstrated||null}
      : {level:0, lastPracticed:null, lastDemonstrated:null};
  });
  return out;
}
function setUnitCompetencyLevel(unitId,dim,level){
  if(!COMPETENCY_DIMS.includes(dim)) return;
  if(!state.competencies[unitId]) state.competencies[unitId]={};
  if(!state.competencies[unitId][dim]) state.competencies[unitId][dim]={level:0,lastPracticed:null,lastDemonstrated:null};
  state.competencies[unitId][dim].level = clampLevel(level);
  saveState();
}
// Optional last-practiced / last-demonstrated dates (request: knowledge decay tracking).
// Never touches `level` — staleness is surfaced separately as a "Needs refresh" label,
// never by silently eroding a recorded mastery rating.
function setUnitCompetencyDate(unitId,dim,field,value){
  if(!COMPETENCY_DIMS.includes(dim) || (field!=='lastPracticed' && field!=='lastDemonstrated')) return;
  if(!state.competencies[unitId]) state.competencies[unitId]={};
  if(!state.competencies[unitId][dim]) state.competencies[unitId][dim]={level:0,lastPracticed:null,lastDemonstrated:null};
  state.competencies[unitId][dim][field] = value || null;
  saveState();
}
function getUnitEvidence(unitId, st=state){ return Array.isArray(st.evidence[unitId]) ? st.evidence[unitId] : []; }
function addEvidence(unitId, record){
  if(!state.evidence[unitId]) state.evidence[unitId]=[];
  state.evidence[unitId].push(record);
  saveState();
}
function removeEvidence(unitId, evidenceId){
  if(!Array.isArray(state.evidence[unitId])) return;
  state.evidence[unitId] = state.evidence[unitId].filter(e=>e.id!==evidenceId);
  saveState();
}
// Derived (never stored) classification of a single competency dimension on a unit.
function getDimensionSource(unitId, dim, st=state){
  const list = getUnitEvidence(unitId, st).filter(e=>Array.isArray(e.competencies)&&e.competencies.includes(dim));
  if(!list.length) return 'self';
  return list.some(e=>EXTERNAL_EVIDENCE_TYPES.has(e.type)) ? 'external' : 'evidence';
}
function sourceLabel(src){ return src==='external'?'Externally validated':src==='evidence'?'Evidence-backed':'Self-assessed'; }
// A dimension's level discounted by how well-supported it is — the core anti-gaming mechanism.
function effectiveLevel(unitId, dim, weights, st=state){
  weights = weights || EVIDENCE_TIER_WEIGHT;
  const level = getUnitCompetency(unitId, st)[dim].level;
  const src = getDimensionSource(unitId, dim, st);
  return level * (weights[src]!==undefined ? weights[src] : 1);
}
// T-shaped roles (request #12): a specialization track explicitly marked "not pursuing" is
// excluded from every aggregate rollup below, so choosing not to go deep on a track never
// reads as a deficiency. Tracks left unset, or marked secondary/reading/primary, count normally.
// `items`/`sections` default to the real curriculum content; calc.js passes its own explicit
// (possibly fixture) item/section lists through so these stay testable in isolation.
function unitExcludedByRole(unitId, st=state, items=ITEMS, sections=SECTIONS){
  const it = items.find(i=>i.id===unitId);
  if(!it) return false;
  const sec = sections.find(s=>s.key===it.ph);
  if(!sec || sec.kind!=='track') return false;
  return st.specializationRoles[sec.key]==='not_pursuing';
}
function activeMajorUnits(st=state, items=ITEMS, sections=SECTIONS){ return items.filter(i=>i.major && !unitExcludedByRole(i.id, st, items, sections)); }

/* ---------- research questions / activity / gates data helpers ---------- */
function getResearchQuestions(){ return state.researchQuestions; }
function addResearchQuestion(q){ state.researchQuestions.unshift(q); saveState(); }
function updateResearchQuestion(id, patch){
  const q = state.researchQuestions.find(x=>x.id===id); if(!q) return;
  Object.assign(q, patch); q.updatedAt = new Date().toISOString(); saveState();
}
function deleteResearchQuestion(id){ state.researchQuestions = state.researchQuestions.filter(x=>x.id!==id); saveState(); }

function addActivityLogEntry(catKey, entry){
  if(!state.researchActivity.log[catKey]) state.researchActivity.log[catKey]=[];
  state.researchActivity.log[catKey].unshift(entry); saveState();
}
function removeActivityLogEntry(catKey, entryId){
  if(!Array.isArray(state.researchActivity.log[catKey])) return;
  state.researchActivity.log[catKey] = state.researchActivity.log[catKey].filter(e=>e.id!==entryId); saveState();
}
function setCadence(cadenceKey, value){
  const v = Math.max(0, parseInt(value,10)||0);
  state.researchActivity.cadence[cadenceKey] = v; saveState();
}

function getGate(key, st=state){
  if(!st.researchGates[key]) st.researchGates[key] = {status:'not_attempted', notes:'', links:[], updatedAt:null};
  const g = st.researchGates[key];
  if(!Array.isArray(g.links)) g.links=[];
  return g;
}
function setGateStatus(key, status){
  if(!GATE_STATUSES.includes(status)) return;
  const g = getGate(key); g.status = status; g.updatedAt = new Date().toISOString(); saveState();
}
function setGateNotes(key, notes){ const g=getGate(key); g.notes = String(notes||''); g.updatedAt = new Date().toISOString(); saveState(); }
function addGateLink(key, title, url){
  if(!url) return;
  const g = getGate(key); g.links.push({id:genId('gl'), title:title||url, url}); saveState();
}
function removeGateLink(key, linkId){ const g=getGate(key); g.links = g.links.filter(l=>l.id!==linkId); saveState(); }
function gateStatus(key, st=state){ return (st.researchGates[key] && st.researchGates[key].status) || 'not_attempted'; }
function gatePassed(key, st=state){ const s=gateStatus(key, st); return s==='self_assessed_pass'||s==='external_pass'; }

function setSpecializationRole(sectionKey, role){
  if(role==='' || role==null){ delete state.specializationRoles[sectionKey]; }
  else if(SPEC_ROLES.includes(role)){ state.specializationRoles[sectionKey]=role; }
  saveState();
}
function getSpecializationRole(sectionKey, st=state){ return st.specializationRoles[sectionKey] || ''; }

// Phase C — Research Engineering: replication status for items opted in via `replication:true`
// (reproduction projects/milestones). Kept independent of GATE_STATUSES: a gate is a one-time
// defense, replication status tracks the ongoing state of a specific reproduction artifact.
function getReplicationStatus(id){ return (state.replicationStatus && state.replicationStatus[id]) || 'not_attempted'; }
function setReplicationStatus(id, status){
  if(!REPLICATION_STATUSES.includes(status)) return;
  if(!state.replicationStatus) state.replicationStatus = {};
  state.replicationStatus[id] = status;
  saveState();
}

/* ---------- Phase D: frontier research radar ---------- */
function getFrontierTopics(){ return Array.isArray(state.frontierTopics) ? state.frontierTopics : []; }
function addFrontierTopic(){
  const t = {id:genId('frt'), topic:'', why:'', keyPapers:[], dateAdded:todayISO(), lastReviewed:null, confidence:0, status:'watching'};
  state.frontierTopics.unshift(t); saveState();
  return t;
}
function updateFrontierTopic(id, patch){
  const t = state.frontierTopics.find(x=>x.id===id); if(!t) return;
  Object.assign(t, patch); saveState();
}
function deleteFrontierTopic(id){ state.frontierTopics = state.frontierTopics.filter(x=>x.id!==id); saveState(); }
function markFrontierReviewed(id){ updateFrontierTopic(id, {lastReviewed: todayISO()}); }
function addFrontierKeyPaper(topicId, title, url){
  const t = state.frontierTopics.find(x=>x.id===topicId); if(!t || !url) return;
  if(!Array.isArray(t.keyPapers)) t.keyPapers=[];
  t.keyPapers.push({id:genId('frp'), title:(title||url).slice(0,200), url:url.slice(0,500)});
  saveState();
}
function removeFrontierKeyPaper(topicId, paperId){
  const t = state.frontierTopics.find(x=>x.id===topicId); if(!t) return;
  t.keyPapers = (t.keyPapers||[]).filter(p=>p.id!==paperId); saveState();
}
// "Reviewed" resets the staleness clock; before a first review, time is measured from
// when the topic was added — a topic nobody has looked at since adding it is just as
// stale as one that hasn't been revisited, and should surface the same way.
function frontierDaysSinceReview(t){ return daysSince(t.lastReviewed || t.dateAdded); }
function isFrontierStale(t){
  if(t.status==='archived') return false;
  const d = frontierDaysSinceReview(t);
  return d===null || d>=FRONTIER_REVIEW_STALE_DAYS;
}

// A competency dimension only becomes "stale" once it has an actual practiced/demonstrated
// date on record and that date has aged past the threshold — an unset date is not a penalty,
// since these fields are explicitly optional. Mastery itself is never touched by this check.
function competencyFreshness(unitId, dim, st=state){
  const c = getUnitCompetency(unitId, st)[dim];
  if(c.level<=0) return {tracked:false, stale:false, days:null};
  const days = [c.lastPracticed, c.lastDemonstrated].map(daysSince).filter(d=>d!==null);
  if(!days.length) return {tracked:false, stale:false, days:null};
  const mostRecent = Math.min(...days);
  return {tracked:true, stale: mostRecent>=STALE_COMPETENCY_DAYS, days:mostRecent};
}
function getStaleCompetencies(st=state){
  const out=[];
  activeMajorUnits(st).forEach(u=>{
    COMPETENCY_DIMS.forEach(dim=>{
      const f = competencyFreshness(u.id,dim,st);
      if(f.stale) out.push({unitId:u.id, unitTitle:u.t, dim, days:f.days});
    });
  });
  return out;
}

export {
  STORE_KEY_V1, STORE_KEY_V2, STORE_KEY_V3,
  defaultState, migrateFlatProgress, sanitizeResearchActivity, migrateState,
  loadState, saveState, setState, resetState,
  isComplete, isMastered,
  getUnitCompetency, setUnitCompetencyLevel, setUnitCompetencyDate,
  getUnitEvidence, addEvidence, removeEvidence,
  getDimensionSource, sourceLabel, effectiveLevel,
  unitExcludedByRole, activeMajorUnits,
  getResearchQuestions, addResearchQuestion, updateResearchQuestion, deleteResearchQuestion,
  addActivityLogEntry, removeActivityLogEntry, setCadence,
  getGate, setGateStatus, setGateNotes, addGateLink, removeGateLink, gateStatus, gatePassed,
  setSpecializationRole, getSpecializationRole,
  getReplicationStatus, setReplicationStatus,
  getFrontierTopics, addFrontierTopic, updateFrontierTopic, deleteFrontierTopic, markFrontierReviewed,
  addFrontierKeyPaper, removeFrontierKeyPaper, frontierDaysSinceReview, isFrontierStale,
  competencyFreshness, getStaleCompetencies,
};
// Live accessor for the current singleton, for callers (mainly calc.js) that want "whatever
// state currently is" without importing setState/mutating it themselves.
export function getState(){ return state; }
