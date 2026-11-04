# Natural boot with loader-bound cache observation

**One original Deus Ex boot installed production `cacheObservation` on its first
owning Worker init and returned real Core/SoftDrv binding reports. The attempt
stopped at `Error: Worker instance absent` in the inherited readiness inspector,
before readiness or natural Draw collection. Both cache sources reached their
boundary cap with zero operation records. No gameplay, full history or lifetime
claim follows. There was no retry.**

Evidence: `scratch/runs/20261104-deusex-natural-bound-cache/`. The production
collector is [d5e762bce](deusex-loader-bound-cache-observer-20261104.md); the
original driver and existing controls come from the
[complete input preflight](deusex-complete-driver-input-preflight-20261104.md).
This is a fresh allocated attempt, not a continuation of the
[previous natural Draw](deusex-preflighted-original-writers-20261104.md).

## Actual driver integration

`tools/deusex-natural-bound-cache-driver.cjs` verifies the published prepared
original driver's exact SHA-256
`fcfe9b91543e28046fe098b703458ea820471d6757e9280881224b0c6753bb21` and generates
its actual runnable body with unique patch anchors. Before `launchApp()` creates
Workers, a page interceptor adds the production option to the first slot-0
`init`, before posting it. The original message, transfer arguments, receiver,
sequence and return value are retained. Other Workers pass through. Duplicate
owning init or preconfiguration fails. The natural limits are explicit:
1,000,000 boundaries, 256 records and 10,000 ms per cache source.

Readiness and post-Draw status plus final stop use the existing queued link's
`_ask`, preserving its response and checking the actual command/response sequence.
They never invoke guest exports. Existing Draw installation, collection,
first-failure handling, eight-minute maximum and raw-before-PNG ordering remain
in the original driver. In this attempt only final cache stop was reached;
readiness status, post-Draw status and Draw installation were not reached.

There was no forced run, setter, repaint, Draw, synthetic native call, cache
mutation, guest configuration/input write, reload, second Chrome or new box.

## Revision recovery and prerequisite controls

The inherited runtime has no `.git` and lacks `tools/build.sh`; it does have the
vendored compiler, source closure and `tools/build-compile-wat.js`. All **485**
inherited input pins were verified first. In particular, its Worker and changed
WAT fragment exactly matched Git `36661cb71b738cf08d91ad51edf55e97084423af`.
`production-reconstruction.patch` is the explicit six-file Git binary diff from
that revision to `d5e762bce340580b74ce7c5157b77c4d84a7b7bd`: Worker, four optional
cache libraries and the concurrent lighting WAT change. `git apply --check`,
application and remote compilation passed. No source archive, module/media copy
or unexplained repinning occurred. Git SHA, relevant uncommitted binary diff,
owned-new patches and exact changed-input pins retain source recovery.

The existing natural producer and its embedded ordered adapter remain the
original byte-pinned implementation, `c33adc61…`, from Git `36661cb71`. The newer
local `835d15be…` adapter was not silently substituted into the captured original.
The new cache libraries are separate opt-in imports with the Worker URL's
version. Input preflight explicitly requires all four optional browser scripts,
walks their literal Node dependencies and checks every supplied pin.

The old inherited modules were `4ddc8336…` / `d4c5171a…`. They were **not** the
modules used by this attempt. The remote rebuild and both HTTP responses matched
these current, collector-qualified modules:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 2,147,323 | `4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b` |
| `build/wine-assembly.compat.wasm` | 2,149,936 | `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34` |

All **twelve** prerequisite commands passed before the sole Chrome launch:
actual input closure (489 pins, 256 derived requirements), real Puppeteer
**25.7.0** CJS/ESM imports and executable `/usr/bin/google-chrome`, composition,
cache graph/self-test, original integration, queued transport, optional/pixel
boundaries, archived replay, composed actual, HTTP/import qualification, repeated
input preflight and served-module qualification. HTTP checked **149** inputs,
including all optional libraries. Both WASM responses had exact size/hash,
COOP `same-origin`, COEP `require-corp`, and `Cache-Control: no-store`.
`control-terminal.json` preserves each command/hash, helper hash, return code,
elapsed time and log. Final input and served checks passed again before launch.

## Natural evidence and first terminal

