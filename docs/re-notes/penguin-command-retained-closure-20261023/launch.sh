#!/bin/sh
# Future coordinator-assigned runtime only. This task does not execute this file.
set -eu
: "${HARNESS_ROOT:?Set to the reviewed wine-assembly harness checkout}"
: "${QUALIFIED_WASM:?Set to an independently qualified prebuilt module}"
: "${PENGUIN_DATA:?Set to the recovered penguin-command-1.6.11 directory}"
: "${PENGUIN_CRT:?Set to the sealed standing msvcrt.dll}"
: "${RUN_DIR:?Set to an admitted empty runtime evidence directory}"
test -f "$QUALIFIED_WASM"
test -f "$PENGUIN_DATA/penguin-command.exe"
test -f "$PENGUIN_CRT"
test -d "$RUN_DIR"
exec node "$HARNESS_ROOT/test/run.js" \
  --no-build --wasm="$QUALIFIED_WASM" \
  --exe="$PENGUIN_DATA/penguin-command.exe" \
  --exe-guest-path='C:\penguin-command.exe' --cwd='C:\' \
  --args='--windowed --nosound' \
  --dll-seed="$PENGUIN_CRT" \
  --dll-seed="$PENGUIN_DATA/SDL.dll" \
  --dll-seed="$PENGUIN_DATA/zlib1.dll" \
  --dll-seed="$PENGUIN_DATA/libpng12-0.dll" \
  --dll-seed="$PENGUIN_DATA/jpeg.dll" \
  --dll-seed="$PENGUIN_DATA/SDL_image.dll" \
  --dll-seed="$PENGUIN_DATA/SDL_mixer.dll" \
  --vfs-include='data/gfx/*.png' --vfs-include='data/gfx/*.jpg' \
  --quiet-api --no-close --max-seconds=60 --max-batches=200000 \
  --control-stdin --png="$RUN_DIR/exit.png" \
  --save-vfs="$RUN_DIR/vfs" --save-vfs-suffix=.dat
