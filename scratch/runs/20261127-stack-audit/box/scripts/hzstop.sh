#!/bin/bash
# tl;dr: hzstop.sh NAME -- on fast-near-3tb-1 only: SIGKILL the recorded lane PIDs of
# ~/wa-bench/regress/out/NAME and their child trees (only PIDs we started), then any
# leftover run.js whose cwd is our worktree, listed by PID and checked one by one.
[ "$(hostname)" = fast-near-3tb-1 ] || { echo "wrong host"; exit 3; }
O=$HOME/wa-bench/regress/out/$1
kt() { for c in $(pgrep -P $1); do kt $c; done; kill -9 $1 2>/dev/null; }
for p in $(cat $O/lanepid $O/pids 2>/dev/null); do kt $p; done
for p in $(pgrep -u "$(id -u)" -f "test/run.js"); do
  [ "$(readlink /proc/$p/cwd)" = "$HOME/wa-bench/regress/s" ] && kill -9 $p
done; echo stopped
