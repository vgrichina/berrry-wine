# Re-Volt current native End recovery and driving, 2026-11-11

Original `re_volt_demo` entered Single Race through normal menus, drove on Toys in the Hood 1, and recovered an overturned car after an ordinary End input. A second ordinary-menu Time Trial also drove, steered, reversed and used Home recovery. No checkpoint increment, completed lap, race finish or ordinary save was verified. Single Race remained lap 1/3; the final Time Trial image retained last lap `00:00:000`.

## Reproducible runtime and evidence

Run: `scratch/runs/20261111-revolt-current-native-race-checkpoint-0950/` (ignored). The runtime was pinned to Git `0db20330ccd6761a705eea70c5dd9bfc7704c147`, including shared renderer `7519e355` and the DirectDraw fixes through `0db20330`. Guest/render module SHA-256: `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`. `runtime-pins.json`, epoch-specific pins, source identity/diffs, original media references and the matching reused locked-build proof preserve the exact inputs. No source tree or repeated media archive was created.

The canonical media is `test/binaries/candidates/re-volt-demo/.wine-assembly-browser.json`, original installed executable/data with normal lazy mounting. The bound native browser controller used full current images, independently released native keys and distinct commands. Read-only probes inspected input delivery and positions; they did not change guest memory, saves, clocks or RNG.

`recovery-map.json` indexes all 1,338 recovered remote artifacts (60,091,811 bytes before deduplication/compression). `retrieval-verified.json` and the independent second remote rehash establish matching local/remote bytes. `png-validation.json` verifies CRCs and IDAT decompression for 114 unique full PNGs. If compressed, `lossless-map.json` maps original paths/hashes to gzip artifacts.

## Native recovery proof

In `review/gap-left2.png` the player's car is overturned, wheels above the chassis, beside the house/brick wall. After separate full-image review, one ordinary End pulse was sent. `recovered/original/input-native-flip-pulse.json` records release armed before key-down and acknowledged down/up (1,000 ms). `review/native-flip.png` shows the car upright in the same street area, lap 1/3. This is an observed native recovery sequence, not checkpoint/lap evidence. The paired binding, admission, review, state and capture records are retained.

A black gameplay capture during the first drive was transient: the following read-only observation restored the rendered race with no reported renderer errors. It does not demonstrate a persistent black-screen defect.

## Actual failures and controller repair

Initial launches exposed missing controller dependencies (`ops/browser-native-input.cjs`, `tools/native-input-pulse.cjs`, then `worker-observe.js`). Exact failures, process waits and confirmed exits were preserved before repaired launches. One launcher attempt also failed locally because its exclusive output file already existed; it did not create another browser.

The first successful runtime's command `home-long` was refused with `STALE_SCENE_BEFORE_DISPATCH` after a lengthy read-only investigation. No key pulse was sent. The inherited transport treated that zero-effect review expiry as a terminal fault and closed the browser (actual exit 1). Caller-level rejection/unknown wording is retained rather than rewritten as success.

A run-local transport repair now returns an exact zero-effect refusal ACK for this specific pre-dispatch stale condition, requires an explicit fresh capture before further input, and keeps post-dispatch/unknown failures terminal. `epoch1-transport.cjs` preserves the original. `stale-regression.cjs` / `.log` pass the refusal → explicit capture → distinct input path and post-effect terminal behavior. The second browser demonstrated this repaired path at `bend-short3` → `fresh3` → `bend-short4`. The refused command was not replayed. The original game was restarted only after confirmed browser exit, in the same box and fixed deadline.

Five focused existing input regressions passed: worker event slots, slice wake, independent DirectInput contract, real-worker acquire, and renderer initial input state (logs in the run). No production emulator defect was demonstrated; no production source change or speculative fix was made. The transport repair remains a run-local helper with its exact new-file patch retained.

## Fixed lifecycle and remaining work

Private box `bx_wfz6ty5g` had an observable independent watchdog armed before allocation, initial expiry `2026-11-11T10:31:28.642Z`, and a fixed earlier browser/recovery cutoff. Driving ended at the recovery cutoff without verified progression. After ordinary controller quit, browser/controller exit 0 and both stream EOFs were recorded; independent process observation found no remaining browser. All unique evidence was retrieved and rehashed before normal delegated stop.

Stop `stop_e985542655480ed5` completed at `2026-11-11T10:25:41.049Z`, forced false, error null. Independent GET confirms archived state and null expiry. The watchdog exited 0 unfired with actual parent wait and both EOFs. Receipts remain in the run.

Next: follow the native route past the early street/fence bends with better heading control and obtain an actual lap/checkpoint transition. Position observations and wrong-way recovery are not substitutes for that proof. No save artifact is claimed.
