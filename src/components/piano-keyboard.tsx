import {
  Canvas,
  Group,
  LinearGradient,
  Rect,
} from "@shopify/react-native-skia";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

export type KeyboardZoomMode = "overview" | "focus" | "detail";
export type KeyboardKeyState =
  | "idle"
  | "current"
  | "focused"
  | "correct"
  | "wrong";
export type KeyboardFeedback = "correct" | "incorrect" | "too-high" | "too-low";

export type PianoKey = {
  midi: number;
  note: string;
  isBlack: boolean;
  state?: KeyboardKeyState;
};

type PianoKeyboardProps = {
  keys?: PianoKey[];
  focusRange?: [number, number];
  zoomMode?: KeyboardZoomMode;
  interactive?: boolean;
  onKeyPress?: (key: PianoKey) => void;
  onZoomModeChange?: (mode: KeyboardZoomMode) => void;
  // ── Neue Props (rückwärtskompatibel) ──
  /** Zielnote (MIDI) – gold/pulsierend. */
  targetMidi?: number | null;
  /** Falsch gespielte Note (MIDI) – rot. */
  wrongMidi?: number | null;
  /** Hervorgehobene Note (MIDI). */
  highlightMidi?: number | null;
  /** Feedback für die Zielnote. */
  feedback?: KeyboardFeedback | null;
  /** Notennamen als Labels auf den Tasten (MIDI → Text). */
  keyLabels?: Record<number, string>;
  /** Multi-Tasten-Highlight in Grün (Tutorial). */
  greenKeys?: number[];
  /** Sichtbarer Ausschnitt (MIDI min/max). */
  visibleRange?: [number, number];
};

const DEFAULT_START_MIDI = 21;
const DEFAULT_END_MIDI = 108;

/** Dauer der Zoom-Animation in ms – vom Screen genutzt, um Listening
 *  erst nach Abschluss des Zooms zu aktivieren (Single Source of Truth). */
export const KEYBOARD_ZOOM_DURATION_MS = 900;

const VIEWPORT_PADDING = 12;
/** Real piano white-key ratio: height / width ≈ 6 */
const KEY_ASPECT_RATIO = 6;

// ── 3D-Perspektive (Pianisten-Sicht) ────────────────────────────────────
/** Rotationswinkel in Grad – 0 = flach (Overview), 38 = Pianisten-Sicht */
const FOCUS_ROTATE_X = 38;
/** Perspektive: kleiner = stärkerer 3D-Effekt */
const FOCUS_PERSPECTIVE = 800;
const OVERVIEW_PERSPECTIVE = 2000;
/** Simulierte Tastentiefe (Frontkante) in natural units */
const KEY_DEPTH = 6;
/** Anteil der Taste, der als Frontkante (dunkler) gezeichnet wird */
const FRONT_FACE_RATIO = 0.08;

/** Premium-Verläufe (gleiche Palette wie RangeSelector). */
const KEY_GRADIENTS = {
  whiteIdle: ["#fdfdfb", "#e8e5de"],
  whiteRange: ["#ddd6fe", "#a78bfa"],
  blackIdle: ["#3d3d49", "#141419"],
} as const;

/** Vertikaler Verlauf als Paint-Kind eines Rects (falls nicht dimmed/state). */
function KeyGradient({ colors, height }: { colors: readonly [string, string] | readonly string[]; height: number }) {
  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: height }}
      colors={colors as unknown as string[]}
    />
  );
}

function isBlackMidi(midi: number) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

function makeDefaultKeys(): PianoKey[] {
  const result: PianoKey[] = [];
  for (let midi = DEFAULT_START_MIDI; midi <= DEFAULT_END_MIDI; midi += 1) {
    result.push({
      midi,
      note: `M${midi}`,
      isBlack: isBlackMidi(midi),
      state: "idle",
    });
  }
  return result;
}

