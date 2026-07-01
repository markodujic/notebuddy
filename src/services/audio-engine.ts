/**
 * Audio-Engine – Pitch-Detection-Pipeline (Dispatcher Stufe A/B).
 *
 * Feature-Flag `USE_WORKLET_ENGINE` steuert die Pipeline:
 * - `true`  → Stufe B: `useAudioWorkletEngine` (Reanimated-UI-Thread).
 * - `false` → Stufe A: `useAudioEngineJs` (JS-Thread, Fallback).
 *
 * Beide Engines haben dieselbe Schnittstelle → Aufrufer (Screen) unverändert.
 *
 * Stufe-A-Pipeline (Fallback, JS-Thread):
 *   AudioRecorder (PCM) → RMS-Gate → PitchDetector → SharedValues + onFrame
 */

/* eslint-disable react-hooks/rules-of-hooks -- USE_WORKLET_ENGINE ist eine
   Modul-Konstante (compile-time switch). Der gewählte Hook ist über alle
   Renders stabil → Hook-Reihenfolge bleibt deterministisch. Siehe
   PITCH-DATAFLOW-PLAN.md. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioManager, AudioRecorder } from "react-native-audio-api";

import {
  CLARITY_THRESHOLD,
  RMS_GATE_THRESHOLD,
  VOLUME_EMA_FACTOR,
} from "@/domain";
import { useAudioWorkletEngine } from "./audio-worklet-engine";
import {
  DEFAULT_BUFFER_SIZE,
  MacLeodPitchDetector,
  calculateRMS,
} from "./pitch-detector";
import type { PitchSharedValuesApi } from "./pitch-shared-values";
import { type PitchFrame, emaSmooth } from "./pitch-utils";

/** Callback für jeden verarbeiteten Pitch-Frame (Diskret-Logik, selten). */
export type AudioEngineCallback = (frame: PitchFrame) => void;

/** Status der Audio-Engine. */
export type AudioEngineStatus = "idle" | "requesting" | "streaming" | "error";

/** Fehler-Callback. */
export type AudioEngineErrorCallback = (error: Error) => void;

/**
 * Feature-Flag: Stufe B (Worklet auf Reanimated-UI-Thread) aktivieren.
 *
 * - `true`  → `useAudioWorkletEngine` (UI-Thread, entlastet JS-Thread).
 * - `false` → `useAudioEngineJs` (JS-Thread, Stufe-A-Fallback).
 *
 * Stufe C (`AudioRuntime`) ist nicht kompatibel mit Reanimated-SharedValues,
 * daher verwenden wir Stufe B (`UIRuntime`). Siehe PITCH-DATAFLOW-PLAN.md.
 */
export const USE_WORKLET_ENGINE = true;

/**
 * Audio-Engine Dispatcher – wählt Stufe A oder B basierend auf Feature-Flag.
 *
 * Beide Engines haben dieselbe Rückgabe-Schnittstelle → Aufrufer unverändert.
 */
export function useAudioEngine(
  values: PitchSharedValuesApi,
  onFrame?: AudioEngineCallback,
  onError?: AudioEngineErrorCallback,
) {
  // USE_WORKLET_ENGINE ist eine Modul-Konstante → der gewählte Hook ist über
  // alle Renders stabil. Die ternary verletzt also nicht die Rules-of-Hooks
  // (Hook-Reihenfolge bleibt deterministisch).
  return USE_WORKLET_ENGINE
    ? useAudioWorkletEngine(values, onFrame, onError)
    : useAudioEngineJs(values, onFrame, onError);
}

/**
 * Stufe-A Audio-Engine: Real-time Pitch-Detection auf dem JS-Thread (Fallback).
 *
 * Schreibt kontinuierliche Werte in `values` (SharedValues) – kein Re-Render.
 * Verwendet ausschließlich die gekapselten Setter → React-Compiler-kompatibel.
 * `onFrame` wird optional für Diskret-Logik aufgerufen.
 *
 * @param values   SharedValues-API (lesen + gekapselte Setter).
 * @param onFrame  Optionaler Callback für Diskret-Logik (Stability etc.).
 * @param onError  Optionaler Fehler-Callback.
 */
