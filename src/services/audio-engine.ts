/**
 * Audio-Engine – Pitch-Detection-Pipeline auf Basis von expo-audio.
 *
 * ⚠️ Architektur: Audio-Verarbeitung passiert in Refs/Callbacks,
 * NICHT im React-Render-Zyklus. Ergebnisse werden via Callbacks emittiert.
 * Die UI entscheidet selbst, ob/wann sie re-rendert (über Stores/Selektoren).
 *
 * Pipeline:
 *   AudioStream (PCM) → RMS-Gate → PitchDetector → Callback
 */

import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
} from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

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
 *
 * @param onFrame Callback für jeden Pitch-Frame.
 * @param onError Optionaler Fehler-Callback.
 */
export function useAudioEngine(
  onFrame: AudioEngineCallback,
  onError?: AudioEngineErrorCallback,
) {
  const statusRef = useRef<AudioEngineStatus>('idle');
  const detectorRef = useRef<MacLeodPitchDetector | null>(null);
  const volumeEmaRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const sampleRateRef = useRef(44100);

  // Callbacks in Refs halten, damit der Audio-Stream nicht re-startet
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Buffer-Verarbeitung
  const processBuffer = useCallback(
    (data: ArrayBuffer, sampleRate: number, timestamp: number) => {
      try {
        sampleRateRef.current = sampleRate;
        const samples = new Float32Array(data);
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

  // Audio-Stream erstellen (ohne onBuffer im options-Objekt)
  // Wir registrieren den Listener stattdessen direkt auf dem Stream-Objekt,
  // weil die onBuffer-Option bei SharedObjects nicht zuverlässig funktioniert.
  const { stream } = useAudioStream({
    sampleRate: 44100,
    channels: 1,
    encoding: 'float32',
  });

  // Event-Listener direkt auf dem Stream-Objekt registrieren
  // AudioStream ist ein SharedObject, das 'audioStreamBuffer' Events emittiert.
  useEffect(() => {
    if (!stream) return;

    const subscription = stream.addListener('audioStreamBuffer', (buffer: { data: ArrayBuffer; sampleRate: number; channels: number; timestamp: number }) => {
      processBuffer(buffer.data, buffer.sampleRate, buffer.timestamp);
    });

    return () => {
      subscription?.remove();
    };
  }, [stream, processBuffer]);

  /**
   * Fordert Mikrofon-Berechtigung an, konfiguriert Audio-Modus und startet den Stream.
   */
  const startListening = useCallback(async () => {
    console.log('[AudioEngine] startListening called, stream:', !!stream);
    if (!stream) {
      onErrorRef.current?.(new Error('Audio-Stream nicht verfügbar'));
      return;
    }

    try {
      statusRef.current = 'requesting';

      // 1. Berechtigung anfordern
      const permission = await requestRecordingPermissionsAsync();
      console.log('[AudioEngine] Permission granted:', permission.granted);
      if (!permission.granted) {
        statusRef.current = 'error';
        onErrorRef.current?.(new Error('Mikrofon-Berechtigung verweigert'));
        return;
      }

      // 2. Audio-Modus konfigurieren (wichtig für Mikrofonaufnahme!)
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });

      // 3. Stream starten
      statusRef.current = 'streaming';
      volumeEmaRef.current = 0;
      console.log('[AudioEngine] Starting stream...');
      await stream.start();
      console.log('[AudioEngine] Stream started, isStreaming:', stream.isStreaming);
    } catch (err) {
      statusRef.current = 'error';
      console.error('[AudioEngine] ERROR:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      onErrorRef.current?.(error);
    }
  }, [stream]);

  /**
   * Stoppt den Stream.
   */
  const stopListening = useCallback(() => {
    try {
      if (stream && stream.isStreaming) {
        stream.stop();
      }
    } catch {
      // Ignorieren
    }
    statusRef.current = 'idle';
    volumeEmaRef.current = 0;
  }, [stream]);

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
        if (stream && stream.isStreaming) {
          stream.stop();
        }
      } catch {
        // Ignorieren
      }
    };
  }, [stream]);

  return {
    startListening,
    stopListening,
    resetDetector,
    isStreaming: stream?.isStreaming ?? false,
  };
}