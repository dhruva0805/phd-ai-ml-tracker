// Decomposed progress metrics — resource completion, competency development, evidence
// strength, capability profile, research independence, research pipeline stats, the
// milestone ladder — plus the integrity/capability diagnostics that scan all of it for
// actionable flags.
//
// Every function here takes the data it needs as explicit parameters (state, items,
// sections) instead of reading module-level globals, specifically so tests can build a
// small fixture state/item list and assert on these functions directly rather than having
// to fake the live singleton or exercise the full 249-item production dataset.
import {
  COMPETENCY_DIMS, CAPABILITY_TAGS, CATEGORY_DIMENSIONS, RESEARCH_INDEPENDENCE_WEIGHT,
  RQ_STATUSES, RESEARCH_ACTIVITY_CATEGORIES, GATES, TYPE_LABEL, COMPETENCY_LABELS,
  STALE_COMPETENCY_DAYS, MILESTONE_LEVELS,
} from './constants.js';
import { daysSince } from './util.js';
import { SECTIONS as REAL_SECTIONS } from './data/sections.js';
import {
  isComplete, isMastered, getUnitCompetency, getDimensionSource, effectiveLevel,
  activeMajorUnits, gatePassed, gateStatus, getGate, getSpecializationRole, getStaleCompetencies,
} from './state.js';

function calculateResourceCompletion(st, items){
  const total=items.length;
  const done=items.filter(i=>isComplete(i.id, st)).length;
  const mastered=items.filter(i=>isMastered(i.id, st)).length;
  return {total, done, mastered, pct: total?Math.round(done/total*100):0, masterPct: total?Math.round(mastered/total*100):0};
}
function calculateGroupCompetency(unitIds, st){
  let sum=0,n=0;
  unitIds.forEach(id=>COMPETENCY_DIMS.forEach(dim=>{ sum+=effectiveLevel(id,dim,undefined,st); n++; }));
  return n ? sum/n : null;
}
function calculateCompetencyDevelopment(st, items, sections=REAL_SECTIONS){
  const majorUnits = activeMajorUnits(st, items, sections);
  let sum=0, n=0, assessedDims=0, totalDims=0;
  majorUnits.forEach(u=>{
    const comp=getUnitCompetency(u.id, st);
    COMPETENCY_DIMS.forEach(dim=>{
      totalDims++;
      if(comp[dim].level>0) assessedDims++;
      sum += effectiveLevel(u.id,dim,undefined,st); n++;
    });
  });
  return {pct: n?Math.round(sum/n/4*100):0, assessedDims, totalDims, unitCount:majorUnits.length};
}
function calculateEvidenceStrength(st, items, sections=REAL_SECTIONS){
  const majorUnits = activeMajorUnits(st, items, sections);
  let selfN=0, evidN=0, extN=0, assessed=0;
  majorUnits.forEach(u=>{
    const comp=getUnitCompetency(u.id, st);
    COMPETENCY_DIMS.forEach(dim=>{
      if(comp[dim].level>0){
        assessed++;
        const src=getDimensionSource(u.id,dim,st);
        if(src==='external') extN++; else if(src==='evidence') evidN++; else selfN++;
      }
    });
  });
  let totalEvidenceRecords=0; Object.values(st.evidence).forEach(l=>{ if(Array.isArray(l)) totalEvidenceRecords+=l.length; });
  return {assessed, self:selfN, evidenceBacked:evidN, externallyValidated:extN, totalEvidenceRecords,
    pct: assessed?Math.round((evidN+extN)/assessed*100):0};
}
function calculateCapabilityProfile(st, items, sections=REAL_SECTIONS){
  const majorUnits = activeMajorUnits(st, items, sections);
  const profile = {};
  ['theory','implementation','experimentation','evaluation','systems'].forEach(cat=>{
    const units = majorUnits.filter(u=>(CAPABILITY_TAGS[u.id]||[]).includes(cat));
    if(!units.length){ profile[cat]={pct:null,count:0}; return; }
    const dims = CATEGORY_DIMENSIONS[cat];
    let sum=0,n=0;
    units.forEach(u=>dims.forEach(dim=>{ sum+=effectiveLevel(u.id,dim,undefined,st); n++; }));
    profile[cat] = {pct: n?Math.round(sum/n/4*100):0, count:units.length};
  });
  // Research Independence is cross-cutting: it looks at research+critique across ALL major
  // units (not just tagged ones) using a much stricter self-assessment discount, so it can
  // never be driven up by simply marking courses/books "mastered". Phase B adds explicit
  // research-activity and research-gate terms on top: recurring research behavior (logged
  // reproductions/ablations/resolved hypotheses/external validations/publications) and passed
  // research gates — both of which are impossible to raise by resource completion alone.
  const riDims=['research','critique'];
  let riSum=0, riN=0;
  majorUnits.forEach(u=>riDims.forEach(dim=>{ riSum+=effectiveLevel(u.id,dim,RESEARCH_INDEPENDENCE_WEIGHT,st); riN++; }));
  const act = calculateResearchActivityCounts(st);
  const researchActivityTerm = Math.min(20,
    Math.min(act.reproductions,3)*2 + Math.min(act.ablations,3)*1.5 +
    Math.min(act.hypothesesTested,5)*1.5 + Math.min(act.externalValidations,3)*3 +
    Math.min(act.publications,3)*4);
  const gatesPassedCount = GATES.filter(g=>gatePassed(g.key, st)).length;
  const researchGateTerm = gatesPassedCount*4;
  const riBase = riN ? (riSum/riN/4*100) : 0;
  profile.research_independence = {pct: Math.round(Math.min(100, riBase+researchActivityTerm+researchGateTerm)), count: majorUnits.length,
    basisBase: Math.round(riBase), activityTerm: Math.round(researchActivityTerm), gateTerm: researchGateTerm};
  return profile;
}
function calculateResearchIndependence(st, items, sections=REAL_SECTIONS){
  const profile = calculateCapabilityProfile(st, items, sections);
  return {pct: profile.research_independence.pct,
    basis:'Evidence-weighted research & critique competency across all major units, plus recurring research-activity and passed-gate terms. Cannot be raised by resource completion or self-rating alone.'};
}

