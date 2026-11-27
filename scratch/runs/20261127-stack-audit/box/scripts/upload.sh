#!/bin/bash
# tl;dr: upload.sh A|B FILELIST -- rsync (deref symlinks) the repo-relative files in
# FILELIST from the main checkout to the box's ~/assets, keeping their paths.
KH=/private/tmp/wa-stack/scratch/runs/20261127-stack-audit/box/known_hosts
case "$1" in A) h=51.77.142.151;; B) h=217.182.192.111;; *) exit 2;; esac
cd /Users/vg/Documents/projects/phone/wine-assembly || exit 1
rsync -aL --files-from="$2" -e "ssh -p 19043 -o UserKnownHostsFile=$KH -o StrictHostKeyChecking=yes -o BatchMode=yes" ./ user@$h:assets/
echo "upload $1 rc=$?"
