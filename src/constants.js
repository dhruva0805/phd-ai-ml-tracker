// Enums, labels and lookup tables shared across the app. Pure data only — see state.js for
// anything that reads or writes the mutable state singleton, and calc.js for the scoring logic
// that consumes these tables.
//
// The one exception: MILESTONE_LEVELS' check() closures call gatePassed/gateStatus from
// state.js at call time (never at module-load time), so this file and state.js import from
// each other. That's safe in ES modules as long as neither side touches the other's bindings
// during its own top-level evaluation — which holds here, since these are only referenced
// inside function bodies that run later.
import { gatePassed, gateStatus } from './state.js';

const TYPE_LABEL = {course:'Course',book:'Book',paper:'Paper',project:'Project',milestone:'Milestone',std:'Standard',skill:'Skill'};
const MAJOR_CYCLE = ['in_progress','done','mastered',null];   // from not-started

// Six independently trackable competency dimensions (request: Understand -> Derive ->
// Implement -> Experiment -> Critique -> Research). Applies only to major:true units.
const COMPETENCY_DIMS = ['understand','derive','implement','experiment','critique','research'];
const COMPETENCY_LABELS = {understand:'Understand',derive:'Derive',implement:'Implement',experiment:'Experiment',critique:'Critique',research:'Research'};
const COMPETENCY_LEVELS = ['Not assessed','Developing','Competent','Strong','Research-ready'];

const EVIDENCE_TYPES = ['Derivation','Implementation','Experiment','Reproduction','Ablation','Research memo','Paper','Peer review','Presentation','External validation'];
// Evidence types strong enough to count as EXTERNALLY VALIDATED rather than merely EVIDENCE-BACKED.
const EXTERNAL_EVIDENCE_TYPES = new Set(['Peer review','External validation']);

// Top-level dashboard capability categories.
const CAPABILITY_CATEGORIES = ['theory','implementation','experimentation','evaluation','systems','research_independence'];
const CAPABILITY_LABELS = {theory:'Theory',implementation:'Implementation',experimentation:'Experimentation',evaluation:'Evaluation',systems:'Systems',research_independence:'Research Independence'};
// Which competency dimension(s) roll up into each tag-based category.
const CATEGORY_DIMENSIONS = {theory:['understand','derive'], implementation:['implement'], experimentation:['experiment'], systems:['implement','experiment'], evaluation:['understand','experiment','critique']};
// Which major units count toward which categories. (Phase C ships the core Evaluation module,
// so 'evaluation' now gets real units below instead of always reading "no data".)
const CAPABILITY_TAGS = {
  'p1-la':['theory'], 'p1-prob':['theory'], 'p1-opt':['theory'], 'p1-info':['theory'],
  'p1-algo':['implementation','systems'], 'p1-os':['systems'], 'p1-net':['systems'],
  'p3-dl':['implementation','theory'], 'p4-rlfound':['implementation','theory'],
  'p5-cs336':['implementation','systems'], 'p5-proj-phenomenon':['experimentation'], 'tg-cs236':['theory','implementation'],
  'tc-neal':['theory'], 'tel-tse':['theory'], 'rm-exp':['experimentation'],
  'es-core':['experimentation'], 'ev-core':['evaluation'], 're-core':['systems'], 're-proj':['systems'], 'tth-core':['theory']
};
// Evidence-tier weighting: a self-assessed level counts for less than an evidence-backed
// or externally-validated one when rolling up into aggregate scores. This is the mechanism
// that stops manual self-rating alone from inflating capability numbers.
const EVIDENCE_TIER_WEIGHT = {self:0.5, evidence:0.85, external:1.0};
// Research Independence uses a stricter weighting: self-assessment barely moves it at all,
// by design (request #14/#24 — resource consumption and self-rating must not read as
// research-readiness). Phase B adds research-activity and gate terms on top of this base.
const RESEARCH_INDEPENDENCE_WEIGHT = {self:0.15, evidence:0.75, external:1.0};

/* =========================================================================
   CONFIG — Phase B: research questions, activity log, gates, roles, milestones
   ========================================================================= */
const RQ_STATUSES = ['observation','question','hypothesis','experiment_designed','experiment_running','supported','falsified','inconclusive','archived'];
const RQ_STATUS_LABELS = {observation:'Observation', question:'Question', hypothesis:'Hypothesis', experiment_designed:'Experiment designed',
  experiment_running:'Experiment running', supported:'Supported', falsified:'Falsified', inconclusive:'Inconclusive', archived:'Archived'};
const RQ_FIELDS = [
  {key:'observation', label:'Observation'}, {key:'question', label:'Research question'}, {key:'hypothesis', label:'Hypothesis'},
  {key:'motivation', label:'Motivation'}, {key:'cheapestExperiment', label:'Cheapest falsifying experiment'},
  {key:'experimentalDesign', label:'Experimental design'}, {key:'result', label:'Result'},
  {key:'updatedBelief', label:'Updated belief'}, {key:'nextQuestion', label:'Next question'}
];
const RQ_RESOLVED_STATUSES = new Set(['supported','falsified','inconclusive']);

