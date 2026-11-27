#!/bin/bash
# tl;dr: perfrec.sh TAG ROOT 'run.js args' -- on a box only: perf record instructions:u
# (sampled every 1M) of one fixed-work run with node --perf-basic-prof, so wasm functions
# get names in /tmp/perf-PID.map; writes ~/out/perf/TAG.report (top symbols by samples).
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
tag=$1; root=$2; shift 2; O=~/out/perf; mkdir -p $O; cd $root || exit 1
perf record -e instructions:u -c 1000000 -o $O/$tag.data -- taskset -c 1-3 node --perf-basic-prof test/run.js --no-build $1 > $O/$tag.log 2>&1
perf report -i $O/$tag.data --no-children --sort sym --stdio 2>/dev/null | grep -v '^#' | grep -v '^$' | head -120 > $O/$tag.report
rm -f $O/$tag.data; echo done $tag
