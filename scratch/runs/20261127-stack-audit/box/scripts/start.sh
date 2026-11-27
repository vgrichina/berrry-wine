#!/bin/bash
# tl;dr: start.sh NAME 'args'... -- on the box: start lane.sh detached (one lane per box).
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
if pgrep -u user -f "[s]w/lane.sh" > /dev/null; then echo "a lane is already running"; exit 1; fi
setsid nohup bash ~/sw/lane.sh "$@" > /dev/null 2>&1 < /dev/null &
sleep 1; pgrep -u user -af "[s]w/lane.sh" | head -2
