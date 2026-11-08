# TR2 far-opening continuation — 2026-11-08 15:54 UTC

**Blocked by death in the single fresh original.** Lara advanced farther down the lower alley, making the ornate building beyond the far opening substantially larger and clearer, but a dog attacked from behind and killed her. The final personally reviewed capture shows **Game Over**. Crossing the threshold, an airborne jump and landing remain unproven. No restart, replay or second allocation was attempted. Full27, parity, audio and FPS remain open.

New evidence is `scratch/runs/20261108-tr2-alley-onward-1544/` (R). The assigned basename already held the closed 14:17 Alt-repair run documented below. Setup overwrote some old helper/metadata inputs before preflight detected that collision. All **483 original artifacts were recovered and checked against their original hashes** before allocation; historical raw journals and captures were never changed. The preflight failure and recovery steps are retained in R. The earlier report remains below.

## Observation before gameplay and exact inputs

Starting Git SHA: `fbcf60472ca6af3d4010c55f90994125e45f62f5`; relevant binary diff is empty. The current exact checker passed **614 providers / 29 physical helpers**, with the production-only normal driver and shared 16-key controls. The 226 accepted control references, 23 existing media references and 49 repair controls were independently reread and reused unchanged. No production code changed and no unchanged fixture suite or full build was rerun.

Before allocation, a cheap smoke check exercised the actual normal driver's extracted `execute` and `capture` functions, confirming that ordinary `observe` awaits ARM then saves a non-null raw journal. This controlled check is not runtime qualification. In the actual original, reviewed Enter accepted the Graphics startup dialog; **ordinary `observe` then ACKed before any gameplay command**. Its retrieved ARM receipt binds `process:1000:endpoint:1`, owner and observation generation 1. The initial raw journal was non-null, live, failure-free and initially empty. `observe-confirmed-before-gameplay.json` records that only Graphics Enter and observe had been queued at confirmation.

Final accounting is **546 raw = 79 qualified retained + 467 discarded**: 448 `coalesced-before-publication`, 19 `run-normal-shutdown`. Every qualified row retains its canonical read source; journal failure is null. The final raw journal SHA-256 is `57281a41844a73d44baf5f6c2027b857bd1edf1fb03ecd2a1b59f58fbc885778`. This is observation accounting, not FPS. Historical predecessor accounting **670 = 53 + 617**, and the earlier run below **299 = 41 + 258**, remain exact and separately attributed.

All five actual parsed JavaScript sources match their pins. Actual CPU and owning native WebGL2 module hashes both equal `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`. The owning backend is WebGL2 on ANGLE Intel UHD Graphics 620. Accepted native pixel-authority proof was reused unchanged without another pixel logpoint.

## Reviewed consequence

Six separately reviewed Right holds revealed the lower alley. Six separately reviewed Up holds advanced toward the ornate building; the last was followed by a passive capture rather than a blind no-progress repeat. A dog became visible attacking Lara from behind, with falling health. A single ordinary Alt hold ACKed and independently released, but the held capture shows the fatal attack and the next capture shows Game Over; neither establishes a successful jump.

Compare R's `review/webgl/right-6.png`, `forward-4.png`, `opening-current.png`, `assess-end.png`, `jump-fresh.png`, and `retrieved/webgl/jump-once-held.png`. The final `review/webgl/jump-once.png` SHA-256 is `5f3b9fb08bfe8049e419b05590a0257d42bd85f5fb2cc235771f7e7504526f0e`. The forward view is visibly beyond the predecessor's final lower-alley view, but the alley walls still flank Lara: crossing is not claimed.

There were **27 ACKs**, including **four stale-scene refusals before dispatch with zero effects**; each was followed by a fresh reviewed capture. Fourteen actual holds comprise Enter once, Right six, Up six and Alt once. All **28 native events are trusted and balanced**; independent release receipts and the final read-only check establish all 16 admitted keys released. Requested two-second holds released in 1999–2001 ms. There was no runtime UNKNOWN, firing, compound input, private input handler, guest write or configuration change. Two attempted local image reads after stale refusals found no nonexistent output; no command was replayed to fill evidence.

## Closed lifecycle and validation

The observable independent 25-minute watchdog was armed before allocation. Overall, browser and cleanup deadlines were immutable, and local lifecycle PID/start identities were captured before create. Box **`bx_s6jxweu2`** was created once with a fresh persisted UUID idempotency key; initial expiry **2026-11-08 16:11:35.304 UTC** was recorded before runtime. The remote custodian held its lock from startup through drain; no local heavy runtime or local runtime lock was used.

