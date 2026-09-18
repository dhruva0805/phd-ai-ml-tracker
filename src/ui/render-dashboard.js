// The Dashboard tab: capability profile, research output/pipeline/evidence tiles, T-shaped
// expertise shape, gate summary, and the milestone ladder — all rolled up, never collapsed
// into one percentage.
import { ITEMS } from '../data/items/index.js';
import { SECTIONS } from '../data/sections.js';
import {
  CAPABILITY_CATEGORIES, CAPABILITY_LABELS, RESEARCH_ACTIVITY_CATEGORIES, GATES,
  GATE_STATUS_LABELS, MILESTONE_LEVELS,
} from '../constants.js';
import { escapeHtml } from '../util.js';
import { getState, getSpecializationRole, gateStatus, gatePassed } from '../state.js';
import {
  calculateCapabilityProfile, calculateResearchActivityCounts, calculateResearchQuestionStats,
  calculateEvidenceStrength, calculateMilestoneStage,
} from '../calc.js';

function renderExpertiseShape(){
  const state = getState();
  const tracks = SECTIONS.filter(s=>s.kind==='track');
  const groups = {primary:[], secondary:[], reading:[], not_pursuing:[], '':[]};
  tracks.forEach(t=>{ const r=getSpecializationRole(t.key, state); groups[r].push(t); });
  const order = [['primary','Primary'],['secondary','Secondary'],['reading','Reading literacy'],['','Unset'],['not_pursuing','Not pursuing']];
  return '<div class="shape-col">'+order.map(([key,label])=>{
    const list = groups[key];
    return '<div class="shape-group'+(list.length?'':' empty')+'"><h4>'+label+' ('+list.length+')</h4><ul>'+
      (list.length ? list.map(t=>'<li>'+escapeHtml(t.title.split('—')[0].trim())+'</li>').join('') : '<li>none</li>')+'</ul></div>';
  }).join('')+'</div>';
}
function renderMilestoneLadder(){
  const m = calculateMilestoneStage(getState(), ITEMS);
  const rungs = m.results.map(r=>{
    const cls = r.level.n===m.stage ? 'current' : (r.level.n<m.stage ? 'done' : '');
    const gap = (r.level.n===m.stage+1 && m.nextGap) ? '<div class="rung-gap">Next: '+escapeHtml(m.nextGap)+'</div>' : '';
    return '<div class="rung '+cls+'"><div class="rung-n">'+r.level.n+'</div><div class="rung-body">'+
      '<div class="rung-title">'+escapeHtml(r.level.title)+'</div><div class="rung-exit">'+escapeHtml(r.level.exit)+'</div>'+gap+
      '</div></div>';
  }).join('');
  return '<div class="dboard-sec"><h3>Capability-Based Milestone Ladder</h3>'+
    '<p class="dsub">Computed from competencies, evidence, research activity and gates — never from resource/checkbox completion. Current stage: <b>'+m.stage+' · '+(MILESTONE_LEVELS.find(l=>l.n===m.stage)||{title:'—'}).title+'</b>.</p>'+
    '<div class="ladder">'+rungs+'</div></div>';
}
function renderGatesSummary(){
  const state = getState();
  const rows = GATES.map((g,i)=>{
    const st = gateStatus(g.key, state);
    return '<div class="barrow"><div class="brl">Gate '+(i+1)+' · '+escapeHtml(g.title)+'</div><div class="brv" style="text-align:left;width:auto;">'+GATE_STATUS_LABELS[st]+'</div></div>';
  }).join('');
  const nextUnmet = GATES.find(g=>!gatePassed(g.key, state));
  const callout = nextUnmet ? '<div class="gate-callout">Next unmet gate: <b>'+escapeHtml(nextUnmet.title)+'</b> — see the Gates tab.</div>' : '<div class="gate-callout">All research gates passed.</div>';
  return '<div class="dboard-sec"><h3>Research Gates</h3>'+rows+callout+'</div>';
}
function renderDashboardPage(){
  const body = document.getElementById('dashboardPageBody'); if(!body) return;
  const state = getState();
  const cap = calculateCapabilityProfile(state, ITEMS);
  const capRows = CAPABILITY_CATEGORIES.map(cat=>{
    const d=cap[cat]; const label=CAPABILITY_LABELS[cat];
    if(!d||d.pct===null) return '<div class="barrow"><div class="brl">'+label+'</div><div class="brbar"><i style="width:0%"></i></div><div class="brv">no data</div></div>';
    return '<div class="barrow'+(cat==='research_independence'?' ri':'')+'"><div class="brl">'+label+'</div><div class="brbar"><i style="width:'+d.pct+'%"></i></div><div class="brv">'+d.pct+'%</div></div>';
  }).join('');
  const act = calculateResearchActivityCounts(state);
  const outputTiles = ['reproductions','ablations','memos','peerReviews','talks','publications'].map(k=>{
    const cat = RESEARCH_ACTIVITY_CATEGORIES.find(c=>c.key===k);
    return '<div class="tile accent"><div class="tv">'+act[k]+'</div><div class="tl">'+(cat?cat.label:k)+'</div></div>';
  }).join('');
  const qstats = calculateResearchQuestionStats(state);
  const pipelineTiles =
    '<div class="tile"><div class="tv">'+qstats.open+'</div><div class="tl">Open questions</div></div>'+
    '<div class="tile accent"><div class="tv">'+qstats.active+'</div><div class="tl">Active hypotheses</div></div>'+
    '<div class="tile"><div class="tv">'+(state.researchQuestions.filter(q=>q.status==='experiment_running').length)+'</div><div class="tl">Running experiments</div></div>'+
    '<div class="tile warn"><div class="tv">'+qstats.byStatus.falsified+'</div><div class="tl">Falsified</div></div>'+
    '<div class="tile"><div class="tv">'+qstats.byStatus.inconclusive+'</div><div class="tl">Inconclusive</div></div>';
  const ev = calculateEvidenceStrength(state, ITEMS);
  const evTiles =
    '<div class="tile"><div class="tv">'+ev.self+'</div><div class="tl">Self-assessed</div></div>'+
    '<div class="tile accent"><div class="tv">'+ev.evidenceBacked+'</div><div class="tl">Evidence-backed</div></div>'+
    '<div class="tile good"><div class="tv">'+ev.externallyValidated+'</div><div class="tl">Externally validated</div></div>'+
    '<div class="tile"><div class="tv">'+ev.pct+'%</div><div class="tl">Backed or validated</div></div>';
  body.innerHTML =
    '<div class="dboard-sec"><h3>Capability Profile</h3>'+capRows+'</div>'+
    '<div class="dboard-sec"><h3>Research Output</h3><div class="tilegrid">'+outputTiles+'</div></div>'+
    '<div class="dboard-sec"><h3>Research Pipeline</h3><div class="tilegrid">'+pipelineTiles+'</div></div>'+
    '<div class="dboard-sec"><h3>Evidence Quality</h3><div class="tilegrid">'+evTiles+'</div></div>'+
    '<div class="dboard-sec"><h3>Expertise Shape</h3>'+renderExpertiseShape()+'</div>'+
    renderGatesSummary()+
    renderMilestoneLadder();
}

export { renderDashboardPage };
