/**
 * RangeSelector – Mini-Klavier A0–C8 (88 Tasten) mit korrekter Klavier-
 * Geometrie: 52 weiße Tasten, schwarze Tasten absolut zwischen/über den
 * weißen positioniert (keine eigenen Spalten mehr).
 *
 * Interaktion: Tippen/Ziehen verschiebt die Grenze (Min/Max), die dem
 * Finger am nächsten ist (Griff-Schwelle ~30px); sonst entscheidet die
 * Lage zur Range-Mitte (links = Min, rechts = Max). Anzeige „Von/Bis"
 * mit deutschem Notennamen + MIDI.
 */

import { useRef, useState, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Canvas, Group, LinearGradient, RoundedRect, Skia } from '@shopify/react-native-skia';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

import { getNotation } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

const KEYBOARD_START = 21; // A0
const KEYBOARD_END = 108; // C8
const KEYBOARD_HEIGHT = 100;
const BLACK_KEY_RATIO = 0.58; // Breite schwarzer Tasten relativ zu weißen
const BLACK_KEY_HEIGHT_RATIO = 0.62;
const HANDLE_WIDTH = 12; // Sicht-/Griffbreite der Grenzbalken
const MAX_ZOOM = 8;

/** Standard-Bereiche für Schnellauswahl (Labels = Helmholtz-Schreibweise). */
const RANGE_PRESETS: { min: number; max: number }[] = [
  { min: 60, max: 67 }, // c'–g'
  { min: 53, max: 60 }, // f–c'
  { min: 53, max: 67 }, // f–g'
  { min: 48, max: 55 }, // c–g
  { min: 48, max: 60 }, // c–c'
  { min: 65, max: 72 }, // f'–c''
  { min: 60, max: 72 }, // c'–c''
];

const isBlackMidi = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

/** Weiße MIDIs 21–108 in Reihenfolge (52 Stück). */
const WHITE_MIDIS: number[] = [];
for (let midi = KEYBOARD_START; midi <= KEYBOARD_END; midi++) {
  if (!isBlackMidi(midi)) WHITE_MIDIS.push(midi);
}
const WHITE_COUNT = WHITE_MIDIS.length;

/** Linker Rand (px) einer Taste. Schwarze Tasten liegen wie beim echten
 *  Klavier versetzt (nicht exakt mittig): 2er-Gruppe Cis/Dis und
 *  3er-Gruppe Fis/Gis/Ais weichen nach außen aus. */
const BLACK_OFFSET: Record<number, number> = {
  1: -0.1, // Cis → leicht zu C
  3: 0.1, //  Dis → leicht zu E
  6: -0.12, // Fis → leicht zu F
  8: 0, //    Gis → mittig
  10: 0.12, // Ais → leicht zu H
};

function keyLeft(midi: number, whiteW: number, blackW: number): number | null {
  const whiteIndex = WHITE_MIDIS.indexOf(midi);
  if (whiteIndex >= 0) return whiteIndex * whiteW;
  // Schwarze Taste: Grenze zur darauffolgenden weißen Taste + Versatz
  const after = WHITE_MIDIS.findIndex((m) => m > midi);
  if (after <= 0) return null;
  return after * whiteW - blackW / 2 + (BLACK_OFFSET[midi % 12] ?? 0) * whiteW;
}

/** Worklet: Pan begrenzen – Keyboard bleibt vollständig über dem Viewport. */
function clampPanW(value: number, z: number, w: number) {
  'worklet';
  if (z <= 1 || w <= 0) return 0;
  return Math.max(w - w * z, Math.min(0, value));
}

/** Feder-Config für Kamerafahrt (Preset-Wechsel, Reset) – ohne Überschwingen. */
const SPRING: WithSpringConfig = { damping: 40, stiffness: 200, mass: 0.9, overshootClamping: true };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type RangeSelectorProps = {
  minMidi: number;
  maxMidi: number;
  onChange: (minMidi: number, maxMidi: number) => void;
};

/** Grenzbalken mit eigener Pan-Geste. Position läuft nativ im
 *  useAnimatedStyle-Worklet (panSV + left·zoom) → bewegt sich synchron
 *  zur Skia-Kamera, ohne JS-Roundtrip (kein Zittern bei der Kamerafahrt). */
