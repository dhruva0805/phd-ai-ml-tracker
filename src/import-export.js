// Export/import/reset flow for the state singleton. Pulls in a little DOM (the import
// modal, the hidden file input, the download-anchor trick) because that's intrinsically
// part of this flow, not a separate concern worth spreading across more files.
import { ITEMS } from './data/items/index.js';
import { SECTIONS } from './data/sections.js';
import {
  COMPETENCY_DIMS, EVIDENCE_TYPES, RQ_STATUSES, RQ_FIELDS,
  GATES, GATE_STATUSES, SPEC_ROLES, FRONTIER_STATUSES,
} from './constants.js';
import { genId, clampLevel, todayISO } from './util.js';
import { getState, setState, resetState, defaultState, migrateState, saveState, isComplete } from './state.js';
import { calculateResourceCompletion, calculateEvidenceStrength } from './calc.js';
import { render } from './ui/render-curriculum.js';
import { toast, confirmDialog } from './ui/render-shared.js';

let pendingImport = null;

function exportProgress(){
  const state = getState();
  const rc = calculateResourceCompletion(state, ITEMS);
  const doneItems = ITEMS.filter(i=>isComplete(i.id, state));
  const payload = {
    schema:'rs-track', version:3, exported:new Date().toISOString(),
    state: state,                          // full v3 state: itemProgress, competencies, evidence, researchActivity, researchQuestions, specializationRoles, researchGates, frontierTopics, settings
    progress: {...state.itemProgress},     // legacy-compatible mirror for older tooling / quick inspection
    completed: rc.done, total: rc.total,
    items: doneItems.map(i=>({id:i.id,title:i.t,type:i.type,state:state.itemProgress[i.id]}))
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='rs-track-progress.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
  const es = calculateEvidenceStrength(state, ITEMS);
  toast('Exported '+rc.done+' completed items, '+es.totalEvidenceRecords+' evidence record(s), '+state.researchQuestions.length+' research question(s)');
}
function handleImportFile(e){
  const file=e.target.files[0]; e.target.value='';
  if(!file){ return; }
  const reader=new FileReader();
  reader.onload=function(ev){
    let data; try{ data=JSON.parse(ev.target.result); }catch(err){ toast('Import failed: not valid JSON'); return; }
    let parsed; try{ parsed=validateImportedState(data); }catch(err){ toast('Import failed: could not read this file safely'); return; }
    if(!parsed){ toast('Import failed: unrecognized file format'); return; }
    pendingImport=parsed.incoming;
    document.getElementById('importSummary').innerHTML =
      'Found <b>'+parsed.known+'</b> item-progress entries matching this curriculum'+
      (parsed.unknown?' · <b>'+parsed.unknown+'</b> unknown IDs will be ignored':'')+
      (parsed.evidenceCount?' · <b>'+parsed.evidenceCount+'</b> evidence record(s)':'')+
      '. Merge keeps your current data and combines with this file (competencies/evidence keep the stronger/union values); Replace overwrites everything.';
    document.getElementById('importModal').classList.add('show');
  };
  reader.onerror=function(){ toast('Import failed: could not read file'); };
  reader.readAsText(file);
}
// Validates + sanitizes an arbitrary parsed-JSON blob into a safe, fully-shaped v3 state.
// Never throws on malformed input; unknown item/unit ids are dropped rather than failing the import.
// Accepts: a v3 export (schema:'rs-track', version>=3, .state{...}), a legacy v2 export
// (.progress{id:state}), a legacy items[] array, or a bare {id:state} map.
function validateImportedState(data){
  if(!data || typeof data!=='object') return null;
  const validIds = new Set(ITEMS.map(i=>i.id));
  const validUnitIds = new Set(ITEMS.filter(i=>i.major).map(i=>i.id));
  const ALIAS = {'p1-sys':'p1-os'};   // legacy: the compressed "Systems foundations" unit was split
  const ALLOWED_PROGRESS = new Set(['in_progress','done','mastered']);

  let rawFull=null, rawProgress=null;
  if(data.state && typeof data.state==='object'){ rawFull=data.state; rawProgress=data.state.itemProgress; }
  else if(data.itemProgress && typeof data.itemProgress==='object'){ rawFull=data; rawProgress=data.itemProgress; }
  else if(data.progress && typeof data.progress==='object'){ rawProgress=data.progress; }
  else if(Array.isArray(data.items)){ rawProgress={}; data.items.forEach(it=>{ if(it&&typeof it.id==='string') rawProgress[it.id]=it.state||'done'; }); }
  else { let looksLikeMap=true; for(const k in data){ if(typeof data[k]==='object'&&data[k]!==null){ looksLikeMap=false; break; } } if(looksLikeMap) rawProgress=data; }
  if(!rawFull && !rawProgress) return null;

  const itemProgress={}; let known=0, unknown=0;
  if(rawProgress && typeof rawProgress==='object'){
    Object.keys(rawProgress).forEach(id=>{
      const realId = ALIAS[id]||id;
      if(!validIds.has(realId)){ unknown++; return; }
      let v = rawProgress[id]; if(v===true||v==='true') v='done';
      if(!ALLOWED_PROGRESS.has(v)) v='done';
      itemProgress[realId]=v; known++;
    });
  }
  if(known===0 && unknown===0 && !rawFull) return null;

  const safe = migrateState(rawFull||{});
  safe.itemProgress = itemProgress;

  const competencies={};
  Object.keys(safe.competencies||{}).forEach(uid=>{
    if(!validUnitIds.has(uid)) return;
    const src=safe.competencies[uid]; if(!src||typeof src!=='object') return;
    const out={};
    COMPETENCY_DIMS.forEach(dim=>{
      const entry=src[dim];
      if(entry && typeof entry==='object') out[dim]={level:clampLevel(entry.level), lastPracticed: typeof entry.lastPracticed==='string'?entry.lastPracticed:null, lastDemonstrated: typeof entry.lastDemonstrated==='string'?entry.lastDemonstrated:null};
    });
    if(Object.keys(out).length) competencies[uid]=out;
  });
  safe.competencies = competencies;

  const evidence={}; let evidenceCount=0;
  Object.keys(safe.evidence||{}).forEach(uid=>{
    if(!validUnitIds.has(uid)) return;
    const list = Array.isArray(safe.evidence[uid]) ? safe.evidence[uid] : [];
    const clean = list.filter(e=>e && typeof e==='object' && typeof e.title==='string').map(e=>({
      id: typeof e.id==='string' ? e.id : genId('ev'),
      title: String(e.title).slice(0,200),
      type: EVIDENCE_TYPES.includes(e.type) ? e.type : EVIDENCE_TYPES[0],
      url: typeof e.url==='string' ? e.url.slice(0,500) : '',
      notes: typeof e.notes==='string' ? e.notes.slice(0,2000) : '',
      date: typeof e.date==='string' ? e.date : '',
      competencies: Array.isArray(e.competencies) ? e.competencies.filter(d=>COMPETENCY_DIMS.includes(d)) : []
    }));
    if(clean.length){ evidence[uid]=clean; evidenceCount+=clean.length; }
  });
  safe.evidence = evidence;

  // Phase B: research questions — keep only well-shaped entries with a known status.
  const trackKeys = new Set(SECTIONS.filter(s=>s.kind==='track').map(s=>s.key));
  safe.researchQuestions = (Array.isArray(safe.researchQuestions) ? safe.researchQuestions : [])
    .filter(q=>q && typeof q==='object')
    .map(q=>{
      const out = {id: typeof q.id==='string' ? q.id : genId('rq'),
        status: RQ_STATUSES.includes(q.status) ? q.status : 'observation',
        createdAt: typeof q.createdAt==='string' ? q.createdAt : new Date().toISOString(),
        updatedAt: typeof q.updatedAt==='string' ? q.updatedAt : new Date().toISOString()};
      RQ_FIELDS.forEach(f=>{ out[f.key] = typeof q[f.key]==='string' ? q[f.key].slice(0,4000) : ''; });
      return out;
    });

  // Phase B: research activity — sanitize cadence numbers and every log entry.
  const cadenceClean={};
  Object.keys(defaultState().researchActivity.cadence).forEach(k=>{
    const v = safe.researchActivity.cadence[k];
    cadenceClean[k] = (typeof v==='number' && v>=0 && v<1000) ? Math.round(v) : defaultState().researchActivity.cadence[k];
  });
  const logClean={};
  Object.keys(defaultState().researchActivity.log).forEach(k=>{
    const list = Array.isArray(safe.researchActivity.log[k]) ? safe.researchActivity.log[k] : [];
    logClean[k] = list.filter(e=>e && typeof e==='object' && typeof e.title==='string').map(e=>({
      id: typeof e.id==='string' ? e.id : genId('al'),
      title: String(e.title).slice(0,300),
      date: typeof e.date==='string' ? e.date : todayISO()
    }));
  });
  safe.researchActivity = {cadence:cadenceClean, log:logClean};

  // Phase B: research gates — only known gate keys, known statuses, bounded notes/links.
  const gatesClean={};
  GATES.forEach(g=>{
    const src = safe.researchGates[g.key];
    if(!src || typeof src!=='object') return;
    gatesClean[g.key] = {
      status: GATE_STATUSES.includes(src.status) ? src.status : 'not_attempted',
      notes: typeof src.notes==='string' ? src.notes.slice(0,4000) : '',
      updatedAt: typeof src.updatedAt==='string' ? src.updatedAt : null,
      links: (Array.isArray(src.links)?src.links:[]).filter(l=>l&&typeof l==='object'&&typeof l.url==='string').map(l=>({
        id: typeof l.id==='string' ? l.id : genId('gl'), title: typeof l.title==='string' ? l.title.slice(0,200) : l.url, url: l.url.slice(0,500)
      }))
    };
  });
  safe.researchGates = gatesClean;

  // Phase B: specialization roles — only known track sections, only known role values.
  const rolesClean={};
  Object.keys(safe.specializationRoles||{}).forEach(k=>{
    if(trackKeys.has(k) && SPEC_ROLES.includes(safe.specializationRoles[k])) rolesClean[k]=safe.specializationRoles[k];
  });
  safe.specializationRoles = rolesClean;

  // Phase D: frontier topics — only well-shaped records with known status/confidence.
  safe.frontierTopics = (Array.isArray(safe.frontierTopics) ? safe.frontierTopics : [])
    .filter(t=>t && typeof t==='object')
    .map(t=>({
      id: typeof t.id==='string' ? t.id : genId('frt'),
      topic: typeof t.topic==='string' ? t.topic.slice(0,200) : '',
      why: typeof t.why==='string' ? t.why.slice(0,4000) : '',
      keyPapers: (Array.isArray(t.keyPapers)?t.keyPapers:[]).filter(p=>p&&typeof p==='object'&&typeof p.url==='string').map(p=>({
        id: typeof p.id==='string' ? p.id : genId('frp'), title: typeof p.title==='string' ? p.title.slice(0,200) : p.url.slice(0,200), url: p.url.slice(0,500)
      })),
      dateAdded: typeof t.dateAdded==='string' ? t.dateAdded : todayISO(),
      lastReviewed: typeof t.lastReviewed==='string' ? t.lastReviewed : null,
      confidence: clampLevel(t.confidence),
      status: FRONTIER_STATUSES.includes(t.status) ? t.status : 'watching'
    }));

  return {incoming:safe, known, unknown, evidenceCount};
}
function applyImport(mode){
  if(!pendingImport){ closeImport(); return; }
  if(mode==='replace'){
    setState(pendingImport);
  } else {
    const state = getState();
    const rank={undefined:0, in_progress:1, done:2, mastered:3};
    Object.keys(pendingImport.itemProgress).forEach(k=>{
      const cur=state.itemProgress[k], inc=pendingImport.itemProgress[k];
      if((rank[inc]||0) >= (rank[cur]||0)) state.itemProgress[k]=inc;
    });
    Object.keys(pendingImport.competencies).forEach(uid=>{
      if(!state.competencies[uid]) state.competencies[uid]={};
      Object.keys(pendingImport.competencies[uid]).forEach(dim=>{
        const inc=pendingImport.competencies[uid][dim], cur=state.competencies[uid][dim];
        if(!cur || inc.level>=cur.level) state.competencies[uid][dim]=inc;
      });
    });
    Object.keys(pendingImport.evidence).forEach(uid=>{
      if(!state.evidence[uid]) state.evidence[uid]=[];
      const existingIds=new Set(state.evidence[uid].map(e=>e.id));
      pendingImport.evidence[uid].forEach(ev=>{ if(!existingIds.has(ev.id)) state.evidence[uid].push(ev); });
    });
    // Phase B fields: merge by union, never overwrite locally-edited data with older imports.
    if(Array.isArray(pendingImport.researchQuestions) && pendingImport.researchQuestions.length){
      const existingIds=new Set((state.researchQuestions||[]).map(q=>q.id));
      pendingImport.researchQuestions.forEach(q=>{ if(!existingIds.has(q.id)) state.researchQuestions.push(q); });
    }
    Object.keys(pendingImport.researchActivity.log||{}).forEach(catKey=>{
      if(!state.researchActivity.log[catKey]) state.researchActivity.log[catKey]=[];
      const existingIds=new Set(state.researchActivity.log[catKey].map(e=>e.id));
      (pendingImport.researchActivity.log[catKey]||[]).forEach(e=>{ if(!existingIds.has(e.id)) state.researchActivity.log[catKey].push(e); });
    });
    Object.assign(state.researchActivity.cadence, pendingImport.researchActivity.cadence||{});
    Object.assign(state.specializationRoles, pendingImport.specializationRoles||{});
    Object.keys(pendingImport.researchGates||{}).forEach(key=>{
      const inc = pendingImport.researchGates[key], cur = state.researchGates[key];
      const rank={not_attempted:0, needs_revision:1, self_assessed_pass:2, external_pass:3};
      if(!cur || (rank[inc.status]||0) >= (rank[cur.status]||0)){
        const mergedLinks = cur ? cur.links.slice() : [];
        const existingLinkIds = new Set(mergedLinks.map(l=>l.id));
        (inc.links||[]).forEach(l=>{ if(!existingLinkIds.has(l.id)) mergedLinks.push(l); });
        state.researchGates[key] = Object.assign({}, inc, {links:mergedLinks});
      } else {
        const existingLinkIds = new Set(cur.links.map(l=>l.id));
        (inc.links||[]).forEach(l=>{ if(!existingLinkIds.has(l.id)) cur.links.push(l); });
      }
    });
    if(Array.isArray(pendingImport.frontierTopics) && pendingImport.frontierTopics.length){
      const existingIds=new Set((state.frontierTopics||[]).map(f=>f.id));
      pendingImport.frontierTopics.forEach(f=>{ if(!existingIds.has(f.id)) state.frontierTopics.push(f); });
    }
  }
  saveState(); closeImport(); render(); toast('Imported ('+mode+')');
}
function closeImport(){ pendingImport=null; document.getElementById('importModal').classList.remove('show'); }
function resetAll(){
  confirmDialog('Reset all progress? This clears every mark, competency rating, evidence record, research question, activity log, gate status and specialization role — and cannot be undone.', () => {
    resetState(); render(); toast('Progress reset');
  });
}

export { exportProgress, handleImportFile, validateImportedState, applyImport, closeImport, resetAll };
