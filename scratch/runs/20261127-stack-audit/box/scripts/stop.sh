#!/bin/bash
# tl;dr: stop.sh -- on the box only: kill -9 the lane, sweep and run.js processes.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
pkill -9 -u user -f "[s]w/lane.sh"; pkill -9 -u user -f "[s]w/sweep.js"; pkill -9 -u user -f "[t]est/run.js"; sleep 1
pgrep -u user -af "run.js|sweep.js|lane.sh" || echo "stopped"