function resolveKeyFill(
  key: PianoKey,
  isBlackKey: boolean,
  dimmed: boolean,
  inRange: boolean,
) {
  const state = key.state ?? "idle";

  // Active feedback states always win, even outside the focus range
  if (state === "correct") return isBlackKey ? "#16a34a" : "#22c55e";
  if (state === "wrong") return isBlackKey ? "#dc2626" : "#ef4444";
  if (state === "current") return isBlackKey ? "#eab308" : "#facc15";
  if (state === "focused") return isBlackKey ? "#7c3aed" : "#a78bfa";

  // Keys outside the focus range are greyed out
  if (dimmed) return isBlackKey ? "#4a4a55" : "#c8c8cc";

  // Range highlight: deutliche violettblaue Tönung für den aktiven Bereich
  if (inRange && !isBlackKey) return "#c4b5fd";
  if (inRange && isBlackKey) return "#6d28d9";

  // Normal idle fill
  return isBlackKey ? "#1f1f28" : "#f8f7f4";
}

/** Etwas dunklere Variante für die Frontkante (Tiefe-Simulation). */
function resolveFrontFaceFill(
  key: PianoKey,
  isBlackKey: boolean,
  dimmed: boolean,
) {
  const state = key.state ?? "idle";

  if (state === "correct") return isBlackKey ? "#0f7a37" : "#16a34a";
  if (state === "wrong") return isBlackKey ? "#991b1b" : "#dc2626";
  if (state === "current") return isBlackKey ? "#a87f06" : "#ca9a0a";
  if (state === "focused") return isBlackKey ? "#5b21b6" : "#8b5cf6";
  if (dimmed) return isBlackKey ? "#3a3a44" : "#b0b0b5";
  return isBlackKey ? "#15151c" : "#d8d5cc";
}

function getBlackLeft(
  visibleWhiteKeys: PianoKey[],
  keyWidth: number,
  key: PianoKey,
) {
  const whiteIndex =
    visibleWhiteKeys.findIndex((white) => white.midi > key.midi) - 1;
  return Math.max(0, whiteIndex) * keyWidth + keyWidth * 0.64;
}

// ── Memoized hit component (D: performance) ─────────────────────────────
type KeyHitProps = {
  left: number;
  width: number;
  height: number;
  zIndex: number;
  disabled?: boolean;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Blinkender Marker für Ziel-/Falsch-Note (deutlich sichtbar) ──────────
const BlinkMarker = memo(function BlinkMarker({
  left,
  width,
  height,
  color,
}: {
  left: number;
  width: number;
  height: number;
  color: string;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.2, { duration: 450, easing: Easing.inOut(Easing.quad) }),
      -1, // unendlich, Vorwärts+Rückwärts
      true,
    );
    return () => {
      opacity.value = 1;
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0,
    left,
    width,
    height,
    backgroundColor: color,
    opacity: opacity.value,
    zIndex: 5,
    borderRadius: 2,
  }));

  return <Animated.View pointerEvents="none" style={style} />;
});

const KeyHit = memo(function KeyHit({
  left,
  width,
  height,
  zIndex,
  disabled,
  onPress,
}: KeyHitProps) {
  const highlight = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    left,
    width,
    height,
    zIndex,
    backgroundColor: `rgba(255,255,255,${highlight.value})`,
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        highlight.value = withTiming(0.28, { duration: 80 });
      }}
      onPressOut={() => {
        highlight.value = withTiming(0, { duration: 180 });
      }}
      style={[styles.hitKey, animatedStyle]}
    />
  );
});

