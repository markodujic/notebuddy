# UI-Polish-Roadmap â€“ Detail-Dokumentation

> VollstÃ¤ndige technische Doku zur 6-Phasen-Politur der notebuddy-UI
> (RangeSelector-Jitter-Fix + Phase 1â€“6). Kurzform: siehe `PLAN.md`.
> Status: alles umgesetzt am 2026-08-31 (Commits `91f484f` â€¦ `8561a9e`).

## Vorarbeit: RangeSelector Boundary-Handle-Jitter-Fix (`91f484f`)

- **Root Cause:** JS-State-Spiegel lief dem nativen Skia-Camera-Transform immer
  einen Frame hinterher â†’ Handles zappelten beim Zoomen.
- **Fix:** zoom-wrapper View entfernt; `BoundaryHandle` sitzt direkt im Viewport.
  Positionierung komplett im `useAnimatedStyle`-Worklet:
  `translateX = panSV + leftÂ·zoomSV âˆ’ HANDLE_WIDTH/2`
  (`left` = Base-Geometry-Key-Center via `minLeftBase/maxLeftBase + whiteW0/2`).
  `styles.boundaryBar` verankert auf `left: 0`; die gezoomten
  `minLeft/maxLeft`-Werte entfallen.
- **Lektion:** SharedValues, die im selben Worklet-Frame gelesen werden, sind
  pixel-synchron mit der nativen Kamera â€“ JS-State ist es nicht.

## Phase 1 â€“ StaffView

### 1.1 Bravura-SMuFL-NotenkÃ¶pfe (`c1f12f0`)

- NotenkÃ¶pfe (display/wrong/hover) als echte Bravura-Glyphen
  (`NOTE_HEAD_FILLED` \uE0A4) via Skia `Text` statt rotierter gezeichneter Ovale.
- Glow-Ring + Hover-Outline als `style="stroke"`-Glyphen.
- `glyphHalfWidth()` misst via `font.measureText`; Hals sitzt exakt an der
  Glyph-Kante (`stemOffsetX = headHalfW`).
- `makeOvalPath`/`Skia`/`Path`-Imports entfallen.
- **SMuFL-Konvention:** 1 em = 4 Staff-Spaces â†’ `NOTE_GLYPH_FONT_SIZE: 96`
  (= LINE_SPACING 24 Ã— 4) macht den Kopf exakt 1 Space hoch â€“ Proportionen
  automatisch typografisch korrekt. `NOTE_HEAD_WIDTH_SPACES: 1.3` als Fallback.
- Hinweis: `LINE_SPACING` ist im selben Objektliteral in `music-font.ts` nicht
  referenzierbar â†’ 96 mit Kommentar hartkodiert.

### 1.2 Pergament als offscreen Picture (`cf84519`)

- `useParchmentPicture(width, height, colors)` in `staff-view.tsx`: Hintergrund,
  Noise (4Ã—4-BlÃ¶cke, ~400 Rects) und 12 horizontale Fasern werden **einmalig**
  (useMemo) via `Skia.PictureRecorder` + `beginRecording` in ein `SkPicture`
  gezeichnet; Rendern via `<Picture picture={â€¦} />`.
- **1 Draw-Call statt ~800**; `Math.random()` lÃ¤uft nur beim Picture-Aufbau â†’
  Faser-Enden fixiert, kein Fiber-Jitter bei Re-Renders.
- Dark-Theme (ab 4.3): zusÃ¤tzliche radiale Vignette mit in das Picture gebakt.

### 1.3 Stichnormen-Metriken (`d227e92`)

- `LEDGER_LINE_WIDTH: 2.25` â€“ Hilfslinien schwerer als Systemlinien (Notenstich).
- `STEM_WIDTH: 2.9` = 0.12 spaces bei LINE_SPACING 24.
- Clef-Origin sitzt korrekt auf G-/F-Linie (SMuFL: Baseline = Referenzlinie).

