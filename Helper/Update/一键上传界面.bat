@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "SCRIPT_DIR=%~dp0"

if "%~1"=="" goto gui
if /I "%~1"=="gui" goto gui
if /I "%~1"=="help" goto help
if /I "%~1"=="/h" goto help
if /I "%~1"=="-h" goto help
if /I "%~1"=="auto" goto auto
if /I "%~1"=="file" goto file
if /I "%~1"=="file-norestart" goto file_norestart
if /I "%~1"=="restart" goto restart

rem If the first argument is not a command, treat all arguments as files.
rem This makes drag-and-drop and direct path calls work:
rem   一键上传界面.bat C:\path\to\projet\index.html modules\main.js
set "NO_RESTART=0"
goto collect_files_direct

:gui
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%UpdateTool-GUI.ps1"
goto end_gui

:auto
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%UpdateTool-GUI.ps1" -Auto
goto end

:file
set "NO_RESTART=0"
goto collect_files

:file_norestart
set "NO_RESTART=1"
goto collect_files

:collect_files
shift
goto collect_files_direct

:collect_files_direct
if "%~1"=="" (
  echo No file specified.
  exit /b 2
)
set "UPLOADED_ANY=0"
:upload_loop
if "%~1"=="" goto after_upload_loop
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%UpdateTool-GUI.ps1" -Files "%~1" -NoRestart
if errorlevel 1 exit /b %ERRORLEVEL%
set "UPLOADED_ANY=1"
shift
goto upload_loop

:after_upload_loop
if "!UPLOADED_ANY!"=="0" (
  echo No file specified.
  exit /b 2
)
if "!NO_RESTART!"=="0" powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%UpdateTool-GUI.ps1" -RestartOnly
goto end

:restart
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%UpdateTool-GUI.ps1" -RestartOnly
goto end

:help
echo Usage:
echo   %~nx0                  Open GUI ^(default when double-clicked^)
echo   %~nx0 gui              Open GUI
echo   %~nx0 auto             Upload default update files and restart service
echo   %~nx0 file FILE_OR_DIR...     Upload listed project files/folders and restart service
echo   %~nx0 file-norestart FILE_OR_DIR... Upload listed project files/folders without restart
echo   %~nx0 FILE_OR_DIR...          Upload listed project files/folders and restart service
echo   %~nx0 restart          Restart service only
echo   %~nx0 help             Show this help
echo.
echo Examples:
echo   %~nx0 auto
echo   %~nx0 file index.html modules\main.js
echo   %~nx0 C:\path\to\projet\modules
goto end

:end_gui
exit /b %ERRORLEVEL%

:end
exit /b %ERRORLEVEL%
