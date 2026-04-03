@echo off
setlocal
set "HERE=%~dp0"
if not exist "%HERE%venv\Scripts\rembg.exe" (
  echo 漫画野郎: bundled rembg venv missing. Run npm run bundle-rembg before npm run dist.
  exit /b 127
)
"%HERE%venv\Scripts\rembg.exe" %*
