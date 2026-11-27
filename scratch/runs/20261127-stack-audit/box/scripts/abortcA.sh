#!/bin/bash
# tl;dr: abortcA.sh -- on box A only: stop the spel30 decomposition lane (moved to the
# bare-metal host) and mark it done so the queued breadth lane A starts.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
bash ~/sw/stop.sh; echo "ABORTED (moved to bare metal)" >> ~/out/cA/lane.out; echo LANEDONE >> ~/out/cA/lane.out
sleep 25; pgrep -u user -af "[s]w/(after|lane).sh" | cut -c1-100
