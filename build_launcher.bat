@echo off
rem Сборка лаунчера "Лаунчер Линия фронта.exe" (нужны Python и pyinstaller)
cd /d "%~dp0"
python -m PyInstaller --noconfirm --onefile --windowed --name LiniyaFrontaLauncher --icon app.ico --add-data "app.ico;." --distpath dist --workpath build ^
 --exclude-module numpy --exclude-module PIL --exclude-module webview --exclude-module setuptools --exclude-module pkg_resources ^
 launcher\launcher.py
