#!/bin/bash
# tl;dr: requeueB.sh -- on box B only: stop the spelhd decomposition (it ran without
# --branch-clock, so fold arms did not do the same guest work), keep its metro rows,
# rerun spelhd under --branch-clock as lane cB2, then breadth lane B, then depth dB.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
BR="--apps=starcraft_shareware,spelunky_classic_hd,diablo_shareware,gta2_demo,mw3,quake2_demo,hexen2_demo,halflife_uplink,jazz2_demo,pinball,moorhuhn_3 --arms=m,off,off2,all --reps=5"
bash ~/sw/killafter.sh B
bash ~/sw/stop.sh
mv ~/out/cB/spelhd ~/out/cB/spelhd-nobc
grep -v '"app":"spelhd"' ~/out/cB/results.jsonl > ~/out/cB/metro.jsonl
grep '"app":"spelhd"' ~/out/cB/results.jsonl > ~/out/cB/spelhd-nobc.jsonl
bash ~/sw/start.sh cB2 "--apps=spelhd --arms=dA,dD,dDs,dG,dGs --reps=6"
setsid nohup bash ~/sw/after.sh cB2 B "$BR" > ~/after-B.log 2>&1 < /dev/null &
sleep 1; pgrep -u user -af "[s]w/(after|lane).sh" | cut -c1-100
