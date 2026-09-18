// All 249 curriculum items. type: course|book|paper|project|milestone|std|skill
// optional fields: m(meta) u(url) major(bool) seq(pill) cur(curation) verify(bool) detail{}
// Each item's `ph` field references a SECTIONS key (see ../sections.js).
import { CORE_CURRICULUM } from './core-curriculum.js';
import { CORE_MODULES } from './core-modules.js';
import { SPECIALIZATION_TRACKS } from './specialization-tracks.js';
import { OPTIONAL_MODULES } from './optional-modules.js';

const ITEMS = [...CORE_CURRICULUM, ...CORE_MODULES, ...SPECIALIZATION_TRACKS, ...OPTIONAL_MODULES];

export { ITEMS };
