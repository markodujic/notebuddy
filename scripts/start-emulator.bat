@echo off
REM Startet den Android-Emulator mit korrektem Pfad und Cold-Boot-Option
REM Usage: scripts\start-emulator.bat [avd-name] [--cold]
REM
REM Beispiele:
REM   scripts\start-emulator.bat                    -> Standard AVD mit Snapshot
REM   scripts\start-emulator.bat Medium_Phone_API_36.1 --cold   -> Cold Boot (fuer Mikrofon)

setlocal

set "EMU=%LOCALAPPDATA%\Android\sdk\emulator\emulator.exe"
set "ADB=%LOCALAPPDATA%\Android\sdk\platform-tools\adb.exe"

REM Default AVD
set "AVD=Medium_Phone_API_36.1"
if not "%~1"=="" set "AVD=%~1"

REM Flags
set "FLAGS="
if /i "%~2"=="--cold" (
  set "FLAGS=-no-snapshot -wipe-data"
  echo Starting emulator with COLD BOOT (fresh, no snapshot) ...
) else (
  echo Starting emulator with snapshot ...
)

echo AVD: %AVD%
echo.

start "" "%EMU%" -avd %AVD% %FLAGS%

echo Waiting for device ...
"%ADB%" wait-for-device
echo Device connected!

REM Warte bis Boot komplett
:BOOTLOOP
"%ADB%" shell getprop sys.boot_completed > "%TEMP%\bootcheck.txt" 2>nul
findstr /C:"1" "%TEMP%\bootcheck.txt" >nul 2>&1
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto BOOTLOOP
)
echo Boot completed! Emulator ready.

"%ADB%" devices
endlocal