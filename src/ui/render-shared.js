// Top-bar progress/capability-strip rendering, page-tab navigation, search/filter, the
// Diagnostics panel, the toast, and the hidden import-file-input trigger — the bits of UI
// that aren't specific to any one page.
import { ITEMS } from '../data/items/index.js';
import { SECTIONS } from '../data/sections.js';
import { CAPABILITY_CATEGORIES, CAPABILITY_LABELS } from '../constants.js';
import { escapeHtml } from '../util.js';
import { getState, isComplete } from '../state.js';
import { calculateResourceCompletion, calculateGroupCompetency, calculateCapabilityProfile, calculateCompetencyDevelopment, runIntegrity, runCapabilityDiagnostics } from '../calc.js';
import { renderResearchPage } from './render-research.js';
import { renderDashboardPage } from './render-dashboard.js';
import { renderGatesPage } from './render-gates.js';
import { renderFrontierPage } from './render-frontier.js';

let curFilter = 'all', curQuery = '';
let currentView = 'curriculum';
function getCurFilter(){ return curFilter; }
function getCurQuery(){ return curQuery; }

function updateProgress(){
  const state = getState();
  const rc = calculateResourceCompletion(state, ITEMS);
  document.getElementById('oFill').style.width=rc.pct+'%';
  document.getElementById('oMaster').style.width=rc.masterPct+'%';
  document.getElementById('oPct').textContent=rc.pct+'%';
  document.getElementById('oCount').textContent=rc.done+' / '+rc.total;
  SECTIONS.forEach(sec=>{
    const items=ITEMS.filter(i=>i.ph===sec.key), d=items.filter(i=>isComplete(i.id, state)).length;
    const p=items.length?Math.round(d/items.length*100):0;
    const f=document.getElementById('sfill-'+sec.key), c=document.getElementById('scount-'+sec.key);
    if(f) f.style.width=p+'%'; if(c) c.textContent=d+'/'+items.length;
    const majorIds = items.filter(i=>i.major).map(i=>i.id);
    const comp = document.getElementById('scomp-'+sec.key);
    if(comp){
      if(majorIds.length){ comp.textContent='comp '+calculateGroupCompetency(majorIds, state).toFixed(1)+'/4'; comp.style.display=''; }
      else comp.style.display='none';
    }
  });
}
function renderCapStrip(){
  const el=document.getElementById('capstrip'); if(!el) return;
  const state = getState();
  const profile = calculateCapabilityProfile(state, ITEMS);
  // Before anything has been rated, every real category still has tagged units (pct computes
  // to 0, never null — only an untagged category would read null), so checking `pct!==null`
  // here would never actually detect "nothing rated yet" for the real dataset. assessedDims is
  // the direct signal: has any competency dimension on any active major unit been rated at all.
  // Hide the whole strip until it has — six gray/zero chips are pure noise on a first visit —
  // and it reappears on its own the moment the first rating happens (this re-runs on every
  // state change via updateAllMetrics()).
  const anyData = calculateCompetencyDevelopment(state, ITEMS).assessedDims > 0;
  el.classList.toggle('empty', !anyData);
  if(!anyData){ el.innerHTML=''; return; }
  el.innerHTML = CAPABILITY_CATEGORIES.map(cat=>{
    const d=profile[cat], label=CAPABILITY_LABELS[cat], riCls=cat==='research_independence'?' ri':'';
    if(!d||d.pct===null||d.count===0) return '<div class="capchip nodata'+riCls+'"><span class="cc-label">'+label+'</span><span class="cc-pct">no data</span></div>';
    return '<div class="capchip'+riCls+'"><span class="cc-label">'+label+'</span><div class="cc-bar"><i style="width:'+d.pct+'%"></i></div><span class="cc-pct">'+d.pct+'%</span></div>';
  }).join('');
}
function updateAllMetrics(){ updateProgress(); renderCapStrip(); refreshActivePage(); }

/* ---------- page navigation (Curriculum / Research / Dashboard / Gates / Frontier) ---------- */
const PAGE_RENDERERS = {
  research: renderResearchPage, dashboard: renderDashboardPage,
  gates: renderGatesPage, frontier: renderFrontierPage
};
function switchView(view){
  currentView = view;
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hide'));
  const target = document.getElementById('page-'+view);
  if(target) target.classList.remove('hide');
  document.querySelectorAll('.pagetab').forEach(b=>b.classList.toggle('on', b.dataset.view===view));
  // The search box, filter chips, phase quick-nav and "Expand all" only do anything on the
  // Curriculum tab — .curriculum-only elements are hidden via CSS on every other tab so the bar
  // isn't showing controls that have no effect on the page you're looking at.
  document.querySelector('.bar').classList.toggle('view-curriculum', view==='curriculum');
  refreshActivePage();
}
function refreshActivePage(){
  const fn = PAGE_RENDERERS[currentView];
  if(typeof fn==='function') fn();
}

