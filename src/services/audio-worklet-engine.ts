/**
 * Audio-Worklet-Engine – Pitch-Detection auf Reanimated-UI-Thread (Stufe B).
 *
 * Vollständiger AudioContext-Graph:
 *   AudioRecorder → RecorderAdapterNode → WorkletNode['UIRuntime']
 *
 * Der Worklet-Callback läuft auf dem **Reanimated-UI-Thread** (nicht JS):
 *   1. RMS berechnen (worklet-safe, inline)
 *   2. MacLeod NSDF + Peaks + Interpolation (via Factory, pre-allocated buffers)
 *   3. Kontinuierliche Werte → SharedValues (direkt `.value =`)
 *   4. Diskrete Events → `runOnJS(onFrame)(...)` (selten, kein Perf-Problem)
 *
 * Stufe B statt C: `AudioRuntime` (fremder nativer Thread) hat keinen
 * Reanimated-Kontext → SharedValue-Schreiben und runOnJS funktionieren dort
 * nicht. `UIRuntime` ist der Reanimated-Thread, wo beides nativ verfügbar ist.
 * Dadurch entlasten wir den JS-Thread (Detection läuft woanders), haben aber
 * weiterhin vollen Zugriff auf die SharedValue-Infrastruktur.
 *
 * Schnittstelle ist identisch zu `useAudioEngine` (Stufe A) → Screen unverändert.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioContext,
  AudioManager,
  AudioRecorder,
} from "react-native-audio-api";
import { runOnJS } from "react-native-reanimated";

import {
  CLARITY_THRESHOLD,
  RMS_GATE_THRESHOLD,
  VOLUME_EMA_FACTOR,
} from "@/domain";

import { createMacLeodWorklet, WORKLET_BUFFER_SIZE } from "./macleod-worklet";
import type { PitchSharedValuesApi } from "./pitch-shared-values";
import type { PitchFrame } from "./pitch-utils";

/** Callback-Typ (identisch zu audio-engine.ts für Drop-in-Kompatibilität). */
export type AudioWorkletEngineCallback = (frame: PitchFrame) => void;

/** Fehler-Callback. */
export type AudioWorkletEngineErrorCallback = (error: Error) => void;

/** Status der Engine. */
export type AudioWorkletEngineStatus =
  | "idle"
  | "requesting"
  | "streaming"
  | "error";

/** Sample-Rate für den AudioContext. */
const SAMPLE_RATE = 44100;

/** Anzahl Stille-Frames bevor Volume-EMA zurückgesetzt wird. */
const SILENCE_FRAME_RESET = 5;

/**
 * Audio-Worklet-Engine Hook: Pitch-Detection auf Reanimated-UI-Thread (Stufe B).
 *
 * Drop-in-Ersatz für `useAudioEngine` (Stufe A) bei aktiviertem Feature-Flag.
 * Gleiche Rückgabe-Schnittstelle: `{ startListening, stopListening, resetDetector, isStreaming }`.
 *
 * @param values   SharedValues-API (lesen + gekapselte Setter).
 * @param onFrame  Optionaler Callback für Diskret-Logik (Stability etc.).
 * @param onError  Optionaler Fehler-Callback.
 */
