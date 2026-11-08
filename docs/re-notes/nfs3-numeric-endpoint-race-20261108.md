# NFS3 numeric endpoint: ordinary race reached, controls unqualified

Run: `scratch/runs/20261108-nfs3-numeric-endpoint-race/` (ignored evidence).
On 2026-11-08 the original demo reached an ordinary cockpit race through
native device catalogue, setup, reload, Direct3D Device 1 selection, warning
OK, setup OK, and chosen-game reload. Reviewed captures show countdown,
elapsed race time, 8th/8 position, opponents, rear mirror, minimap and rain.
Acceleration, steering and input-caused road-relative displacement remain
unverified. No new emulator mismatch was established; no emulator fix is made.

## Qualification and native route

The released `renderer-attached.cjs`, `browser-run-prepared.cjs` and prepared
runtime pins were reused in run-owned helpers. The initial binding guard in
the copied `bound-input.cjs` also required `nativeBinding`, which cannot yet
exist when initially attaching to the already-created game renderer. That
extra conjunct was removed locally. The two-read identity, owner, module,
context, freshness and release checks remain. This is a harness attachment
correction, not an emulator change.

Before allocation, the actual production Worker passed the complete local
native route and bound numeric endpoint `1`; `local-numeric-qualification.json`
records both guest and renderer module SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`.
Local processes were fully drained. The focused endpoint test rejects
missing/null/`none` and accepts numeric/string IDs. HTTP/SHA preflight passed
for all three registered executables: device data, device setup and game.

The one fresh remote runtime consumed the native setup writes, recorded in
`retrieved/webgl/native-selection.json`: Thrash Driver `d3d`, Group `D3D`,
device `0`, Hardware Acceleration `1`, Triple Buffer `0`. Setup terminated
before page reload and the chosen game registration. There was no injected
renderer/configuration/scene state, guest patch, forced clock or seed.

The remote owning guest Worker target was
`AC2B55C449F17DE40D8C16CF37F84B9E`; recovered guest and renderer modules match
the SHA above. The renderer is numeric endpoint `1`, legacy API, requested
WebGL backend, actual WebGL2, 640×480, ANGLE Intel UHD 620/Mesa 23.2.1.
The last held-state capture reports 122,742 draw calls, zero errors, zero
fallbacks, and zero software/fallback-software completed draws. These are
renderer counters, not FPS measurements.

## Race and control evidence

`retrieved/webgl/after-enter.png` shows the cockpit countdown;
`poll-throttle-2-held.png` and `steer-left-held.png` show the subsequent race.
The game progressed from loading to overhead start and cockpit countdown
without presenting an in-game settings menu. Artifact names such as
`pause-menu.png` describe attempted actions; they do not establish that a
pause/settings menu appeared. Escape attempts did not expose one.

Separately reviewed bounded Up and Left commands had exact acknowledgements
and independent key releases. Speed readouts ranged from 0 to 2 MPH, but the
captures do not establish acceleration caused by Up, a steering response, or
input-caused displacement relative to the road. Landmark drift alone does not
qualify those controls.

The shipped `game/Setup/english/readme.txt` lines 289–290 documents Up for
acceleration and Left for steering; lines 140–146 pairs arrows and numpad
directions. The current configured mapping was not inspected through native
settings. A read-only observer sampled the actual guest key array during a
bounded Up command. Of 141 samples, 24 saw page Up held and 26 saw guest scan
`0x48` set, with released samples before and after. Static original-EXE
disassembly identifies the key-down write at `0x4cb57a` to
`0x562f28 + scan`, and the corresponding key-up clear at `0x4cb612`.
See `poll-input-samples-2.json`, `key-array-disassembly.txt` and `analysis.json`.
This proves delivery into the guest input array; the active throttle mapping
and overlap with simulation sampling remain unmeasured.

Raw input `hwnd=0` and a zero main-slice focus field are not an established
failure: the production queue resolves focus or the highest visible window.
The visible game window belonged to thread 2, the document had focus and the
canvas was active. No emulator-semantics cause follows from these observations.
The next investigation must connect the documented/current accelerator
mapping and simulation consumption to a bounded input before attributing
weak response to the emulator. Do not repeat missing-EXE or string-only
endpoint investigations.

## Evidence and shutdown

`analysis.json` validates 1,293 pinned HTTP responses with no mismatch, 32 PNG
payloads, 29 exact ACKs and two stale zero-effect refusals. No transport
UNKNOWN was observed or replayed. The run outcome `unknown` means incomplete
control qualification, distinct from sticky transport UNKNOWN.

Runtime byte pins retain their published source commit
`0a38cf48438096482d059c5d8f27c048474c83b9`; the shared checkout base is
`811bca5b6fea2f692da1da857fe439b51cf4d956`. `runtime-pins.json`,
`base-commit.txt`, `relevant-source.patch` and run-owned new-file patches
record recovery inputs. Media is referenced by existing path and SHA, not
archived. No source tree, media archive or test-binary bundle was created.

An observable independent 25-minute watchdog was armed before UUID-idempotent
creation of the sole box `bx_em4ysnuw` at 06:14:21 UTC. Its original deadline
was 06:39:21 UTC. Quit command 28 was exactly acknowledged and Chrome exited
0. An immediate drain assertion caught the controller still exiting; a
distinct settled read at 06:27:43 confirmed all controller/Chrome/profile/
writer processes absent, both ports closed and all 726 runtime pins unchanged.
Both records are preserved; only `full-drain-settled.json` passes.

All 328 remote artifact references (298 unique SHA values) were retrieved
and independently verified by size and SHA-256 before normal stop. The box
is **archived**, final expiry `null`, stopped 06:28:22.970 UTC, with completed
normal receipt **`stop_10015f16c68eb0ec`**, `forced: false`. The supervisor and
watchdog exited cleanly. Free disk remained above 5 GB. No second box, old-box
resume/delete, deployment or emulator source change occurred.

Full27, parity, audio and unmeasured FPS remain open.