Allocation was **bx_t2kna5qz**, expiry **2026-11-04T16:03:07.608Z**. Explicit
`DEUSEX_CLOSE_AT=2026-11-04T15:48:00Z`, recovery 15:53Z and coordinator stop 15:57Z
left the full eight-minute maximum plus recovery reserve at admission. The
driver's earlier relative deadline was **15:37:47.066Z**.

Supervisor **18308**, driver **18342**, and sole Chrome **18350** ran.
Chrome **151.0.7922.108** launched **15:29:51.603Z**. The measured executable was
the existing original `test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe`.
Final cache stop proves one intercepted owning init, endpoint identity **1**,
slot **0**, and binding thread **1**. Its real queued response was
`cacheObservationResult`, sequence **351**, binding status `explicit-stop`,
**319** observed public run calls, and unknown history.

The binding recorded `bound-before-execution` for both original hashes:

| Source | Original file SHA-256 | Row / base / image bytes / generation |
| --- | --- | --- |
| Core | `2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167` | 1 / `0x10cca000` / 1,802,240 / 1 |
| SoftDrv | `25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18` | 4 / `0x11464000` / 757,760 / 1 |

A third binding event retains unverified media hash `bb487eb6…`, row 17,
generation 1, with unknown history; it was not adopted as either source.
Both source reports ended at `boundary-limit`, sequence **1,000,000**, and each
counted **501,290** duplicate boundaries. Core Init entries/returns, clears,
locked/hash-removal/recycle/publication counts are zero. SoftDrv acquisitions,
misses and releases are zero. Both have zero records and empty pending arrays.
The binding stop preserves the earlier per-source terminals. These finite,
duplicate-suppressed boundaries are not full execution histories or evidence
that an unobserved cache operation never happened.

At **15:30:04.613Z**, the unchanged `owner-inspect.cjs` rejected because
`instance` was absent at its Worker evaluation boundary. Its guard runs before
slot/thread qualification. The preceding owning sample at **15:30:04.592Z**
reported `GIsRunning=0`; there was no visible source-bearing game window.
The console records creation of a guest thread and then
`[guest-worker 1] instantiated` at **15:30:04.621Z**, after the failure. This
supports investigating inspection during another Worker's startup; the failed
evaluation itself did not record that Worker's slot, so its identity remains
unknown. A focused offline execution of the exact inspector reproduces its
`Worker instance absent` terminal with an absent instance. No readiness repair
or runtime retry was attempted.

Chrome closed **15:30:05.070Z**; supervisor returned **1** at **15:30:05.109Z**.
No readiness-met, natural Draw, raw buffer or PNG was collected. Consequently
there is no fresh capture to inspect and no menu, pixels or gameplay claim.
The next concrete prerequisite is offline qualification of the original
readiness inspector across uninitialized and foreign Worker startup, preserving
its first-failure rule and identifying the owning initialized instance before
another separately allocated original attempt.

All unloaded/reloaded generations retain separate unknown-history reports by
production contract; this attempt observed no unload/reload, so those paths are
not newly qualified. Internal WAT reentry, cross-thread/foreign Worker execution,
concurrent writes, atomic snapshots and descriptor/consumer ordering remain
unknown. Core/SoftDrv reports are not joined into lifetimes. Release is not
retirement; this run did not observe a release.

## Tests, recovery and custody

The worker's focused test passed same-message/transfer/receiver/return identity,
foreign Worker passthrough, duplicate rejection, queued response identity and
negative cases, the exact original-driver transformation, unchanged natural
bounds/raw-before-PNG order and the inherited absent-instance terminal.
`flock /tmp/wine-build.lock bash tools/build.sh` passed locally, producing the
same two module hashes above. No shared production collector or WAT was edited
by this worker.

All **356** closed remote files (**7,125,070 bytes**) were recovered or matched
to exact retained small inputs, with full size/SHA-256 inventory. A second
inventory was identical. This includes the closed Chrome profile and queued
transport result. Already identical modules and original media are referenced
by existing path/hash, not copied. The focused evidence inspection retains the
real report fields and explicitly checks capture absence.

At custody return all three own PIDs were absent, Chrome inventory was empty,
and port 8123 was closed. **bx_t2kna5qz was left RUNNING** (API `idle`, healthy,
hydrated), expiry **16:03:07.608Z**. Early terminal/custody was appended to the
board, with recovery subsequently sealed. The coordinator owns snapshot and
normal shutdown. No worker stop/resume/delete or further runtime follows.
