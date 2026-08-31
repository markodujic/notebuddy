# UI-Polish-Roadmap – Detail-Dokumentation

> Vollständige technische Doku zur 6-Phasen-Politur der notebuddy-UI
> (RangeSelector-Jitter-Fix + Phase 1–6). Kurzform: siehe `PLAN.md`.
> Status: alles umgesetzt am 2026-08-31 (Commits `91f484f` … `8561a9e`).

## Vorarbeit: RangeSelector Boundary-Handle-Jitter-Fix (`91f484f`)

- **Root Cause:** JS-State-Spiegel lief dem nativen Skia-Camera-Transform immer
  einen Frame hinterher → Handles zappelten beim Zoomen.
- **Fix:** zoom-wrapper View entfernt; `BoundaryHandle` sitzt direkt im Viewport.
  Positionierung komplett im `useAnimatedStyle`-Worklet:
  `translateX = panSV + left·zoomSV − HANDLE_WIDTH/2`
  (`left` = Base-Geometry-Key-Center via `minLeftBase/maxLeftBase + whiteW0/2`).
  `styles.boundaryBar` verankert auf `left: 0`; die gezoomten
  `minLeft/maxLeft`-Werte entfallen.
- **Lektion:** SharedValues, die im selben Worklet-Frame gelesen werden, sind
  pixel-synchron mit der nativen Kamera – JS-State ist es nicht.

## Phase 1 – StaffView

### 1.1 Bravura-SMuFL-Notenköpfe (`c1f12f0`)

- Notenköpfe (display/wrong/hover) als echte Bravura-Glyphen
  (`NOTE_HEAD_FILLED` \uE0A4) via Skia `Text` statt rotierter gezeichneter Ovale.
- Glow-Ring + Hover-Outline als `style="stroke"`-Glyphen.
- `glyphHalfWidth()` misst via `font.measureText`; Hals sitzt exakt an der
  Glyph-Kante (`stemOffsetX = headHalfW`).
- `makeOvalPath`/`Skia`/`Path`-Imports entfallen.
- **SMuFL-Konvention:** 1 em = 4 Staff-Spaces → `NOTE_GLYPH_FONT_SIZE: 96`
  (= LINE_SPACING 24 × 4) macht den Kopf exakt 1 Space hoch – Proportionen
  automatisch typografisch korrekt. `NOTE_HEAD_WIDTH_SPACES: 1.3` als Fallback.
- Hinweis: `LINE_SPACING` ist im selben Objektliteral in `music-font.ts` nicht
  referenzierbar → 96 mit Kommentar hartkodiert.

### 1.2 Pergament als offscreen Picture (`cf84519`)

- `useParchmentPicture(width, height, colors)` in `staff-view.tsx`: Hintergrund,
  Noise (4×4-Blöcke, ~400 Rects) und 12 horizontale Fasern werden **einmalig**
  (useMemo) via `Skia.PictureRecorder` + `beginRecording` in ein `SkPicture`
  gezeichnet; Rendern via `<Picture picture={…} />`.
- **1 Draw-Call statt ~800**; `Math.random()` läuft nur beim Picture-Aufbau →
  Faser-Enden fixiert, kein Fiber-Jitter bei Re-Renders.
- Dark-Theme (ab 4.3): zusätzliche radiale Vignette mit in das Picture gebakt.

### 1.3 Stichnormen-Metriken (`d227e92`)

- `LEDGER_LINE_WIDTH: 2.25` – Hilfslinien schwerer als Systemlinien (Notenstich).
- `STEM_WIDTH: 2.9` = 0.12 spaces bei LINE_SPACING 24.
- Clef-Origin sitzt korrekt auf G-/F-Linie (SMuFL: Baseline = Referenzlinie).

### 1.4 Feedback-Animationen (`f2deafc`)

- **Wrong-Shake:** `shakeX` SharedValue; Sequenz ±2.5/±1.8px, ~510ms gesamt.
  Im Canvas: `wrongShake = useDerivedValue(() => [{ translateX: shakeX.value }])`
  als Group-Transform um die komplette falsche Note (inkl. Hilfslinien).
- **Glow-Puls:** `glowPulse` SharedValue; `withSequence(0.1 @250ms → 1 @450ms,
  Easing.out(Easing.quad))` beim Erscheinen, danach steady 1. Die Glow-Opacity
  hängt nicht mehr am Fade-Effekt.

### 1.5 Kartenrahmen (`0a52f6f`)

- Container-Style: `borderRadius: 12`, `borderWidth: 1`,
  `borderColor: rgba(128,128,128,0.28)`, `overflow: "hidden"`,
  iOS `shadowColor/Offset/Opacity/Radius` + Android `elevation: 4`.

## Phase 2 – PianoKeyboard