All **615 uploads joined** before verified content-barrier publication; queue admission and parent consumption match manifest SHA-256 `0378a41720c7119910926786a095175cb2b8a26faf896745f7751268cdb29127` (614 providers / 57,915,773 bytes). The published durable WNOWAIT reaper and existing tested custody were reused.

Before requesting normal stop, **343 artifact references / 312 unique hashes / 347,154,484 bytes** were retrieved and independently reread. Drain passed for **28 recorded remote PID/start identities**, including observed/adopted descendants, custodian and bootstrap; endpoints, both ports, profile, writers, held input and remote lock were drained, and all provider hashes remained unchanged. Custody covers a 50 ms descendant census plus subreaper adoption and durable before-reap registration, not exhaustive kernel fork history or identities of intermediates already reaped by their parents. Diagnostic subprocesses were synchronous and parent-awaited. All three recorded local PID/start identities are absent; both lifecycle children exited zero and the supervisor ended empty.

Box state is now **archived, expiry null**. Normal stop **`stop_14219da97d66b403`** completed **15:54:32.164 UTC**, forced=false, error=null. No task box remains billing.

`python3 R/audit-onward.py` passes: original artifact hashes, exact barrier, pre-gameplay ARM, raw qualification accounting, parsed sources/modules, trusted balanced input and releases, 24 PNG chunk-CRC checks, remote drain, local lifecycle and old-run restoration. Run-specific helper syntax checks pass. Recovery uses the exact Git SHA, empty relevant binary diff, small owned patches, individual logs/captures/modules and existing media path/hash references; `BOAT.TR2` stays at its existing path, SHA-256 `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e`. No source/media archive, peer WIP, public deployment, old-box resume/delete or subworker was used.

Stop after this concrete gameplay blocker. A separately assigned continuation must account for the dog encounter before attempting the far opening; it must preserve the same pre-gameplay ARM gate and avoid replaying this closed original.

---

# TR2 alley onward and native key integration repair — 2026-11-08

The fresh original exposed and reproduced a **new generic input integration defect**: ordinary request validation admitted `Alt`, but the independently released hold executor had a separate key map without `Alt`. A reviewed jump request therefore asserted before any native Alt event, closed the runtime, and remained sticky UNKNOWN. The substantive repair uses one key definition and event encoder for request admission and execution. Eleven focused tests, including the actual numbered request/consume queue, pass; the required locked build passes and produces the unchanged `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc` native module.

This meets the tested FIRST NEW integration repair alternative. A new plaza/threshold and a successful native jump are **not established**. No second original or replay was attempted. Full27, parity, audio and FPS remain open.

Evidence is `scratch/runs/20261108-tr2-alley-onward/`.

## Exact fresh runtime and preserved qualification

Preallocation checks verified the accepted 612 source/helper pins, 226 control references, 23 existing media references and 49 repair artifacts. The inherited 33 physical startup helpers were relocated into the owned run directory, and all 34 physical helpers including the new verifier passed syntax/hash checks before create. Relevant source diff was empty and launch disk exceeded 8 GB. Accepted decoder/compositor/guard/build controls were reused without reruns.

One UUID-idempotent box and one original used the same `index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl` route. Actual CDP parsed-source hashes match the five accepted host/imports/render-worker/d3d-render-worker/renderer pins. Before movement, actual CPU and owning render modules matched `d8facd06…`; the owner identity binds the actual WebGL2 context on ANGLE Intel UHD 620. No expensive pixel logpoint was repeated and the accepted prior pixel proof remains the pixel authority.

The bounded publication journal and each capture retain exact request, source, native cache token, scene and display transfers. Final retirement records **299 raw = 41 qualified retained + 258 discarded** (249 coalesced and nine retired on shutdown). Qualification advances from five rows in `onward-current` to 39 in the final reviewed `slope-assess` and 41 at shutdown. The last qualified row records actual request descriptor 3483180 / serial 355, retained generation 292, cache serial 41 and publication 107. These are observation counts, not FPS. Request, writer, poison, expiry, identity and lifetime guards were unchanged.

## Reviewed movement and the first new failure

I reviewed the alley images personally. Five admitted ordinary Up holds, each requested for 2000 ms and independently released in 2000–2001 ms, moved Lara farther along the rising alley. The lattice/doorway grew nearer and the perspective changed beyond the initial image. Later holds showed little further travel and Lara settled at the slope. `slope-assess.png` is the final reviewed position; no new open area is claimed.