function BoundaryHandle({
  color,
  left,
  arrow,
  gesture,
  panSV,
  zoomSV,
}: {
  color: string;
  /** Basis-X (Zoom ×1) des Tastenzentrums, auf dem der Balken sitzt. */
  left: number;
  arrow: string;
  gesture: ReturnType<typeof Gesture.Pan>;
  panSV: SharedValue<number>;
  zoomSV: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: panSV.value + left * zoomSV.value - HANDLE_WIDTH / 2 }],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.boundaryBar, style, { width: HANDLE_WIDTH, backgroundColor: color }]}
        hitSlop={{ left: 8, right: 8, top: 10, bottom: 10 }}
      >
        <View style={styles.boundaryInner}>
          <Text style={styles.boundaryText}>{arrow}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Preset-Chip mit Press-Scale-Feedback. */
function PresetChip({
  label,
  active,
  bg,
  borderColor,
  textColor,
  onPress,
}: {
  label: string;
  active: boolean;
  bg: string;
  borderColor: string;
  textColor: string;
  onPress: () => void;
}) {
  const scaleSV = useSharedValue(1);
  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleSV.value }],
  }));
  return (
    <AnimatedPressable
      onPressIn={() => {
        scaleSV.value = withTiming(0.94, { duration: 80 });
      }}
      onPressOut={() => {
        scaleSV.value = withTiming(1, { duration: 140 });
      }}
      onPress={onPress}
      style={[
        styles.presetButton,
        {
          backgroundColor: active ? '#6d28d9' : bg,
          borderColor: active ? '#6d28d9' : borderColor,
        },
        chipStyle,
      ]}
    >
      <Text style={[styles.presetButtonText, { color: active ? '#ffffff' : textColor }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function RangeSelector({ minMidi, maxMidi, onChange }: RangeSelectorProps) {
  const theme = useTheme();
  const notation = getNotation('german');
  const [width, setWidth] = useState(0);

  // ── Zoom/Pan: Tasten werden statisch in Basis-Geometrie (Zoom ×1)
  // gerendert; Zoom/Verschiebung laufen als animierter Transform auf dem
  // UI-Thread (translateX + scaleX). React-State ist nur JS-Spiegel. ──
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const zoomSV = useSharedValue(1);
  const panSV = useSharedValue(0);
  const widthSV = useSharedValue(0);
  const pageXSV = useSharedValue(0); // Viewport-X in Fensterkoordinaten (focalX ist fensterrelativ)
  const startZoomSV = useSharedValue(1);
  const startPanSV = useSharedValue(0);
  const startFocalSV = useSharedValue(0);

  // Basis-Geometrie – Tasten werden in echter Zoom-Größe gerendert;
  // Zoom/Pan laufen als SharedValues, der JS-Spiegel (useAnimatedReaction
  // unten) aktualisiert die Geometrie pro Frame.
  const whiteW = width > 0 ? (width * zoom) / WHITE_COUNT : 0;
  const blackW = whiteW * BLACK_KEY_RATIO;

  // JS-Spiegel von Zoom/Pan (für Badge, Mapping, Preset-Berechnung)
  const commitBoth = (z: number, p: number) => {
    setZoom(z);
    setPanX(p);
  };
  useAnimatedReaction(
    () => ({ z: zoomSV.value, p: panSV.value }),
    (cur, prev) => {
      if (!prev || cur.z !== prev.z || cur.p !== prev.p) {
        runOnJS(commitBoth)(cur.z, cur.p);
      }
    },
  );

  /**
   * Preset anwenden und mit Feder in den Bereich „fahren":
   * Range + je 2 weiße Nachbarnoten sichtbar, zentriert im Viewport.
   */
  const applyPreset = (min: number, max: number) => {
    onChange(min, max);

    const rangeWhites = WHITE_MIDIS.filter((m) => m >= min && m <= max).length;
    const visibleWhites = Math.max(rangeWhites + 4, 10); // 2 Nachbarn je Seite, min. sinnvoll
    const z = Math.max(1, Math.min(MAX_ZOOM, WHITE_COUNT / visibleWhites));

    // Geometrie mit dem neuen Zoom berechnen
    const w = (width * z) / WHITE_COUNT;
    const bw = w * BLACK_KEY_RATIO;
    const leftMin = keyLeft(min, w, bw) ?? 0;
    const leftMax = keyLeft(max, w, bw) ?? 0;
    const centerKey = (leftMin + leftMax) / 2 + w / 2;

    // Clamp lokal berechnen (SharedValue-Lesen von JS ist evtl. noch stale!)
    const p = z <= 1 || width <= 0 ? 0 : Math.max(width - width * z, Math.min(0, width / 2 - centerKey));

    zoomSV.value = withSpring(z, SPRING);
    panSV.value = withSpring(p, SPRING);
  };

  /** X → MIDI: schwarze Tasten zuerst (liegen über den weißen). */
  const midiFromX = (x: number) => {
    if (whiteW <= 0) return minMidi;
    for (let midi = KEYBOARD_START; midi <= KEYBOARD_END; midi++) {
      if (!isBlackMidi(midi)) continue;
      const left = keyLeft(midi, whiteW, blackW);
      if (left !== null && x >= left && x < left + blackW) return midi;
    }
    const index = Math.max(0, Math.min(WHITE_COUNT - 1, Math.floor(x / whiteW)));
    return WHITE_MIDIS[index];
  };

  const applyHandle = (handle: 'min' | 'max', midi: number) => {
    if (handle === 'min') {
      onChange(Math.max(KEYBOARD_START, Math.min(midi, maxMidi - 1)), maxMidi);
    } else {
      onChange(minMidi, Math.min(KEYBOARD_END, Math.max(midi, minMidi + 1)));
    }
  };

  // ── Grenz-Griffe: Finger-Delta (Screen-px) → MIDI, ohne Drift ──
  const dragRef = useRef<{ which: 'min' | 'max'; startX: number; startMidi: number } | null>(null);

  const beginHandle = (which: 'min' | 'max', startX: number) => {
    dragRef.current = {
      which,
      startX,
      startMidi: which === 'min' ? minMidi : maxMidi,
    };
  };
  const moveHandle = (absX: number) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = (absX - d.startX) / zoom; // Screen-px → Tastatur-px
    const centerKey = (keyLeft(d.startMidi, whiteW, blackW) ?? 0) + whiteW / 2;
    applyHandle(d.which, midiFromX(centerKey + delta));
  };
  const endHandle = () => {
    dragRef.current = null;
  };

  const minHandleGesture = Gesture.Pan()
    .onBegin((e) => runOnJS(beginHandle)('min', e.absoluteX))
    .onUpdate((e) => runOnJS(moveHandle)(e.absoluteX))
    .onEnd(() => runOnJS(endHandle)())
    .onFinalize(() => runOnJS(endHandle)());

  const maxHandleGesture = Gesture.Pan()
    .onBegin((e) => runOnJS(beginHandle)('max', e.absoluteX))
    .onUpdate((e) => runOnJS(moveHandle)(e.absoluteX))
    .onEnd(() => runOnJS(endHandle)())
    .onFinalize(() => runOnJS(endHandle)());

  // ── Gesten (Worklets auf dem UI-Thread): Pinch zoomt um den
  // Fokuspunkt, 2-Finger-Pan scrollt. Ergebnisse via runOnJS in State. ──
  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      startZoomSV.value = zoomSV.value;
      startPanSV.value = panSV.value;
      // focalX ist in Fensterkoordinaten → in Viewport-Koordinaten umrechnen
      startFocalSV.value = e.focalX - pageXSV.value;
    })
    .onUpdate((e) => {
      const z = Math.max(1, Math.min(MAX_ZOOM, startZoomSV.value * e.scale));
      const focalX = e.focalX - pageXSV.value;
      // Fokuspunkt (Fingermitte) in Tastatur-Koordinaten stabil halten
      const keyX = (startFocalSV.value - startPanSV.value) / startZoomSV.value;
      zoomSV.value = z;
      panSV.value = clampPanW(focalX - keyX * z, z, widthSV.value);
    });

  // 1-Finger-Pan scrollt die gezoomte Tastatur
  const scrollPan = Gesture.Pan()
    .onBegin(() => {
      startPanSV.value = panSV.value;
    })
    .onUpdate((e) => {
      panSV.value = clampPanW(startPanSV.value + e.translationX, zoomSV.value, widthSV.value);
    });

  const keyboardGestures = Gesture.Simultaneous(pinch, scrollPan);

  // ── Skia-Rendering: Tasten statisch in Basis-Geometrie (Zoom ×1),
  // Kamera (translateX + scaleX, Anker links) als animierter Group-
  // Transform → vektor-crisp, 0 React-Renders pro Frame. ──
  const camera = useDerivedValue(() => [
    { translateX: panSV.value },
    { scaleX: zoomSV.value },
  ]);

  // Basis-Geometrie (Zoom ×1) für die Grenzbalken-Worklets
  const whiteW0 = width / WHITE_COUNT;
  const blackW0 = whiteW0 * BLACK_KEY_RATIO;
  const minLeftBase = keyLeft(minMidi, whiteW0, blackW0) ?? 0;
  const maxLeftBase = keyLeft(maxMidi, whiteW0, blackW0) ?? 0;

  const keyRects = useMemo(() => {
    const whiteW0 = width / WHITE_COUNT;
    const blackW0 = whiteW0 * BLACK_KEY_RATIO;
    if (whiteW0 <= 0) return null;

    // Weiße Tasten: subtiler Vertikalverlauf (Licht oben, Schatten unten)
    // + feine Trennlinie – wirkt wie lackiertes Elfenbein statt Flat-Fill.
    const whiteRects = WHITE_MIDIS.map((midi) => {
      const x = keyLeft(midi, whiteW0, blackW0) ?? 0;
      const w = Math.max(0.5, whiteW0 - 0.5);
      const inRangeKey = midi >= minMidi && midi <= maxMidi;
      const isBoundary = midi === minMidi || midi === maxMidi;
      const fill =
        midi === minMidi
          ? ['#81d48a', '#3d9c4b']
          : midi === maxMidi
            ? ['#ffc46b', '#f08c00']
            : inRangeKey
              ? ['#ddd6fe', '#a78bfa']
              : ['#fdfdfb', '#e8e5de'];
      return (
        <Group key={`w${midi}`}>
          <RoundedRect x={x} y={0} width={w} height={KEYBOARD_HEIGHT} r={1}>
            <LinearGradient
              start={Skia.Point(0, 0)}
              end={Skia.Point(0, KEYBOARD_HEIGHT)}
              colors={fill}
            />
          </RoundedRect>
          <RoundedRect
            x={x}
            y={0}
            width={w}
            height={KEYBOARD_HEIGHT}
            r={1}
            color={isBoundary ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'}
            style="stroke"
            strokeWidth={0.5}
          />
        </Group>
      );
    });

    // Schwarze Tasten: dunkler Hochglanz-Falloff + Glanzkante oben
    const blackRects: React.ReactNode[] = [];
    for (let midi = KEYBOARD_START; midi <= KEYBOARD_END; midi++) {
      if (!isBlackMidi(midi)) continue;
      const x = keyLeft(midi, whiteW0, blackW0);
      if (x === null) continue;
      const h = KEYBOARD_HEIGHT * BLACK_KEY_HEIGHT_RATIO;
      const inRangeKey = midi >= minMidi && midi <= maxMidi;
      blackRects.push(
        <Group key={`b${midi}`}>
          <RoundedRect x={x} y={0} width={blackW0} height={h} r={1}>
            {midi === minMidi ? (
              <LinearGradient start={Skia.Point(0, 0)} end={Skia.Point(0, h)} colors={['#5fc06c', '#256b32']} />
            ) : midi === maxMidi ? (
              <LinearGradient start={Skia.Point(0, 0)} end={Skia.Point(0, h)} colors={['#ffb84d', '#c96e00']} />
            ) : inRangeKey ? (
              <LinearGradient start={Skia.Point(0, 0)} end={Skia.Point(0, h)} colors={['#8b5cf6', '#5b21b6']} />
            ) : (
              <LinearGradient start={Skia.Point(0, 0)} end={Skia.Point(0, h)} colors={['#3d3d49', '#141419']} />
            )}
          </RoundedRect>
          <RoundedRect
            x={x}
            y={0}
            width={blackW0}
            height={h}
            r={1}
            color="rgba(0,0,0,0.4)"
            style="stroke"
            strokeWidth={0.5}
          />
          {/* dezente Glanzkante oben */}
          <RoundedRect
            x={x + blackW0 * 0.15}
            y={1.5}
            width={blackW0 * 0.7}
            height={Math.max(1.5, h * 0.06)}
            r={1}
            color="rgba(255,255,255,0.16)"
          />
        </Group>,
      );
    }
    return [...whiteRects, ...blackRects];
  }, [width, minMidi, maxMidi]);

  return (
    <View style={styles.rangeSelector}>
      <View style={[styles.rangeInfo, { backgroundColor: theme.bgSurfaceAlt }]}>
        <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
          <Text style={{ color: '#4caf50', fontWeight: 'bold' }}>Von: </Text>
          <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>
            {notation.midiToDisplay(minMidi)}
          </Text>{' '}
          (MIDI {minMidi})
        </Text>
        <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
          <Text style={{ color: '#ff9800', fontWeight: 'bold' }}>Bis: </Text>
          <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>
            {notation.midiToDisplay(maxMidi)}
          </Text>{' '}
          (MIDI {maxMidi})
        </Text>
      </View>

      <View
        style={[styles.keyboardContainer, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
      >
        <GestureHandlerRootView>
          <GestureDetector gesture={keyboardGestures}>
            <View
              style={styles.keyboardViewport}
              onLayout={(e) => {
                setWidth(e.nativeEvent.layout.width);
                widthSV.value = e.nativeEvent.layout.width;
              }}
              onTouchStart={(e) => {
                // Viewport-Position in Fensterkoordinaten ermitteln
                pageXSV.value = e.nativeEvent.pageX - e.nativeEvent.locationX;
              }}
            >
              {/* Skia-Klavier: Kamera läuft als Group-Transform auf der GPU */}
              <Canvas style={{ width, height: KEYBOARD_HEIGHT }}>
                <Group transform={camera}>{keyRects}</Group>
              </Canvas>

              {/* Grenz-Griffe: Position nativ im Worklet → synchron zur Kamera */}
              <BoundaryHandle
                color="#4caf50"
                left={minLeftBase + (whiteW0 > 0 ? whiteW0 / 2 : 0)}
                arrow="◀"
                gesture={minHandleGesture}
                panSV={panSV}
                zoomSV={zoomSV}
              />
              <BoundaryHandle
                color="#ff9800"
                left={maxLeftBase + (whiteW0 > 0 ? whiteW0 / 2 : 0)}
                arrow="▶"
                gesture={maxHandleGesture}
                panSV={panSV}
                zoomSV={zoomSV}
              />
            </View>
          </GestureDetector>
        </GestureHandlerRootView>

        {/* Zoom-Status: Tippen fährt animiert zurück */}
        <Pressable
          style={[styles.zoomBadge, { backgroundColor: theme.bgSurfaceAlt, borderColor: theme.border }]}
          onPress={() => {
            zoomSV.value = withSpring(1, SPRING);
            panSV.value = withSpring(0, SPRING);
          }}
        >
          <Text style={[styles.zoomBadgeText, { color: theme.textSecondary }]}>
            🔍 Pinch = Zoom ×{zoom.toFixed(1)} · 1 Finger = schieben · Balken = Grenze · Tippen = Reset
          </Text>
        </Pressable>

        {/* Standard-Bereiche */}
        <View style={styles.presets}>
          {RANGE_PRESETS.map((preset) => {
            const active = preset.min === minMidi && preset.max === maxMidi;
            const label = `${notation.midiToDisplay(preset.min, { octaveStyle: 'helmholtz' })}–${notation.midiToDisplay(preset.max, { octaveStyle: 'helmholtz' })}`;
            return (
              <PresetChip
                key={`${preset.min}-${preset.max}`}
                label={label}
                active={active}
                bg={theme.bgSurfaceAlt}
                borderColor={theme.border}
                textColor={theme.textSecondary}
                onPress={() => applyPreset(preset.min, preset.max)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeSelector: {
    width: '100%',
  },
  rangeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
  rangeLabel: {
    fontSize: 13,
  },
  keyboardContainer: {
    marginBottom: 8,
    borderWidth: 2,
    borderRadius: 8,
    padding: 10,
  },
  keyboard: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: KEYBOARD_HEIGHT,
    zIndex: 5,
  },
  keyboardViewport: {
    width: '100%',
    height: KEYBOARD_HEIGHT,
    overflow: 'hidden',
  },
  zoomBadge: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  zoomBadgeText: {
    fontSize: 12,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  presetButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  boundaryBar: {
    position: 'absolute',
    left: 0,
    top: -12,
    height: KEYBOARD_HEIGHT + 24,
    borderRadius: 6,
    zIndex: 5,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  boundaryText: {
    fontSize: 9,
    color: '#ffffff',
    marginTop: 4,
  },
  boundaryInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});