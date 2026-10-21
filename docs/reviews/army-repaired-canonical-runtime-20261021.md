# Army Men exact-main canonical build: dependency prerequisite blocker

Exact tested source: `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`.
Fresh canonical `bash tools/build.sh` completed exit 0 on 2026-10-21,
including every normal gate, WATX compile and compiled data-overlap gate.
All 7,299 tracked files passed blob and SHA-256 inventory before build;
postflight reverified all hashes and clean Git status.
Module: `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. It matches the historical Hock hash, but this is a fresh
exact-source build, not a copied module. Build log, command, exit and API
receipt are preserved. Existing npm dependencies were reused. Initial
`npm ls` diagnostic included intentionally omitted dev packages and exited 1;
corrected `npm ls --omit=dev` passed before canonical build. No gate bypass.

## First reproducible prerequisite blocker

The existing real-DLL graph resolver, with the same five search directories
as current `test/run.js`, reports missing `comctl32.dll`, `ole32.dll`,
`mfc42.dll`, and `msvcrt.dll`. The fresh checkout's ignored
`test/binaries/dlls` contains only `SOURCES.md`. `smackw32.dll` resolves.
Two preflight executions reproduce the same list; both exit 1 at the explicit
complete-closure assertion. No guest was launched.

This is a staging prerequisite, not evidence of a game/emulator regression.
`mfc42.dll` and `msvcrt.dll` ARE among the verified originals, under
`windows/system` and `armymen/dlls`; those directories are outside the
runner's initial real-PE preload search. `comctl32.dll` and `ole32.dll` are
not in the 433-entry historical manifest. The separate next assignment must
supply verified real dependencies in the actual preload search and complete
the transitive graph before runtime. This task did not fetch replacement
DLLs, substitute placeholders, patch source or launch past missing closure.

All 419 originals were independently verified locally, transferred in memory
without a local asset archive, and size/SHA-256 verified remotely. All 14
historical generated system placeholders were excluded and absent.
Both `cpuinf32.dll` and `cpuinfo.dll` resolve through `findVfsDllBytes`, match
original hashes, and export nonzero `wincpuid` and `cpunormspeed` entries.
Their export tables/imports and the real DLL graph are preserved in
`repaired-evidence/dependency-closure.json`. Registry copied unchanged from
the requested prior capture. No prior gameplay evidence was repackaged.

## Limits and handoff

Boot Camp, input acknowledgments, before/after screenshots, observer pixel
pairs and stripe observation remain unqualified. No browser/FPS/audio or
historical stripe-causality claim. No source repair/main merge/public deploy,
other boxes, workers, laptop changes or shared root WIP edits.

Assigned `bx_e8a7pw8v` left RUNNING (API state `idle`, health `ok` at handoff),
expiry `2026-10-21T12:21:46.313Z`; coordinator retains shutdown ownership.
Remote `/home/user/army-current-main/repo`, `vfs`, `original419.tgz`,
`repaired-evidence` and fresh build remain intact, as does old `evidence`.
Handoff is before 12:10 UTC. No guest/controller remains because none launched.

Local evidence: `scratch/runs/20261021-army-repaired-canonical-runtime`.
Task branch: `task/army-repaired-canonical-runtime-oct21`.
Tracked report and compact evidence archive live under `docs/reviews` on that
isolated branch. See RECOVERY.md and SHA256SUMS.json for preservation/validation.
