@echo off
REM Copy react-native-audio-api prebuilt binaries from PolyM to notebuddy
REM (avoids the WSL/bash download issue on this Windows machine)
REM
REM CMake expects static libs at: external/android/<abi>/lib*.a
REM CMake expects shared libs at:  android/src/main/jniLibs/<abi>/lib*.so

set "SRC=D:\PolyM\node_modules\react-native-audio-api"
set "DST=D:\notebuddy\node_modules\react-native-audio-api"

echo === Copying jniLibs (shared .so libs) ===
xcopy /E /I /Y "%SRC%\android\src\main\jniLibs" "%DST%\android\src\main\jniLibs"

echo === Creating android subfolder for static .a libs ===
mkdir "%DST%\common\cpp\audioapi\external\android" 2>nul

echo === Copying static .a libs into android subfolder ===
for %%A in (arm64-v8a armeabi-v7a x86 x86_64) do (
  echo Copying %%A ...
  mkdir "%DST%\common\cpp\audioapi\external\android\%%A" 2>nul
  xcopy /E /I /Y "%SRC%\common\cpp\audioapi\external\%%A" "%DST%\common\cpp\audioapi\external\android\%%A"
)

echo === Copying include folders ===
xcopy /E /I /Y "%SRC%\common\cpp\audioapi\external\include" "%DST%\common\cpp\audioapi\external\include"
xcopy /E /I /Y "%SRC%\common\cpp\audioapi\external\include_ffmpeg" "%DST%\common\cpp\audioapi\external\include_ffmpeg"

echo Done.