# NFS3-RENDERER-BENCH — preparation, execution pending

Owner `codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642`, 2026-10-02 UTC. Read-only source audit and metadata only. No browser, benchmark, build, installation or network command launched. This recipe is an intermediate handoff: the user task remains unfinished until authorized execution and reviewed results.

## Three original guest paths

All local fixture files exist and were hashed; `scratch/nfs3-renderer-bench-20261002/audit-hashes.json` records full identities. Original EXE SHA-256 `0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad` matches the benchmark's required seed-hook fixture.

| Case | Registry Thrash Driver / loaded DLL | Execution route | Frame boundary |
| --- | --- | --- | --- |
| glide | voodoo / voodooa.dll | original guest Glide → shared renderer WebGL endpoint | grBufferSwap |
| d3d | d3d / d3da.dll, D3D Device=0 | original guest D3D → WebGL, with explicit counted fallback if any | DirectDraw Flip |
| software | softtri / softtria.dll | original game's x86 CPU rasterizer → DirectDraw presentation | primary dx_present |

`glide-software` is a fourth, different route: original Glide DLL through Wine-Assembly's WAT rasterizer. It is excluded from the requested three-way comparison. Setting `d3d-renderer=software` alone does not prove original game software selection: the DLL load must establish it. Require requested DLL and absence of the other two, not merely one matching log entry.

DLL SHA-256: voodooa `6c7b0a1bd3ea4f7c673b7ff89db25379939171d33b1a969aa2506e44b8103b77`; d3da `ae676272438d93fd7a8da7a19250d6e8b664d8570824ab8042e2b20b38395a02`; softtria `8ea15aac0a7095b7d750cd75bbc9095553b6f708d1b89ca807864294a1a12b02`.

## Proposed identified base and resources

Preferred source/module pair is an isolated **copy** of the already validated `/private/tmp/wa-mig-audio-20261002` at9b4f9b3f plus the documented audio-capability slice, with WASM `da5bf93bcaca3ec1e16f48f1ffea8d30c7d375b76b4118ffa1109cb2f5ff7074`. Rechecked that module and its existing NFS harness, Glide backend, D3DIM backend, guest worker and app registry; hashes are in `proposed-base.json`. Its harness is identical to current `afd3992f222318d79006edf4296d4f82fe14cb1ef20231cca6119140e9a73148`. Full runtime/build-input freeze manifest must be produced before execution, and source/module lineage verified against the audio handoff. Do not claim this is current dirty main. The current canonical module is c474288d and does not establish provenance for the unfinished shared REP source; it is not the proposed module.

Use one exclusive **local Mac CPU + hardware GPU + headful Chrome** slot, one browser at a time, ephemeral static server, unique browser profiles. Record actual macOS/CPU/Chrome/Node/GPU identities at execution. Explicit Chrome path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; do not auto-update/install. Freeze all served host/runtime files, helper/overlay bytes, source manifest, module and full fixture manifest; recheck after campaign. Copy exact original fixtures/browser manifest into the isolated fixture with original relative paths, preserving source assets. New helper code is measured as part of the same frozen setup for all paths.

No slot is assumed granted. The old ASCII FP host uses actual SwiftShader and is **not** suitable for this requested hardware comparison. Latest ownership also preserves SAM8138/8146, Pirates8159, MMX server58114 and ops8098. REP exec33835 exit remains unconfirmed in its handoff; coordinator must resolve its resource state without retrying blocked execution or signaling foreign jobs. Ops has an active dashboard browser-review claim. Quiet benchmarking must wait for all local browser/test/build work to release CPU/GPU, including the dashboard review. Read-only board checks do not establish remote job state.

At execution require three consecutive10-second CPU-idle samples≥95%, no competing browser/compiler/emulator benchmark, ≥4GiB available memory, normal thermal state if readable, and stable actual hardware GPU. Record sanitized processes and load; load alone is not a quiet check. Preserve parked/reference jobs. On interference stop and retain the attempted run; no silent retry or foreign process cleanup.

## Narrow tool work required before launch

Request ownership of `tools/nfs-renderer-bench.js` only, plus a small new pure-analysis test if needed, or an equivalent isolated helper copy explicitly approved by coordinator. No production renderer/source edits are needed for preparation. Existing helper provides serial fresh browsers, deterministic seed, screenshots, CPU-process accounting, counters and page/worker profiles, but does **not** yet satisfy all task criteria:

