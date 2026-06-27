/**
 * Audio-Engine – Pitch-Detection-Pipeline auf Basis von react-native-audio-api.
 *
 * ⚠️ Architektur: Audio-Verarbeitung passiert in Refs/Callbacks,
 * NICHT im React-Render-Zyklus. Ergebnisse werden via Callbacks emittiert.
 * Die UI entscheidet selbst, ob/wann sie re-rendert (über Stores/Selektoren).
 *
 * Pipeline:
 *   AudioRecorder (PCM) → RMS-Gate → PitchDetector → Callback
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import {
  CLARITY_THRESHOLD,
  RMS_GATE_THRESHOLD,
  VOLUME_EMA_FACTOR,
} from '@/domain';
import { DEFAULT_BUFFER_SIZE, MacLeodPitchDetector, calculateRMS } from './pitch-detector';
import { type PitchFrame, emaSmooth } from './pitch-utils';

/** Callback für jeden verarbeiteten Pitch-Frame. */
export type AudioEngineCallback = (frame: PitchFrame) => void;

/** Status der Audio-Engine. */
export type AudioEngineStatus = 'idle' | 'requesting' | 'streaming' | 'error';

/** Fehler-Callback. */
export type AudioEngineErrorCallback = (error: Error) => void;

/**
 * Audio-Engine Hook: Real-time Pitch-Detection aus dem Mikrofon.
 *
 * Audio-Verarbeitung läuft vollständig in Refs – kein Re-Render pro Frame.
 * Ergebnisse werden nur über den `onFrame`-Callback geliefert.
 */
export function useAudioEngine(
  onFrame: AudioEngineCallback,
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
   * Verarbeitet rohe PCM-Samples: RMS → Pitch-Detection → Callback.
   */
  const processSamples = useCallback(
    (samples: Float32Array, sampleRate: number, timestamp: number) => {
      try {
        sampleRateRef.current = sampleRate;
        const rms = calculateRMS(samples);
        volumeEmaRef.current = emaSmooth(volumeEmaRef.current, rms, VOLUME_EMA_FACTOR);

        if (rms < RMS_GATE_THRESHOLD) {
          onFrameRef.current({
            frequency: 0,
            clarity: 0,
            rms: volumeEmaRef.current,
            timestamp: timestamp * 1000,
          });
          return;
        }

        if (!detectorRef.current) {
          detectorRef.current = new MacLeodPitchDetector(DEFAULT_BUFFER_SIZE, sampleRate);
        }

        const result = detectorRef.current.getPitch(samples);
        const passesGate = result.clarity >= CLARITY_THRESHOLD;

        onFrameRef.current({
          frequency: passesGate ? result.frequency : 0,
          clarity: result.clarity,
          rms: volumeEmaRef.current,
          timestamp: timestamp * 1000,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onErrorRef.current?.(error);
      }
    },
    [],
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