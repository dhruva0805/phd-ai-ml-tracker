// Entry point: boots the app and bridges the ~40 handler functions referenced by generated
// onclick/onchange/onblur/oninput HTML strings onto `window`.
//
// Everything is rendered by building HTML strings and assigning them via innerHTML (see
// ui/render-*.js) rather than addEventListener + delegation — a pattern carried over
// unchanged from before this module split, not introduced by it. Because the bundle below is
// an IIFE (not an ES module in the browser), module-scoped function declarations do NOT
// become globals the way top-level <script> functions used to, so anything referenced from
// one of those inline attribute strings has to be explicitly exposed here. This bridge is the
// one place that has to change if a future pass moves those handlers to real event listeners.
import { ITEMS } from './data/items/index.js';
import { SECTIONS } from './data/sections.js';
import { loadState, setState, setSpecializationRole, setReplicationStatus } from './state.js';
import { runIntegrity } from './calc.js';
import {
  render, toggleAllSections, toggleDetail,
  setCompetency, setCompetencyDate, toggleEvidenceForm, submitEvidenceForm, deleteEvidence,
} from './ui/render-curriculum.js';
import { setFilter, applyFilters, switchView, toggleDiag, triggerImport } from './ui/render-shared.js';
import { exportProgress, handleImportFile, applyImport, closeImport, resetAll } from './import-export.js';
import {
  toggleRqCard, rqFieldBlur, rqSetStatus, rqDelete, rqNew, rqSetFilter, rqSetQuery,
  actAdd, actRemove, actSetCadence,
} from './ui/render-research.js';
import { gateSetStatusUI, gateSetNotesUI, gateAddLinkUI, gateRemoveLinkUI } from './ui/render-gates.js';
import {
  frToggleReviewMode, frNewTopic, frToggleCard, frDelete, frFieldBlur, frSetStatus,
  frSetConfidence, frMarkReviewed, frAddPaperUI, frRemovePaperUI,
} from './ui/render-frontier.js';

Object.assign(window, {
  render, toggleAllSections, toggleDetail,
  setCompetency, setCompetencyDate, toggleEvidenceForm, submitEvidenceForm, deleteEvidence,
  setFilter, applyFilters, switchView, toggleDiag, triggerImport,
  exportProgress, handleImportFile, applyImport, closeImport, resetAll,
  toggleRqCard, rqFieldBlur, rqSetStatus, rqDelete, rqNew, rqSetFilter, rqSetQuery,
  actAdd, actRemove, actSetCadence,
  gateSetStatusUI, gateSetNotesUI, gateAddLinkUI, gateRemoveLinkUI,
  frToggleReviewMode, frNewTopic, frToggleCard, frDelete, frFieldBlur, frSetStatus,
  frSetConfidence, frMarkReviewed, frAddPaperUI, frRemovePaperUI,
  setSpecializationRole, setReplicationStatus,
});

/* ---------- boot ---------- */
(function(){
  const r = runIntegrity(ITEMS, SECTIONS);
  if(r.issues.length) console.warn('[RS Track] integrity issues:', r.issues);
  else console.log('[RS Track] integrity OK —', r.total, 'items,', r.verify.length, 'flagged for verification');
})();
setState(loadState());
render();