1. Collect bounded timestamps at the exact guest frame boundaries used for FPS, in their originating execution context where possible. Glide swap timestamps must come from the renderer endpoint, not delayed/batched page stats delivery. D3D/software use their respective Flip/primary-present callbacks. Retain raw intervals, clock/context labels and dropped/overflow counts; exclude the first cross-window interval. Report guest submission/presentation cadence, not GPU completion latency. RAF/perf HUD intervals are a different metric and cannot substitute. Compute nearest-rank p95 and median from actual intervals, not1000/FPS or percentiles of three aggregate windows.
2. Strengthen independent GPU checks with CDP SystemInfo device/auxAttributes/software-rendering flags **and** active endpoint/context renderer. Reject SwiftShader/llvmpipe/software/unknown or contradictory evidence for accelerated arms. Record renderer endpoint API/backend for D3D as well as Glide. Old assertion trusts application renderer text alone, already contradicted on the FP host. No `--swiftshader`, fallback substitution or hardware-gate bypass.
3. Require exact640×480 guest display and surface. For softtria independently assert selected/raster/backbuffer640×480 and1280-byte pitch from existing DLL-offset probe. Require only requested renderer DLL, zero guest/renderer errors, advancing exact frame counter and visible attached race output.
4. Strengthen route readiness: existing >100k triangles or software >100presents/40seconds may include countdown/loading. Preserve seed12345 hook and scene `{mode:3,ai:0,weather:1,night:0}`; verify a post-countdown idle cockpit with timer advancing and speed0, without accelerator/steering input. A first bounded qualification establishes a visible HUD checkpoint (proposed race clock00:00:10) and a reliable per-path read/observation; do not invent an unverified guest timer address. If checkpoint cannot be aligned, report unavailable controlled comparison, not an FPS ranking. Keep save/VFS state fresh. This is an idle race-start/rain workload, not driven racing or pixel parity.
5. Add explicit readiness/sample/overall deadlines and stop-on-first-failure orchestration, preserving finally cleanup. Existing multi-case loop continues after failure, so invoke one case per process under the outer supervisor. Capture served-overlay hashes; existing metadata records only five source files, insufficient for full build identity. No normalization or silent source rewrite.

## Bounded campaign after qualification

First grant should cover static helper implementation plus **one qualification launch per path**, serial glide→d3d→software, zero timed samples. Each launch maximum600seconds total, no retries, with own browser/server cleanup; inspect race images and validate hardware/DLL/resolution/checkpoint/counters. A failed path is reported explicitly and stops the campaign for review. These launches validate route, not performance. Up to1800seconds qualification budget.

Once qualification passes, freeze helper/inputs and use two reverse-order blocks: `glide,d3d,software,software,d3d,glide`. Every fresh process uses `--seconds=30 --samples=3 --seed=12345`,10-second post-checkpoint warmup, no CPU profiler/guest histogram/RPC/readback probes. This gives six30-second windows per path and two same-path sessions each; the second block provides the same-path drift control. Each process capped600seconds including route/warmup/windows/cleanup; six-process cap3600seconds. No sample reruns. Command skeleton from isolated root:

```
CHROME=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome node tools/nfs-renderer-bench.js --cases=CASE --wasm=build/wine-assembly.wasm --source-commit=9b4f9b3f+documented-audio-slice --seed=12345 --seconds=30 --samples=3 --out=FRESH_CASE_SESSION_DIR
```

The outer supervisor enforces ownership, deadlines and failed-result stop; the strengthened route gate is in the frozen helper. Do not run this skeleton before the missing gates are implemented/reviewed.

Then three separately labeled diagnostic launches, one per path, `--seconds=20 --samples=1 --profile --rpc-census`, same source/module/route, maximum600seconds each. No `--guest-profile` initially (histogram overhead and no need for tier census to meet this task). Enable `--readback-census` only if its inspected source anchors apply to this frozen build and label that probe overhead; if unavailable, existing sync/readback counters plus CPU stacks still report the gap explicitly. Profiles must include actual renderer worker as well as guest workers/page and identify thread URLs. Diagnostics never supply headline timing. Total proposed maximum7200seconds across qualification+baseline+diagnostics, excluding bounded static preparation and review; no wider sweep implied.

## Metrics and predeclared acceptance

