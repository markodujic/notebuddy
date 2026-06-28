@echo off
REM Wait for emulator boot completion and install APK
setlocal
set "ADB=%LOCALAPPDATA%\Android\sdk\platform-tools\adb.exe"
set "APK=D:\notebuddy\android\app\build\outputs\apk\debug\app-debug.apk"

echo Waiting for emulator boot ...
:WAITLOOP
"%ADB%" -s emulator-5554 shell getprop sys.boot_completed > "%TEMP%\bootcheck.txt" 2>nul
findstr /C:"1" "%TEMP%\bootcheck.txt" >nul 2>&1
if errorlevel 1 (
  echo ... still booting
  timeout /t 3 /nobreak >nul
  goto WAITLOOP
)
echo Boot completed!

echo Installing APK ...
"%ADB%" -s emulator-5554 install -r -d "%APK%"

if errorlevel 1 (
  echo.
  echo Installation failed. Trying with --no-incremental ...
  "%ADB%" -s emulator-5554 install -r "%APK%"
)

echo Done.
endlocal