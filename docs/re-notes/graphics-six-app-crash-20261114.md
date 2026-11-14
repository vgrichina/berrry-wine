# Current six-original startup crash sweep, 14 November 2026

Twelve completed 20-second windows produced no classified trap, unimplemented
API, guest exit, exception or runtime timeout. Four final compositor images are
blank. No concrete emulator defect was established, so no production repair or
speculative test was added. This is bounded startup evidence for six named
originals, not historical27, browser, physical-GPU, parity or gameplay acceptance.

Evidence is in ignored `scratch/runs/20261114-graphics-six-app-crash/`.
`result.json` names exactly twelve selected final PNGs; all were personally
inspected. `observations.json` contains the individual signatures, full-log
audit, window events, loaded-module hashes and actual process waits.

## Tested composition

The locked full build passed on main
`a9448409727cc11d065591831103f03ae1b71c22`, including published D3D9 repair
`2a567ae263f968d0304b70e0376c67ef48c302ba`, plus the existing foreign WIP.
`build/source.patch` records the relevant tracked WIP; `build/new-wininit.patch`
records the existing untracked `lib/wininit-boot.js`. Per-launch source pins
match the recorded built-source pins across all twelve windows. This does not
claim a pristine committed source tree or an audit of every runtime JS read.

All twelve observed standard-WASM reads were 2,199,488 bytes, SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
The actual fresh build matches the D3D9 predecessor's module; no module was
selected by inference. Compatibility WASM was built but not exercised.

Environment: local Node v24.18.1, display `:0`, `@node-3d/glfw` 7.4.1,
`@node-3d/webgl` 6.0.3, llvmpipe LLVM 20.1.2, WebGL 1.0 / GLSL 4.50.
The actual native shader/readback control passed. Registered game-path manifests
were hashed before and after: Quake II 67, Quake III 307, GLTron 92,
Hexen II 18, Heretic II 1,826 and Forsaken 873 references, with no missing paths
or changed bytes. `media-paths.json` records existing paths and SHA-256 values;
no media was downloaded or copied. No guest reverse engineering, private-payload
decoding, guest patch, game input or configuration edit was performed.

## Executed windows and reviewed images

Each app/mode used the existing tool, serially, with the heavy-runtime lock
released between launches:

```sh
node tools/crash-sweep.js --apps=APP --modes=MODE \
  --headless-gl --jobs=1 --seconds=20 --stuck-after=0 \
  --no-build --jsonl=RUN/APP.MODE/sweep.jsonl
```

The retained host-only `observe.cjs` preload appends supported `--real-ticks`
and `--png-canvas` before `test/run.js` parses arguments. It records actual WASM
reads and retains the final PNG and compressed log before the sweep removes its
temporary files. No back-canvas, surface dump or frame series is enabled.
PCM is classified by the existing sweep and discarded; no audio claim follows.

| Original | Cooperative final compositor | Threaded final compositor | Signature |
| --- | --- | --- | --- |
| Quake II | Original Game/Multiplayer/Options/Video/Quit menu over console/backdrop | Same menu | Both `ok/content` |
| Quake III | Uniform gray | Uniform gray | Both `ok/blank` |
| GLTron | Uniform black | Uniform black | Both `ok/blank` |
| Hexen II | Original Single Player/Multiplayer/Options/Help/Quit menu | Same menu | Both `ok/content` |
| Heretic II | Textured original Main book menu | Same menu | Both `ok/content` |
| Forsaken | Original heart/sword logo splash | Same splash | Both `ok/content` |

Hexen II's existing registry startup flag already bypasses its first-launch
notice; this is beyond the notice-only November 7 observation without a task
change to guest settings. Forsaken retains its registered software D3D route;
passing `--headless-gl` does not convert it into GL coverage. The two scheduler
flags establish requested modes, not auxiliary guest-Worker execution for every
title. All final captures are 640×480; sweep `ok` means a completed harness
window, not successful rendering, guest completion or gameplay.

Quake III creates and shows `Quake 3: Arena` in both logs, but completed source
draws/swaps and their compositor ownership were not instrumented. GLTron's logs
show an `SDL_app` creation at 0×0 and no subsequent creation/show event. Those
public observations do not distinguish slow startup, context/draw failure and
presentation failure. No modal or intentional guest exit was observed in the
qualified twelve windows. The blank cases remain visually unqualified.

## Checks, exclusions and cleanup

Passed: `flock /tmp/wine-heavy-runtime.lock flock /tmp/wine-build.lock bash
tools/build.sh`; actual native `test/test-headless-gl.js`; 20/20
`test/registry-crash-sweep.test.js` cases; and
`test/test-crash-sweep-against.js`. These controls do not upgrade the originals'
bounded outcomes into broad acceptance.

An initial setup attempt found pruned old native-package folders and a skipped
preflight. Its Quake II cooperative menu and cancelled threaded attempt are
excluded; the reviewed setup PNG was deselected and removed. Fresh pinned
native dependencies were installed only inside this run, then positively
qualified before the twelve windows. Their 164 file hashes and npm recovery
lock remain; the regenerable installed distribution was removed after checking
its hashes and joining all runtimes.

One later 170-second lock-queue wait expired before any observed module load.
Only the seven remaining app/mode cases were resumed, without repeating the
five completed cases. The resumed independent watchdog preserved the original
qualified-sweep absolute deadline, approximately 09:49:14.750 UTC. All twelve
actual app runs ended normally at their 20-second deadlines, and both qualified
supervisors and the excluded setup have terminal watchdog waits with both EOFs.
Recorded process/group checks found no survivors or residual-group cleanup in
the twelve completed cases. The final app ended at approximately 09:44:25.508
UTC. Locks were released; final free space exceeded 14.19 GB decimal.

No box was created: ID null, state `NOT_CREATED`, expiry null, stop receipt
`N/A`. No source-tree archive, WASM dump, browser, deployment or other worker
was created by this task. Foreign WIP remains untouched.

The next causal blocker is the missing public context-bind/draw/swap versus
compositor discriminator for gray Quake III and black GLTron. A bounded passive
trace at those boundaries is needed before proposing a generic fix. Repeating
the same unattended windows alone would not resolve it.
