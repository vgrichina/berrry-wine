#!/bin/sh
set -eu
cd "$(dirname "$0")/../../.."
# No build, guest, network, or runtime. Recover ignored members first only if absent,
# under a separately checked remaining acquisition allowance (see acquire.py).
mkdir -p local
git -C /home/user/wine-assembly-shadow-man-original-recover-runtime-oct22 show c26252c4a95babe583ade1d1c6e2da0c050be45c:lib/filesystem.js > local/historical-filesystem.js
git -C /home/user/wine-assembly-aoe3-qualified-source-integrate-oct22 show 324cc4f9580755a4fcc97eea0a5e4070ea7a0df9:lib/filesystem.js > local/main-filesystem.js
printf '%s\n' '4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e  local/historical-filesystem.js' '4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e  local/main-filesystem.js' | sha256sum -c -
python3 scratch/runs/20261022-shadow-man-error112-cause/analyze.py
node scratch/runs/20261022-shadow-man-error112-cause/write-fixture.cjs local/historical-filesystem.js local/main-filesystem.js