// Research activity log categories. Deliberately manual/explicit (request #4: "do not count
// a simple paper-completed checkbox as a deep paper read automatically"). "Hypotheses tested"
// is intentionally NOT a manual log here — it is derived from the Hypothesis Log's resolved
// entries (calculateResearchQuestionStats) so the same event isn't recorded in two places.
const RESEARCH_ACTIVITY_CATEGORIES = [
  {key:'papersDeepRead', label:'Papers deeply read', cadenceKey:'paperPerWeek', cadenceUnit:'week', cadenceDays:7},
  {key:'reconstructions', label:'Paper reconstructions', cadenceKey:'reconstructionPerMonth', cadenceUnit:'month', cadenceDays:30},
  {key:'reproductions', label:'Reproductions completed', cadenceKey:'reproductionPerQuarter', cadenceUnit:'quarter', cadenceDays:91},
  {key:'memos', label:'Research memos written', cadenceKey:'memoPerQuarter', cadenceUnit:'quarter', cadenceDays:91},
  {key:'ablations', label:'Ablations completed'},
  {key:'failedExperiments', label:'Failed experiments recorded'},
  {key:'peerReviews', label:'Peer reviews completed'},
  {key:'talks', label:'Talks delivered'},
  {key:'externalValidations', label:'External validations'},
  {key:'publications', label:'Publications'}
];

const GATES = [
  {key:'gate1', title:'Reproduction Defense', requirements:['Reproduce a published result','Explain discrepancies','Defend methodology']},
  {key:'gate2', title:'Experimental Design Defense', requirements:['Propose a hypothesis','Design falsifying experiments','Identify confounders','Define evaluation before seeing results']},
  {key:'gate3', title:'Research Critique', requirements:['Critique a strong recent paper','Identify its strongest claim','Identify its weakest assumption','Propose the most decisive follow-up experiment']},
  {key:'gate4', title:'Specialization Qualifying Exam', requirements:['Produce a literature map','Present the field','Defend technical questions','Identify open problems']},
  {key:'gate5', title:'Independent Research Proposal', requirements:['Research question','Literature gap','Hypotheses','Experimental plan','Risks','Compute requirements','Evaluation strategy','Expected contribution']}
];
const GATE_STATUSES = ['not_attempted','self_assessed_pass','external_pass','needs_revision'];
const GATE_STATUS_LABELS = {not_attempted:'Not attempted', self_assessed_pass:'Self-assessed pass', external_pass:'External pass', needs_revision:'Needs revision'};

// Phase C — Research Engineering: replication status for items opted in via `replication:true`
// (reproduction projects/milestones). Kept independent of GATE_STATUSES: a gate is a one-time
// defense, replication status tracks the ongoing state of a specific reproduction artifact.
const REPLICATION_STATUSES = ['not_attempted','self_reproduced','independently_reproduced','failed_independent_reproduction'];
const REPLICATION_STATUS_LABELS = {not_attempted:'Not attempted', self_reproduced:'Self reproduced', independently_reproduced:'Independently reproduced', failed_independent_reproduction:'Failed independent reproduction'};

const SPEC_ROLES = ['primary','secondary','reading','not_pursuing'];
const SPEC_ROLE_LABELS = {primary:'Primary', secondary:'Secondary', reading:'Reading literacy', not_pursuing:'Not pursuing'};
const SPEC_ROLE_TARGETS = {primary:'Target: research-frontier depth.', secondary:'Target: collaboration-level depth.', reading:'Target: understand papers and communicate with specialists.', not_pursuing:'Intentionally not being pursued right now — this is not a penalty.'};

/* =========================================================================
   PHASE D — Frontier research radar + competency freshness
   ========================================================================= */
// A frontier topic's status is a trajectory, not a checkbox — it tracks where a research
// front is on its own arc, independent of how much of it you personally have studied.
const FRONTIER_STATUSES = ['watching','emerging','active','maturing','archived'];
const FRONTIER_STATUS_LABELS = {watching:'Watching', emerging:'Emerging', active:'Active research frontier', maturing:'Maturing', archived:'Archived'};
const FRONTIER_CONFIDENCE_LEVELS = ['Not rated','Low','Moderate','High','Very high'];
// Matches the curriculum's own "revisit every quarter" cadence for the Frontier module.
const FRONTIER_REVIEW_STALE_DAYS = 90;

// A competency dimension only becomes "stale" once it has an actual practiced/demonstrated
// date on record and that date has aged past the threshold — an unset date is not a penalty,
// since these fields are explicitly optional. Mastery itself is never touched by this check.
const STALE_COMPETENCY_DAYS = 180;

