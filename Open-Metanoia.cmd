@echo off
if exist "%~dp0src-tauri\target\release\metanoia-v2.exe" (
  copy /y "%~dp0src-tauri\target\release\metanoia-v2.exe" "%~dp0outputs\Metanoia V2.exe" >nul 2>&1
)
start "" "%~dp0outputs\Metanoia V2.exe"
