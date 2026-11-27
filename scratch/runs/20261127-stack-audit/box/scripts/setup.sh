#!/bin/bash
# tl;dr: box setup for the stack audit. Clones the public repo, makes one
# worktree per arm build (NAME=REF ...), links the uploaded ~/assets/test/binaries
# into each (symlinks, tracked files untouched), npm ci, builds, prints sha256.
# Refuses to run anywhere but a box-node host.
set -u
case "$(hostname)" in box-node-*) ;; *) echo "not a box: $(hostname)"; exit 3;; esac
cd ~
[ -d repo ] || git clone -q https://github.com/vgrichina/berrry-wine.git repo
cd repo && git fetch -q origin && cd ~
for spec in "$@"; do
  n=${spec%%=*}; ref=${spec#*=}
  [ -d ~/$n ] || (cd ~/repo && git worktree add -q --detach ~/$n "$ref")
  cd ~/$n
  [ -d ~/assets/test/binaries ] && cp -rsn /home/user/assets/test/binaries/. test/binaries/ 2>/dev/null
  [ -d node_modules ] || npm ci --no-audit --no-fund > ~/npm-$n.log 2>&1
  bash tools/build.sh > ~/build-$n.log 2>&1; rc=$?
  echo "$n $(git log --oneline -1 | cut -c1-60) build=$rc $(sha256sum build/wine-assembly.wasm | cut -c1-64)"
done
echo SETUPDONE
