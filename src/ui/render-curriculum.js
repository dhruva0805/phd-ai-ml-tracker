// The Curriculum tab: section/item tree, item state cycling, and the competency + evidence
// editor inside each major unit's detail panel.
import { ITEMS } from '../data/items/index.js';
import { SECTIONS } from '../data/sections.js';
import {
  SPEC_ROLES, SPEC_ROLE_LABELS, GROUP_ORDER, GROUP_NAME, TYPE_LABEL, MAJOR_CYCLE,
  COMPETENCY_DIMS, COMPETENCY_LABELS, COMPETENCY_LEVELS, EVIDENCE_TYPES, EXTERNAL_EVIDENCE_TYPES,
  REPLICATION_STATUSES, REPLICATION_STATUS_LABELS, STALE_COMPETENCY_DAYS,
} from '../constants.js';
import { escapeHtml, genId } from '../util.js';
import {
  getState, isComplete, saveState,
  getUnitCompetency, setUnitCompetencyLevel, setUnitCompetencyDate,
  getUnitEvidence, addEvidence, removeEvidence,
  getDimensionSource, sourceLabel, competencyFreshness,
  getReplicationStatus, setReplicationStatus,
  getSpecializationRole, setSpecializationRole,
} from '../state.js';
import { applyFilters, updateAllMetrics, toast, getCurFilter, registerSectionOpen } from './render-shared.js';

let sectionOpen = {}, allExpanded = false;
registerSectionOpen(() => sectionOpen);

function render(){
  const app = document.getElementById('app'), nav = document.getElementById('navjump');
  app.innerHTML=''; nav.innerHTML='';
  SECTIONS.forEach(sec=>{
    if(!(sec.key in sectionOpen)) sectionOpen[sec.key] = !!sec.open;
    const secItems = ITEMS.filter(i=>i.ph===sec.key);
    const a=document.createElement('a'); a.href='#sec-'+sec.key;
    a.textContent = sec.num+' · '+sec.title.split('—')[0].split('(')[0].trim();
    nav.appendChild(a);

    const wrap=document.createElement('section');
    wrap.className='sec'+(sectionOpen[sec.key]?'':' collapsed'); wrap.id='sec-'+sec.key;
    const numCls = sec.cls || (sec.kind==='track'?'track':(sec.kind==='module'?'mod':''));
    const kindLabel = sec.kind==='track'?'<div class="sec-kind spec">Specialization track</div>'
                    : sec.kind==='module'?'<div class="sec-kind module'+(sec.core?' core':'')+'">'+(sec.core?'Core module — required':'Module')+'</div>':'';
    const roleSelector = sec.kind==='track' ? (()=>{
      const cur = getSpecializationRole(sec.key, getState());
      const opts = [['','— set role —']].concat(SPEC_ROLES.map(r=>[r,SPEC_ROLE_LABELS[r]]))
        .map(([v,l])=>'<option value="'+v+'"'+(cur===v?' selected':'')+'>'+l+'</option>').join('');
      return '<div class="role-select-wrap" onclick="event.stopPropagation()" title="T-shaped expertise: mark this track Primary/Secondary/Reading literacy, or Not pursuing (never penalized)."><select class="role-select'+(cur?' role-'+cur:'')+'" onclick="event.stopPropagation()" onchange="event.stopPropagation(); setSpecializationRole(\''+sec.key+'\',this.value); render();">'+opts+'</select></div>';
    })() : '';
    const head=document.createElement('div'); head.className='sec-head';
    head.innerHTML =
      '<div class="sec-num '+numCls+'">'+sec.num+'</div>'+
      '<div class="sec-titles">'+kindLabel+'<h2>'+sec.title+'</h2><div class="dur">'+sec.dur+'</div></div>'+
      roleSelector+
      '<div class="sec-prog"><div class="sbar"><i id="sfill-'+sec.key+'"></i></div><span class="scount" id="scount-'+sec.key+'"></span><span class="scomp mono" id="scomp-'+sec.key+'" style="display:none" title="Average evidence-weighted competency (0-4) across this section\'s major units"></span></div>'+
      '<span class="chev">▾</span>';
    head.addEventListener('click',()=>toggleSection(sec.key));
    wrap.appendChild(head);

    const body=document.createElement('div'); body.className='sec-body';
    const goal=document.createElement('p'); goal.className='sec-goal'; goal.innerHTML=sec.goal; body.appendChild(goal);

    const renderTypeGroups = (items)=>{
      GROUP_ORDER.forEach(tp=>{
        const g=items.filter(i=>i.type===tp); if(!g.length) return;
        const lbl=document.createElement('div'); lbl.className='grp-label'; lbl.textContent=GROUP_NAME[tp]; body.appendChild(lbl);
        const box=document.createElement('div'); box.className='items';
        g.forEach(it=>box.appendChild(itemRow(it))); body.appendChild(box);
      });
    };
    if(sec.layers && sec.layers.length){
      // Presentational four-layer regrouping (Phase C / Phase 5): items keep their own id/type,
      // `layer` just decides which header they render under. Anything missing a matching layer
      // still renders (ungrouped, at the end) so a mistagged item can never silently disappear.
      sec.layers.forEach(layer=>{
        const layerItems = secItems.filter(i=>i.layer===layer.key); if(!layerItems.length) return;
        const lh=document.createElement('div'); lh.className='layer-head';
        lh.innerHTML='<h4>'+layer.label+'</h4>'+(layer.goal?'<p class="layer-goal">'+layer.goal+'</p>':'');
        body.appendChild(lh);
        renderTypeGroups(layerItems);
      });
      const unlayered = secItems.filter(i=>!sec.layers.some(l=>l.key===i.layer));
      if(unlayered.length) renderTypeGroups(unlayered);
    } else {
      renderTypeGroups(secItems);
    }
    if(sec.exit){ const ex=document.createElement('div'); ex.className='exit'; ex.innerHTML='<b>Exit criteria</b>'+sec.exit; body.appendChild(ex); }
    wrap.appendChild(body); app.appendChild(wrap);
  });
  updateAllMetrics(); applyFilters();
}