export function useAudioWorkletEngine(
  values: PitchSharedValuesApi,
  onFrame?: AudioWorkletEngineCallback,
  onError?: AudioWorkletEngineErrorCallback,
) {
  const contextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  /**
   * Startet AudioContext-Graph + Aufnahme.
   *
   * Graph: AudioRecorder → RecorderAdapterNode → WorkletNode['UIRuntime']
   */
  const startListening = useCallback(async () => {
    try {
      // 1. Berechtigung
      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== "Granted") {
        onErrorRef.current?.(new Error("Mikrofon-Berechtigung verweigert"));
        return;
      }

      // 2. Audio-Session (iOS)
      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "measurement",
        iosOptions: ["defaultToSpeaker", "allowBluetoothA2DP"],
        iosNotifyOthersOnDeactivation: true,
      });

      // 3. AudioContext + Graph aufbauen
      const context = new AudioContext({ sampleRate: SAMPLE_RATE });
      contextRef.current = context;

      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      const recorderAdapter = context.createRecorderAdapter();
      const detect = createMacLeodWorklet(WORKLET_BUFFER_SIZE, SAMPLE_RATE);

      // SharedValues für Worklet-Closure (individuelle Referenzen, stabil)
      const { volume, clarity, frequency, detectedMidi } = values;

      // JS-Thread-Handler für Diskret-Events (wird via runOnJS aufgerufen).
      // Setzt timestamp auf JS-Thread (performance.now ist nicht worklet-safe).
      const handleFrameOnJs = (
        frameFrequency: number,
        frameClarity: number,
        frameRms: number,
      ) => {
        const frame: PitchFrame = {
          frequency: frameFrequency,
          clarity: frameClarity,
          rms: frameRms,
          timestamp: performance.now(),
        };
        onFrameRef.current?.(frame);
      };

      // Volume-EMA State (Closure — persistiert über Frames im Worklet)
      let volumeEma = 0;
      let silenceFrameCount = 0;

      // Der Worklet-Callback läuft auf 'UIRuntime' = Reanimated-UI-Thread.
      // 'worklet'-Direktive wird durch makeShareableCloneRecursive ergänzt.
      const workletCallback = (
        audioData: Float32Array[],
        _channelCount: number,
      ) => {
        "worklet";

        const samples = audioData[0]; // mono input
        if (!samples) return;

        // ── RMS berechnen (worklet-safe, inline) ──
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          sum += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sum / samples.length);

        // EMA-Smoothing (worklet-safe, inline — emaSmooth ist nicht als Worklet markiert)
        volumeEma =
          volumeEma * (1 - VOLUME_EMA_FACTOR) + rms * VOLUME_EMA_FACTOR;

        // ── Stille-Pfad ──
        if (rms < RMS_GATE_THRESHOLD) {
          volume.value = Math.min(1, volumeEma / 0.15);
          clarity.value = 0;
          frequency.value = 0;
          detectedMidi.value = -1;

          silenceFrameCount += 1;
          if (silenceFrameCount >= SILENCE_FRAME_RESET) {
            // Stability-Reset Signal an JS-Thread (frequency=0 = Stille)
            runOnJS(handleFrameOnJs)(0, 0, volumeEma);
          }
          return;
        }

        silenceFrameCount = 0;

        // ── Pitch-Detection (MacLeod, rein funktional) ──
        const result = detect(samples);

        // Frequency-Filter: nur musikalisch nutzbarer Bereich
        const passesGate = result.clarity >= CLARITY_THRESHOLD;
        const detectedFrequency =
          passesGate && result.frequency >= 50 && result.frequency <= 2000
            ? result.frequency
            : 0;

        // ── Kontinuierliche Werte → SharedValues (direkt, 0 Re-Renders) ──
        volume.value = Math.min(1, volumeEma / 0.15);
        clarity.value = result.clarity;
        frequency.value = detectedFrequency;
        detectedMidi.value =
          detectedFrequency > 0
            ? Math.round(12 * Math.log2(detectedFrequency / 440) + 69)
            : -1;

        // ── Diskret-Event → JS-Thread (Stability-Tracking etc.) ──
        runOnJS(handleFrameOnJs)(detectedFrequency, result.clarity, volumeEma);
      };

      // WorkletNode erstellen.
      // 'UIRuntime' = Reanimated-UI-Thread (Stufe B). Dort funktionieren
      // SharedValue-Schreibzugriffe und runOnJS nativ, im Gegensatz zum
      // fremden 'AudioRuntime'-Thread, der keinen Reanimated-Kontext hat.
      const workletNode = context.createWorkletNode(
        workletCallback,
        WORKLET_BUFFER_SIZE,
        1, // mono
        "UIRuntime",
      );

      // Graph verbinden: Mic → Adapter → Worklet
      recorder.connect(recorderAdapter);
      recorderAdapter.connect(workletNode);

      // 4. Stream starten
      recorder.start();
      setIsStreaming(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onErrorRef.current?.(error);
    }
  }, [values]);

  /** Stoppt Aufnahme + baut Graph ab. */
  const stopListening = useCallback(() => {
    try {
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.stop();
      }
    } catch {
      // Ignorieren
    }

    // AudioContext auflösen (Ressourcen freigeben)
    try {
      contextRef.current?.close();
    } catch {
      // Ignorieren
    }
    contextRef.current = null;

    setIsStreaming(false);
  }, []);

  /**
   * Reset (kompatibel mit Stufe-A-API, hier weitgehend No-Op da Worklet-Engine
   * keine persistenten JS-Thread-Detector-Refs hält).
   */
  const resetDetector = useCallback(() => {
    // Detector wird beim nächsten startListening neu erstellt.
    // SharedValues-Reset übernimmt der Aufrufer via values.reset().
  }, []);

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.isRecording()) {
          recorderRef.current.stop();
        }
        contextRef.current?.close();
      } catch {
        // Ignorieren
      }
    };
  }, []);

  // Rückgabe memoisieren (gleiche Struktur wie useAudioEngine)
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