/* ---------- Phase B: research questions, activity counts, milestone ladder ---------- */
function calculateResearchQuestionStats(st){
  const qs = st.researchQuestions;
  const byStatus = {}; RQ_STATUSES.forEach(s=>byStatus[s]=0);
  qs.forEach(q=>{ if(byStatus[q.status]!==undefined) byStatus[q.status]++; });
  const resolved = byStatus.supported+byStatus.falsified+byStatus.inconclusive;
  const active = byStatus.hypothesis+byStatus.experiment_designed+byStatus.experiment_running;
  const open = byStatus.observation+byStatus.question;
  return {total:qs.length, byStatus, resolved, active, open,
    falsificationRate: resolved?Math.round(byStatus.falsified/resolved*100):0,
    inconclusiveRate: resolved?Math.round(byStatus.inconclusive/resolved*100):0,
    supportedRate: resolved?Math.round(byStatus.supported/resolved*100):0};
}
function calculateResearchActivityCounts(st){
  const log = st.researchActivity.log;
  const counts = {};
  RESEARCH_ACTIVITY_CATEGORIES.forEach(c=>{ counts[c.key] = Array.isArray(log[c.key]) ? log[c.key].length : 0; });
  counts.hypothesesTested = calculateResearchQuestionStats(st).resolved;
  return counts;
}
// "On pace" check for cadence-tracked categories: were enough entries logged within the
// most recent cadence window (week/month/quarter) to meet the configured target?
function calculateCadencePace(catKey, st){
  const cat = RESEARCH_ACTIVITY_CATEGORIES.find(c=>c.key===catKey);
  if(!cat || !cat.cadenceKey) return null;
  const target = st.researchActivity.cadence[cat.cadenceKey] || 0;
  const log = st.researchActivity.log[catKey] || [];
  const cutoff = Date.now() - cat.cadenceDays*24*60*60*1000;
  const recent = log.filter(e=>e.date && new Date(e.date).getTime()>=cutoff).length;
  return {target, recent, onPace: target<=0 ? null : recent>=target, unit:cat.cadenceUnit};
}
function calculateMilestoneSignals(st, items, sections=REAL_SECTIONS){
  const majorUnits = activeMajorUnits(st, items, sections);
  let anyAssessed=false, implementBreadth=0, experimentEvidenceBacked=false, critiqueEvidenceBacked=false;
  majorUnits.forEach(u=>{
    const comp=getUnitCompetency(u.id, st);
    COMPETENCY_DIMS.forEach(dim=>{ if(comp[dim].level>0) anyAssessed=true; });
    if(comp.implement.level>=2) implementBreadth++;
    if(comp.experiment.level>=2 && getDimensionSource(u.id,'experiment',st)!=='self') experimentEvidenceBacked=true;
    if(comp.critique.level>=3 && getDimensionSource(u.id,'critique',st)!=='self') critiqueEvidenceBacked=true;
  });
  const act = calculateResearchActivityCounts(st);
  let reproductionEvidenceRecords=0, ablationEvidenceRecords=0;
  Object.values(st.evidence).forEach(list=>{ if(!Array.isArray(list)) return; list.forEach(e=>{
    if(e.type==='Reproduction') reproductionEvidenceRecords++;
    if(e.type==='Ablation') ablationEvidenceRecords++;
  });});
  const qstats = calculateResearchQuestionStats(st);
  return {
    anyAssessed, implementBreadth,
    reproductionSignals: act.reproductions + reproductionEvidenceRecords,
    ablationSignals: act.ablations + ablationEvidenceRecords,
    experimentEvidenceBacked, critiqueEvidenceBacked,
    literatureMapSignal: gatePassed('gate4', st) || act.memos>=2,
    resolvedHypotheses: qstats.resolved,
    publications: act.publications, externalValidations: act.externalValidations, talks: act.talks
  };
}
// Current stage = highest contiguous level (from 1) whose check passes. Never derived from
// raw resource/checkbox completion — only from competencies+evidence+activity+gates.
function calculateMilestoneStage(st, items, sections=REAL_SECTIONS){
  const sig = calculateMilestoneSignals(st, items, sections);
  const results = MILESTONE_LEVELS.map(lvl=>{ const r=lvl.check(sig, st); return {level:lvl, pass:!!r.pass, gap:r.gap}; });
  let stage=0;
  for(let i=0;i<results.length;i++){ if(results[i].pass) stage=results[i].level.n; else break; }
  const next = MILESTONE_LEVELS.find(l=>l.n===stage+1);
  const nextResult = next ? results.find(r=>r.level.n===next.n) : null;
  return {stage, results, next, nextGap: nextResult?nextResult.gap:null, signals:sig};
}

