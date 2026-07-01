# notebuddy – Phase 4: Restliche Modi (1:1 aus notenlern-app)

> Detaillierter Umsetzungsplan für die 4 verbleibenden Modi aus der Svelte-Referenz-App.
> Alle Funktionen werden 1:1 übernommen, mit der notebuddy-Architektur.
>
> Branch: `feat/phase-4-modes` · Stand: 2026-07-01

---

## Reihenfolge

| #       | Modus                     | Aufwand | Abhängigkeiten           |
| ------- | ------------------------- | ------- | ------------------------ |
| **4.1** | Klavier → Note            | Niedrig | Domain+Keyboard fertig   |
| **4.2** | Notensystem visualisieren | Mittel  | InteractiveStaffView neu |
| **4.3** | Tutorial (Erklärmodus)    | Mittel  | Audio+Keyboard vorhanden |
| **4.4** | Tonumfang-Finder          | Hoch    | RangeFinder-Domain + 4.2 |

---

## 4.1 — Klavier → Note

### Flow (1:1 aus alter App)

1. Session startet → `targetNote` (random aus Range)
2. `PianoKeyboard` wird interaktiv gezeigt
3. User tappt eine Taste → MIDI wird gespeichert
4. `NoteButtons` erscheint: 7 Noten (C D E F G A H) + Swipe (♯/♭) + 9 Oktaven
5. User wählt Note+Vorzeichen → dann Oktave → `submitNote(getippteMidi)`
6. Feedback → nächste Aufgabe

### Schritte

| #     | Datei                                                | Beschreibung                                                                    |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| 4.1.1 | `src/components/controls/note-buttons.tsx` (**neu**) | NoteButtons: 7 Noten-Buttons mit Swipe-Geste, 9 Oktave-Buttons, Flash-Animation |
| 4.1.2 | `src/app/piano-to-note.tsx` (**neu**)                | Screen: Session + Keyboard + NoteButtons + Feedback                             |
| 4.1.3 | `src/app/index.tsx`                                  | Route `/piano-to-note`                                                          |
| 4.1.4 | `src/components/piano-keyboard.tsx`                  | `onKeyPress` Prop falls noch nicht vorhanden                                    |

---

## 4.2 — Notensystem visualisieren

### Flow

1. Session → `targetNote` + `correctPosition`
2. Zwei Input-Modi: 🎤 Speech oder 🎼 Graphic
3. **Speech:** Positionsnamen erkennen → mappen
4. **Graphic:** InteractiveStaffView tippen
5. Position-Prüfung (mit Ledger-Toleranz)
6. Feedback → nächste Aufgabe

### Schritte

| #     | Datei                                                       | Beschreibung                                        |
| ----- | ----------------------------------------------------------- | --------------------------------------------------- |
| 4.2.1 | `src/domain/music/visualization.ts` (**neu**)               | `getValidVisualizationNotes(clef)`, Ledger-Toleranz |
| 4.2.2 | `src/components/staff/interactive-staff-view.tsx` (**neu**) | Skia-Staff mit 29 Touch-Zonen                       |
| 4.2.3 | `src/services/speech-position-mapper.ts` (**neu**)          | Sprache → StaffPosition                             |
| 4.2.4 | `src/hooks/use-speech-recognition.ts` (**neu**)             | expo-speech-recognition Wrapper                     |
| 4.2.5 | `src/app/visualize.tsx` (**neu**)                           | Screen mit Toggle + Feedback                        |
| 4.2.6 | `src/app/index.tsx`                                         | Route anpassen                                      |

---

## 4.3 — Tutorial (Erklärmodus)

### Flow (4 Phasen)

1. **Phase 1:** Animation aller 2er/3er-Gruppen (passiv)
2. **Phase 2:** Mic — 2er-Gruppen nachspielen
3. **Phase 3:** Mic — 3er-Gruppen nachspielen
4. **Phase 4:** Mic — alle 88 Tasten

### Schritte

| #     | Datei                                                 | Beschreibung                           |
| ----- | ----------------------------------------------------- | -------------------------------------- |
| 4.3.1 | `src/domain/learning/tutorial-config.ts` (**neu**)    | Gruppen-Konstanten, Toleranzen         |
| 4.3.2 | `src/hooks/use-tutorial-phase.ts` (**neu**)           | Phase-State-Machine                    |
| 4.3.3 | `src/components/tutorial/tutorial-view.tsx` (**neu**) | UI: Instructions + Keyboard + Progress |
| 4.3.4 | `src/app/tutorial.tsx` (**neu**)                      | Screen                                 |
| 4.3.5 | `src/app/index.tsx`                                   | Route anpassen                         |

---

## 4.4 — Tonumfang-Finder

### Flow

1. Start-Screen mit Timer-Slider (1–10s)
2. Adaptiver Test: Notes basierend auf Antworten
3. Pro Note: Timer + Position tippen
4. Test-Ende → Range berechnen → übernehmen

### Schritte

| #     | Datei                                                    | Beschreibung            |
| ----- | -------------------------------------------------------- | ----------------------- |
| 4.4.1 | `src/domain/learning/range-finder.ts` (**neu**)          | Adaptiver Algorithmus   |
| 4.4.2 | `src/stores/range-finder-store.ts` (**neu**)             | Zustand-Wrapper         |
| 4.4.3 | `src/components/range-finder/timer-slider.tsx` (**neu**) | Timer-Slider mit Emojis |
| 4.4.4 | `src/app/range-finder.tsx` (**neu**)                     | Screen                  |
| 4.4.5 | `src/app/index.tsx`                                      | Route anpassen          |

---

## Domain-Ergänzungen (übergreifend)

| Datei                      | Beschreibung                                      |
| -------------------------- | ------------------------------------------------- |
| `src/domain/music/note.ts` | `fromNameAndOctave(name, octave)` für NoteButtons |

---

_Erstellt: 2026-07-01 · Status: In Implementierung (4.1 zuerst)_
