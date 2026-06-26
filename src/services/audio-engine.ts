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

import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
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

  // Buffer-Verarbeitung als useRef (wird erst beim ersten Buffer aufgerufen)
  const processBufferRef = useRef<
    ((audioBuffer: { data: ArrayBuffer; sampleRate: number; channels: number; timestamp: number }) => void) | null
  >(null);

  /**
   * Verarbeitet einen rohen PCM-Buffer: RMS → Pitch-Detection → Callback.
   */
  const processBuffer = useCallback(
    (audioBuffer: { data: ArrayBuffer; sampleRate: number; channels: number; timestamp: number }) => {
      try {
        const { data, sampleRate, timestamp } = audioBuffer;
        sampleRateRef.current = sampleRate;

        // Float32Array aus ArrayBuffer erstellen
        const samples = new Float32Array(data);

        // RMS berechnen (Lautstärke / Rauschfilter)
        const rms = calculateRMS(samples);

        // Volume EMA-Smoothing
        volumeEmaRef.current = emaSmooth(volumeEmaRef.current, rms, VOLUME_EMA_FACTOR);

        // RMS-Gate: zu leise Signale ignorieren
        if (rms < RMS_GATE_THRESHOLD) {
          // Stille-Frame emitten
          onFrameRef.current({
            frequency: 0,
            clarity: 0,
            rms: volumeEmaRef.current,
            timestamp: timestamp * 1000,
          });
          return;
        }

        // Pitch-Detector erstellen (falls noch nicht vorhanden oder sampleRate geändert)
        if (!detectorRef.current) {
          detectorRef.current = new MacLeodPitchDetector(DEFAULT_BUFFER_SIZE, sampleRate);
        }

        // Pitch erkennen
        const result = detectorRef.current.getPitch(samples);

        // Clarity-Gate
        const passesGate = result.clarity >= CLARITY_THRESHOLD;

        onFrameRef.current({
          frequency: passesGate ? result.frequency : 0,
          clarity: result.clarity,
          rms: volumeEmaRef.current,
          timestamp: timestamp * 1000,
        });
      } catch (err) {
        // Fehler beim Buffer-Verarbeiten abfangen (nicht crashen)
        const error = err instanceof Error ? err : new Error(String(err));
        onErrorRef.current?.(error);
      }
    },
    [],
  );

  // processBuffer in Ref halten, damit der onBuffer-Callback darauf zugreifen kann
  processBufferRef.current = processBuffer;

  // Audio-Stream erstellen (sampleRate 44100, mono, float32)
  // WICHTIG: onBuffer ruft processBufferRef.current auf (nicht processBuffer direkt),
  // um Forward-Reference-Probleme zu vermeiden.
  const { stream } = useAudioStream({
    sampleRate: 44100,
    channels: 1,
    encoding: 'float32',
    onBuffer: (audioBuffer) => {
      processBufferRef.current?.(audioBuffer);
    },
  });

  /**
   * Fordert Mikrofon-Berechtigung an und startet den Stream.
   */
  const startListening = useCallback(async () => {
    if (!stream) {
      onErrorRef.current?.(new Error('Audio-Stream nicht verfügbar'));
      return;
    }

    try {
      statusRef.current = 'requesting';

      // Berechtigung anfordern
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        statusRef.current = 'error';
        onErrorRef.current?.(new Error('Mikrofon-Berechtigung verweigert'));
        return;
      }

      // Stream starten
      statusRef.current = 'streaming';
      volumeEmaRef.current = 0;
      await stream.start();
    } catch (err) {
      statusRef.current = 'error';
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
   * Setzt den Pitch-Detector zurück (z.B. für Silence-Gate).
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
    /** Startet die Audio-Aufnahme + Pitch-Detection. */
    startListening,
    /** Stoppt die Audio-Aufnahme. */
    stopListening,
    /** Setzt den Detector zurück. */
    resetDetector,
    /** Ist der Stream aktiv? */
    isStreaming: stream?.isStreaming ?? false,
  };
}