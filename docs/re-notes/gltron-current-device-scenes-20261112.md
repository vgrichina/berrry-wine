# GLTron current device and native scenes — 2026-11-12

Run: `scratch/runs/20261112-gltron-current-device-scene-repair-0015/`.
Tested source: `850d78554832293f5026c09bdfce853e864b36a4`, with relevant
uncommitted source recorded in `relevant-source.patch` and
`untracked-runtime.patch`. The locked full build produced module SHA-256
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`
(2,189,682 bytes). CPU and render Worker modules recovered from the browser
match this build. Production runtime files were not changed by this task.

## Current outcome

The normal registered browser URL
`/index.html?debug&candidates&no-log&gl-renderer=software&app=gltron`, and the
same URL with `gl-renderer=webgl`, both run the original pinned game with
Threads enabled. Full images were reviewed before dependent native input;
trusted key pairs have independently armed releases and acknowledged outcomes.
There were no guest memory, media, clock, configuration or forced-round edits.

Software shows the native menu, paused arena, moving yellow cycle with a long
trail, collision, other growing trails and a native round result. Review
`software-qualified/motion-1`, `motion-3`, and `motion-6` captures. The first
moving frame's bound software owner has 253,354 software completions and 511
presentations; the matching legacy executor records actual GL triangles.
WebGL shows the menu, arena, moving cycle and trail, other moving cycles and
round result. Its `moving-before` bound owner records 11,874 draws, 400,959
vertices and 225 presentations. These are cumulative observations, not FPS.
The late S pulses do not demonstrate steering causality or a controlled win.

Normal CLI `test/run.js --app=gltron --no-build --headless-gl --real-ticks`
was tested with both `--no-threads` and `--threads`. Both reach the original
menu and native arena, show moving trails and a native crash/round transition,
and quit with actual parent wait, exit zero and separate stdout/stderr EOF.
CLI PNG publication can lag command acknowledgement; a returned input ACK
alone does not establish the displayed state.

## Remaining boundary and harness correction

The 25-second current default cooperative CLI still produces only the initial
clear/presentation, texture uploads and zero scene draws. It exits normally;
its reviewed sample is black. This does not contradict the real-time routes.
Published `295d01407` repaired callback ownership. Current main also contains
`5d02d4d2e` CPU-service accounting and `7c50c29b9` real-time audio binding.
The production tests verify these repairs, including real Worker RPC callback
execution and clock sharing. No new failing supported-semantics runtime case
was demonstrated here, so no speculative runtime change was made.

The default block clock's assumed 5,000 blocks/second is not a calibrated CPU
throughput model. The original decode/device-service imbalance recorded in
`20261110-gltron-cpu-device-service-cause-1725` remains relevant to that default
route. Choosing a faster constant because the menu appears would not prove a
semantic repair. The remaining default-model work needs an independently
justified CPU/device service model and a failing regression before changing
production behavior. This run does not retest the default threaded route.

The inherited software evidence selector did have a demonstrated defect: it
required the *legacy D3D executor* backend to be software. Normal global D3D
selection is WebGL even while GL uses software/WAT. The run-local selector now
accepts either legacy backend while retaining the actual software GL context,
matching owner, completed software work, presentation sequence, GL triangle
work and failure checks. The recorded original sample fails before and passes
after; seven negative cases still fail. An actual generated triangle fixture
with software GL and WebGL D3D also passes. Guest CPU `gl_sw_triangles == 0`
is expected when those triangles execute in the render Worker and is not a
substitute for its producer evidence. This correction is confined to run inputs.

## Validation and scope

`flock /tmp/wine-build.lock bash tools/build.sh` passed. Focused service-clock,
guest-clock-source and CLI callback-owner tests passed, including actual WASM
work partitions, actual Worker shared service ledger and all-blocked idle,
production CLI real-time audio binding, and actual Worker callback return with
zero main-thread fallback calls. `selection-regression.cjs` and the live mixed
backend generated fixture passed.

Exact original media paths and 92 hashes are in `media-verification.json`;
media was referenced rather than archived into this run. Postflight checks
match 727 production/runtime/media pins locally and remotely. Git and relevant
patches are the source archive. Unique captures, logs and modules are recovered
and hash-verified before delegated normal shutdown of the private box; see the
run report and lifecycle receipts for final counts and state.

Earlier moving-browser trail evidence, including the November 7 round and
`20261110-gltron-browser-arena-gameplay-1930`, retains its original scope. This
run adds current matched-source software/WebGL original scenes and real-time
CLI coverage. It does not establish timing, visual or audio parity, default CLI
repair, every input mapping, or completion of GLD3D-CORPUS-27.

Private box `bx_dzx8z6jp` stopped normally at 00:42:20Z, before its initial
01:15:20Z expiry. Final state is archived with no expiry; receipt
`stop_b59ce246b52d5ebb` completed without force or error. Lifecycle parent,
adopted owner and watchdog have actual zero-status wait/EOF records. Recovery
verified 601 paths and 477 unique hashes; the evidence check also verified 18
bound browser captures and 15 balanced original input pairs.
