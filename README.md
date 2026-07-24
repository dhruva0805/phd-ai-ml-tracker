# PhD-Level AI / ML / GenAI Expertise Tracker (v1.0.0)

A self-contained, browser-based curriculum tracker for building **research-scientist depth** in AI, machine learning, and generative models.

Open [`index.html`](index.html) in any modern browser — no build step, server, or dependencies.

## What it is

A seven-phase core spine plus optional specialization tracks and modules. Every item is checkable and linked. Major learning units expand to show rationale, prerequisites, key topics, mastery checks, and a required artifact.

Progress is meant to reflect real mastery, not just “watched it.”

## Features

- **Four progress states** for major units: Not started → In progress → Done → Mastered (simple resources toggle done)
- **Overall + per-section progress** bars (mastered share shown as an overlay on the overall bar)
- **Search and filter** by type / status
- **Collapsible sections** — specialization tracks and modules start collapsed
- **Import / Export / Reset** — back up progress as a file; import merges or replaces safely
- **Local persistence** — progress is stored in the browser’s `localStorage` for this page
- **Research Radar** (Frontier tab) — your own structured list of research fronts (topic, why it matters, key papers, status, confidence) with a "review frontier topics" action that surfaces entries you haven't revisited recently — always relative to today, never a fixed year
- **Knowledge decay tracking** — optional last-practiced / last-demonstrated dates on major-unit competencies; a dimension left untouched for a long time is labeled "Needs refresh" without ever erasing the rating itself
- **Capability diagnostics** — specific, numbers-based flags (e.g. lots of papers read but few reproductions, no primary specialization chosen, stale competencies) with an actionable recommendation attached to each one

## Curriculum structure

### Core phases

| Phase | Focus | Typical duration |
|-------|--------|------------------|
| 0 | Diagnostic & prerequisite repair | 1–3 months (parallel with Phase 1) |
| 1 | Mathematical & CS foundations | 6–9 months |
| 2 | Classical & statistical machine learning | 4–6 months |
| 3 | Deep learning — core & beyond | 9–12 months |
| 4 | Reinforcement learning | 4–6 months |
| 5 | Foundation models, LLMs & ML systems | 12–18 months |
| 6 | Increasingly independent research | Ongoing (years 3–7) |

### Core modules

Three mandatory modules that apply across phases rather than sitting inside one: **Experimental Science & Statistical Rigor for ML**, **Evaluation**, and **Research Engineering** (which adds a replication-status tracker — Not attempted / Self reproduced / Independently reproduced / Failed independent reproduction — for reproduction artifacts).

### Specialization tracks & modules

Optional tracks (e.g. advanced RL, probabilistic ML, ML systems, **theoretical machine learning**) and modules such as the **Frontier** rolling reading list (paired with the Research Radar above it on the Frontier tab), **telecom / wireless-AI**, research methodology, qualifying-exam checkpoints, a curated resource index, and a **milestone ladder** of artifacts.

Item types include courses, books, papers, projects, milestones, standards, and skills.

## How to use

1. Open `index.html` locally (double-click or serve the folder with any static file server).
2. Click a row to advance its state.
3. Expand major units for detail and mastery criteria.
4. Use **Export** periodically to back up progress; **Import** to restore on another machine or after clearing site data.
5. **Reset** clears all progress for this tracker in the current browser.

> Progress is tied to this browser and origin. Export before switching devices or clearing storage.

## Tech

Single static HTML file (CSS + JS inline). No framework, no package manager.

## License

Personal learning roadmap / tracker. Use and adapt for your own study path.
