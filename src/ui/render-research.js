// The Research tab: Observation -> Question -> Hypothesis -> Experiment -> Result log, plus
// the recurring research-activity counters and cadence targets.
import { RQ_FIELDS, RQ_STATUSES, RQ_STATUS_LABELS, RESEARCH_ACTIVITY_CATEGORIES } from '../constants.js';
import { escapeHtml, genId, todayISO } from '../util.js';
import {
  getState, addResearchQuestion, updateResearchQuestion, deleteResearchQuestion,
  addActivityLogEntry, removeActivityLogEntry, setCadence,
} from '../state.js';
import { calculateResearchQuestionStats, calculateResearchActivityCounts, calculateCadencePace } from '../calc.js';
import { toast, confirmDialog } from './render-shared.js';

let rqFilter = 'all', rqQuery = '', rqOpenId = null;

// See render-curriculum.js's KA constant for what this does and why.
const KA = 'tabindex="0" role="button" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}"';

function rqCard(q){
  const open = rqOpenId===q.id;
  const fields = RQ_FIELDS.map(f=>'<div class="rq-field"><label>'+f.label+'</label><textarea data-rqfield="'+f.key+'" onblur="rqFieldBlur(event,\''+q.id+'\',\''+f.key+'\')">'+escapeHtml(q[f.key]||'')+'</textarea></div>').join('');
  const statusOpts = RQ_STATUSES.map(s=>'<option value="'+s+'"'+(q.status===s?' selected':'')+'>'+RQ_STATUS_LABELS[s]+'</option>').join('');
  return '<div class="rq-card'+(open?' open':'')+'" id="rqcard-'+q.id+'">'+
    '<div class="rq-top" '+KA+' onclick="toggleRqCard(\''+q.id+'\')">'+
      '<span class="rq-status st-'+q.status+'">'+RQ_STATUS_LABELS[q.status]+'</span>'+
      '<span class="rq-q">'+escapeHtml(q.question||q.observation||'(untitled)')+'</span>'+
      '<span class="rq-date">'+escapeHtml((q.updatedAt||q.createdAt||'').slice(0,10))+'</span>'+
    '</div>'+
    '<div class="rq-body">'+
      '<div class="rq-2col"><div class="rq-field"><label>Status</label><select onclick="event.stopPropagation()" onchange="rqSetStatus(\''+q.id+'\',this.value)">'+statusOpts+'</select></div><div></div></div>'+
      fields+
      '<div class="rq-actions"><button class="rq-del" onclick="rqDelete(event,\''+q.id+'\')">Delete</button></div>'+
    '</div>'+
  '</div>';
}
function toggleRqCard(id){ rqOpenId = (rqOpenId===id) ? null : id; renderResearchPage(); }
function rqFieldBlur(e, id, key){ updateResearchQuestion(id, {[key]: e.target.value.slice(0,4000)}); }
function rqSetStatus(id, status){ updateResearchQuestion(id, {status}); renderResearchPage(); }
function rqDelete(e, id){
  e.stopPropagation();
  confirmDialog('Delete this research question entry?', () => { deleteResearchQuestion(id); toast('Deleted'); renderResearchPage(); });
}
function rqNew(){
  const q = {id:genId('rq'), status:'observation', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
  RQ_FIELDS.forEach(f=>q[f.key]='');
  addResearchQuestion(q);
  rqOpenId = q.id;
  renderResearchPage();
}
function rqSetFilter(f){ rqFilter=f; renderResearchPage(); }
function rqSetQuery(v){ rqQuery=v; renderResearchPage(); }
function renderHypothesisLog(){
  const state = getState();
  const stats = calculateResearchQuestionStats(state);
  let list = state.researchQuestions.slice();
  if(rqFilter!=='all') list = list.filter(q=>q.status===rqFilter);
  if(rqQuery.trim()){
    const needle = rqQuery.trim().toLowerCase();
    list = list.filter(q=>RQ_FIELDS.some(f=>(q[f.key]||'').toLowerCase().includes(needle)));
  }
  const filterBtns = ['all'].concat(RQ_STATUSES).map(s=>{
    const label = s==='all'?'All':RQ_STATUS_LABELS[s];
    const count = s==='all'?stats.total:stats.byStatus[s];
    return '<button class="chip'+(rqFilter===s?' on':'')+'" onclick="rqSetFilter(\''+s+'\')">'+label+' ('+count+')</button>';
  }).join('');
  return '<div class="dboard-sec">'+
    '<h3>Research Question / Hypothesis Log</h3>'+
    '<div class="tilegrid" style="margin-bottom:.9rem;">'+
      '<div class="tile"><div class="tv">'+stats.open+'</div><div class="tl">Open questions</div></div>'+
      '<div class="tile accent"><div class="tv">'+stats.active+'</div><div class="tl">Active hypotheses</div></div>'+
      '<div class="tile good"><div class="tv">'+stats.byStatus.supported+'</div><div class="tl">Supported</div></div>'+
      '<div class="tile warn"><div class="tv">'+stats.byStatus.falsified+'</div><div class="tl">Falsified ('+stats.falsificationRate+'%)</div></div>'+
      '<div class="tile"><div class="tv">'+stats.byStatus.inconclusive+'</div><div class="tl">Inconclusive ('+stats.inconclusiveRate+'%)</div></div>'+
      '<div class="tile"><div class="tv">'+stats.byStatus.archived+'</div><div class="tl">Archived</div></div>'+
    '</div>'+
    '<div class="rq-toolbar">'+
      '<input type="text" placeholder="Search questions, hypotheses, results…" value="'+escapeHtml(rqQuery)+'" oninput="rqSetQuery(this.value)">'+
      '<button class="btn" onclick="rqNew()">+ New entry</button>'+
    '</div>'+
    '<div class="rq-statfilter" style="margin-bottom:.8rem;">'+filterBtns+'</div>'+
    (list.length ? list.map(rqCard).join('') : '<p style="color:var(--muted)">No entries'+(rqFilter!=='all'||rqQuery?' match this filter/search.':' yet — start from an observation, not a conclusion.')+'</p>')+
  '</div>';
}

/* ---------- Research page: activity log + cadence ---------- */
function actAdd(catKey){
  const titleEl = document.getElementById('actin-'+catKey);
  const title = ((titleEl&&titleEl.value)||'').trim();
  if(!title){ toast('Add a short title/note first'); return; }
  addActivityLogEntry(catKey, {id:genId('al'), title:title.slice(0,300), date:todayISO()});
  if(titleEl) titleEl.value='';
  renderResearchPage();
  toast('Logged');
}
function actRemove(catKey, entryId){ removeActivityLogEntry(catKey, entryId); renderResearchPage(); }
function actSetCadence(key, value){ setCadence(key, value); renderResearchPage(); }
function renderResearchActivity(){
  const state = getState();
  const counts = calculateResearchActivityCounts(state);
  const cadence = state.researchActivity.cadence;
  const cadenceFields = [
    {key:'paperPerWeek', label:'Papers / week'}, {key:'reconstructionPerMonth', label:'Reconstructions / month'},
    {key:'reproductionPerQuarter', label:'Reproductions / quarter'}, {key:'memoPerQuarter', label:'Memos / quarter'}
  ].map(f=>'<div class="cadence-field"><label>'+f.label+'</label><input type="number" min="0" value="'+cadence[f.key]+'" onchange="actSetCadence(\''+f.key+'\',this.value)"></div>').join('');
  const cards = RESEARCH_ACTIVITY_CATEGORIES.map(cat=>{
    const log = state.researchActivity.log[cat.key]||[];
    const pace = calculateCadencePace(cat.key, state);
    const paceHtml = pace ? '<div class="ac-pace '+(pace.onPace?'on':'off')+'">'+pace.recent+'/'+pace.target+' this '+pace.unit+' · '+(pace.onPace?'on pace':'behind pace')+'</div>' : '';
    const recent = log.slice(0,3).map(e=>'<div>'+escapeHtml(e.date||'')+' — '+escapeHtml(e.title)+' <a href="#" onclick="event.preventDefault();actRemove(\''+cat.key+'\',\''+e.id+'\')" style="color:var(--frontier)">×</a></div>').join('');
    return '<div class="actcard">'+
      '<div class="ac-top"><span class="ac-count">'+counts[cat.key]+'</span><span class="ac-label">'+cat.label+'</span></div>'+
      paceHtml+
      '<div class="ac-recent">'+recent+'</div>'+
      '<div class="ac-add"><input type="text" id="actin-'+cat.key+'" placeholder="What did you log?" onkeydown="if(event.key===\'Enter\'){actAdd(\''+cat.key+'\')}"><button onclick="actAdd(\''+cat.key+'\')">+ Log</button></div>'+
    '</div>';
  }).join('');
  return '<div class="dboard-sec">'+
    '<h3>Research Activity</h3>'+
    '<p class="dsub">Recurring output, logged explicitly. "Hypotheses tested" ('+counts.hypothesesTested+') is derived automatically from the log above, not entered twice.</p>'+
    '<div class="cadence-form">'+cadenceFields+'</div>'+
    '<div class="actgrid">'+cards+'</div>'+
  '</div>';
}
function renderResearchPage(){
  const body = document.getElementById('researchPageBody'); if(!body) return;
  body.innerHTML = renderHypothesisLog() + renderResearchActivity();
}

export {
  toggleRqCard, rqFieldBlur, rqSetStatus, rqDelete, rqNew, rqSetFilter, rqSetQuery,
  actAdd, actRemove, actSetCadence, renderResearchPage,
};
