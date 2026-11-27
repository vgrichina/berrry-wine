#!/bin/bash
# tl;dr: remote.sh A|B 'command' -- ssh to stack-audit box A (bx_b86yx6bp) or B (bx_5jze62f9)
# with the pinned host key. Never runs anything locally.
KH=/private/tmp/wa-stack/scratch/runs/20261127-stack-audit/box/known_hosts
case "$1" in A) h=51.77.142.151;; B) h=217.182.192.111;; *) echo "box A|B" >&2; exit 2;; esac; shift
exec ssh -p 19043 -o UserKnownHostsFile=$KH -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20 user@$h "$@"
