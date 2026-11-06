# Lords2: first destructor DestroyWindow, 2026-11-06

The first destructor USER.53 call actually returns AX=0 because its narrow HWND has already been unmapped. It enters neither WM_DESTROY nor WM_NCDESTROY through the USER.53 destruction walk. This establishes the previously inferred return and exact branch; it does not demonstrate an emulator contract violation. No semantic implementation change is committed. Installation and gameplay were not reached.

Evidence is in `scratch/runs/20261106-lords2-first-destroy-notifications/` (ignored). Start with `first-destruction-analysis.json`, `first-destruction-state.json`, and `first-destruction-excerpt.json`. These are original passive records, not reconstructed successful cleanup. The predecessor is [callback stack lifetime](lords2-callback-stack-lifetime-20261105.md).

## Original observation

One original session ran 07:40:52–07:46:11 UTC, inside the immutable 07:38:12–08:23:12 validation/cleanup window. Reviewed captures: `startup.png`, `after-install.png`, `after-yes.png`, `after-yes-corrected.png`, `after-system-yes.png`. Ordinary input reached the sound-card wave-test question. The session ended there by queued quit, before selecting its answer or repeating the known later fault. Chrome and the probe exited normally, code 0. No restart, guest program/memory patch, simulated cleanup, selector forcing, media copy, worker, deployment, or remote box was used.

Ordered records from CPU instance 1, process 1000, task/thread 2:

| Sequence | Observation |
| --- | --- |
| 2093–2099 | Guest attach segment 4:`8f6e` receives object `0087:88a4`, HWND `013b`; map-insert segment 5:`34aa` returns cell `0037:077a`. Attach writes `0087:88a4` into that cell. |
| 2115 | Before host `set_window_class(1804e,-2)`, row 80 still records full HWND `1804e`, retired=1/live=0, generation 81, owner thread 2, procedure `005f:8fd8`, dialog procedure 0; narrow alias `013b` remains. This is already retired at the first captured row event. |
| 2116–2118 | Window table row is gone; narrow alias `013b` is then removed; host destroy follows. Guest cell `0037:077a` still contains `0087:88a4`. |
| 2123–2129 | A different object, `0087:885c`, executes detach and removes map key `0134`. This is not evidence that `0087:88a4` detached. |
| 2130–2132 | Destructor wrapper segment 4:`9430`; first USER.53 entry has argument `013b`, return `005f:9464`, widened handle 0, no window-table row. BX=SI=`88a4`, DI=1, BP=`87e8`; ES/SS/DS=`0087`, CS=`005f`, linear SP=`1f87da`. |
| 2133–2135 | Probe phases 1→2→8: widened zero, exact zero-handle rejection, actual return AX=DX=0, SP=`1f87e0`, EIP=`1a9464`. It does not take the nonzero-handle/missing-table rejection. |
| 2136 | Independently observed guest block return at `005f:9464` also has AX=0. Guest object-map cell remains unchanged. |
| 2142–2146 | A second wrapper invocation repeats the zero result; it is not substituted for the first. |

The ordered USER.53 notification-entry/return list is empty: phases 4/14 (selected/entered callback), 5 (callback return), and 6/7 (finish/continuation return) never occur in the original trace. No Catch/Throw restoration was encountered during this destruction. Collector errors and dropped records are both zero. This does **not** prove that the earlier teardown omitted all destruction messages: the diagnostic qualifies USER.53's walk, not every other notification producer. Host events in `console.log` can be duplicated by generic/enriched serialization; sequence-numbered `state.records` is the analysis source.

The earlier row retirement and handle-map removal are now the precise next evidence gap. Qualify the producer that retires `1804e`, including its ordered WM_DESTROY/WM_NCDESTROY entries/returns, procedure/thread routing, and guest detach behavior, before changing notification semantics. A reference contract or comparative witness is still needed before calling that earlier behavior defective. Do not change USER.53 to accept the retired handle or claim a CPU instruction defect.

## Passive diagnostic and validation

