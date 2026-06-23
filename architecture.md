# notebuddy – Zielarchitektur für eine performante Expo-App

Diese Datei beschreibt eine sinnvolle Architektur für **notebuddy** auf Basis der installierten Expo-APIs. Das zentrale Prinzip lautet:

> **Grafik und Audio müssen strikt entkoppelt sein**, damit Rendering und Audioverarbeitung jeweils mit maximaler Performance laufen.

## Leitprinzipien

1. **Audio und Grafik laufen unabhängig voneinander**
   - Audio darf niemals vom Render-Takt der UI abhängig sein.
   - Grafik darf niemals direkt Audiosignale verarbeiten.
   - Kommunikation nur über Status, Events oder dedizierte State-Hooks.

2. **Klare Schichtentrennung**
   - Navigation
   - Features
   - Services / Infrastruktur
   - UI / Rendering

3. **Einweg-Datenfluss bevorzugen**
   - Services erzeugen Ergebnisse.
   - UI konsumiert diese Ergebnisse.
   - Keine zyklischen Abhängigkeiten zwischen Visualisierung und Audio.

4. **Performance zuerst**
   - `reanimated` / Skia / SVG für Animation und Visualisierung
   - `expo-audio` / `expo-speech-recognition` für Audio und Sprache
   - minimale Re-Renders durch saubere Zustandsgrenzen

## Architekturübersicht

### 1. Navigation Layer

Verantwortlich für Routen, Layouts und Bildschirmwechsel.

- `expo-router`
- `src/app/`

Aufgaben:
- App-Start
- Screen-Navigation
- Modals
- Deep Links

### 2. Feature Layer

Verantwortlich für fachliche Funktionen.

Beispiele:
- Lernmodi
- Audio-Übungen
- Spracheingabe-Modi
- Statistik / Fortschritt
- Einstellungen

Aufgaben:
- Zustand pro Feature
- fachliche Regeln
- Steuerung von Workflows

### 3. Service / Infrastructure Layer

Verantwortlich für Geräte- und Systemzugriffe.

| API | Aufgabe |
|-----|---------|
| `expo-audio` | Aufnahme / Wiedergabe |
| `expo-speech-recognition` | Spracheingabe |
| `expo-sqlite` | lokale Persistenz |
| `expo-linking` | Deep Links |
| `expo-web-browser` | externe Inhalte |
| `expo-device` | Geräteerkennung |
| `expo-constants` | Runtime-Konfiguration |

**Wichtig:** Diese Schicht liefert nur Daten und Events, aber keine UI-Logik.

### 4. Presentation Layer

Verantwortlich für Darstellung, Animation und Interaktion.

| API / Lib | Aufgabe |
|-----------|---------|
| `@expo/ui` | native UI-Bausteine |
| `@shopify/react-native-skia` | performante Visualisierungen |
| `react-native-svg` | Vektor-Grafiken |
| `react-native-reanimated` | Animationen |
| `react-native-gesture-handler` | Touch- und Swipe-Gesten |
| `expo-image` | optimierte Medienanzeige |
| `expo-font` | Schriftarten / Notationsfonts |
| `expo-symbols` | native Symbolik |
| `expo-glass-effect` | visuelle Glaseffekte |

## Trennung von Grafik und Audio

Das wichtigste Architekturziel ist eine **saubere Entkopplung**.

### Audio-Schicht

Die Audio-Schicht übernimmt:
- Aufnahme
- Wiedergabe
- Tonerkennung
- Spracheingabe
- Signalverarbeitung

Sie sollte:
- keine UI rendern
- keine Animationen triggern, die vom Audio-Thread abhängen
- ihre Ergebnisse nur als Zustandswerte oder Events bereitstellen

### Grafik-Schicht

Die Grafik-Schicht übernimmt:
- Noten-/Diagramm-Rendering
- Animationen
- Feedback-UI
- visuelle Fortschrittsanzeigen

Sie sollte:
- keine direkten Audiooperationen ausführen
- keine Audioanalyse berechnen
- nur auf Zustandsänderungen reagieren

### Kommunikationsmuster

Empfohlen ist folgender Fluss:

```text
Audio Service → Ergebnis / Event → Feature State → UI Rendering
```

Nicht empfohlen ist:

```text
UI ↔ Audio direkt verschränkt
```

## Empfohlene Ordnerstruktur

```text
src/
├── app/                # Expo Router: Routen, Layouts, Screens
├── components/         # Wiederverwendbare UI-Komponenten
├── constants/          # App-Konstanten, UI- und Feature-Werte
├── hooks/              # Zustands- und Service-Hooks
├── features/           # Fachliche Module wie Lernen, Audio, Statistik
├── services/          # Audio, Speech, SQLite, Linking, Browser
├── stores/             # Globale App-Zustände
├── utils/              # Hilfsfunktionen
└── assets/             # Bilder, Fonts, Icons
```

## Rolle der installierten APIs im Zielsystem

| Paket | Rolle |
|------|------|
| `expo-router` | Routing / Screens |
| `expo-audio` | Audio-Handling |
| `expo-speech-recognition` | Spracheingabe |
| `expo-sqlite` | Persistenz |
| `expo-font` | Fonts / Notation |
| `expo-image` | Medien |
| `expo-linking` | Deep Links |
| `expo-web-browser` | Externe Inhalte |
| `expo-device` | Geräteabhängige Anpassung |
| `expo-constants` | Runtime-Konfiguration |
| `expo-splash-screen` | Startverhalten |
| `expo-system-ui` | System-UI |
| `expo-status-bar` | Statusbar |
| `expo-symbols` | native Symbole |
| `expo-glass-effect` | UI-Effekte |
| `@expo/ui` | native Komponenten |
| `@shopify/react-native-skia` | High-Performance-Visualisierung |
| `react-native-reanimated` | Animationen |
| `react-native-gesture-handler` | Gesten |
| `react-native-svg` | Vektorformen |
| `@tonejs/midi` | MIDI-Verarbeitung |
| `fft.js` | Frequenzanalyse |
| `vexflow` | Musiknotation |

## Ableitung aus der Referenz-App

Die untersuchte `notenlern-app` zeigt, dass diese Architektur besonders gut für Lern-Apps geeignet ist:

- Audio-Feedback ist ein eigener Flow.
- Visualisierung ist ein eigener Flow.
- Spracheingabe ist ein eigener Flow.
- Persistenz bleibt unabhängig.

Das ist genau die richtige Richtung für eine performante App: **Services liefern Zustände, UI zeigt Zustände an**.

## Fazit

Eine gute Architektur für **notebuddy** ist eine Expo-App mit:

- klarer Router-Struktur
- sauber getrennten Feature-Modulen
- isolierten Audio-Services
- eigenständiger Rendering-Schicht
- strikter Entkopplung von Grafik und Audio

So bleibt die App sowohl für Audio als auch für UI flüssig und gut wartbar.