#!/bin/sh
# Run only on the coordinator-assigned bx_2gnkcnac after verify-remote.py passes.
# No compilation, engine edits, media downloads, or lifecycle changes.
set -u
cd /home/user/deus-ex-training || exit 1
date -u +%FT%TZ > evidence/start.txt
node test/run.js --app=deus_ex_demo --no-build \
  --wasm=/home/user/deus-ex-training/wine-assembly.wasm --no-threads \
  --quiet-api --quiet-blocks --no-close --control --frozen \
  --max-seconds=3000 --max-batches=100000 \
  --batch-size=200000 --tick-ms-per-batch=25 --trace-input \
  > evidence/run.log 2>&1
status=$?
printf '%s\n' "$status" > evidence/run.exit
date -u +%FT%TZ > evidence/end.txt
exit "$status"