Temporary instrumentation in `src/09e-win16-api.wat` added an off-by-default host-only probe at USER.53 argument/widening/rejection/return, notification selection/entry/return, handle forgetting, and destruction-time Catch/Throw boundaries. Host observation copied registers, segments, stack, window rows, guest map cells and selected guest function entry/returns; it wrote no guest state. The callback census update reviewed only the two affected continuation-bearing function hashes, with unchanged ownership boundaries. Both temporary shared-file changes were reversed exactly using retained `diagnostic-with-census.binarydiff`; both files are clean afterward.

The locked full build passed before original execution and after restoration (`build-diagnostic.log`, `build-restored.log`). Both standard and compat modules passed generated actual NE callback controls: nonzero preserved callee registers/stack/segments, nested notifications and window teardown, retired-handle rejection and missing-table rejection, exact armed-versus-disabled final architecture/memory comparison. Separate generated fault-context preservation controls passed for both modules; they did not investigate the original's later fault. Existing `test/test-win16-far-fault.js` passed both modules before and after restoration. Production queue-validator and callback-census reconciliation controls passed. See `validation-controls.json`, `regression-{standard,compat}.json`, and focused logs.

Diagnostic shipping module identities:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| standard | 2178672 | `4fb6863fb7d37ecca84632d4d8eb89e87ee7fcb5db7428c2210e8afac2683578` |
| compat | 2181318 | `b6d410aa631f3be03e93d9a5e580abb15ed6f1b2ceb68257d01e31a0317b258b` |

The original actually instantiated the standard module with the first hash, for CPU instances 0 and 1. Before trusted input, actual HTTP responses for existing host/source/module files matched local hashes; the optional absent `build-info.js` returned 404 and is explicitly retained, not reported as a match. `http-preflight.json` also qualifies both modules and source delivery. The original used the cooperative `?debug&no-threads` backend. There is no worker-backend gameplay claim.

Harness limitations are retained. The first lock-holder shell ended prematurely; a prelaunch assertion caught its absence, and the caller failed before its launch marker, browser or guest. Locks were reacquired persistently without resetting the deadline (`prelaunch-lock-failure.json`). Later a readout CDP connection used Puppeteer's default viewport and changed live geometry to 800×600 while the owning screenshot client captured 900×720. Two Yes clicks missed the button; the live 640×515 canvas geometry was then used for the successful ordinary click. The readout helper was corrected to `defaultViewport:null`; the earlier geometry mismatch is preserved. At completion, the replacement holder and watcher sessions reported exit 143; the signal sender/time is unknown. Thus continuous runtime-lock ownership is not proven, although the holder was verified alive at original launch, both builds used the build flock, source ownership remained assigned, and no overlapping runtime was observed. `lock-session-terminal.json` retains this limitation. None of these harness issues was treated as an emulator defect or used to justify another original session.

## Recovery and provenance

Runtime source commit: `8b19dbcf03e2d292afdf887be51a6084e77f1470`. `source-before.json`, `runtime-relevant.binarydiff`, `diagnostic-with-census.binarydiff`, the preparation/baseline/diagnostic/restored source manifests, and patches for relevant untracked source retain the exact source state. Small run-specific helper inputs have new-file patches. Unique diagnostic modules are retained with their hashes; no source tree or media/source archive was copied.

All 181 original files (14,382,323 bytes) were verified in existing media `/home/user/wine-assembly/scratch/game-media/lords2-demo-20261105/original`, referenced through the existing fixture. `SETUP.EXE` SHA-256: `c9844241cf6594050cb4cdde5b04d4f994dfa6da83a3c5538dab16e792aa49b7`; candidate manifest SHA-256: `f73d8da675e08d1a5460e380e1b314a4bfe7cc59031ec1202b8f11560f929afc`; fixture manifest SHA-256: `a1749143a2de176c4f3fdf314337a1767f6101eed4a88b6d5b0dee4d59012f8e`. See `media-verification.json` for per-file hashes and existing recovery paths.

Predecessor releases and independent cleanup/resource checks are retained in `release-gate.json` and `launch-resource-check.json`. Coordinator 07:32:53 clarified that existing workers were already admitted. No flag occurred in this lane. The earlier stopped D3D lane was not continued. Assigned boxes: none (ID/state/expiry N/A). Final owned PID/port/profile/lock checks and evidence hashes are in the run's cleanup and result artifacts, with `result.json` written last.
