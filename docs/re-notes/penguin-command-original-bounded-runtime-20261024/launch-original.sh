#!/bin/sh
set -eu
: "${QUALIFIED_WASM:?exact qualified full module required}"
: "${HARNESS_ROOT:?compatible qualified harness required}"
: "${RUN_DIR:?admitted empty evidence directory required}"
: "${PENGUIN_DATA:?retained original game directory required}"
: "${PENGUIN_CRT:?retained original CRT required}"
test ! -e "$RUN_DIR"
mkdir "$RUN_DIR"
unset WINE_RUN_EXTRA_ARGS
exec node --max-old-space-size=512 "$HARNESS_ROOT/test/run.js" \
  --no-build --wasm="$QUALIFIED_WASM" \
  --exe="$PENGUIN_DATA/penguin-command.exe" \
  --exe-guest-path='C:\penguin-command.exe' --cwd='C:\' \
  --args='--windowed --nosound' \
  --dlls="$PENGUIN_CRT,$PENGUIN_DATA/SDL.dll,$PENGUIN_DATA/zlib1.dll,$PENGUIN_DATA/libpng12-0.dll,$PENGUIN_DATA/jpeg.dll,$PENGUIN_DATA/SDL_image.dll,$PENGUIN_DATA/SDL_mixer.dll" \
  --vfs-include='data/gfx/*.png' --vfs-include='data/gfx/*.jpg' \
  --quiet-api --no-close --max-seconds=60 --max-batches=200000 \
  --control-stdin --png="$RUN_DIR/exit.png" \
  --save-vfs="$RUN_DIR/vfs" --save-vfs-suffix=.dat
