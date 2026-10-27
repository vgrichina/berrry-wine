#!/bin/bash
set -euo pipefail
label=$1
shift
exec python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 2 -- python3 -B -S /tmp/ricochet-pinned-unlink-independent-accept-oct27/ops/run.py git "$label" git -C /tmp/ricochet-pinned-unlink-independent-accept-oct27/repo "$@"
