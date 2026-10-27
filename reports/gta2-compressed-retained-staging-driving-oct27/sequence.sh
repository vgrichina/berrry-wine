#!/bin/bash
set -eu
base=/tmp/gta2-compressed-retained-staging-driving-oct27/ops
# Exact disjoint ranges from measured request plan, each bounded supervisor retained.
while read -r first last; do
 python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 2 --wait 45 -- python3 "$base/control.py" supervise "gzip-$first" script "$base/stage-gzip.py" "$first" "$last"
done < "$base/ranges.txt"
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 2 --wait 45 -- python3 "$base/control.py" supervise extra script "$base/extra.py"
