@echo off
REM Schlanker lokaler Dev-Build: nur EINE ABI statt aller 4 Architekturen
REM (kleineres APK, schnellere Builds). Ohne Metro-Start!
REM Metro danach manuell starten: npx expo start
REM
REM Usage: scripts\build-android-slim.bat [abi] [adb-serial]
REM
REM Beispiele:
REM   scripts\build-android-slim.bat                          -> x86_64 (Standard-Emulator)
REM   scripts\build-android-slim.bat arm64-v8a                -> physisches Geraet (ARM)
REM   scripts\build-android-slim.bat x86_64 emulator-5554     -> expliziter Emulator

setlocal

set "ABI=%~1"
if "%ABI%"=="" set "ABI=x86_64"
set "SERIAL=%~2"

set "ADB=%LOCALAPPDATA%\Android\sdk\platform-tools\adb.exe"
set "APK=D:\notebuddy\android\app\build\outputs\apk\debug\app-debug.apk"

REM Git-Bash in PATH (noetig fuer react-native-audio-api prebuilt download task)
set "PATH=C:\Program Files\Git\usr\bin;%PATH%"

echo === Slim Dev-Build (ABI: %ABI%) ===
cd /d D:\notebuddy\android

call gradlew.bat assembleDebug --console=plain -PreactNativeArchitectures=%ABI%
if errorlevel 1 (
  echo.
  echo BUILD FEHLGESCHLAGEN.
  exit /b 1
)

echo.
echo === Installiere APK ===
if "%SERIAL%"=="" (
  "%ADB%" install -r "%APK%"
) else (
  "%ADB%" -s %SERIAL% install -r "%APK%"
)
if errorlevel 1 (
  echo.
  echo INSTALLATION FEHLGESCHLAGEN.
  exit /b 1
)

echo.
echo Fertig! Metro jetzt manuell starten: npx expo start
endlocal
