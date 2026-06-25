# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Skill-Priorität
Für dieses Projekt sollen bei passenden Aufgaben die installierten Skills bevorzugt werden, insbesondere:
- `expo-react-native-typescript`
- `react-native-expo`
- vorhandene Expo-Skills wie `expo-ui`, `expo-api-routes`, `expo-dev-client`, `expo-deployment`, `native-data-fetching`

Diese Skills sind bei Expo-/React-Native-/UI-/Audio-/Skia-Aufgaben vor allgemeinen Antworten zu prüfen und zu nutzen.

## Architektur-Grundsatz
Für alle Audio-, Grafik- und Visualisierungsaufgaben gilt:

- **Audio und Grafik strikt entkoppeln.**
- Audioverarbeitung darf nicht vom Render-Takt der UI abhängen.
- Grafik darf keine direkten Audiooperationen ausführen.
- Kommunikation nur über Zustände, Events oder klare Service-Schnittstellen.

Ziel ist, dass Audio und UI jeweils mit maximaler Performance und möglichst wenig Re-Renders arbeiten können.

## Rendering-Vorgabe für Visualisierung und Piano-UI

- Für visuelle Piano-/Keyboard-/Grafik-Komponenten **Skia als Default-Rendering-System** verwenden.
- **Reanimated ergänzend** für Animationen, Transitions und Press-Feedback einsetzen.
- React Native Views nur als **Interaktions-Overlays** oder für einfache Layout-Hüllen nutzen.
- Bei passenden Aufgaben zuerst den installierten Skia-/Reanimated-Skill **`reanimated-skia-performance`** aktivieren und danach die Implementierung darauf aufbauen.