/* ---------- integrity + capability diagnostics ---------- */
// Structural sanity checks on the curriculum content itself — no state involved. Runs against
// the real ITEMS/SECTIONS at the Diagnostics button and in tests/integrity.test.mjs, so a
// content edit that introduces a duplicate id, an orphaned section, or a malformed URL is
// caught immediately rather than silently shipped.
function runIntegrity(items, sections){
  const issues=[], info=[]; const ids=new Set(), urls={}; const secKeys=new Set(sections.map(s=>s.key));
  const VALID_TYPES=new Set(Object.keys(TYPE_LABEL));
  items.forEach(it=>{
    if(ids.has(it.id)) issues.push('Duplicate item id: '+it.id); else ids.add(it.id);
    if(!secKeys.has(it.ph)) issues.push('Unknown section for '+it.id+': '+it.ph);
    if(!VALID_TYPES.has(it.type)) issues.push('Bad type on '+it.id+': '+it.type);
    if(!it.t||!it.t.trim()) issues.push('Missing title: '+it.id);
    if(it.u&&!/^https?:\/\/.+/.test(it.u)) issues.push('Malformed URL on '+it.id+': '+it.u);
    if(it.u){ (urls[it.u]=urls[it.u]||[]).push(it.id); }
  });
  let xlinks=0; Object.keys(urls).forEach(u=>{ if(urls[u].length>1) xlinks++; });
  if(xlinks) info.push(xlinks+' resource(s) are intentionally cross-listed (same canonical link used by a phase and a track/index).');
  sections.forEach(s=>{ if(!items.some(i=>i.ph===s.key)) issues.push('Section with no items: '+s.key); });
  const verify=items.filter(i=>i.verify).map(i=>i.id);
  return {issues, info, verify, total:items.length};
}
// Capability diagnostics: flags specific, evidence-aware issues with a concrete, actionable
// recommendation attached to real numbers — never generic motivational text. Phase D fills out
// the full heuristic set; each check below only fires once there is enough signal to be a real
// pattern rather than noise for a tracker someone just started using.
function runCapabilityDiagnostics(st, items, sections){
  const notes=[];
  const majorUnits = items.filter(i=>i.major);
  const highSelfNoEvidence=[];
  majorUnits.forEach(u=>{
    const comp=getUnitCompetency(u.id, st);
    const flagged = COMPETENCY_DIMS.some(dim=>comp[dim].level>=3 && getDimensionSource(u.id,dim,st)==='self');
    if(flagged) highSelfNoEvidence.push(u.t);
  });
  if(highSelfNoEvidence.length){
    notes.push(highSelfNoEvidence.length+' unit(s) have a competency self-rated Strong or Research-ready with no supporting evidence: '+
      highSelfNoEvidence.slice(0,5).join('; ')+(highSelfNoEvidence.length>5?', …':'')+
      '. Attach an evidence record (derivation, implementation, reproduction, ablation, etc.) to back these ratings.');
  }
  const es = calculateEvidenceStrength(st, items, sections);
  if(es.assessed>=5 && es.pct<20){
    notes.push('Only '+es.pct+'% of assessed competencies are evidence-backed or externally validated ('+es.self+' of '+es.assessed+' assessed dimensions are self-assessed only). Evidence, not self-rating, is what should move Research Independence.');
  }
  const ri = calculateResearchIndependence(st, items, sections), rc = calculateResourceCompletion(st, items);
  if(rc.pct>=40 && ri.pct<10){
    notes.push('Resource completion is at '+rc.pct+'% but Research Independence is only '+ri.pct+'%. That gap is intentional — Research Independence is decoupled from course/paper completion and grows from evidence-backed critique and research competency (reproductions, ablations and hypothesis outcomes on the Research tab feed this score).');
  }

  const cap = calculateCapabilityProfile(st, items, sections);
  const qstats = calculateResearchQuestionStats(st);
  const sig = calculateMilestoneSignals(st, items, sections);

  // High completion but low experimentation.
  if(rc.pct>=40 && cap.experimentation.pct!==null && cap.experimentation.pct<20){
    notes.push('Resource completion is at '+rc.pct+'% but Experimentation capability is only '+cap.experimentation.pct+'%. Reading and coursework are not experimentation — design and run a controlled experiment or ablation on something you have already studied.');
  }

  // No recent research activity.
  const allActivityDates=[];
  Object.values(st.researchActivity.log).forEach(list=>{ if(Array.isArray(list)) list.forEach(e=>{ if(e.date) allActivityDates.push(e.date); }); });
  st.researchQuestions.forEach(q=>{ if(q.updatedAt) allActivityDates.push(q.updatedAt); });
  const activityDays = allActivityDates.map(daysSince).filter(d=>d!==null);
  const mostRecentActivityDays = activityDays.length ? Math.min(...activityDays) : null;
  if(rc.done>=5){
    if(mostRecentActivityDays===null){
      notes.push('No research activity has been logged yet on the Research tab despite '+rc.done+' completed item(s). Log a paper read, reconstruction, reproduction or hypothesis to start building a research track record.');
    } else if(mostRecentActivityDays>60){
      notes.push('No research activity logged in the last '+mostRecentActivityDays+' days. Studying should be paired with recurring research output — log something on the Research tab.');
    }
  }

  // Specialization role checks: no primary chosen, or too many tracks pursued at once.
  const trackSections = sections.filter(s=>s.kind==='track');
  const roleCounts = {primary:0, secondary:0, reading:0, not_pursuing:0};
  trackSections.forEach(t=>{ const r=getSpecializationRole(t.key, st); if(r) roleCounts[r]=(roleCounts[r]||0)+1; });
  const anyRoleSet = trackSections.some(t=>!!getSpecializationRole(t.key, st));
  if(roleCounts.primary===0 && anyRoleSet){
    notes.push('No specialization track is marked Primary. T-shaped expertise needs one track pursued to research-frontier depth — set a Primary role from a track\'s section header.');
  }
  if(roleCounts.primary>1){
    notes.push(roleCounts.primary+' specialization tracks are marked Primary at once. Depth requires focus — pick the single track that matters most and downgrade the rest to Secondary or Reading literacy.');
  }
  const activeTrackCount = roleCounts.primary+roleCounts.secondary;
  if(activeTrackCount>=4){
    notes.push(activeTrackCount+' specialization tracks are marked Primary or Secondary at the same time. Pursuing that many tracks simultaneously dilutes depth in each — mark some Reading literacy or Not pursuing instead.');
  }

  // Overdue research gates.
  const stuckGates = GATES.filter(g=>{
    const gt = getGate(g.key, st);
    if(gt.status!=='needs_revision' || !gt.updatedAt) return false;
    const d = daysSince(gt.updatedAt);
    return d!==null && d>45;
  });
  if(stuckGates.length){
    notes.push(stuckGates.length+' research gate(s) have sat at "Needs revision" for over 45 days: '+stuckGates.map(g=>g.title).join('; ')+'. Revisit and resolve them — they block the milestones that depend on them.');
  }
  const milestoneStage = calculateMilestoneStage(st, items, sections).stage;
  if(milestoneStage>=3 && gateStatus('gate1', st)==='not_attempted'){
    notes.push('Milestone stage is '+milestoneStage+' (Reproducer or beyond) but Gate 1 (Reproduction Defense) has never been attempted. Formalize a reproduction you have already done into a gate defense.');
  }

  // Weak evaluation capability.
  if(rc.pct>=25 && cap.evaluation.pct!==null && cap.evaluation.pct<25){
    notes.push('Evaluation capability is only '+cap.evaluation.pct+'% while overall resource completion is '+rc.pct+'%. Evaluation is a mandatory core module, not an afterthought — invest evidence-backed competency there deliberately.');
  }

  // Weak statistical rigor (Experimental Science & Statistical Rigor core unit specifically).
  const esCoreComp = getUnitCompetency('es-core', st);
  const esCoreAssessedDims = COMPETENCY_DIMS.filter(d=>esCoreComp[d].level>0).length;
  if(rc.pct>=40 && esCoreAssessedDims<=1){
    notes.push('Overall resource completion is '+rc.pct+'% but "Statistical rigor for ML experiments" has almost no competency assessed. Weak statistical rigor undermines every experimental claim you make — assess and evidence it directly rather than letting it lag behind reading progress.');
  }

  // Many papers read but few reproductions.
  const papersCompleted = items.filter(i=>i.type==='paper' && isComplete(i.id, st)).length;
  const reproductionSignals = sig.reproductionSignals;
  if(papersCompleted>=15 && reproductionSignals<=1){
    notes.push('You completed '+papersCompleted+' papers but have only '+reproductionSignals+' reproduction'+(reproductionSignals===1?'':'s')+'. Pause reading accumulation and reproduce one recent paper end to end.');
  }

  // Many implementations but few hypotheses.
  if(sig.implementBreadth>=5 && qstats.total===0){
    notes.push('You have Competent+ implementation on '+sig.implementBreadth+' major units but zero entries in the Hypothesis Log. Implementation without a research question is not research — log an observation or question from your most recent implementation.');
  }

  // No external validation at all.
  if(es.assessed>=8 && es.externallyValidated===0){
    notes.push('None of your '+es.assessed+' assessed competency dimensions are externally validated. Self- and evidence-backed ratings cannot fully substitute for outside signal — seek a peer review or external validation on your strongest unit.');
  }

  // Stale competencies (knowledge decay — see the "Needs refresh" labels on major units).
  const stale = getStaleCompetencies(st);
  if(stale.length){
    const byUnit = new Set(stale.map(s=>s.unitId));
    const sample = stale.slice(0,5).map(s=>s.unitTitle+' ('+COMPETENCY_LABELS[s.dim]+', '+s.days+'d)').join('; ');
    notes.push(stale.length+' competency dimension(s) across '+byUnit.size+' unit(s) have not been practiced or demonstrated in over '+STALE_COMPETENCY_DAYS+' days and are labeled "Needs refresh" (the rating itself is untouched): '+sample+(stale.length>5?', …':'')+'.');
  }

  return notes;
}

export {
  calculateResourceCompletion, calculateGroupCompetency, calculateCompetencyDevelopment,
  calculateEvidenceStrength, calculateCapabilityProfile, calculateResearchIndependence,
  calculateResearchQuestionStats, calculateResearchActivityCounts, calculateCadencePace,
  calculateMilestoneSignals, calculateMilestoneStage,
  runIntegrity, runCapabilityDiagnostics,
};