For each baseline window retain frame count/duration/FPS, actual interval median/p95, interval count, raw timestamps, browser-process CPU by type and totalCPUms/frame, load/idle/thermal observations, scene/resolution/backend, start/end screenshots and cumulative-counter deltas. Aggregate windows with median, min/max and spread, retaining session boundaries. CPU totals include all browser processes and are not isolated guest CPU. Never add overlapping elapsed draw/texture/sync timers as if independent.

Glide stats expose draws/triangles/swaps/uploads/uploadBytes/LFB reads+writes/GPU readback count+bytes+CPUms/failures/mergedDraws/errors. D3DIM exposes draws/drawCalls/mergedDraws/triangles/lines/fallbacks/fences/syncs/syncPixels/syncBytes/uploads/uploadRows/textureUploads/drawMs/submitMs/syncMs/uploadMs/textureMs/pageChecks/textureByteChecks/dirtyAuditMisses/errors. Report per-frame deltas and counter semantics. Original x86 software may not expose triangle/texture counts through these accelerated adapters: mark unavailable/N/A, retain guest CPU profile and DirectDraw upload/presentation counters; never fill missing counts with zero or use a different renderer to obtain them. Fallback counts must be disclosed even with verified hardware WebGL; whole-context software fallback is rejected.

Predeclared quality budget: all correctness/hardware/route/hash gates pass; ≥100 valid frame intervals per30-second window, zero overflow, no competing work; same-path session median FPS drift≤5% and frame-time p95 drift≤10%. If original software cannot supply100intervals, preserve the evidence and call precision insufficient; do not extend windows without a new bounded grant. Performance advantage requires median FPS difference>max(5%, measured same-path drift) and consistent direction in both order blocks, with no>10% p95 regression or correctness degradation. This is a comparative acceptance budget, not a promised FPS target or significance test. Results inside control spread are inconclusive. Report unavailable paths and bottlenecks honestly; historical high-load or SwiftShader observations are context only.

Final reviewed bundle belongs to registered candidate `need-for-speed-3-demo`, with route-specific images, full manifest, profiles, counters, sample ordering and limitations; publish after actual execution/review under coordinator grant. Exact next action: coordinator chooses proposed isolated source pair, grants narrow helper ownership and local qualification slot after ownership/quiet checks. The benchmark task remains active pending those grants.

## Isolated preparation completed under subsequent grant

Prepared `scratch/nfs3-renderer-bench-20261002/fixture` from the selected validated audio tree, with exact local NFS3 assets. `frozen-original-hashes.json` pins2826 copied files. Only the isolated `tools/nfs-renderer-bench.js` differs from that snapshot; two new isolated files are `tools/nfs-bench-analysis.js` and `test/test-nfs-bench-analysis.js`. Original source/module and shared worktree files were not edited. `node_modules` links to the existing validated tree's dependency directory; no packages installed. `harness.patch` contains the reviewed isolated harness diff. `prepare-harness.py` is an intermediate construction record, not a replay command (subsequent reviewed edits are in the final files).

Prepared helper hash `66713e5e03276c928c584e2512db00dae81ef5091b155a71d438b249c29b7933`; helper/test hashes are in `prepared-hashes.json`. Static overlay audit parsed both complete served scripts with `vm.Script` without executing either. Original/served identities:

| Overlay | Original SHA-256 | Served SHA-256 |
| --- | --- | --- |
| guest-worker.js | `d9c0d0775d017e2f07f46991208449e616b80a6193d5ce0b095f0d052b9a92f6` | `7cb24b5cded90092ef63fe813fffbe4233d52430071205450694707f0accfeae` |
| glide-backend.js | `8102c667567b9407a8cadc9e34301213cf8ee1f5c841096341973c8b870cbace` | `f49345c0e741274cc3a90b67de64916aa4f17a3ea812fb7fc9942b7eedc1d490` |

The guest-worker overlay retains the existing exact seed hook and renderer probe, and wraps the originating WASM `dx_trace` import to timestamp Flip/present before forwarding unchanged arguments/return. The Glide overlay timestamps the existing swap counter increment inside the device's actual `submit` execution context. Neither changes renderer selection, drawing, state, resource lifetime or scheduling. Arrays cap at100,000 timestamps with explicit overflow; per-context clocks are never merged. Qualification fails unless exactly one expected originating stream is discoverable. Whether Puppeteer's page-worker enumeration reaches every actual execution context is deliberately a runtime qualification gate, not presumed from static inspection. It does not substitute page RAF or batched stats timing.

