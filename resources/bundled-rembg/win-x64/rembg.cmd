@echo off
setlocal
set "HERE=%~dp0"
if not exist "%HERE%venv\Scripts\python.exe" (
  echo 漫画野郎: bundled rembg venv missing. Run npm run bundle-rembg before npm run dist.
  exit /b 127
)
if exist "%HERE%invoke-rembg.py" (
  "%HERE%venv\Scripts\python.exe" "%HERE%invoke-rembg.py" %*
) else (
  "%HERE%venv\Scripts\rembg.exe" %*
)