The original [PC manual](https://cdn.akamai.steamstatic.com/steam/apps/225300/manuals/manual.pdf), printed pages 2 and 5, confirms Alt jump and cursor-key movement/turning. After reviewing the limited progress at the slope and clear overhead, I requested a bounded 1500 ms Alt jump. The actual failure is in `retrieved/webgl/first-browser-failure.json`: the executor's `Object.hasOwn(KEYS,k)` assertion failed before its timer, attempted-key list or CDP dispatch. The baseline test reproduces request acceptance followed by that exact executor rejection with **zero native sends**. The queue has 17 commands, 16 ACKs, three zero-effect stale-review refusals, and one terminal UNKNOWN; no UNKNOWN was replayed.

The earlier all-source check ran before native Graphics startup had created the D3D render worker, so it declined the missing parsed source. The after-start check verifies all five sources. An observation request missing `waitMs` was rejected before queue publication; its corrected request includes the required bound. Both failures are retained. The Graphics acceptance review text also needs correction: `startup.png` showed Graphics/OK, while refreshed `graphics-current.png` showed a teal canvas without that dialog. The review text incorrectly described the earlier image. The ordinary Enter ACKed, and `native-start.png` then showed gameplay. This correction is retained separately; it is not a claim of scene manipulation or a second launch.

## Repair, tests and successor recovery

`tools/native-key-controls.cjs` supplies the shared key validation, established combination validation and native event encoding. It maps Alt to `AltLeft`, virtual key 18. The owned run's `ordinary-keys.cjs` and `bound-input.cjs` now consume it; the originally executed helper bytes are preserved separately as `runtime-original-*`. This repairs integration helpers, with no guest, presentation, input-duration, scene-freshness or production-renderer change. The accepted two-key combination policy is preserved; Alt+Up is not newly admitted.

Tests:

- `node --test tools/native-key-controls.test.cjs scratch/runs/20261108-tr2-alley-onward/key-integration.test.cjs`: 11 pass. Coverage includes the exact baseline failure, real request/consume ACK, all 16 accepted single keys, unknown-key/duration/combination refusal before native sends, keydown failure cleanup, and independent keyup while a passive sampler is still pending.
- `flock /tmp/wine-build.lock bash tools/build.sh`: pass; native WASM hash unchanged.
- `python3 scratch/runs/20261108-tr2-alley-onward/audit.py`: pass; all 223 recovered artifact references / 177,965,205 bytes independently reread, 15 PNGs validated by chunk CRC, journals/accounting/drain/lifecycle checked.

Recovery uses `source-head.txt`, relevant binary diffs, small owned helper patches, `successor-runtime-pins.json`, and existing media paths/hashes. Git is the source archive; no source/media archive was made. The successor manifest changes only the two integration helper hashes and adds the common key tool to the accepted runtime closure. It is a recovery input, not permission to replay this closed queue. The repaired jump path has mock CDP/queue coverage and has **not** been retested in another original.

## Lifecycle

An observable independent 25-minute watchdog was armed before allocation; overall/browser/cleanup deadlines were immutable. The remote custodian acquired the remote runtime lock before provisioning and held it through descendant drain. No local heavy runtime or local runtime lock was used for remote supervision/retrieval.

After the runtime fault, normal Browser.close exited Chrome zero. The drain verified all 28 recorded remote PID/start identities, bootstrap/custodian and adopted children absent, endpoints/ports/profile/writer closed, admitted key holds released, original runtime pins unchanged and remote lock free. Unique artifacts were retrieved and independently hash-verified **before** the delegated normal box stop. Both local lifecycle children exited zero, the supervisor ended empty, and all three local lifecycle PIDs were absent.

Coverage limits are explicit: the accepted custodian uses a 50 ms descendant census plus subreaper adoption/reaping, rather than kernel fork tracing. Synchronous diagnostic children have parent-awaited command exit records. Local lifecycle armed records retain PID/parent/session and supervised child exit, but local start ticks were not recorded before exit. A final live page key-state snapshot was unavailable after the sticky fault; the last reviewed capture has arrow states zero, every admitted hold has an independent release receipt, and the failing Alt path asserted before any native send. These limits do not establish exhaustive kernel task history.

Box **`bx_thx2e9ky` is archived**, expiry null. Normal stop **`stop_1642f50b97c2e213`** completed at **14:23:30.944 UTC**, forced=false, error=null. No task box remains running. No old box was resumed/deleted, public site deployed, source archive made, peer WIP included, or subworker launched.

Next: use the repaired shared key helper in a separately assigned fresh continuation, verify its actual loaded hashes, then review the slope before a bounded native jump or turn toward the next area. Do not infer jump success from this repair's mock tests.