GPU qualification requires active context text plus CDP renderer, matching recognized vendor, enabled hardware WebGL features, and no software/unknown renderer indications. D3D must expose the shared d3dim/webgl endpoint; Glide retains its endpoint assertion. Guest display/surface must be640×480; original software also checks its three internal dimensions and1280-byte pitch. Requested DLL must load and alternative renderer DLLs are rejected. Seed12345/default rendering switches are fixed; diagnostics, SwiftShader and the fourth Glide-software case are rejected during qualification. Outputs must be fresh directories.

Qualification takes ready screenshot,10-second warmup, then screenshots10 and20seconds later plus raw timestamps/counters. This does **not** establish a synchronized post-countdown checkpoint. Every report explicitly says `timingAccepted:false` and checkpoint UNREVIEWED. Timed samples are rejected at startup (`--qualification --samples=0` is mandatory) until the HUD checkpoint has been inspected and a reliable matched gate approved. The qualification interval summary uses a minimal one-interval sanity gate solely to validate collection; the later performance≥100interval gate remains part of the unlaunched campaign specification. No FPS acceptance can be inferred from these diagnostic qualification images/intervals.

Each single-case body has a600-second deadline; timeout skips further screenshot/observe requests and enters owned-browser cleanup. Browser close has10seconds grace, then only that browser process may receive SIGKILL as a last resort; no foreign PID is targeted. No timeout or cleanup code has been exercised against a live process yet. External ownership/quiet-host preflight still belongs to the coordinator-granted execution supervisor. The static helper does not claim to detect all host interference by itself.

Validation performed: harness syntax check PASS; pure analysis test PASS for median/nearest-rank p95, insufficient/nonadvancing/nonfinite samples, contradictory SwiftShader/Intel and Apple/Intel identities, missing/disabled hardware evidence, DLL exclusions, timestamp reset/cap/overflow; complete served-overlay syntax and unique seed/swap anchors PASS;2826-file freeze comparison showed only the owned isolated harness changed. All tests were ordinary JavaScript parsing/analysis/fixture reads, with no emulator, browser, build or network work.

Concrete first qualification command, **not executed**, after a fresh localCPU/GPU grant and quiet checks:

```
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scratch/nfs3-renderer-bench-20261002/fixture/tools/nfs-renderer-bench.js --qualification --cases=glide --samples=0 --seed=12345 --wasm=build/wine-assembly.wasm --source-commit=9b4f9b3f+documented-audio-slice --out=../qualification-glide
```

On success and reviewed evidence, use identical command with `d3d`/`qualification-d3d`, then `software`/`qualification-software`, within the granted three-launch budget. Stop on first failed path; no retries. Relative `--wasm`/`--out` resolve from the isolated fixture, not shell cwd. Persist hashes and actual GPU/browser identity with each result. Runtime-dependent endpoint/surface/worker visibility may expose a concrete integration gap; preserve and report it rather than relaxing a gate silently. Next action is coordinator diff review and qualification grant after dashboard GPU release. Task still unfinished; no local benchmark slot held.

## Root review fixes — prepared revision 2

Supersedes the prepared helper/served hashes immediately above; the qualification command is unchanged. Latest authoritative `prepared-hashes.json` pins harness `246401ec76ee5729abb6bd115d43796d55681df9f024e817094244cccb0f3973`, analysis helper `7cec796df20a80f06efb7b57ddc2f49db87b5f9db48cd3dc7763eca38787af9c`, and pure test `c945988e09af7cc2ae486dd476eea0f196e89a1e06be4a949405fa65b141c9f0`. Regenerated `harness.patch` reviewed;2826-file comparison still finds only the owned isolated harness changed.

Final evidence capture now shares a five-second budget, further capped by the remaining600-second body deadline. Expired bodies send no final observe/screenshot request. An observe failure or timeout skips the subsequent screenshot; expiry between the two also skips it. Browser close has an independent ten-second cap, then signals only its owned browser process if necessary. Static-server close has a five-second cap and only closes its own connections on expiry. Maximum asynchronous finalization allowance is20seconds (5capture+10browser+5server), in addition to the body600seconds; ordinary local file writes are outside these async protocol budgets. A preexisting body failure remains the primary `report.failure`; final capture/cleanup errors are retained separately and only become the primary failure if none existed. No cleanup error silently converts failure to success. These bounds were tested with fake never-resolving callbacks, not a real browser.