### 1.4 Feedback-Animationen (`f2deafc`)

- **Wrong-Shake:** `shakeX` SharedValue; Sequenz Â±2.5/Â±1.8px, ~510ms gesamt.
  Im Canvas: `wrongShake = useDerivedValue(() => [{ translateX: shakeX.value }])`
  als Group-Transform um die komplette falsche Note (inkl. Hilfslinien).
- **Glow-Puls:** `glowPulse` SharedValue; `withSequence(0.1 @250ms â†’ 1 @450ms,
  Easing.out(Easing.quad))` beim Erscheinen, danach steady 1. Die Glow-Opacity
  hÃ¤ngt nicht mehr am Fade-Effekt.

### 1.5 Kartenrahmen (`0a52f6f`)

- Container-Style: `borderRadius: 12`, `borderWidth: 1`,
  `borderColor: rgba(128,128,128,0.28)`, `overflow: "hidden"`,
  iOS `shadowColor/Offset/Opacity/Radius` + Android `elevation: 4`.

## Phase 2 â€“ PianoKeyboard

- **2.1 Kamera:** bereits nativ gelÃ¶st â€“ Pan/Scale/3D-`rotateX`/`perspective`
  laufen Ã¼ber SharedValues auf einem `Animated.View`
  (`transformOrigin: "center bottom"`), kein JS pro Frame. Bewusst nicht
  umgebaut; Viewport-HÃ¶he wird ebenfalls worklet-seitig projiziert.
- **2.2 Premium-Styling (`be51372`):** Idle-Tasten mit vertikalen
  `LinearGradient`-Fills (`KEY_GRADIENTS.whiteIdle/whiteRange/blackIdle`),
  Gloss-Deckel (rgba(255,255,255,0.12)) auf schwarzen Tasten. Zustands- und
  Dimmed-Fills bleiben solide fÃ¼r Lesbarkeit. Gradients nur als Paint-Kinder
  der bestehenden Rects â€“ keine additional Draw-Ops-Struktur.
- **2.3 Feedback:** BlinkMarker (opacity-SV) und Press-Highlight liefen
  bereits worklet-basiert.

## Phase 3 â€“ 60fps

- **3.1 Range-Finder (`417acf4`):** Der 100ms-Poll bleibt, aber:
  - `timeRemaining` â†’ `timerProgressSv` (SharedValue). Timer-Balken-Breite und
    Farbwechsel (rot < 0.3) via `useAnimatedStyle` + `interpolateColor`,
    Badge-Farbe gelbâ†’grau ebenfalls nativ. JS-Funktion `mixColors` entfernt.
  - `setRfState` nur bei diskreten Ã„nderungen: Signatur
    `currentNoteMidi|currentClef|foundRange|isComplete`, verglichen Ã¼ber
    `lastStateSigRef` â†’ statt 10 Re-Renders/s nur bei Notenwechsel etc.
- **3.2 Modes-Audit:** keine weiteren setInterval-Loops in den Modes;
  Feedbacks sind diskrete One-Shot-States + CSS-Keyframes (nativ).
- **3.3 (`c2414bf`):** `PianoKeyboard` als `memo()`-Export.

## Phase 4 â€“ Design-Tokens & Base-UI

- **4.1 (`15d69c9`):** `src/constants/graphics.ts` â€“ `KEY_GRADIENTS`
  (whiteIdle/whiteRange/blackIdle). Importiert von piano-keyboard.tsx und
  range-selector.tsx. Typ: `Record<string, string[]>` (Skia will mutable
  Color-Arrays, kein `as const`).
- **4.2 (`9f57b5e`):** `src/components/ui/base-button.tsx` â€“ memoized,
  themed (Default `theme.accentBlue`), nativer Press-Scale 0.96/90ms down,
  1/140ms up. Einsatz: Range-Finder-â€žLos gehtâ€™s!â€œ-Button, End-Screen-Buttons.