export const PianoKeyboard = memo(function PianoKeyboard({
  keys,
  focusRange,
  zoomMode = "overview",
  interactive = true,
  onKeyPress,
  onZoomModeChange,
  targetMidi,
  wrongMidi,
  highlightMidi,
  feedback,
  keyLabels,
  greenKeys,
  visibleRange,
}: PianoKeyboardProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isPortrait = windowWidth < 520;
  const [viewportWidth, setViewportWidth] = useState(0);
  const isFirstLayout = useRef(true);

  // Wenn neue Props (targetMidi/feedback/greenKeys) gesetzt sind,
  // wenden wir die States auf die Keys an.
  const keyboardKeys = useMemo(() => {
    const base = keys ?? makeDefaultKeys();
    const hasNewProps =
      targetMidi !== undefined ||
      targetMidi !== null ||
      wrongMidi !== undefined ||
      wrongMidi !== null ||
      highlightMidi !== undefined ||
      highlightMidi !== null ||
      feedback !== undefined ||
      greenKeys !== undefined;

    if (!hasNewProps) return base;

    return base.map((key) => {
      let state: KeyboardKeyState = key.state ?? "idle";
      if (greenKeys?.includes(key.midi)) state = "correct";
      if (
        highlightMidi !== null &&
        highlightMidi !== undefined &&
        key.midi === highlightMidi
      ) {
        state = "focused";
      }
      // Zielnote: bei falscher Antwort grün (richtig), sonst gold/feedback
      if (
        targetMidi !== null &&
        targetMidi !== undefined &&
        key.midi === targetMidi
      ) {
        if (feedback === "correct") state = "correct";
        else if (feedback === "incorrect")
          state = "correct"; // grün = richtige Lösung
        else state = "current";
      }
      // Falsch gespielte Note → rot (gewinnt über Target, damit bei
      // „Falsch – es war X“ die Taste rot statt grün erscheint)
      if (
        wrongMidi !== null &&
        wrongMidi !== undefined &&
        key.midi === wrongMidi
      ) {
        state = "wrong";
      }
      const note = keyLabels?.[key.midi] ?? key.note;
      return { ...key, state, note };
    });
  }, [
    keys,
    targetMidi,
    wrongMidi,
    highlightMidi,
    feedback,
    greenKeys,
    keyLabels,
  ]);

  const whiteKeys = useMemo(
    () => keyboardKeys.filter((key) => !key.isBlack),
    [keyboardKeys],
  );
  const blackKeys = useMemo(
    () => keyboardKeys.filter((key) => key.isBlack),
    [keyboardKeys],
  );

  // ── Sizing: aus dem verfügbaren Platz ableiten, NICHT fix ──────────────
  // Früher: fixe 16/24px-Tasten bei 52 weißen Tasten → natürliche Breite
  // 832–1248px, die per overviewScale auf ~0.5 geschrumpft wurde → Mini-
  // Keyboard (~46px hoch). Jetzt: Tastenbreite = Viewportbreite / Anzahl,
  // zusätzlich durch eine Höhen-Obergrenze begrenzt.
  const whiteKeyCount = Math.max(1, whiteKeys.length);
  // Vor erstem Layout: Schätzung aus Fensterbreite (verhindert Mini-Layout)
  const effectiveViewportWidth =
    viewportWidth > 0 ? viewportWidth : Math.max(280, windowWidth - 16);
  // Klaviatur-Höhe auf ~30% der Fensterhöhe begrenzen (min. 120px)
  const maxKeyboardHeight = Math.max(120, windowHeight * 0.3);
  const widthForKey = effectiveViewportWidth / whiteKeyCount;
  const heightForKey = maxKeyboardHeight / KEY_ASPECT_RATIO;
  const naturalWhiteKeyWidth = Math.max(8, Math.min(widthForKey, heightForKey));
  const naturalKeyboardWidth = whiteKeyCount * naturalWhiteKeyWidth;
  const keyboardWidth = naturalKeyboardWidth;
  const pianoHeight = naturalWhiteKeyWidth * KEY_ASPECT_RATIO;
  const blackKeyHeight = pianoHeight * 0.62;
  const frontFaceHeight = pianoHeight * FRONT_FACE_RATIO;

  // Whether a key lies inside the active focus range
  const isInFocusRange = (midi: number) =>
    focusRange ? midi >= focusRange[0] && midi <= focusRange[1] : true;

  // Whether a key lies outside the active focus range (→ greyed out)
  const isDimmed = (midi: number) =>
    zoomMode !== "overview" && focusRange ? !isInFocusRange(midi) : false;

  // Range highlight is visible in ALL zoom modes (including overview)
  const isInRange = (midi: number) =>
    focusRange ? midi >= focusRange[0] && midi <= focusRange[1] : false;

  // ── Three-stage scale system ──────────────────────────────────────────
  const overviewScale =
    viewportWidth > 0 ? Math.min(1, viewportWidth / naturalKeyboardWidth) : 0;
  const focusScale = Math.min(3, overviewScale * 2.5);
  const detailScale = Math.min(6, overviewScale * 4.5);

  const keyWidth = naturalWhiteKeyWidth;
  const blackKeyWidth = keyWidth * 0.58;

  // Focus center in natural coordinates (used for pan offset)
  const focusCenter = useMemo(() => {
    if (!focusRange) return naturalKeyboardWidth / 2;
    const [min, max] = focusRange;
    const whiteBefore = whiteKeys.filter((key) => key.midi < min).length;
    const whiteInFocus = whiteKeys.filter(
      (key) => !key.isBlack && key.midi >= min && key.midi <= max,
    ).length;
    return (whiteBefore + Math.max(1, whiteInFocus) / 2) * naturalWhiteKeyWidth;
  }, [focusRange, naturalKeyboardWidth, naturalWhiteKeyWidth, whiteKeys]);

  // Resolve the target scale for the current zoom mode
  const targetScale =
    zoomMode === "detail"
      ? detailScale
      : zoomMode === "focus"
        ? focusScale
        : overviewScale;

  // ── 3D-Perspektive SharedValues ───────────────────────────────────────
  // Overview = flach (0°), Focus/Detail = Pianisten-Sicht (52°)
  const targetRotateX = zoomMode === "overview" ? 0 : FOCUS_ROTATE_X;
  const targetPerspective =
    zoomMode === "overview" ? OVERVIEW_PERSPECTIVE : FOCUS_PERSPECTIVE;

  const scaleSv = useSharedValue(targetScale);
  const offsetX = useSharedValue(0);
  const rotateXSv = useSharedValue(targetRotateX);
  const perspectiveSv = useSharedValue(targetPerspective);

  useEffect(() => {
    if (viewportWidth <= 0) return;

    const scaledWidth = keyboardWidth * targetScale;
    let targetOffset: number;

    if (zoomMode === "overview") {
      targetOffset = (viewportWidth - scaledWidth) / 2;
    } else {
      const rawOffset = viewportWidth / 2 - focusCenter * targetScale;
      const minOffset = Math.min(0, viewportWidth - scaledWidth);
      const maxOffset = Math.max(0, (viewportWidth - scaledWidth) / 2);
      targetOffset = Math.max(minOffset, Math.min(maxOffset, rawOffset));
    }

    const animationConfig = {
      duration: KEYBOARD_ZOOM_DURATION_MS,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
    };

    if (isFirstLayout.current) {
      isFirstLayout.current = false;
      scaleSv.value = targetScale;
      offsetX.value = targetOffset;
      rotateXSv.value = targetRotateX;
      perspectiveSv.value = targetPerspective;
    } else {
      scaleSv.value = withTiming(targetScale, animationConfig);
      offsetX.value = withTiming(targetOffset, animationConfig);
      rotateXSv.value = withTiming(targetRotateX, animationConfig);
      perspectiveSv.value = withTiming(targetPerspective, animationConfig);
    }
  }, [
    targetScale,
    targetRotateX,
    targetPerspective,
    zoomMode,
    viewportWidth,
    keyboardWidth,
    focusCenter,
    scaleSv,
    offsetX,
    rotateXSv,
    perspectiveSv,
  ]);

  // ── Viewport-Höhe (3D-Projektion) ─────────────────────────────────────
  const viewportStyle = useAnimatedStyle(() => {
    const rad = (rotateXSv.value * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const projected = pianoHeight * scaleSv.value * cosR;
    const frontFace = KEY_DEPTH * scaleSv.value * sinR;
    return {
      height: projected + frontFace + VIEWPORT_PADDING * 2,
    };
  });

  // ── Camera (Pan + Scale + 3D-Kippung) ────────────────────────────────
  // translateX/scale für Pan & Zoom, rotateX für Pianisten-Sicht.
  // transformOrigin "center bottom" kippt von der Unterkante.
  // perspective liegt statisch auf dem Viewport (Parent) → Fluchtpunkt
  // immer am Bildschirm-Zentrum, unabhängig vom Pan-Offset.
  // perspective als erstes im transform-Array → definiert den 3D-Raum.
  // Da es im selben Array wie translateX/scale liegt, gilt es lokal für
  // dieses Element. Der Fluchtpunkt ist am Element-Zentrum.
  // Reanimated v4 type erfordert perspective als number (nicht string).
  const cameraStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: perspectiveSv.value },
      { translateX: offsetX.value },
      { scale: scaleSv.value },
      { rotateX: `${rotateXSv.value}deg` },
    ],
  }));

  function handleLayout(e: LayoutChangeEvent) {
    setViewportWidth(e.nativeEvent.layout.width);
  }

  // Marker-Geometrie für eine MIDI-Note (weiß oder schwarz)
  function getKeyGeometry(midi: number) {
    if (isBlackMidi(midi)) {
      const left = getBlackLeft(whiteKeys, keyWidth, { midi } as PianoKey);
      return { left, width: blackKeyWidth, height: blackKeyHeight };
    }
    const index = whiteKeys.findIndex((k) => k.midi === midi);
    if (index < 0) return null;
    return { left: index * keyWidth, width: keyWidth, height: pianoHeight };
  }

  const showTargetMarker =
    targetMidi !== null &&
    targetMidi !== undefined &&
    (feedback === "correct" || feedback === "incorrect") &&
    wrongMidi !== targetMidi; // roter Marker gewinnt bei derselben Taste
  const showWrongMarker = wrongMidi !== null && wrongMidi !== undefined;

  return (
    <ThemedView style={styles.shell}>
      <Animated.View
        onLayout={handleLayout}
        style={[styles.keyboardViewport, viewportStyle]}
      >
        <Animated.View
          style={[
            styles.keyboardCamera,
            {
              width: keyboardWidth,
              height: pianoHeight,
              top: VIEWPORT_PADDING,
              transformOrigin: "center bottom",
            },
            cameraStyle,
          ]}
        >
          <Canvas style={{ width: keyboardWidth, height: pianoHeight }}>
            {whiteKeys.map((key, index) => {
              const dimmed = isDimmed(key.midi);
              const inRange = isInRange(key.midi);
              const isIdle = (key.state ?? "idle") === "idle";
              return (
                <Group key={key.midi}>
                  {/* Weiße Taste – Hauptkörper (Premium-Verlauf im Idle/Zustand) */}
                  <Rect
                    x={index * keyWidth}
                    y={0}
                    width={keyWidth}
                    height={pianoHeight}
                    color={resolveKeyFill(key, false, dimmed, inRange)}
                  >
                    {isIdle &&
                      !dimmed &&
                      (inRange ? (
                        <KeyGradient colors={KEY_GRADIENTS.whiteRange} height={pianoHeight} />
                      ) : (
                        <KeyGradient colors={KEY_GRADIENTS.whiteIdle} height={pianoHeight} />
                      ))}
                  </Rect>
                {/* Frontkante – dunkler (Tiefe-Simulation bei 3D-Neigung) */}
                <Rect
                  x={index * keyWidth}
                  y={pianoHeight - frontFaceHeight}
                  width={keyWidth}
                  height={frontFaceHeight}
                  color={resolveFrontFaceFill(key, false, isDimmed(key.midi))}
                />
                {/* Outline */}
                <Rect
                  x={index * keyWidth}
                  y={0}
                  width={keyWidth}
                  height={pianoHeight}
                  color="rgba(0,0,0,0.2)"
                  style="stroke"
                  strokeWidth={1}
                />
              </Group>
              );
            })}

            {/* C2: shadow rects beneath black keys */}
            {blackKeys.map((key) => {
              const x = getBlackLeft(whiteKeys, keyWidth, key);
              return (
                <Rect
                  key={`${key.midi}-shadow`}
                  x={x + 1}
                  y={2}
                  width={blackKeyWidth}
                  height={blackKeyHeight}
                  color="rgba(0,0,0,0.3)"
                />
              );
            })}

            {/* C2+C3: black keys with shadow */}
            {blackKeys.map((key) => {
              const x = getBlackLeft(whiteKeys, keyWidth, key);
              const dimmed = isDimmed(key.midi);
              const isIdle = (key.state ?? "idle") === "idle";
              return (
                <Group key={key.midi}>
                  <Rect
                    x={x}
                    y={0}
                    width={blackKeyWidth}
                    height={blackKeyHeight}
                    color={resolveKeyFill(
                      key,
                      true,
                      dimmed,
                      isInRange(key.midi),
                    )}
                  >
                    {isIdle && !dimmed && (
                      <KeyGradient colors={KEY_GRADIENTS.blackIdle} height={blackKeyHeight} />
                    )}
                  </Rect>
                  {/* Glanzkante (Gloss) oben auf der schwarzen Taste */}
                  {isIdle && !dimmed && (
                    <Rect
                      x={x + blackKeyWidth * 0.15}
                      y={blackKeyHeight * 0.06}
                      width={blackKeyWidth * 0.7}
                      height={blackKeyHeight * 0.18}
                      color="rgba(255,255,255,0.12)"
                    />
                  )}
                  {/* Schwarze Taste Frontkante */}
                  <Rect
                    x={x}
                    y={blackKeyHeight - frontFaceHeight * 0.6}
                    width={blackKeyWidth}
                    height={frontFaceHeight * 0.6}
                    color={resolveFrontFaceFill(key, true, isDimmed(key.midi))}
                  />
                </Group>
              );
            })}
          </Canvas>

          {/* C4 + D: memoized hit overlays with animated press highlight */}
          {whiteKeys.map((key, index) => (
            <KeyHit
              key={key.midi}
              left={index * keyWidth}
              width={keyWidth}
              height={pianoHeight}
              zIndex={3}
              disabled={!interactive}
              onPress={() => onKeyPress?.(key)}
            />
          ))}

          {blackKeys.map((key) => {
            const x = getBlackLeft(whiteKeys, keyWidth, key);
            return (
              <KeyHit
                key={key.midi}
                left={x}
                width={blackKeyWidth}
                height={blackKeyHeight}
                zIndex={4}
                disabled={!interactive}
                onPress={() => onKeyPress?.(key)}
              />
            );
          })}

          {/* Blinkende Ergebnis-Marker: Zielnote grün, Falsch-Note rot */}
          {showTargetMarker &&
            (() => {
              const g = getKeyGeometry(targetMidi as number);
              return g ? (
                <BlinkMarker key={`target-${targetMidi}`} {...g} color="#22c55e" />
              ) : null;
            })()}
          {showWrongMarker &&
            (() => {
              const g = getKeyGeometry(wrongMidi as number);
              return g ? (
                <BlinkMarker key={`wrong-${wrongMidi}`} {...g} color="#ef4444" />
              ) : null;
            })()}
        </Animated.View>
      </Animated.View>
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  shell: {
    gap: Spacing.two,
  },
  keyboardViewport: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    alignSelf: "stretch",
  },
  keyboardCamera: {
    position: "absolute",
    left: 0,
  },
  hitKey: {
    position: "absolute",
    top: 0,
    backgroundColor: "transparent",
  },
});
