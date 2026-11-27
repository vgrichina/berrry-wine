#!/bin/bash
# tl;dr: killafter.sh NAME -- on the box only: kill the queued after.sh waiter that would start lane NAME.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
pkill -u user -f "[s]w/after.sh [A-Za-z0-9]+ $1 "; sleep 1; pgrep -u user -af "[s]w/after.sh" || echo "no waiters"