- **4.3 (`f1fc493`):** Dark-Theme-Vignette (radial, rgba schwarz 0â†’0.25,
  Radius 0.75Ã—max(w,h)) via `Skia.Shader.MakeRadialGradient` ins Picture gebakt.

## Phase 5 â€“ Wow-Effekt

- **Key-Dip (`8561a9e`):** `transform: [{ translateY: highlight.value * 7 }]`
  im KeyHit-Worklet â€“ Taste senkt sich beim Druck physisch ab, im selben
  Worklet wie das Press-Highlight (null Zusatzkosten).

## Phase 6 â€“ Verifikation

- Pro Schritt: `npx tsc --noEmit` + `npm run verify:reanimated` (immer
  `âœ… Alles ok`) â†’ Commit (ein Schritt = eine Komponente = ein Commit).
- Alles JS-only â†’ **OTA-Update reicht, kein neuer Dev-Build nÃ¶tig**.

## Wiederverwendbare Muster

| Muster | Wo | Nutzen |
| --- | --- | --- |
| Offscreen `SkPicture` fÃ¼r statische Texturen | staff-view | 1 Draw-Call statt hunderten |
| Worklet-Positionierung statt JS-State-Spiegel | range-selector, staff-view | Pixel-Sync, kein Jitter |
| SharedValue fÃ¼r kontinuierliche Werte + Signatur-Check diskret | range-finder-mode | 0 Re-Renders fÃ¼r Timer |
| `interpolateColor` statt JS-Farb-Mix | range-finder-mode | native FarbÃ¼bergÃ¤nge |
| SMuFL-Glyphen statt gezeichneter Formen | staff-view | typografisch korrekt gratis |
| `memo()` auf teuren Komponenten | piano-keyboard | Render-Kaskaden stoppen |

## Skia-API-Stolperfallen (vgl. PITFALLS.md #19)

- `PictureRecorder`: `finishRecordingAsPicture()` (nicht `finishRecording`).
- `SkCanvas.drawLine(x0, y0, x1, y1, paint)` â€“ 5 Zahlen-Args, keine Points.
- Radialer Shader: `Skia.Shader.MakeRadialGradient(center, r, colors, positions, mode)`.
- `Skia.Color()` akzeptiert auch `rgba(...)`-Strings.

## Nachtrag (2026-08-31): Staff-Rendering-Konsolidierung

Der Bestands-Audit zeigte: GrandStaffView war eine Zweit-Implementierung ohne
alle Polish-Phasen (Oval-Notenkopf statt Glyph, ~3600 Texture-Rects als
Einzel-Draw-Calls statt Picture, kein Rahmen, kein Store-Theme). Redesign:

- `parchment-picture.ts` (neu): `useParchmentPicture` â€“ eine Quelle der
  Wahrheit fuer Pergament + Noise + Fasern + Dark-Vignette (offscreen Picture).
- `staff-glyphs.ts` (neu): `glyphGeom`/`noteHeadGeom` â€“ Ink-Box-Messung der
  Bravura-Glyphen (Fix fuer verschobene Notenkoepfe, gilt jetzt fuer beide
  Views).
- `staff-primitives.tsx` (neu): `<StaffLines>`, `<ClefGlyph>`, `<LedgerLines>`
  (optional mit Pergament-Freilegung), `<Stem>`, `<NoteHeadGlyph>` (fill oder
  outline).
- `staff-view.tsx`: duenne Schale aus Primitives + Interaktion + Animationen.
- `grand-staff-view.tsx`: Rewrite auf Primitives â€“ Glyph-Notenkoepfe,
  Picture-Pergament, Dark-Vignette, Kartenrahmen, Theme via `useAppStore`
  statt `useColorScheme`.
- `staff-geometry.ts`: unveraendert (Logik/Rendering-Trennung bleibt).

Commits: `e233b4c` (Extraktion), darauffolgend (GrandStaffView-Rewrite).
