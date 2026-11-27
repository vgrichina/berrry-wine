#!/bin/bash
# tl;dr: after.sh PREV NAME 'args'... -- on the box: wait for lane PREV's LANEDONE, then start lane NAME.
case "$(hostname)" in box-node-*) ;; *) echo "not a box"; exit 3;; esac
prev=$1; shift
until grep -q LANEDONE ~/out/$prev/lane.out 2>/dev/null; do sleep 20; done
sleep 2; bash ~/sw/start.sh "$@"
