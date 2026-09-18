// The Frontier tab: the self-maintained research radar (topics, why they matter, key papers,
// review cadence) plus the Frontier curriculum module rendered below it.
import { ITEMS } from '../data/items/index.js';
import { SECTIONS } from '../data/sections.js';
import { FRONTIER_STATUSES, FRONTIER_STATUS_LABELS, FRONTIER_CONFIDENCE_LEVELS, FRONTIER_REVIEW_STALE_DAYS } from '../constants.js';
import { escapeHtml, clampLevel } from '../util.js';
import {
  getFrontierTopics, addFrontierTopic, updateFrontierTopic, deleteFrontierTopic,
  markFrontierReviewed, addFrontierKeyPaper, removeFrontierKeyPaper,
  frontierDaysSinceReview, isFrontierStale,
} from '../state.js';
import { toast, confirmDialog } from './render-shared.js';
import { itemRow } from './render-curriculum.js';

// See render-curriculum.js's KA constant for what this does and why.
const KA = 'tabindex="0" role="button" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}"';

let frReviewOnly = false, frOpenId = null;
function frToggleReviewMode(){ frReviewOnly = !frReviewOnly; renderFrontierPage(); }
function frNewTopic(){ const t=addFrontierTopic(); frOpenId=t.id; renderFrontierPage(); }
function frToggleCard(id){ frOpenId = (frOpenId===id) ? null : id; renderFrontierPage(); }
function frDelete(e,id){
  e.stopPropagation();
  confirmDialog('Delete this frontier topic? This cannot be undone.', () => { deleteFrontierTopic(id); toast('Deleted'); renderFrontierPage(); });
}
function frFieldBlur(e,id,key){ updateFrontierTopic(id, {[key]: e.target.value.slice(0, key==='topic'?200:4000)}); }
function frSetStatus(id,status){ if(!FRONTIER_STATUSES.includes(status)) return; updateFrontierTopic(id, {status}); renderFrontierPage(); }
function frSetConfidence(id,level){ updateFrontierTopic(id, {confidence: clampLevel(level)}); renderFrontierPage(); }
function frMarkReviewed(e,id){ e.stopPropagation(); markFrontierReviewed(id); toast('Marked reviewed today'); renderFrontierPage(); }
function frAddPaperUI(id){
  const t=document.getElementById('frp-title-'+id), u=document.getElementById('frp-url-'+id);
  const url=(u&&u.value||'').trim(); if(!url){ toast('Add a URL first'); return; }
  addFrontierKeyPaper(id, (t&&t.value||'').trim(), url);
  if(t) t.value=''; if(u) u.value='';
  renderFrontierPage();
}
function frRemovePaperUI(e,topicId,paperId){ e.stopPropagation(); removeFrontierKeyPaper(topicId,paperId); renderFrontierPage(); }

