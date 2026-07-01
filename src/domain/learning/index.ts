/**
 * Learning-Domain Barrel (framework-neutral).
 */

export {
    CLARITY_THRESHOLD,
    LEARNING_CONFIG,
    RMS_GATE_THRESHOLD,
    SILENCE_GATE_FRAMES,
    TUTORIAL_PITCH_TOLERANCE_SEMITONES,
    TUTORIAL_STABILITY_FRAMES,
    TUTORIAL_WARMUP_MS,
    VOLUME_EMA_FACTOR
} from "./config";

export {
    evaluateFrequency,
    evaluateNote,
    type EvaluationResult,
    type FeedbackType
} from "./evaluator";

export {
    createDefaultSessionConfig,
    Session,
    type Exercise,
    type ExerciseMode,
    type SessionConfig,
    type SessionState
} from "./session";

export { weightedRandom, Weighting, type NoteWeight } from "./weighting";

export {
    ANIMATION_GROUPS,
    ANIMATION_INTERVAL_MS,
    DREIER_GRUPPEN,
    FULL_KEYBOARD_KEY_COUNT,
    FULL_KEYBOARD_MAX_MIDI,
    FULL_KEYBOARD_MIN_MIDI,
    MIC_WARMUP_MS,
    MIN_CLARITY,
    MIN_RMS,
    NOTE_TOLERANCE,
    REQUIRED_STABLE_FRAMES,
    ZWEIER_GRUPPEN
} from "./tutorial-config";

export {
    getClefForNote, RangeFinder, type NoteTestResult, type RangeFinderState
} from "./range-finder";

