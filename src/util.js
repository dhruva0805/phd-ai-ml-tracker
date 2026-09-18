// Pure, dependency-free helpers used throughout the app.

function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function genId(prefix){ return prefix+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function clampLevel(v){ v=Number(v); if(!Number.isFinite(v)) return 0; return Math.max(0,Math.min(4,Math.round(v))); }
// Date helpers used throughout Phase D (frontier review cadence, competency freshness).
// Deliberately relative ("N days ago") everywhere in the UI — never a hardcoded calendar year —
// so the tracker keeps making sense whenever it's opened, this year or a decade from now.
function todayISO(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function daysSince(dateStr){
  if(!dateStr || typeof dateStr!=='string') return null;
  const t = new Date(dateStr.length<=10 ? dateStr+'T00:00:00' : dateStr).getTime();
  if(!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now()-t)/86400000));
}

export { escapeHtml, genId, clampLevel, todayISO, daysSince };
