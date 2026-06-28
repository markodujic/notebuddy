/**
 * Music-Domain Barrel (framework-neutral).
 */

// Frequenz-Mapping
export {
    A4_FREQUENCY,
    A4_MIDI,
    analyzeFrequency, CENTS_PER_SEMITONE, centsBetween,
    centsOffFromNearestNote, frequencyToMidi,
    getPitchDirection,
    matchesNote,
    midiToFrequency,
    SEMITONES_PER_OCTAVE
} from './frequency';
export type { FrequencyAnalysis, PitchDirection } from './frequency';

// Note-Modell
export {
    BLACK_KEY_INDICES,
    isBlackKey,
    isNaturalNote,
    MIDDLE_C_MIDI,
    midiToOctave,
    NATURAL_NOTE_INDICES,
    Note,
    NOTE_INDEX,
    PIANO_MAX_MIDI,
    PIANO_MIN_MIDI
} from './note';

// Range-Modell
export {
    BASS_DEFAULT_RANGE,
    clampRange,
    contains,
    createRange,
    DEFAULT_RANGE,
    expandRange,
    getAllMidi,
    getAllMidiFiltered,
    getMaxNote,
    getMinNote,
    getRandomMidi,
    isBlackKeyInRange,
    noteCount,
    TREBLE_DEFAULT_RANGE
} from './range';
export type { Range } from './range';

// Staff-Position
export {
    getMidiForPosition,
    getNoteStaffPosition,
    getValidVisualizationNotes,
    parseStaffPosition,
    positionsMatch,
    STAFF_LINES,
    STAFF_SPACES
} from './staff-position';
export type {
    Clef,
    LedgerDirection,
    StaffPosition,
    StaffPositionInfo,
    StaffPositionType
} from './staff-position';

// Notation
export * from './notation';