- **2.1 Kamera:** bereits nativ gelöst – Pan/Scale/3D-`rotateX`/`perspective`
  laufen über SharedValues auf einem `Animated.View`
  (`transformOrigin: "center bottom"`), kein JS pro Frame. Bewusst nicht
  umgebaut; Viewport-Höhe wird ebenfalls worklet-seitig projiziert.
- **2.2 Premium-Styling (`be51372`):** Idle-Tasten mit vertikalen
  `LinearGradient`-Fills (`KEY_GRADIENTS.whiteIdle/whiteRange/blackIdle`),
  Gloss-Deckel (rgba(255,255,255,0.12)) auf schwarzen Tasten. Zustands- und
  Dimmed-Fills bleiben solide für Lesbarkeit. Gradients nur als Paint-Kinder
  der bestehenden Rects – keine additional Draw-Ops-Struktur.
- **2.3 Feedback:** BlinkMarker (opacity-SV) und Press-Highlight liefen
  bereits worklet-basiert.

## Phase 3 – 60fps

- **3.1 Range-Finder (`417acf4`):** Der 100ms-Poll bleibt, aber:
  - `timeRemaining` → `timerProgressSv` (SharedValue). Timer-Balken-Breite und
    Farbwechsel (rot < 0.3) via `useAnimatedStyle` + `interpolateColor`,
    Badge-Farbe gelb→grau ebenfalls nativ. JS-Funktion `mixColors` entfernt.
  - `setRfState` nur bei diskreten Änderungen: Signatur
    `currentNoteMidi|currentClef|foundRange|isComplete`, verglichen über
    `lastStateSigRef` → statt 10 Re-Renders/s nur bei Notenwechsel etc.
- **3.2 Modes-Audit:** keine weiteren setInterval-Loops in den Modes;
  Feedbacks sind diskrete One-Shot-States + CSS-Keyframes (nativ).
- **3.3 (`c2414bf`):** `PianoKeyboard` als `memo()`-Export.

## Phase 4 – Design-Tokens & Base-UI

- **4.1 (`15d69c9`):** `src/constants/graphics.ts` – `KEY_GRADIENTS`
  (whiteIdle/whiteRange/blackIdle). Importiert von piano-keyboard.tsx und
  range-selector.tsx. Typ: `Record<string, string[]>` (Skia will mutable
  Color-Arrays, kein `as const`).
- **4.2 (`9f57b5e`):** `src/components/ui/base-button.tsx` – memoized,
  themed (Default `theme.accentBlue`), nativer Press-Scale 0.96/90ms down,
  1/140ms up. Einsatz: Range-Finder-„Los geht’s!“-Button, End-Screen-Buttons.
- **4.3 (`f1fc493`):** Dark-Theme-Vignette (radial, rgba schwarz 0→0.25,
  Radius 0.75×max(w,h)) via `Skia.Shader.MakeRadialGradient` ins Picture gebakt.

## Phase 5 – Wow-Effekt

- **Key-Dip (`8561a9e`):** `transform: [{ translateY: highlight.value * 7 }]`
  im KeyHit-Worklet – Taste senkt sich beim Druck physisch ab, im selben
  Worklet wie das Press-Highlight (null Zusatzkosten).

## Phase 6 – Verifikation

- Pro Schritt: `npx tsc --noEmit` + `npm run verify:reanimated` (immer
  `✅ Alles ok`) → Commit (ein Schritt = eine Komponente = ein Commit).
- Alles JS-only → **OTA-Update reicht, kein neuer Dev-Build nötig**.

## Wiederverwendbare Muster

| Muster | Wo | Nutzen |
| --- | --- | --- |
| Offscreen `SkPicture` für statische Texturen | staff-view | 1 Draw-Call statt hunderten |
| Worklet-Positionierung statt JS-State-Spiegel | range-selector, staff-view | Pixel-Sync, kein Jitter |
| SharedValue für kontinuierliche Werte + Signatur-Check diskret | range-finder-mode | 0 Re-Renders für Timer |
| `interpolateColor` statt JS-Farb-Mix | range-finder-mode | native Farbübergänge |
| SMuFL-Glyphen statt gezeichneter Formen | staff-view | typografisch korrekt gratis |
| `memo()` auf teuren Komponenten | piano-keyboard | Render-Kaskaden stoppen |

## Skia-API-Stolperfallen (vgl. PITFALLS.md #19)

- `PictureRecorder`: `finishRecordingAsPicture()` (nicht `finishRecording`).
- `SkCanvas.drawLine(x0, y0, x1, y1, paint)` – 5 Zahlen-Args, keine Points.
- Radialer Shader: `Skia.Shader.MakeRadialGradient(center, r, colors, positions, mode)`.
- `Skia.Color()` akzeptiert auch `rgba(...)`-Strings.
