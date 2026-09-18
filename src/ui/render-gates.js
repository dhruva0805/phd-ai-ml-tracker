// The Gates tab: five research checkpoints, each with a status select, notes, and evidence links.
import { GATES, GATE_STATUSES, GATE_STATUS_LABELS } from '../constants.js';
import { escapeHtml } from '../util.js';
import { getState, setGateStatus, setGateNotes, addGateLink, removeGateLink, getGate } from '../state.js';
import { toast } from './render-shared.js';

function gateSetStatusUI(key, status){ setGateStatus(key, status); renderGatesPage(); }
function gateSetNotesUI(e, key){ setGateNotes(key, e.target.value); }
function gateAddLinkUI(key){
  const t=document.getElementById('gl-title-'+key), u=document.getElementById('gl-url-'+key);
  const url=(u&&u.value||'').trim(); if(!url){ toast('Add a URL first'); return; }
  addGateLink(key, (t&&t.value||'').trim(), url);
  if(t) t.value=''; if(u) u.value='';
  renderGatesPage();
}
function gateRemoveLinkUI(key, linkId){ removeGateLink(key, linkId); renderGatesPage(); }
function renderGatesPage(){
  const body = document.getElementById('gatesPageBody'); if(!body) return;
  const state = getState();
  const statusOpts = s0 => GATE_STATUSES.map(s=>'<option value="'+s+'"'+(s0===s?' selected':'')+'>'+GATE_STATUS_LABELS[s]+'</option>').join('');
  body.innerHTML = GATES.map((g,i)=>{
    const gate = getGate(g.key, state);
    const links = gate.links.map(l=>'<div class="gate-link-row">→ <a href="'+escapeHtml(l.url)+'" target="_blank" rel="noopener">'+escapeHtml(l.title)+'</a> <a href="#" onclick="event.preventDefault();gateRemoveLinkUI(\''+g.key+'\',\''+l.id+'\')" style="color:var(--frontier)">×</a></div>').join('');
    return '<div class="gate-card">'+
      '<div class="gc-top"><div><div class="gate-num">Gate '+(i+1)+'</div><h4>'+escapeHtml(g.title)+'</h4></div>'+
        '<select class="gate-status-select gs-'+gate.status+'" onchange="gateSetStatusUI(\''+g.key+'\',this.value)">'+statusOpts(gate.status)+'</select></div>'+
      '<ul class="gate-reqs">'+g.requirements.map(r=>'<li>'+escapeHtml(r)+'</li>').join('')+'</ul>'+
      '<textarea placeholder="Notes — what did you actually do, what would a critical reviewer push back on?" onblur="gateSetNotesUI(event,\''+g.key+'\')">'+escapeHtml(gate.notes)+'</textarea>'+
      '<div class="gate-links">'+links+
        '<div class="gate-addlink"><input type="text" id="gl-title-'+g.key+'" placeholder="Title (optional)"><input type="text" id="gl-url-'+g.key+'" placeholder="Evidence URL"><button onclick="gateAddLinkUI(\''+g.key+'\')">+ Link</button></div>'+
      '</div>'+
    '</div>';
  }).join('');
}

export { gateSetStatusUI, gateSetNotesUI, gateAddLinkUI, gateRemoveLinkUI, renderGatesPage };
