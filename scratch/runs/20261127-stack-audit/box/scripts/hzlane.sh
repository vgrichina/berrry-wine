#!/bin/bash
# tl;dr: hzlane.sh NAME 'sweep-args' -- on fast-near-3tb-1 only, under ~/wa-bench/regress:
# run 4 sweep shards concurrently, shard i pinned to CPU 0/2/4/6 (lowest hyperthread of
# P-cores 0-3; the other P-cores belong to bench-fn). Records PIDs; ends with LANEDONE.
[ "$(hostname)" = fast-near-3tb-1 ] || { echo "wrong host"; exit 3; }
R=$HOME/wa-bench/regress; name=$1; shift; O=$R/out/$name; mkdir -p $O; echo $$ > $O/lanepid
export PATH=$R/../node/bin:$PATH
{ date -u; uptime; lscpu | grep -E "Model name|MHz"; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor; node --version; } > $O/box-env.txt
cpus=(0 2 4 6); pids=()
for i in 0 1 2 3; do
  node $R/sw/sweep.js $1 --out=$O --base=$R --noperf --cpu=${cpus[$i]} --shard=$i/4 > $O/lane-$i.out 2>&1 &
  pids+=($!); echo "${pids[-1]}" >> $O/pids
done
wait "${pids[@]}"; { date -u; uptime; } >> $O/lane.out; echo LANEDONE >> $O/lane.out