function useAudioEngineJs(
  values: PitchSharedValuesApi,
  onFrame?: AudioEngineCallback,
  onError?: AudioEngineErrorCallback,
) {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const detectorRef = useRef<MacLeodPitchDetector | null>(null);
  const volumeEmaRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const sampleRateRef = useRef(44100);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  /**
   * Verarbeitet rohe PCM-Samples: RMS → Pitch-Detection → SharedValues + onFrame.
   *
   * Kontinuierliche Werte gehen über den gekapselten Setter `setFrame` in die
   * SharedValues (UI-Thread liest direkt, 0 Re-Renders).
   * `onFrame` (falls vorhanden) wird für Diskret-Logik aufgerufen.
   */
  const processSamples = useCallback(
    (samples: Float32Array, sampleRate: number, timestamp: number) => {
      try {
        sampleRateRef.current = sampleRate;
        const rms = calculateRMS(samples);
        volumeEmaRef.current = emaSmooth(
          volumeEmaRef.current,
          rms,
          VOLUME_EMA_FACTOR,
        );

        const silenceFrame: PitchFrame = {
          frequency: 0,
          clarity: 0,
          rms: volumeEmaRef.current,
          timestamp,
        };

        if (rms < RMS_GATE_THRESHOLD) {
          // Stille → gekapselter Setter (React-Compiler-safe)
          values.setFrame(silenceFrame);
          onFrameRef.current?.(silenceFrame);
          return;
        }

        if (!detectorRef.current) {
          detectorRef.current = new MacLeodPitchDetector(
            DEFAULT_BUFFER_SIZE,
            sampleRate,
          );
        }

        const result = detectorRef.current.getPitch(samples);
        const passesGate = result.clarity >= CLARITY_THRESHOLD;
        // Filter: Nur Frequenzen im musikalisch nutzbaren Bereich akzeptieren
        // (verwirft Subharmonische Artefakte wie ~21Hz und Ultraschall).
        const frequency =
          passesGate && result.frequency >= 50 && result.frequency <= 2000
            ? result.frequency
            : 0;

        // Kontinuierliche Werte → gekapselter Setter (UI-Thread, 0 Re-Renders)
        const frame: PitchFrame = {
          frequency,
          clarity: result.clarity,
          rms: volumeEmaRef.current,
          timestamp,
        };
        values.setFrame(frame);

        // Diskret-Logik (Stability etc.) – Aufrufer entscheidet über Kommunikation
        onFrameRef.current?.(frame);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onErrorRef.current?.(error);
      }
    },
    [values],
  );

  // Recorder erst beim Start erstellen (Lazy Init)
  const ensureRecorder = useCallback(() => {
    if (!recorderRef.current) {
      const recorder = new AudioRecorder();

      recorder.onAudioReady(
        {
          sampleRate: 44100,
          bufferLength: DEFAULT_BUFFER_SIZE,
          channelCount: 1,
        },
        (event) => {
          const samples = event.buffer.getChannelData(0);
          // event.when kann auf manchen Plattformen undefined/NaN sein.
          // Fallback auf performance.now() (monoton, ms).
          const ts =
            typeof event.when === "number" && !Number.isNaN(event.when)
              ? event.when
              : performance.now();
          processSamples(samples, event.buffer.sampleRate, ts);
        },
      );

      recorder.onError((error) => {
        onErrorRef.current?.(new Error(error.message));
      });

      recorderRef.current = recorder;
    }
    return recorderRef.current;
  }, [processSamples]);

  /**
   * Fordert Mikrofon-Berechtigung an, konfiguriert Audio-Session und startet die Aufnahme.
   */
  const startListening = useCallback(async () => {
    try {
      // 1. Berechtigung anfordern
      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== "Granted") {
        onErrorRef.current?.(new Error("Mikrofon-Berechtigung verweigert"));
        return;
      }

      // 2. Audio-Session konfigurieren (iOS)
      // WICHTIG: playAndRecord für Aufnahme + ggf. Wiedergabe
      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "measurement",
        iosOptions: ["defaultToSpeaker", "allowBluetoothA2DP"],
        iosNotifyOthersOnDeactivation: true,
      });

      // 3. Recorder erstellen und starten
      const recorder = ensureRecorder();
      volumeEmaRef.current = 0;
      recorder.start();
      setIsStreaming(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onErrorRef.current?.(error);
    }
  }, [ensureRecorder]);

  /**
   * Stoppt die Aufnahme.
   */
  const stopListening = useCallback(() => {
    try {
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.stop();
      }
    } catch {
      // Ignorieren
    }
    volumeEmaRef.current = 0;
    setIsStreaming(false);
  }, []);

  /**
   * Setzt den Pitch-Detector zurück.
   */
  const resetDetector = useCallback(() => {
    detectorRef.current = null;
    volumeEmaRef.current = 0;
  }, []);

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.isRecording()) {
          recorderRef.current.stop();
        }
        recorderRef.current?.clearOnAudioReady();
      } catch {
        // Ignorieren
      }
    };
  }, []);

  // WICHTIG: Rückgabe memoisieren! Consumer haben Cleanup-Effekte wie
  // `useEffect(() => () => audio.stopListening(), [audio])`. Ohne useMemo wäre
  // `audio` bei jedem Render eine neue Referenz → Cleanup feuert bei jedem Render
  // → Mikrofon wird sofort wieder gestoppt (Bug: "Mikro geht nach ~2s aus").
  return useMemo(
    () => ({
      startListening,
      stopListening,
      resetDetector,
      isStreaming,
    }),
    [startListening, stopListening, resetDetector, isStreaming],
  );
}