function stateClass(id){ const s=getState().itemProgress[id]; if(s==='done') return 's-done'; if(s==='mastered') return 's-mastered'; if(s==='in_progress') return 's-in_progress'; return ''; }

// Compact 6-tick competency visualization shown on every major-unit row (collapsed view).
function renderCompMini(unitId){
  const state = getState();
  const comp = getUnitCompetency(unitId, state);
  return COMPETENCY_DIMS.map(dim=>{
    const level = comp[dim].level, src = getDimensionSource(unitId,dim,state);
    return '<span class="comp-tick lvl-'+level+' src-'+src+'" title="'+escapeHtml(COMPETENCY_LABELS[dim]+': '+COMPETENCY_LEVELS[level]+' ('+sourceLabel(src).toLowerCase()+')')+'"></span>';
  }).join('');
}

function itemRow(it){
  const row=document.createElement('div');
  row.className='item '+stateClass(it.id);
  row.dataset.id=it.id; row.dataset.type=it.type; row.dataset.major=it.major?'1':'0';
  row.dataset.text=(it.t+' '+(it.m||'')+' '+(it.seq||'')+' '+(it.cur||'')).toLowerCase();

  const pills=[]
    .concat(it.major?['<span class="pill major">Major unit</span>']:[])
    .concat(it.cur?['<span class="pill cur '+it.cur+'">'+it.cur+'</span>']:[])
    .concat(it.seq?['<span class="pill seq">'+it.seq+'</span>']:[])
    .concat(it.verify?['<span class="pill verify">⚠ verify</span>']:[]).join('');
  const link=it.u?'<a class="lnk" href="'+it.u+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">open ↗</a>':'';
  const meta=it.m?'<div class="m">'+it.m+'</div>':'';
  const compMini=it.major?'<div class="comp-mini">'+renderCompMini(it.id)+'</div>':'';
  const expander=(it.detail||it.major)?'<span class="expander" onclick="toggleDetail(event,this)">details ⌄</span>':'';
  const replSelect = it.replication ? (()=>{
    const cur = getReplicationStatus(it.id);
    const opts = REPLICATION_STATUSES.map(s=>'<option value="'+s+'"'+(cur===s?' selected':'')+'>'+REPLICATION_STATUS_LABELS[s]+'</option>').join('');
    return '<select class="repl-select repl-'+cur+'" onclick="event.stopPropagation()" onchange="event.stopPropagation(); setReplicationStatus(\''+it.id+'\',this.value); render();" title="Replication status">'+opts+'</select>';
  })() : '';

  const r=document.createElement('div'); r.className='item-row';
  r.innerHTML =
    '<div class="box"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>'+
    '<div class="item-main"><div class="t"><span class="tt">'+it.t+'</span>'+link+' '+pills+'</div>'+meta+compMini+replSelect+'</div>'+
    expander+
    '<span class="badge '+it.type+'">'+TYPE_LABEL[it.type]+'</span>';
  r.addEventListener('click',()=>cycle(it,row));
  row.appendChild(r);

  if(it.detail || it.major){
    const d=document.createElement('div'); d.className='detail';
    const dt=it.detail||{}; let html='';
    if(dt.why){ html+='<h5>Why it matters</h5><p>'+dt.why+'</p>'; }
    if(dt.tech){ html+='<h5>What to understand technically</h5><p>'+dt.tech+'</p>'; }
    if(dt.prereq){ html+='<h5>Prerequisites</h5><p>'+dt.prereq+'</p>'; }
    if(dt.topics&&dt.topics.length){ html+='<h5>Key topics</h5><ul>'+dt.topics.map(x=>'<li>'+x+'</li>').join('')+'</ul>'; }
    if(dt.mastery&&dt.mastery.length){ html+='<h5>Mastery checks — you can…</h5><ul>'+dt.mastery.map(x=>'<li>'+x+'</li>').join('')+'</ul>'; }
    if(dt.after){ html+='<h5>Reproduce · derive · critique</h5><p>'+dt.after+'</p>'; }
    if(dt.artifact){ html+='<h5>Required artifact</h5><div class="arte">'+dt.artifact+'</div>'; }
    if(dt.resources&&dt.resources.length){ html+='<h5>Recommended resources</h5><ul>'+dt.resources.map(x=>'<li>'+(x.u?'<a href="'+x.u+'" target="_blank" rel="noopener">'+x.t+' ↗</a>':x.t)+'</li>').join('')+'</ul>'; }
    if(it.major){
      html+='<h5>Competency <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted)">— six independent dimensions</span></h5>';
      html+='<p class="comp-note">0 = not assessed · 1 = developing · 2 = competent · 3 = strong · 4 = research-ready. Each dimension is tagged self-assessed, evidence-backed, or externally validated based on the evidence you attach below. Last-practiced / last-demonstrated dates are optional — leaving them blank never lowers a rating, but a dimension left unpracticed for a long time is labeled <b>Needs refresh</b> below as a reminder, without erasing the rating itself.</p>';
      html+='<div class="comp-wrap">'+competencySectionInner(it)+'</div>';
      html+='<h5>Evidence</h5>';
      html+='<div class="evid-wrap">'+evidenceSectionInner(it)+'</div>';
    }
    d.innerHTML=html; row.appendChild(d);
  }
  return row;
}