// Capability-based milestone ladder. Each level's `check(sig, st)` reads only from computed
// signals (competencies+evidence+research activity+gates) — never from raw resource/checkbox
// completion — and returns {pass, gap} so the UI can show exactly what's missing next. `st` is
// the state object to evaluate gates against (defaults to the live singleton at call sites that
// don't need isolation; calc.js passes an explicit one so this stays testable with fixtures).
const MILESTONE_LEVELS = [
  {n:1, key:'apprentice', title:'Apprentice', exit:'Can understand and implement established methods with guidance.',
    check:(sig,st)=>({pass: sig.anyAssessed, gap:'Rate at least one competency dimension on a major unit to establish a baseline.'})},
  {n:2, key:'implementer', title:'Implementer', exit:'Can independently implement established methods without guidance.',
    check:(sig,st)=>({pass: sig.implementBreadth>=3, gap:'Implement competency at Competent+ on '+sig.implementBreadth+' of 3 needed major units.'})},
  {n:3, key:'reproducer', title:'Reproducer', exit:'Can independently reproduce a published claim and explain discrepancies.',
    check:(sig,st)=>({pass: sig.reproductionSignals>=1, gap:'No reproduction evidence or logged reproduction yet — reproduce one published result end to end.'})},
  {n:4, key:'experimentalist', title:'Experimentalist', exit:'Can design controlled experiments, ablations, and uncertainty analysis.',
    check:(sig,st)=>({pass: sig.ablationSignals>=1 && sig.experimentEvidenceBacked, gap:'Needs an ablation (logged or evidenced) plus evidence-backed Experiment competency (currently '+(sig.experimentEvidenceBacked?'ok':'missing')+', '+sig.ablationSignals+' ablation signal(s)).'})},
  {n:5, key:'critic', title:'Critic', exit:'Can identify methodological weaknesses and propose decisive experiments.',
    check:(sig,st)=>({pass: sig.critiqueEvidenceBacked || gatePassed('gate3',st), gap:'Needs evidence-backed Critique competency (Strong+) or a passed Research Critique gate.'})},
  {n:6, key:'synthesizer', title:'Synthesizer', exit:'Can connect multiple research threads into a coherent research landscape.',
    check:(sig,st)=>({pass: sig.literatureMapSignal, gap:'Needs a literature-map/qualifying-exam signal — pass Gate 4 or log 2+ research memos.'})},
  {n:7, key:'researcher', title:'Researcher', exit:'Can formulate and test a genuinely novel hypothesis.',
    check:(sig,st)=>({pass: sig.resolvedHypotheses>=1, gap:'No hypothesis in the Research Question Log has reached Supported/Falsified/Inconclusive yet.'})},
  {n:8, key:'independent_researcher', title:'Independent Researcher', exit:'Can establish and defend a coherent research agenda.',
    check:(sig,st)=>({pass: gatePassed('gate5',st), gap:'Independent Research Proposal (Gate 5) has not been passed yet.'})},
  {n:9, key:'research_leader', title:'Research Leader', exit:'Can identify important problems and guide other researchers.',
    check:(sig,st)=>({pass: gateStatus('gate5',st)==='external_pass' && sig.publications>=1 && sig.externalValidations>=1 && sig.talks>=1,
      gap:'Needs an externally-passed Gate 5, at least one publication, one external validation, and one talk delivered.'})}
];

// Curriculum item type-group rendering order/labels (Curriculum tab groups items by type
// within each section).
const GROUP_ORDER = ['course','book','paper','std','skill','project','milestone'];
const GROUP_NAME = {course:'Courses',book:'Books & textbooks',paper:'Papers',std:'Standards',skill:'Capabilities',project:'Projects & practice',milestone:'Milestones'};

export {
  TYPE_LABEL, MAJOR_CYCLE,
  COMPETENCY_DIMS, COMPETENCY_LABELS, COMPETENCY_LEVELS,
  EVIDENCE_TYPES, EXTERNAL_EVIDENCE_TYPES,
  CAPABILITY_CATEGORIES, CAPABILITY_LABELS, CATEGORY_DIMENSIONS, CAPABILITY_TAGS,
  EVIDENCE_TIER_WEIGHT, RESEARCH_INDEPENDENCE_WEIGHT,
  RQ_STATUSES, RQ_STATUS_LABELS, RQ_FIELDS, RQ_RESOLVED_STATUSES,
  RESEARCH_ACTIVITY_CATEGORIES,
  GATES, GATE_STATUSES, GATE_STATUS_LABELS,
  REPLICATION_STATUSES, REPLICATION_STATUS_LABELS,
  SPEC_ROLES, SPEC_ROLE_LABELS, SPEC_ROLE_TARGETS,
  FRONTIER_STATUSES, FRONTIER_STATUS_LABELS, FRONTIER_CONFIDENCE_LEVELS, FRONTIER_REVIEW_STALE_DAYS,
  STALE_COMPETENCY_DAYS, MILESTONE_LEVELS,
  GROUP_ORDER, GROUP_NAME,
};