Originating DirectDraw telemetry now keys by `(kind, surface slot)` and retains the uncoerced slot argument. A slot first seen after measurement arming is captured rather than lost. Qualification fails if the requested frame kind has multiple active slots/contexts, a missing/invalid slot, or overflow. D3D Flip additionally requires observed `dx_present` activity and identical front/presentation slot values. Original software requires exactly one active present slot; its primary/front semantics remain explicitly subject to the qualification surface/visual evidence. Slots are not collapsed or silently filtered to whichever is fastest. The immutable trace source documents kind5 as surface present and kind6 as front-slot Flip; no guessed memory-layout accessor was introduced.

Additional pure tests PASS: two present slots rejected, missing/invalid slot rejected, Flip without presentation or with a different presented slot rejected, new slots after arm recorded, hung capture skips screenshot and still closes, expired body skips all evidence requests, hung close reaches own-kill callback, expiry between captures skips screenshot, zero budget does not start a task, original failure preserved. Syntax and complete served-overlay parse/unique anchors PASS again. Revised served hashes are in `static-overlay-audit-v2/served-hashes.json`: guest-worker `cbc43f02d80152d2628420bc2d61934bd74e4f2f8aac612024d7baebb4b10a8a`, Glide `9e74faf14049718af97bbc9f0cdbbd13d6d87a03314963a0ea660ee57d66a32a`; original hashes unchanged. Previous audit evidence is preserved.

Still no emulator/browser/network/build or GPU claim. Await root review and resource grant; task remains unfinished.

## Dependency closure and resource preflight — qualification deferred

Static closure audit found and repaired actual fixture omissions without downloads, installations, builds, browser or guest execution. Added the frozen base's19 registry/system-data files (18 DLLs plus `test/binaries/tlbs/stdole2.tlb`). Removed the mutable `node_modules` link by copying existing package bytes. Static resolution then exposed ancestor packages under `/Users/vg/node_modules`; those are now mirrored under `fixture/package-ancestor/node_modules`, with196 links for packages absent from the project tree. Keeping the ancestor mirror's own package layout preserves its dependency versions instead of flattening them over existing project versions. All250 fixture symlinks resolve inside the fixture; no resolved Node dependency escapes it.

The source package directory contains a self-referential `.node_modules-9kk4pwUY` backup link. Initial materialization followed it; stopped only own copy exec48767 via Ctrl-C, preserved that incomplete copy outside the fixture, and excluded this non-runtime backup link from the completed copy. Two intermediate flattened packages were also retained outside the fixture when the exact ancestor layout replaced them. None is on the fixture's resolution path. `audit-closure.py` records the initial interrupted attempt; the authoritative final audit is `finalize-closure.py` plus `resolve-closure.js` and their reports. These construction records are not instructions to replay over the existing fixture.

`closure-hashes.json` pins12,270 regular files. `closure-additions.json` pins9,442 added files; all2,826 original file identities remain as expected, with only the previously approved isolated harness delta, and all three `prepared-hashes.json` values are unchanged. Candidate manifest133 entries all resolve and are hashed,78 font files are present, browser bootstrap scripts and checked worker/endpoint script literals resolve, and the original EXE/three renderer DLLs/WASM remain pinned. `closure-report.json` records exact paths, symlinks and external executable metadata. Deployment-only `build-info.js` remains intentionally absent as documented by the original index's local `dev` fallback.

`node-closure.json` records377 statically reached files and1,015 literal require/import resolution edges with zero external resolutions. Its16 unresolved literals are classified in `optional-dependencies.json`: optional try/catch `bufferutil`, `utf-8-validate`, and `supports-color`; unselected QuickJS debug/async variants used by optional proxy/PAC machinery; and two documentation-example literals from the conservative extractor. Release-sync QuickJS files exist. The selected local Chrome WebSocket transport creates a direct NodeWebSocket without a proxy agent; no download/PAC path is requested. Dynamic computed imports cannot be proven by literal extraction; complete lib/tools/package trees and worker definitions were frozen to cover them, and first qualification remains the runtime gate. No pure helper tests were repeated because helper source did not change.

