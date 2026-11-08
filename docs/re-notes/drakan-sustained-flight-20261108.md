# Drakan flight: buffered drain versus actor-update gate, 2026-11-08

Sustained flight was not demonstrated. This attempt identifies a concrete new boundary: the accepted bounded host hold can arrive at the original game as **down and release in one buffered drain**, canceling the ascent control before a subsequent actor update. The actual original handler retains the exact down timestamp, so this advances beyond an unexplained input-without-consequence result. No emulator defect is asserted and no production source was changed.

Evidence: `scratch/runs/20261108-drakan-sustained-flight/` (ignored). The accepted [T ascent](drakan-buffered-ascent-20261108.md) and [Up-forward predecessor](drakan-buffered-flight-consumption-20261108.md) remain valid observations of their separate buffered reads. They do not guarantee that another independently timed host hold will span a guest update.

## Closure and prerequisites

The run reuses the accepted immutable production closure at `979e342930c4201f231533d3d492babdec778960`, including `663f1c139`, with module SHA256 `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0` (2,182,663 bytes). Actual original CPU and render Worker bytecode match. This is reuse of the accepted module and Git closure, not a fresh shared-tree build claim. Peer D3DIM command-handoff WIP was excluded. Initial preflight verifies 690 pinned inputs; all 231 HTTP200 payloads match their pins. The 64 installed-media paths/hashes match the accepted ascent run. Git SHA, binary diff, the retained untracked `lib/wininit-boot.js` patch, and run-helper patches supply recovery without a source/media archive.

Before allocation, under `wine-runtime.lock`, the exact module passed the native Warning → production WebGL D3DIM buffered-keyboard fixture. T1000 and Up1000 produced down/release records with exact host timestamps/sequences and consumes; measured intervals were 1002/1003ms within the inherited explicit 10ms native timer tolerance. Missing format, unacquired reads, repeated Acquire and changing an acquired buffer retain their expected HRESULTs. Direct and RPC production buffering regressions each pass fourteen cases, including overflow/peek/partial-consume/acquisition behavior. Their source hashes match this Git closure.

Actual-WASM and contract controls preserve the observer's receiver, arguments, return and exception exactly once, with zero extra polls or guest writes. Seven split owner/module/freshness/sticky-UNKNOWN negatives pass with zero negative dispatch. Ordinary trusted button-free mouse motion also passes locally. Local Chrome exits0 and its driver/browser PIDs, ports, profile and writer drain before allocation.

`action-plan.json` predates the original: ordinary Warning/startup/NewGame/Normal/story, then one T2000, one separately bounded Up2000 and one button-free mouse-heading movement, with independent key releases and passive terrain captures between actions. The installed readme assigns Up to forward and **Move Mouse** to directional control; Left/Right arrows are strafe controls. Progression requires reviewing the preceding consequence. No hold repeat, lengthening or attack was authorized by this plan.

## Sole original and the new boundary

Ordinary Warning, startup, production pointer lock, New Game, Normal and story Enter reach the living, full-red-health mounted rainy scene. The pre-action ridge/conifers/bridge/river remain stationary between `level-loading.png` at 08:27:23.121Z and `living-scene.png` at 08:27:41.397Z despite actor animation. CPU target `4A8BA5AA50228E8E11CD6C1E997E2C4A`, render target `F5B3339E003E878BF027BEC2AB447E06`, process1000 and endpoint1/slot0 retain exact binding. The owning Worker has an actual WebGL2 context, advancing completed work and zero software draws. No physical-GPU or FPS qualification follows from its ANGLE string.

Only **one T2000** gameplay hold was sent. Trusted down/up occur at 08:27:57.956/59.957Z, 2001ms apart. Original buffered evidence is:

| Edge | Host event | Timestamp | Sequence | Original read / consume |
| --- | --- | --- | --- | --- |
| T down | `0x154` | 249363 | 9 | call906 / call912 |
| T release | `0x54` | 251363 | 10 | call909 / call912 |

Both reads occur at 08:28:00.660Z and **both belong to consume912, count2, return0**. The original observes the down about2704ms after trusted delivery, after the independent UP has already occurred. There is no overflow, observer exception or truncated observation. Unlike the accepted ascent, these edges do not span separate reads. The immediate released snapshot precedes their consumption and is not used as proof of an action response.

