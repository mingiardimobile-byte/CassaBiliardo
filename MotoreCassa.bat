   @echo off
   echo Accensione motore Cassa Biliardo...
   start /min cmd /c "cd /d C:\CassaBiliardo && npm run dev"
   timeout /t 6 /nobreak >nul
   echo Apertura applicazione...
   start chrome --app=http://localhost:5173/
   exit