#!/bin/bash
# tl;dr: perfchain.sh -- on box A only: after depth lane dA finishes, perf-record (instructions:u)
# main vs branch-off vs branch-all on Heroes III and Red Alert, to attribute the off-config
# instruction tax to wasm functions. Reports land in ~/out/perf/*.report.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
rm -f ~/out/perf/*
C="--quiet-api --stuck-after=0 --no-close --branch-clock"
OFF="--uop-opt=0 --gm-fold=0 --no-fpu-direct"
ALL="--uop-opt=0xffff --gm-fold=0x1F --uop-sse --uop-sse-native --uop-retry-ladder=15"
H3="--app=heroes3_demo --max-batches=31000 $C"
RA="--app=red_alert_95_demo --max-batches=75000 $C"
bash ~/sw/perfrec.sh h3-m ~/m "$H3"
bash ~/sw/perfrec.sh h3-off ~/s "$H3 $OFF"
bash ~/sw/perfrec.sh h3-all ~/s "$H3 $ALL"
bash ~/sw/perfrec.sh ra-m ~/m "$RA"
bash ~/sw/perfrec.sh ra-off ~/s "$RA $OFF"
bash ~/sw/perfrec.sh ra-all ~/s "$RA $ALL"
echo PERFDONE > ~/out/perf/DONE
