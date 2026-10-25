@echo off
rem Пересборка "Линия фронта.exe" (нужны Python, pywebview, pyinstaller, pythonnet)
cd /d "%~dp0"
python -m PyInstaller --noconfirm --onefile --windowed --name LiniyaFronta --icon app.ico --add-data "app;app" --distpath dist --workpath build ^
 --exclude-module PyQt5 --exclude-module PySide2 --exclude-module PySide6 --exclude-module PyQt6 --exclude-module qtpy --exclude-module gi --exclude-module cefpython3 ^
 --exclude-module cryptography --exclude-module bcrypt --exclude-module jinja2 --exclude-module setuptools --exclude-module pkg_resources --exclude-module wheel ^
 --exclude-module numpy --exclude-module PIL --exclude-module tkinter --exclude-module webview.platforms.qt --exclude-module webview.platforms.gtk --exclude-module webview.platforms.cef ^
 main.py && copy /y dist\LiniyaFronta.exe "Линия фронта.exe"