`altitude-observed.png` and `cancellation-settled.png` retain the initial terrain, through the final state at 08:30:30.111Z. All three reviewed rock crests remain at y347/408/434 in every gameplay capture. Twenty-four actor/HUD-free patch comparisons also match at zero displacement. Rain and other actors advance in the final image; their motion is not counted as viewpoint translation. Takeoff was not established in this original, so the planned forward and heading actions were withheld. T was not repeated.

The new read-only inspection binds `dragon.rfl` to actual base `0x713000` and callback `0x71dc70`. All **8192 callback bytes**, after exact PE relocations, match the pinned installed original; all576 bytes of its EXE input-drain loop match too (`action-boundary-validation.json`). The live pointer chain is root4699280 → object19183594 → actor20295660. The route selector corresponding to preferred address `0x1015e618` is zero, selecting actor controls rather than the alternate global word.

Original `0x40591c..0x405938` visits every returned keyboard record through `0x4059b0` before leaving the drain. The callback maps T to down destination `0x1000b5f8` and release destination `0x1000c1bb`. Down saves its event timestamp at preferred `0x1015e584` and sets actor `+0x78` bit0 at `0x1000b657..0x1000b65d`; release clears that bit at `0x1000c212..0x1000c218`. The live saved timestamp is **249363**, exactly this T-down's timestamp. The live actor ascent word is zero, as is the alternate global ascent word. This establishes that down reached the original action handler, rather than merely reaching DirectInput.

Taken together, the same-drain edge pair, exact original set/clear path, retained down timestamp, clear ascent bit and unchanged terrain support cancellation before the next ordinary actor integration. This is an inference from code plus passive state; individual callback invocations and the actor-update instruction were not dynamically traced. No private handler/export was invoked, no guest write performed, and no running observer was hotpatched.

**Next actionable gate:** prearm read-only observation at the original `0x405770` buffered-drain → actor-control/update boundary. A future flight claim needs down consumed in a completed update with actor ascent bit active, followed by release in a later update. Keep the independent 2000ms maximum; if a down does not reach that boundary before the hard release, release and refuse the flight claim. A larger host hold is not justified by this run. Only after that gate and reviewed takeoff should the already planned separate Up and mouse-heading controls proceed.

## Verification, recovery and shutdown

`validation.json` passes 48 PNG CRC/decode checks, 231 HTTP hashes, 17 exact original command/ACK pairs, stable owner/module identities, the same-consume proof, live-handler timestamp check, pinned callback/drain-loop bytes and stationary terrain diagnostics. The original has no UNKNOWN. All212 drained remote references (15,705,109 bytes;193 unique payloads) were retrieved as ordinary files and independently reread/hash-verified before stop. No mutable-log hardlinks were used.

The evidence-checker regression passes3/3. This run has no containment, missing-reference or schema errors; the global checker still reports seven containment errors in other runs, retained separately.

Two mistyped local regression filenames failed before the correct tests ran; the immediate first local drain assertion also ran before the driver finished exiting. These prerequisite failures and the initial allocation guard's refusal on the missing drain record are retained explicitly. Neither allocated a box nor repeated game input. Minor over-specific startup review descriptions have separate retained clarifications. The later positive drain check precedes the sole allocation.

UUID-idempotent box `bx_q6egcegc` was created 08:23:11Z after its independent observable25-minute watchdog was armed. Initial expiry was 08:48:11.070Z. After Chrome exit0 and confirmed absence of driver5798, Chrome5810, launcher5797, both ports, profile and writer, unique evidence was retrieved and independently verified. Delegated normal stop `stop_a49aab1bfbd4e55a` completed 08:31:39.878Z, forced=false, error=null. Final state is archived, expiry/archiveAfter=null; normal/watchdog children exit0 and the supervisor has no children. Own local PIDs/watchers also drain; disk remains above5GB.

No old-box resume/delete, public deployment, subworker, forced scene/configuration/clock/seed, source repair, attack, publication-Join, full27/parity/audio or FPS claim occurred. Sustained controlled flight remains open behind the specific drain-to-update gate above.