Node executable, Chrome launcher and Chrome Info.plist were read/hashed, not run, in `closure-report.json`. Current bundle version is154.0.8037.95. OS/browser framework resources remain installed external dependencies and must be rechecked at actual launch; they are not falsely described as frozen package inputs.

After dashboard's explicit resource release, performed one authorized read-only local preflight. Sandbox denied `ps`; a single escalated `python3 scratch/nfs3-renderer-bench-20261002/resource-preflight.py` completed as exec43088, exit0. No duplicated operation. Raw evidence `local-resource-preflight.json`; concise `resource-summary.json`.

**NOT QUIET:** three ten-second intervals at04:40:16/26/36 UTC were31.46%,28.53%,35.40% idle, versus95% required. Initial process snapshot included foreign replayd PID37382 at145.5%CPU, WindowServer PID181 at45.9%, WebKit GPU PID68082 at21.8%, and several Chrome processes at17–19%. These are observed contenders, not ownership or termination authorization. No process was signaled. `memory_pressure -Q` reported40% of16GiB (~6.4GiB pressure-based headroom); this is not a claim of6.4GiB physically free RAM—top reported only76–87MiB unused with substantial compression. `pmset -g therm` reported no recorded thermal/performance warning, not an affirmative thermal sensor measurement.

No browser launched, no GPU slot held. Exact next step is coordinator resource decision; any later quiet recheck and first **Glide-only** qualification require a fresh grant. D3D/software remain gated on review of that first result. The original three-path benchmark task remains unfinished.

## Root semantic review gate before later measurement

The subsequent frozen-source audit in ops/handoffs/ops-game-fps-frame-review.md shows raw dx_trace kind5 may count partial primary Blt/BltFast, rect Unlock, palette updates and other presentation requests; a stable single surface slot alone is not proof of one game frame. Kind6 is an accepted Flip-submission boundary, still not displayed-frame completion. Public onGuestFrame duplicates kind5 notifications and must not be used for exact counting.

The existing prepared NFS3 helper remains qualification-only with timed samples disabled. Its software kind5 stream is diagnostic request cadence until actual runtime and a separately reviewed full-frame discriminator establish meaning; it must not be promoted to software gameplay FPS merely because surface/dimensions/interval gates pass. No helper source was changed by this note, no browser was launched, and the hardware/quiet-host blocker remains.

## Executed on a CPU-only boat — 2026-10-10 (claude:90024109)

Run on current main (1d573ba03, built on boat bx_why3tmc3) with `tools/nfs-renderer-bench.js`
as shipped, not the 10-02 frozen fixture (it is not on the ops box). Headful Chrome 151 on Xorg,
AMD Ryzen 9 9950X 4 vCPU, **no GPU**: WebGL was SwiftShader, explicit and CDP-verified. Evidence
and full report: `scratch/runs/20261010T0215Z-nfs3-renderer-bench-swiftshader/report.md`.

- All three original paths qualified (only the requested DLL loaded, 640x480 display/surface,
  softtria raster 640x480 pitch 1280, seed hook, rain race-start scene), then 18/18 timed windows
  in blocks glide,d3d,software,software,d3d,glide (3 x 30 s each).
- Medians: glide 14.3 swaps/s (session drift 4.4%), d3d 14.1 flips/s (15.7%), software
  12.8 present requests/s (20.8%). **Inconclusive** under the budget above: drift > 5% on two
  paths and every between-path gap is inside it.
- Chrome's GPU process (SwiftShader) used 71–86 of ~120 CPU-s per window on every path; the
  renderer process 17–35. On this machine the measurement is mostly SwiftShader.
- D3D reads back the full 640x480 frame (1,228,800 bytes) once per Flip, ~34 ms, plus ~47 ms
  wait per frame; Glide's render worker spends 90% in `gl.getError`; original software is guest
  compute (`$uop_fast` 34%, `$x87_island_fast` 11%). Original software draws no fog and an empty
  mirror, so it is a lighter workload.
- Gate bug found and fixed: on this GPU-less box the context's `WEBGL_debug_renderer_info` reads
  "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 …)" with or without SwiftShader flags while CDP
  names SwiftShader. The hardware gate trusted that string alone; it now requires CDP agreement
  and refuses the run without `--swiftshader` (verified on the boat).
- Still missing for the full task: a real-GPU host, and per-interval frame-time p95 (the tool
  counts boundaries per window only).
