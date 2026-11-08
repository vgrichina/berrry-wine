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