function cycle(it,row){
  const state = getState();
  const id=it.id, cur=state.itemProgress[id];
  let next;
  if(it.major){ const idx=[undefined,'in_progress','done','mastered'].indexOf(cur); next=MAJOR_CYCLE[Math.max(0,idx)]; }
  else { next = isComplete(id, state)?null:'done'; }
  if(next===null||next===undefined) delete state.itemProgress[id]; else state.itemProgress[id]=next;
  row.className='item '+stateClass(id)+(row.classList.contains('open')?' open':'');
  saveState(); updateAllMetrics();
  if(getCurFilter()==='todo') applyFilters();
}

function toggleDetail(e,el){ e.stopPropagation(); el.closest('.item').classList.toggle('open'); }

function toggleSection(key){ sectionOpen[key]=!sectionOpen[key]; document.getElementById('sec-'+key).classList.toggle('collapsed',!sectionOpen[key]); }

function toggleAllSections(){
  allExpanded=!allExpanded;
  SECTIONS.forEach(s=>{ sectionOpen[s.key]=allExpanded; document.getElementById('sec-'+s.key).classList.toggle('collapsed',!allExpanded); });
  const b=document.getElementById('expandBtn'); if(b) b.textContent = allExpanded?'Collapse all':'Expand all';
}

/* ---------- competency + evidence UI (rendered inside major-unit detail panels) ---------- */
function competencySectionInner(it){
  const state = getState();
  const comp = getUnitCompetency(it.id, state);
  let html='';
  COMPETENCY_DIMS.forEach(dim=>{
    const level = comp[dim].level, src = getDimensionSource(it.id,dim,state);
    let btns='';
    for(let l=0;l<=4;l++){
      btns += '<button type="button" class="comp-btn'+(level===l?' active':'')+'" onclick="setCompetency(\''+it.id+'\',\''+dim+'\','+l+')" title="'+escapeHtml(COMPETENCY_LEVELS[l])+'">'+l+'</button>';
    }
    const fresh = competencyFreshness(it.id,dim,state);
    const refreshBadge = fresh.stale ? '<span class="refresh-badge" title="No practice or demonstration recorded in over '+STALE_COMPETENCY_DAYS+' days — mastery rating is unchanged, this is just a reminder to revisit it.">Needs refresh · '+fresh.days+'d</span>' : '';
    const dates = comp[dim];
    const dateInputs = '<div class="comp-dates">'+
      '<label>Last practiced <input type="date" value="'+escapeHtml(dates.lastPracticed||'')+'" onchange="setCompetencyDate(\''+it.id+'\',\''+dim+'\',\'lastPracticed\',this.value)"></label>'+
      '<label>Last demonstrated <input type="date" value="'+escapeHtml(dates.lastDemonstrated||'')+'" onchange="setCompetencyDate(\''+it.id+'\',\''+dim+'\',\'lastDemonstrated\',this.value)"></label>'+
      '</div>';
    html += '<div class="comp-row"><div class="comp-row-label">'+COMPETENCY_LABELS[dim]+'</div>'+
            '<div class="comp-btns">'+btns+'</div>'+
            '<span class="src-tag src-'+src+'">'+sourceLabel(src)+'</span>'+refreshBadge+
            dateInputs+'</div>';
  });
  return html;
}
function evidenceSectionInner(it){
  const list = getUnitEvidence(it.id, getState());
  let html = '<div class="evid-list">';
  if(!list.length){ html += '<p class="evid-empty">No evidence recorded yet — every dimension above is self-assessed only.</p>'; }
  else {
    list.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(ev=>{
      const isExternal = EXTERNAL_EVIDENCE_TYPES.has(ev.type);
      html += '<div class="evid-item'+(isExternal?' ext':'')+'">'+
        '<div class="evid-top"><span class="evid-type">'+escapeHtml(ev.type)+'</span>'+
        '<span class="evid-title">'+escapeHtml(ev.title)+'</span>'+
        (ev.date?'<span class="evid-date">'+escapeHtml(ev.date)+'</span>':'')+
        '<button class="evid-del" onclick="deleteEvidence(event,\''+it.id+'\',\''+ev.id+'\')" title="Remove evidence">✕</button></div>'+
        (ev.url?'<a class="lnk" href="'+escapeHtml(ev.url)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">open ↗</a>':'')+
        (ev.notes?'<p class="evid-notes">'+escapeHtml(ev.notes)+'</p>':'')+
        (ev.competencies&&ev.competencies.length?'<div class="evid-dims">'+ev.competencies.map(d=>'<span class="pill cur">'+escapeHtml(COMPETENCY_LABELS[d]||d)+'</span>').join('')+'</div>':'')+
        '</div>';
    });
  }
  html += '</div>';
  html += '<span class="expander" onclick="toggleEvidenceForm(event,\''+it.id+'\')">+ add evidence</span>';
  html += '<div class="evid-add-form" id="evform-'+it.id+'">'+
    '<input type="text" id="ev-title-'+it.id+'" placeholder="Title (e.g. \'Reproduced ResNet-18 on CIFAR-10\')" maxlength="200">'+
    '<select id="ev-type-'+it.id+'">'+EVIDENCE_TYPES.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('')+'</select>'+
    '<input type="url" id="ev-url-'+it.id+'" placeholder="URL / reference (optional)" maxlength="500">'+
    '<input type="date" id="ev-date-'+it.id+'">'+
    '<textarea id="ev-notes-'+it.id+'" placeholder="Notes (optional)" maxlength="2000"></textarea>'+
    '<div class="evid-dimcheck">'+COMPETENCY_DIMS.map(d=>'<label><input type="checkbox" class="ev-dim" value="'+d+'"> '+COMPETENCY_LABELS[d]+'</label>').join('')+'</div>'+
    '<div class="evid-form-btns"><button class="mbtn-primary" type="button" onclick="submitEvidenceForm(event,\''+it.id+'\')">Save evidence</button>'+
    '<button class="mbtn-ghost" type="button" onclick="toggleEvidenceForm(event,\''+it.id+'\')">Cancel</button></div>'+
    '</div>';
  return html;
}
// Re-renders only the competency+evidence portion of one already-open detail panel, so
// editing never collapses sections or triggers a full-page re-render.
function refreshUnitDetail(unitId){
  const rowEl = document.querySelector('.item[data-id="'+unitId+'"]');
  const it = ITEMS.find(i=>i.id===unitId);
  if(!rowEl || !it) return;
  const compWrap = rowEl.querySelector('.comp-wrap');
  const evidWrap = rowEl.querySelector('.evid-wrap');
  if(compWrap) compWrap.innerHTML = competencySectionInner(it);
  if(evidWrap) evidWrap.innerHTML = evidenceSectionInner(it);
  const miniEl = rowEl.querySelector('.comp-mini');
  if(miniEl) miniEl.innerHTML = renderCompMini(unitId);
  updateAllMetrics();
}
function setCompetency(unitId,dim,level){ setUnitCompetencyLevel(unitId,dim,level); refreshUnitDetail(unitId); }
function setCompetencyDate(unitId,dim,field,value){ setUnitCompetencyDate(unitId,dim,field,value); refreshUnitDetail(unitId); }
function toggleEvidenceForm(e,unitId){ e.stopPropagation(); const f=document.getElementById('evform-'+unitId); if(f) f.classList.toggle('show'); }
function submitEvidenceForm(e,unitId){
  e.stopPropagation();
  const titleEl=document.getElementById('ev-title-'+unitId);
  const title=(titleEl&&titleEl.value||'').trim();
  if(!title){ toast('Evidence needs a title'); return; }
  const type=(document.getElementById('ev-type-'+unitId)||{}).value || EVIDENCE_TYPES[0];
  const url=((document.getElementById('ev-url-'+unitId)||{}).value||'').trim();
  const notes=((document.getElementById('ev-notes-'+unitId)||{}).value||'').trim();
  const date=(document.getElementById('ev-date-'+unitId)||{}).value || new Date().toISOString().slice(0,10);
  const checked=[...document.querySelectorAll('#evform-'+unitId+' .ev-dim:checked')].map(c=>c.value);
  addEvidence(unitId, {id:genId('ev'), title:title.slice(0,200), type, url:url.slice(0,500), notes:notes.slice(0,2000), date, competencies:checked});
  refreshUnitDetail(unitId);
  toast('Evidence added');
}
function deleteEvidence(e,unitId,evidenceId){
  e.stopPropagation();
  if(!confirm('Remove this evidence record?')) return;
  removeEvidence(unitId, evidenceId);
  refreshUnitDetail(unitId);
  toast('Evidence removed');
}

export {
  render, itemRow, toggleAllSections, toggleSection, toggleDetail, cycle,
  setCompetency, setCompetencyDate, toggleEvidenceForm, submitEvidenceForm, deleteEvidence,
};
