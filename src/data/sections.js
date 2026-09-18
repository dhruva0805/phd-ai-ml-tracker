// The 21 curriculum sections (7 core phases, 3 core modules, 10 specialization tracks, 6
// optional modules) — headings, goals/exit text, and structural metadata. Items reference
// a section by its `ph` key; see data/items/.

const SECTIONS = [
 {key:'p0', kind:'phase', num:'0', title:'Diagnostic & prerequisite repair', dur:'1–3 months · parallel with Phase 1', open:true,
  goal:"Find and patch holes before they compound. <strong>Skip what you own; drill what you don't.</strong>",
  exit:"No red flags on the self-diagnostic; a from-scratch NumPy backprop notebook on GitHub."},
 {key:'p1', kind:'phase', num:'1', title:'Mathematical & CS foundations', dur:'6–9 months', open:true,
  goal:"Linear algebra, calculus, probability, mathematical statistics, optimization, information theory, and the core CS ML is built on. <strong>Research scientists are separated from engineers here.</strong>",
  exit:"Implement PCA + logistic regression + gradient descent from scratch (derive the gradients); solve a KKT problem by hand; read matrix-calculus & measure-free probability notation fluently."},
 {key:'p2', kind:'phase', num:'2', title:'Classical & statistical machine learning', dur:'4–6 months', open:true,
  goal:"Bias–variance, kernels, ensembles, latent-variable models. The toolkit you reach for when a transformer is the wrong tool — and the language reviewers speak.",
  exit:"Beat a strong baseline on real tabular data with gradient boosting + honest validation; derive & implement EM for a GMM."},
 {key:'p3', kind:'phase', num:'3', title:'Deep learning — core & beyond', dur:'9–12 months', open:true,
  goal:"Autodiff, optimization dynamics, CNNs, sequence models, the attention/transformer bridge. <strong>Highest-leverage move:</strong> build a neural net, then a GPT, from scratch.",
  exit:"A tested nanoGPT-class transformer you trained + a written explanation of every component; reproduce ResNet on CIFAR-10 within tolerance."},
 {key:'p4', kind:'phase', num:'4', title:'Reinforcement learning', dur:'4–6 months', open:true,
  goal:"A first-class taught path, not a link list: bandits → MDPs → dynamic programming → TD → policy gradients → actor-critic → PPO → offline/model-based RL, with the bridge to RLHF and RL-for-reasoning.",
  exit:"Implement a value-based (DQN) and a policy-gradient (PPO) agent from scratch that solve control benchmarks; write up what stabilized training and why."},
 {key:'p5', kind:'phase', num:'5', title:'Foundation models, LLMs & ML systems', dur:'12–18 months', open:true,
  goal:"The current center of gravity. Two parallel tracks: <strong>the model</strong> (build an LLM end-to-end) and <strong>the system</strong> (train & serve it at scale).",
  exit:"Pre-train a small LLM end-to-end then post-train with SFT + DPO; 2× a served model's throughput and explain why; reproduce one scaling-law fit.",
  // Presentational regrouping only (Phase C) — every item below still carries its original id/url;
  // `layer` just changes which of these four headers it renders under.
  layers:[
    {key:'pretrain', label:'Pretraining', goal:"Build the base model: tokenization, architecture, data, and the scaling laws that predict what a training run will cost and yield."},
    {key:'posttrain', label:'Post-training', goal:"Turn a base model into something aligned and useful: supervised fine-tuning, preference optimization, and efficient adaptation."},
    {key:'inference', label:'Inference-time intelligence', goal:"What the model does at serving time: efficient inference, retrieval augmentation, and throughput engineering."},
    {key:'evalsci', label:'Evaluation & science', goal:"Treat the system you built as an object of study — production evaluation practice, plus a required original empirical finding."}
  ]},
 {key:'p6', kind:'phase', num:'6', title:'Increasingly independent research', dur:'Ongoing · years 3–7', open:true,
  goal:"The actual PhD: pick a niche, map its literature, reproduce its SOTA, find the gap, publish. Read → Reconstruct → Reproduce → Ablate → Critique → Synthesize → Hypothesize → Design → Write → Defend.",
  exit:"One reproduction others use; one workshop paper, then a main-conference / top-journal paper; a defensible research opinion."},

 {key:'expsci', kind:'module', num:'Σ', cls:'mod', core:true, title:'Experimental Science & Statistical Rigor for ML', dur:'Core · continuous, applied from Phase 2 onward', open:false,
  goal:"The methodology that separates a real result from a lucky seed. Statistical power, uncertainty, and the discipline to design experiments that could actually falsify your hypothesis — rigor a PhD is expected to bring to every claim, not just the headline ones."},
 {key:'eval', kind:'module', num:'◎', cls:'mod', core:true, title:'Evaluation', dur:'Core · mandatory, builds on Phase 5', open:false,
  goal:"Measuring whether a model actually works — and whether the measurement itself can be trusted. Benchmark construction, contamination, calibration, and the limits of any single number. Turns 'it scored X%' into a defensible claim."},
 {key:'reseng', kind:'module', num:'⚙', cls:'mod', core:true, title:'Research Engineering', dur:'Core · mandatory, applied throughout Phases 3–6', open:false,
  goal:"The infrastructure that makes a result trustworthy and reusable: configs, tracked experiments, versioned data, and a repo someone else can actually run. The difference between a result and a reproducible result."},

 {key:'t-prob', kind:'track', num:'β', title:'Probabilistic & Bayesian ML', dur:'Specialization · parallel', open:false,
  goal:"Kept distinct from the LLM path: probabilistic modeling, Bayesian inference, graphical models, EM, MCMC, variational inference, and uncertainty."},
 {key:'t-gen', kind:'track', num:'∿', title:'Generative modeling', dur:'Specialization · parallel', open:false,
  goal:"The full generative lineage: latent-variable models, VAEs, GANs, autoregressive models, score-based & diffusion models, and flow matching."},
 {key:'t-rl2', kind:'track', num:'⟳', title:'Advanced RL topics', dur:'Specialization · optional after Phase 4', open:false,
  goal:"Depth beyond the core RL phase: model-based RL, offline RL, exploration, distributional RL, multi-agent, and RL for reasoning."},
 {key:'t-graph', kind:'track', num:'◈', title:'Graph machine learning', dur:'Specialization · parallel', open:false,
  goal:"Message passing, graph convolutions, attention on graphs, and scalable representation learning on relational data."},
 {key:'t-mm', kind:'track', num:'◐', title:'Multimodal learning', dur:'Specialization · parallel', open:false,
  goal:"Joint vision–language(–audio) representations, contrastive pretraining, and any-to-any generation."},
 {key:'t-trust', kind:'track', num:'⚖', title:'Evaluation, robustness, interpretability & safety', dur:'Specialization · increasingly core', open:false,
  goal:"Trustworthy AI: rigorous evaluation, calibration & uncertainty, distribution shift, mechanistic interpretability, and alignment. A PhD is expected to evaluate and stress-test, not just train."},
 {key:'t-causal', kind:'track', num:'⇄', title:'Causal inference', dur:'Specialization · parallel', open:false,
  goal:"Causal graphs, interventions, confounding, backdoor adjustment, potential outcomes, identification, and the limits of observational data."},
 {key:'t-sys', kind:'track', num:'▤', title:'ML systems deep-dive', dur:'Specialization · parallel with Phase 5', open:false,
  goal:"Beyond LLM-systems: foundational OS/networks/distributed systems, plus data pipelines, parallelism, kernels, serving, and reliability — measured, not just read."},
 {key:'t-theory', kind:'track', num:'∴', title:'Theoretical machine learning', dur:'Specialization · parallel', open:false,
  goal:"Why generalization happens at all — and why over-parameterized deep nets seem to break the classical story. PAC learning, complexity measures, stability, and scaling/generalization theory. Proof-level fluency, not a reading list: you should be able to reconstruct and defend these results from memory, not just cite them."},
 {key:'t-agent', kind:'track', num:'◆', title:'Agentic AI systems & multi-agent engineering', dur:'Specialization · parallel with Phases 5–6', open:false,
  goal:"Building and evaluating systems where an LLM plans, calls tools, and acts over multiple steps: workflows vs. autonomous agents, MCP, agent Skills, sub-agent orchestration, context engineering, and the failure modes specific to multi-step and multi-agent systems."},

 {key:'fr', kind:'module', num:'★', cls:'fr', title:'Frontier module — rolling reading list', dur:'Rolling · revisit every quarter', open:true,
  goal:"The biggest currency upgrade. A rolling set of live research fronts, refreshed every quarter — <strong>staying current is the job.</strong> Use the Frontier tab's Research Radar above this list to track topics (not just papers) and when you last reviewed each one."},
 {key:'tel', kind:'module', num:'⌘', cls:'tel', title:'Telecom / wireless-AI vertex', dur:'Specialization · parallel with Phases 5–6', open:false,
  goal:"Your differentiator, rebuilt as a real research specialization: communications & wireless foundations → AI applications → standards → surveys → a concrete reproduction."},
 {key:'research', kind:'module', num:'✎', cls:'mod', title:'Research methodology & apprenticeship', dur:'Continuous', open:false,
  goal:"The apparatus that converts study into contribution: the reading protocol, annotated bibliography, reproduction reports, negative-results log, proposal, talks, and peer review."},
 {key:'quals', kind:'module', num:'✓', cls:'ml', title:'Qualifying-exam checkpoint', dur:'Self-administered · end of Phase 5', open:false,
  goal:"Simulate a real PhD gate. For each area, test whether you can derive, prove, implement, analyze, critique and defend — out loud, from memory."},
 {key:'res', kind:'module', num:'§', cls:'res', title:'Curated resource index', dur:'Reference', open:false,
  goal:"Deduplicated hubs — every resource you gathered plus what this curriculum adds. Prefer primary sources; finish one per slot before collecting more."},
 {key:'ml', kind:'module', num:'▲', cls:'ml', title:'The milestone ladder', dur:'Artifacts, not calendar time', open:false,
  goal:"Move to the next rung when you've produced the artifact. Dates are a realistic part-time pace; the artifacts are what matter."}
];

export { SECTIONS };