/* ---------- filters ---------- */
function setFilter(f,el){ curFilter=f; document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on')); el.classList.add('on'); applyFilters(); }
function applyFilters(){
  curQuery=document.getElementById('q').value.trim().toLowerCase();
  const searching = curQuery.length>0;
  // sectionOpen lives in ui/render-curriculum.js; imported dynamically below to avoid a
  // module-load-order cycle (render-curriculum imports applyFilters from this file).
  if(searching){ SECTIONS.forEach(s=>document.getElementById('sec-'+s.key).classList.remove('collapsed')); }
  else { SECTIONS.forEach(s=>document.getElementById('sec-'+s.key).classList.toggle('collapsed',!sectionOpenRef()[s.key])); }
  let anyVisible=false;
  document.querySelectorAll('.item').forEach(row=>{
    const tp=row.dataset.type, txt=row.dataset.text, id=row.dataset.id, major=row.dataset.major==='1';
    let ok=true;
    if(curFilter==='todo') ok=!isComplete(id, getState());
    else if(curFilter==='major') ok=major;
    else if(curFilter!=='all') ok=(tp===curFilter);
    if(ok&&curQuery) ok=txt.indexOf(curQuery)!==-1;
    row.classList.toggle('hide',!ok); if(ok) anyVisible=true;
  });
  document.querySelectorAll('.items').forEach(box=>{
    const vis=[...box.querySelectorAll('.item')].some(r=>!r.classList.contains('hide'));
    box.style.display=vis?'':'none';
    const lbl=box.previousElementSibling; if(lbl&&lbl.classList.contains('grp-label')) lbl.style.display=vis?'':'none';
  });
  document.querySelectorAll('.sec').forEach(sec=>{
    const vis=[...sec.querySelectorAll('.item')].some(r=>!r.classList.contains('hide'));
    sec.style.display=(vis||(!searching&&curFilter==='all'))?'':'none';
  });
  document.getElementById('empty').style.display=anyVisible?'none':'block';
}
// Lazily resolved to sidestep the render-curriculum.js <-> render-shared.js import cycle
// (both need something from the other); set once by ui/render-curriculum.js at load time.
let sectionOpenRef = () => ({});
function registerSectionOpen(getter){ sectionOpenRef = getter; }

/* ---------- diagnostics ---------- */
function toggleDiag(){
  const el=document.getElementById('diag'); el.classList.toggle('show');
  if(!el.classList.contains('show')) return;
  const r=runIntegrity(ITEMS, SECTIONS), inner=document.getElementById('diagInner');
  let h='<h4>Integrity check — '+r.total+' items</h4>';
  if(!r.issues.length) h+='<p class="ok">✓ No structural issues: no duplicate IDs, all sections valid & populated, all types known, no malformed URLs.</p>';
  else h+='<p class="warn">'+r.issues.length+' issue(s):</p><ul>'+r.issues.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul>';
  if(r.info.length) h+='<p style="color:var(--muted)">'+r.info.map(x=>'· '+escapeHtml(x)).join('<br>')+'</p>';
  if(r.verify.length) h+='<p style="color:var(--amber)">⚠ '+r.verify.length+' item(s) flagged for verification (open & confirm before citing): '+r.verify.join(', ')+'</p>';
  const capNotes = runCapabilityDiagnostics(getState(), ITEMS, SECTIONS);
  h += '<h4 style="margin-top:1rem">Capability diagnostics</h4>';
  if(!capNotes.length) h += '<p class="ok">✓ No capability-tracking flags right now.</p>';
  else h += '<ul>'+capNotes.map(x=>'<li class="warn" style="color:var(--frontier)">'+escapeHtml(x)+'</li>').join('')+'</ul>';
  inner.innerHTML=h;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2400); }

/* ---------- import trigger (the actual file read lives in import-export.js) ---------- */
function triggerImport(){ document.getElementById('importFile').click(); }

/* ---------- keyboard accessibility ---------- */
// Every custom clickable element (a <div>/<span> with an onclick, not a real <button>/<a>) gets
// tabindex+role="button" plus a keydown handler that fires the element's own click handler via
// el.click() on Enter/Space — so existing click logic is reused verbatim, never duplicated.
// Elements built as HTML strings (rq-top, fr-top, .expander) get the equivalent inline:
// tabindex="0" role="button" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
function makeKeyboardActivatable(el){
  el.tabIndex = 0;
  el.setAttribute('role','button');
  el.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); el.click(); }
  });
}

/* ---------- confirm dialog (replaces the native confirm() for destructive actions) ---------- */
let pendingConfirm = null;
function confirmDialog(message, onConfirm){
  pendingConfirm = onConfirm;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmModal').classList.add('show');
}
function confirmDialogYes(){
  const fn = pendingConfirm; pendingConfirm = null;
  document.getElementById('confirmModal').classList.remove('show');
  if(typeof fn==='function') fn();
}
function confirmDialogNo(){
  pendingConfirm = null;
  document.getElementById('confirmModal').classList.remove('show');
}

export {
  getCurFilter, getCurQuery, registerSectionOpen,
  updateProgress, renderCapStrip, updateAllMetrics,
  switchView, refreshActivePage,
  setFilter, applyFilters,
  toggleDiag, toast, triggerImport,
  makeKeyboardActivatable, confirmDialog, confirmDialogYes, confirmDialogNo,
};
