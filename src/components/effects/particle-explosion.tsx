/**
 * ParticleExplosion – Skia-basierte Partikel-Explosion für falsche Antworten.
 *
 * ⚠️ Architektur: Läuft komplett auf dem UI-Thread via SharedValues.
 * 0 React Re-Renders pro Frame.
 *
 * Bei `trigger`-Wechsel zu `true` startet die Explosion:
 *   - 24 Partikel fliegen radial nach außen
 *   - Gravitation zieht sie nach unten
 *   - Opacity fade-out über ~800ms
 *   - Farben: Rote/orange Splitter (Feedback für "falsch")
 */

import { Canvas, Circle } from "@shopify/react-native-skia";
import { memo, useEffect, useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ParticleExplosionProps {
  /** Bei Wechsel zu `true` startet die Explosion. */
  trigger: boolean;
  /** X-Position des Explosions-Zentrums (relativ zur Canvas). */
  centerX?: number;
  /** Y-Position des Explosions-Zentrums (relativ zur Canvas). */
  centerY?: number;
  /** Canvas-Größe (quadratisch). */
  size?: number;
  /** Dauer der Animation in ms. */
  duration?: number;
}

const PARTICLE_COUNT = 24;
const COLORS = ["#ef4444", "#f97316", "#fbbf24", "#dc2626"];

type ParticleConfig = {
  angle: number;
  speed: number;
  radius: number;
  color: string;
};

type ParticleProps = {
  config: ParticleConfig;
  centerX: number;
  centerY: number;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
};

// Einzelne Partikel-Komponente – Hooks sind hier erlaubt (eine pro Instanz)
const Particle = memo(function Particle({
  config,
  centerX,
  centerY,
  progress,
  opacity,
}: ParticleProps) {
  const cx = useDerivedValue(
    () => centerX + Math.cos(config.angle) * config.speed * progress.value,
    [progress],
  );
  const cy = useDerivedValue(() => {
    const t = progress.value;
    const gravity = 40 * t * t; // quadratische Gravitation
    return centerY + Math.sin(config.angle) * config.speed * t + gravity;
  }, [progress]);
  const r = useDerivedValue(
    () => config.radius * (1 - progress.value * 0.6),
    [progress],
  );
  const particleOpacity = useDerivedValue(
    () => opacity.value * (1 - progress.value * 0.3),
    [opacity, progress],
  );

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      color={config.color}
      opacity={particleOpacity}
    />
  );
});

function generateParticles(): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.3;
    particles.push({
      angle,
      speed: 60 + Math.random() * 80,
      radius: 3 + Math.random() * 5,
      color: COLORS[i % COLORS.length],
    });
  }
  return particles;
}

export const ParticleExplosion = memo(function ParticleExplosion({
  trigger,
  centerX = 150,
  centerY = 150,
  size = 300,
  duration = 800,
}: ParticleExplosionProps) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const particles = useMemo(() => generateParticles(), []);

  useEffect(() => {
    if (trigger) {
      progress.value = 0;
      opacity.value = 1;
      progress.value = withTiming(1, { duration });
      opacity.value = withTiming(0, { duration });
    } else {
      progress.value = 0;
      opacity.value = 0;
    }
  }, [trigger, progress, opacity, duration]);

  if (!trigger) return null;

  return (
    <Canvas style={{ width: size, height: size, position: "absolute" }}>
      {particles.map((p, i) => (
        <Particle
          key={i}
          config={p}
          centerX={centerX}
          centerY={centerY}
          progress={progress}
          opacity={opacity}
        />
      ))}
    </Canvas>
  );
});
