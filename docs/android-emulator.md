# Android Emulator – Setup & Befehle

## Verfügbarer AVD

- `Medium_Phone_API_36.1`

## Skripte (alle in `scripts/`)

### Emulator starten

```cmd
:: Normal (mit Snapshot, schneller)
scripts\start-emulator.bat

:: Cold Boot (frisch, wichtig für Mikrofon!)
scripts\start-emulator.bat Medium_Phone_API_36.1 --cold
```

### App bauen + installieren

```cmd
:: Baut die App und installiert auf dem Emulator
:: (inkl. Git-Bash-Fix für react-native-audio-api)
scripts\run-android-debug.bat
```

### Schlanker Dev-Build (nur eine ABI, ohne Metro-Start) – Standard

```cmd
:: Emulator (x86_64) – Standardweg für die Entwicklung
npm run android:slim

:: Physisches Gerät (ARM)
npm run android:slim:arm

:: Direkter Aufruf mit ABI / adb-Serial
scripts\build-android-slim.bat x86_64 emulator-5554
```

- Baut nur die angegebene Architektur → deutlich kleineres APK und schnellere
  Builds (x86_64 nur ca. 1/3 der Größe gegenüber allen 4 ABIs).
- Installiert automatisch, startet aber **kein** Metro → danach `npx expo start`.
- **Achtung:** x86_64-Builds laufen nur auf x86_64-Emulatoren, arm64-v8a-Builds
  nur auf ARM-Geräten. Vor jedem Dev-Build: `npm run verify:reanimated`.

### Audio-Binaries kopieren (nur nach `npm install`)

```cmd
:: Kopiert Prebuilt-Binaries von D:\PolyM (Workaround für WSL/bash-Problem)
scripts\copy-audio-binaries.bat
```

### Auf Boot warten + APK installieren

```cmd
scripts\wait-and-install.bat
```

---

## Manuelle Befehle (PowerShell)

### Emulator starten (Cold Boot)

```powershell
& "$env:LOCALAPPDATA\Android\sdk\emulator\emulator.exe" -avd Medium_Phone_API_36.1 -no-snapshot -wipe-data
```

### Emulator starten (Normal)

```powershell
& "$env:LOCALAPPDATA\Android\sdk\emulator\emulator.exe" -avd Medium_Phone_API_36.1
```

### AVDs auflisten

```powershell
& "$env:LOCALAPPDATA\Android\sdk\emulator\emulator.exe" -list-avds
```

### Geräte auflisten

```powershell
& "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe" devices
```

### App manuell installieren

```powershell
& "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe" -s emulator-5554 install -r "D:\notebuddy\android\app\build\outputs\apk\debug\app-debug.apk"
```

### App starten

```powershell
& "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe" -s emulator-5554 shell am start -n com.ddigitall.notebuddy/.MainActivity
```

### Logcat (Audio + JS)

```powershell
& "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe" -s emulator-5554 logcat -t 100 ReactNativeJS:V AudioAPI:V
```

---

## Mikrofon im Emulator

### Problem

Der Android-Emulator leitet das Windows-Mikrofon nicht automatisch durch.
Logcat zeigt: `pcm_readi failed with 'I/O error'` + `inserting silence`.

### Lösung

1. **Emulator komplett schließen**
2. **Cold Boot**: `scripts\start-emulator.bat Medium_Phone_API_36.1 --cold`
3. **Im Emulator**: Drei Punkte `...` → **Microphone** → einschalten
4. **Windows**: Einstellungen → Datenschutz → Mikrofon → `qemu-system-x86_64.exe` erlauben
5. App neu starten

### Falls weiterhin kein Ton

Emulator-Audio-Passthrough ist auf Windows unzuverlässig.
Alternative: **Physisches Gerät** per USB:

```cmd
adb devices
npm run android
```

---

## Bekannte Build-Probleme

### `SDK location not found`

→ `android/local.properties` muss existieren:

```
sdk.dir=C:/Users/dujic/AppData/Local/Android/Sdk
```

### `downloadPrebuiltBinaries` schlägt fehl (WSL bash)

→ `android/build.gradle` deaktiviert den Task (bereits konfiguriert).
→ Binaries von `D:\PolyM` kopieren: `scripts\copy-audio-binaries.bat`

### `INSTALL_FAILED_INSUFFICIENT_STORAGE`

→ Emulator mit `-wipe-data` neu starten (Cold Boot).

### `NoClassDefFoundError: AnyTypeProvider`

→ `expo-splash-screen` Version-Mismatch. Fix:

```cmd
npx expo install expo-splash-screen
```
