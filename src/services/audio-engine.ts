/**
 * Audio-Engine – Pitch-Detection-Pipeline auf Basis von react-native-audio-api.
 *
 * ⚠️ Architektur (Stufe A, siehe PITCH-DATAFLOW-PLAN.md):
 * Audio-Verarbeitung läuft in Refs (kein React-Render-Zyklus).
 * Kontinuierliche Werte (volume, clarity, frequency, detectedMidi) werden
 * PRO FRAME in SharedValues geschrieben → 0 Re-Renders.
 *
 * Pipeline:
 *   AudioRecorder (PCM) → RMS-Gate → PitchDetector → SharedValues + onFrame
 *
 * Verwendet ausschließlich die gekapselten Setter von `PitchSharedValuesApi`
 * (`setFrame`), niemals direkte `.value`-Mutationen → React-Compiler-kompatibel.
 *
 * Der optionale `onFrame`-Callback ist für seltene Diskret-Logik (z.B.
 * Stability-Tracking + Submit), die ihrerseits nur in SharedValues oder
 * via `runOnJS` kommunizieren sollte – niemals `setState` pro Frame.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import {
  CLARITY_THRESHOLD,
  RMS_GATE_THRESHOLD,
  VOLUME_EMA_FACTOR,
} from '@/domain';
import { DEFAULT_BUFFER_SIZE, MacLeodPitchDetector, calculateRMS } from './pitch-detector';
import type { PitchSharedValuesApi } from './pitch-shared-values';
import { type PitchFrame, emaSmooth } from './pitch-utils';

/** Callback für jeden verarbeiteten Pitch-Frame (Diskret-Logik, selten). */
export type AudioEngineCallback = (frame: PitchFrame) => void;

/** Status der Audio-Engine. */
export type AudioEngineStatus = 'idle' | 'requesting' | 'streaming' | 'error';

/** Fehler-Callback. */
export type AudioEngineErrorCallback = (error: Error) => void;

/**
 * Audio-Engine Hook: Real-time Pitch-Detection aus dem Mikrofon.
 *
 * Schreibt kontinuierliche Werte in `values` (SharedValues) – kein Re-Render.
 * Verwendet ausschließlich die gekapselten Setter → React-Compiler-kompatibel.
 * `onFrame` wird optional für Diskret-Logik aufgerufen.
 *
 * @param values   SharedValues-API (lesen + gekapselte Setter).
 * @param onFrame  Optionaler Callback für Diskret-Logik (Stability etc.).
 * @param onError  Optionaler Fehler-Callback.
 */
export function useAudioEngine(
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
        volumeEmaRef.current = emaSmooth(volumeEmaRef.current, rms, VOLUME_EMA_FACTOR);

        const silenceFrame: PitchFrame = {
          frequency: 0,
          clarity: 0,
          rms: volumeEmaRef.current,
          timestamp: timestamp * 1000,
        };

        if (rms < RMS_GATE_THRESHOLD) {
          // Stille → gekapselter Setter (React-Compiler-safe)
          values.setFrame(silenceFrame);
          onFrameRef.current?.(silenceFrame);
          return;
        }

        if (!detectorRef.current) {
          detectorRef.current = new MacLeodPitchDetector(DEFAULT_BUFFER_SIZE, sampleRate);
        }

        const result = detectorRef.current.getPitch(samples);
        const passesGate = result.clarity >= CLARITY_THRESHOLD;
        const frequency = passesGate ? result.frequency : 0;

        // Kontinuierliche Werte → gekapselter Setter (UI-Thread, 0 Re-Renders)
        const frame: PitchFrame = {
          frequency,
          clarity: result.clarity,
          rms: volumeEmaRef.current,
          timestamp: timestamp * 1000,
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
          processSamples(samples, event.buffer.sampleRate, event.when);
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
      if (permission !== 'Granted') {
        onErrorRef.current?.(new Error('Mikrofon-Berechtigung verweigert'));
        return;
      }

      // 2. Audio-Session konfigurieren (iOS)
      // WICHTIG: playAndRecord für Aufnahme + ggf. Wiedergabe
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'measurement',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
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

  return {
    startListening,
    stopListening,
    resetDetector,
    isStreaming,
  };
}