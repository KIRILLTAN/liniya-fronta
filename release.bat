@echo off
rem Выпуск новой версии на GitHub: release.bat v1.1.0 "что нового"
rem Лаунчер у игроков увидит новую версию и предложит обновиться.
cd /d "%~dp0"
if "%~1"=="" (echo Укажите версию, например: release.bat v1.1.0 "Новые заводы" & exit /b 1)
call build.bat || exit /b 1
call build_launcher.bat || exit /b 1
gh release create %1 dist\LiniyaFronta.exe dist\LiniyaFrontaLauncher.exe --title "Линия фронта %1" --notes "%~2"
