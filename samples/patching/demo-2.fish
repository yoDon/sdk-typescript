#!/usr/bin/fish

cp ./src/workflows/patched.ts ./src/workflows/current.ts
npm run build

set_color blue; echo "Running worker with patched workflow"
timeout 4s npm start

set_color red; echo "Murdered worker after 4s enter to continue"
read

cp ./src/workflows/new.ts ./src/workflows/current.ts
npm run build

set_color blue; echo "Running worker with deprecated patch / new code only"
timeout 15s npm start
