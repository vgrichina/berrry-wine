#!/bin/bash
# tl;dr: lane.sh NAME 'sweep-args' ['sweep-args' ...] -- on the box only: relink
# uploaded assets into ~/s and ~/m, record box env, then run sweep.js once per
# argument string, strictly serially. Ends with LANEDONE in ~/out/NAME/lane.out.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
name=$1; shift
for w in ~/s ~/m; do cp -rsn /home/user/assets/test/binaries/. $w/test/binaries/ 2>/dev/null; done
O=~/out/$name; mkdir -p $O
{ date -u; uptime; nproc; grep -m1 "model name" /proc/cpuinfo; uname -a; node --version; node -p process.versions.v8;
  cat /proc/sys/kernel/perf_event_paranoid; grep -E '^(steal|cpu )' /proc/stat; } > $O/box-env.txt
for step in "$@"; do node ~/sw/sweep.js $step --out=$O >> $O/lane.out 2>&1; done
{ date -u; uptime; grep -E '^cpu ' /proc/stat; } >> $O/lane.out; echo LANEDONE >> $O/lane.out
