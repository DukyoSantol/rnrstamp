@echo off
echo Unblocking exe...
powershell -Command "Unblock-File -Path 'rnr_v2.exe'"
echo Done! Now run run.bat
pause