@echo off
REM Build script for Android dev build with Git bash in PATH
REM (needed for react-native-audio-api prebuilt download task)
set "PATH=C:\Program Files\Git\usr\bin;%PATH%"
cd /d D:\notebuddy
call npm run android 2>&1