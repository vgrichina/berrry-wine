#!/bin/bash
# tl;dr: arm64 native capture (laptop) of the hot uop/x87/GM functions, both
# engines, stack-audit module vs main f60235c94 module. Indices from each
# build's build/watx-facts.json (--func naming is broken).
N=/private/tmp/wa-stack/scratch/runs/20261127-stack-audit/native-arm64
export OBJDUMP=/opt/homebrew/opt/binutils/bin/objdump
run() { # tag wasm index engine
  timeout 120 node /private/tmp/wa-stack/tools/wasm-native.js --wasm=$2 --index=$3 --engine=$4 --limit=100000 > $N/$1.txt 2>&1; echo "$1 rc=$? lines=$(wc -l < $N/$1.txt)"; }
S=/private/tmp/wa-stack/build/wine-assembly.wasm; M=/private/tmp/wa-stack-main/build/wine-assembly.wasm
for e in v8 sm; do
  run s-uop_fast-$e $S 1597 $e; run m-uop_fast-$e $M 1579 $e
  run s-fpu_exec_mem-$e $S 1030 $e; run m-fpu_exec_mem-$e $M 1029 $e
  run s-th_uop_enter-$e $S 1628 $e; run m-th_uop_enter-$e $M 1609 $e
  run s-uop_run-$e $S 1596 $e; run m-uop_run-$e $M 1578 $e
done
