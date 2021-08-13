#!/usr/bin/fish

cp ./src/workflows/old.ts ./src/workflows/current.ts
npm run build

set_color blue; echo "Running worker with old workflow"
timeout 4s npm start

set_color red; echo "Murdered worker after 4s enter to continue"
read

cp ./src/workflows/patched.ts ./src/workflows/current.ts
npm run build

set_color blue; echo "Running worker with patched workflow"
timeout 15s npm start
