/**
 * Notation-Modul Barrel (framework-neutral).
 */

export { midiToHelmholtz } from './helmholtz';
export {
    DEFAULT_NOTATION_ID,
    getAllNotationIds,
    getAllNotations,
    getDefaultNotation,
    getNotation
} from './registry';
export { englishNotation } from './systems/english';
export { germanNotation } from './systems/german';
export { nordicNotation } from './systems/nordic';
export { solfegeNotation } from './systems/solfege';
export { midiToNoteIndex, midiToScientificOctave } from './types';
export type {
    DisplayOptions,
    NameOptions,
    NotationSystem,
    NotationSystemId
} from './types';