// A topic's "reviewed X days/months ago" label is always computed relative to today (daysSince),
// never printed as an absolute year — the radar reads the same whether opened this month or years out.
function frReviewLabel(t){
  const d = frontierDaysSinceReview(t);
  if(d===null) return 'Never reviewed';
  if(!t.lastReviewed) return 'Never reviewed · added '+d+'d ago';
  return 'Reviewed '+d+'d ago';
}
function frTopicCard(t){
  const open = frOpenId===t.id, stale = isFrontierStale(t);
  const statusOpts = FRONTIER_STATUSES.map(s=>'<option value="'+s+'"'+(t.status===s?' selected':'')+'>'+FRONTIER_STATUS_LABELS[s]+'</option>').join('');
  const confOpts = FRONTIER_CONFIDENCE_LEVELS.map((l,i)=>'<option value="'+i+'"'+(t.confidence===i?' selected':'')+'>'+l+'</option>').join('');
  const papers = (t.keyPapers||[]).map(p=>'<div class="gate-link-row">→ <a href="'+escapeHtml(p.url)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+escapeHtml(p.title)+'</a> <a href="#" onclick="event.preventDefault();frRemovePaperUI(event,\''+t.id+'\',\''+p.id+'\')" style="color:var(--frontier)">×</a></div>').join('');
  return '<div class="fr-card'+(open?' open':'')+(stale?' stale':'')+'" id="frcard-'+t.id+'">'+
    '<div class="fr-top" '+KA+' onclick="frToggleCard(\''+t.id+'\')">'+
      '<span class="fr-status fs-'+t.status+'">'+FRONTIER_STATUS_LABELS[t.status]+'</span>'+
      '<span class="fr-topic">'+escapeHtml(t.topic||'(untitled topic)')+'</span>'+
      (stale?'<span class="refresh-badge" title="Review cadence is every '+FRONTIER_REVIEW_STALE_DAYS+' days">Review due</span>':'')+
      '<span class="fr-review-date">'+escapeHtml(frReviewLabel(t))+'</span>'+
    '</div>'+
    '<div class="fr-body">'+
      '<div class="rq-2col">'+
        '<div class="rq-field"><label>Topic</label><input type="text" maxlength="200" value="'+escapeHtml(t.topic||'')+'" onclick="event.stopPropagation()" onblur="frFieldBlur(event,\''+t.id+'\',\'topic\')"></div>'+
        '<div class="rq-field"><label>Status</label><select onclick="event.stopPropagation()" onchange="frSetStatus(\''+t.id+'\',this.value)">'+statusOpts+'</select></div>'+
      '</div>'+
      '<div class="rq-field"><label>Why it matters</label><textarea onclick="event.stopPropagation()" onblur="frFieldBlur(event,\''+t.id+'\',\'why\')">'+escapeHtml(t.why||'')+'</textarea></div>'+
      '<div class="rq-2col">'+
        '<div class="rq-field"><label>Confidence / relevance</label><select onclick="event.stopPropagation()" onchange="frSetConfidence(\''+t.id+'\',this.value)">'+confOpts+'</select></div>'+
        '<div class="rq-field"><label>Date added</label><input type="text" value="'+escapeHtml(t.dateAdded||'')+'" disabled></div>'+
      '</div>'+
      '<div class="rq-field"><label>Key papers</label><div class="gate-links">'+papers+
        '<div class="gate-addlink"><input type="text" id="frp-title-'+t.id+'" placeholder="Title (optional)" onclick="event.stopPropagation()"><input type="text" id="frp-url-'+t.id+'" placeholder="URL" onclick="event.stopPropagation()"><button onclick="event.stopPropagation();frAddPaperUI(\''+t.id+'\')">+ Paper</button></div>'+
      '</div></div>'+
      '<div class="rq-actions"><button class="btn" onclick="frMarkReviewed(event,\''+t.id+'\')">Mark reviewed today</button><button class="rq-del" onclick="frDelete(event,\''+t.id+'\')">Delete</button></div>'+
    '</div>'+
  '</div>';
}
function renderFrontierRadar(){
  const all = getFrontierTopics();
  const staleCount = all.filter(isFrontierStale).length;
  let list = (frReviewOnly ? all.filter(isFrontierStale) : all).slice();
  list.sort((a,b)=>(frontierDaysSinceReview(b)||0)-(frontierDaysSinceReview(a)||0));
  const cards = list.length ? list.map(frTopicCard).join('')
    : '<p style="color:var(--muted)">'+(frReviewOnly?'Nothing overdue for review right now — everything has been reviewed within the last '+FRONTIER_REVIEW_STALE_DAYS+' days.':'No frontier topics tracked yet. Add one below: what it is, why it matters, and the papers that define it right now.')+'</p>';
  return '<div class="dboard-sec">'+
    '<h3>Research Radar</h3>'+
    '<p class="dsub">Your own living list of research fronts — independent of any curriculum content below. Status reflects where a topic sits on its own trajectory (Watching → Emerging → Active research frontier → Maturing, or Archived once it is no longer worth tracking). "Review due" is always relative to today, not tied to any particular year.</p>'+
    '<div class="tilegrid" style="margin-bottom:.9rem;">'+
      '<div class="tile"><div class="tv">'+all.length+'</div><div class="tl">Topics tracked</div></div>'+
      '<div class="tile'+(staleCount?' warn':' good')+'"><div class="tv">'+staleCount+'</div><div class="tl">Due for review</div></div>'+
    '</div>'+
    '<div class="rq-toolbar">'+
      '<button class="btn'+(frReviewOnly?' on':'')+'" onclick="frToggleReviewMode()">'+(frReviewOnly?'Show all topics':'Review frontier topics ('+staleCount+' due)')+'</button>'+
      '<button class="btn" onclick="frNewTopic()">+ New topic</button>'+
    '</div>'+
    cards+
  '</div>';
}
function renderFrontierPage(){
  const body = document.getElementById('frontierPageBody'); if(!body) return;
  const frSec = SECTIONS.find(s=>s.key==='fr');
  let html = renderFrontierRadar();
  if(frSec){
    const items = ITEMS.filter(i=>i.ph==='fr');
    const box = document.createElement('div'); box.className='items';
    items.forEach(it=>box.appendChild(itemRow(it)));
    html += '<div class="dboard-sec"><h3>Frontier curriculum</h3><p class="sec-goal">'+frSec.goal+'</p></div>';
    body.innerHTML = html;
    body.appendChild(box);
  } else {
    body.innerHTML = html;
  }
}

export {
  frToggleReviewMode, frNewTopic, frToggleCard, frDelete, frFieldBlur, frSetStatus,
  frSetConfidence, frMarkReviewed, frAddPaperUI, frRemovePaperUI, renderFrontierPage,
};
