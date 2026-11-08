# NFS3 complete closure loads the game and reaches D3DIM; race qualification blocked by capture predicate

The corrected native route reaches the actual game on the production `7ec49`
module. Native catalogue → setup → reload → setup selection → warning OK →
setup OK → reload → chosen-game launch preserves D3D registry values and produces
an active owning D3DIM render Worker. Acceleration, steering and road-relative
displacement remain untested: a run-local capture predicate rejected the numeric
renderer endpoint ID and terminated this route. This is a harness failure, not a
demonstrated emulator mismatch. No emulator code changed.

Evidence is in `scratch/runs/20261108-nfs3-complete-closure-race/`. This continues
[native chooser qualification](nfs3-owner-repaired-chooser-race-20261108.md).
Before allocation, the released `test-staged-native-route.cjs` passed all three
production registrations over staged HTTP with size/SHA checks, including the
separate `nfs3demo.exe` registration (1,577,984 bytes, SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`).
The original media were referenced locally, not copied into evidence. All pinned
inputs were verified locally and the remote process later verified 726 unchanged
pins. `runtime-pins.json` describes execution; `prepared-runtime-pins.json` is
explicitly a subsequent, unexecuted continuation.

## Native consumption and actual renderer

`retrieved/webgl/native-selection.json` retains ordinary native setup writes:
Direct3D Device 1, Thrash Driver `d3d`, Group `D3D`, D3D Device `0`, Hardware
Acceleration `1`, Triple Buffer `0`. Setup terminates before the page reload.
No registry injection or renderer override was used. Five independently released
mouse clicks occurred; one warning click used viewport-normalized Y instead of
canvas-normalized Y and landed above its button. A fresh capture was reviewed,
then the correct visible warning OK was clicked. This was a known successful
command with the wrong point, not a transport UNKNOWN or input replay.

`early-game-load.json` requires exactly the chosen registered app, running,
not stopped, with a guest Worker before input-chain creation. Its regression
rejects seven missing/failed/wrong-app states and accepts the live game without
inferring renderer readiness. The game EXE serves HTTP 200 with the expected
SHA at 06:06:51.915Z. The initial reviewed game image is only the startup window;
it does not show a race or establish playability.

The subsequent `game-settled-state.json`, saved before the failing screenshot
binding, contains actual D3DIM activity:

| Evidence | Observed value |
| --- | --- |
| Registered app / process | `nfs3_chosen_renderer` / 1000, running |
| Owning renderer target | `F5F103926047DB828414DABE96907CD3` |
| Render endpoint | numeric `1`, API `legacy`, backend `webgl` |
| Owning observed context | WebGL 2, 640×480 |
| Context renderer | ANGLE, Intel Mesa UHD Graphics 620 (KBL GT2), Mesa 23.2.1 |
| Actual guest and renderer module SHA-256 | `7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf` |
| Draw calls / triangles | 805 / 1766 |
| Reported fallbacks / errors | 0 / 0 |
| Software / fallback software draw completions | 0 / 0 |
| Owning control | ready 1, error 0, completed 4230, commands 1000 |

The context is observed in the same actual render Worker that owns endpoint 1;
its module bytes were recovered through CDP. The adapter wrapper itself has no
`gl` member, so that field is null; context identity comes from the Worker's
passive context observer. This establishes active D3DIM following native D3D
selection, not a measured FPS or parity result. The mounted `d3da.dll` HTTP hash
is recorded, but HTTP delivery alone does not prove its guest module load address.
No guest module-load inventory was collected before termination.

## Precise first new dependency

At 06:07:05.608Z, `capture()` skipped `establishReady()` because my added
predicate required `typeof renderEndpoint === 'string'`. The actual endpoint
is numeric `1`. The original qualified native chain therefore entered its
capture path after renderer attachment and correctly asserted
`native stage requires no renderer: 1 !== 'none'`. The pending capture command
received the sticky terminal first fault; no game input or failed command was
replayed. Seven earlier commands had exact successful ACKs. No acceleration or
steering input occurred.

`renderer-attached.cjs` and its focused regression now refuse absent/null/`none`
endpoints and accept numeric and string actual IDs. `browser-run-prepared.cjs`
uses that predicate while preserving all owner/module/freshness/readiness checks.
These are prepared only; the executed browser helper and pins remain untouched.
The next fresh run must use this prepared correction, qualify renderer binding,
review actual game images, then use ordinary menu/race input to test acceleration,
steering and road-relative displacement. Do not resume this stopped box.

## Validation and lifecycle

`analysis.json` verifies 1,259 complete pinned HTTP responses with zero mismatches;
16 PNG references pass CRC and zlib decoding. Original setup/selection/startup
images were personally reviewed. All 130 remote artifact references (120 unique
hashes) were retrieved and independently re-read for size/SHA before stop.
Chrome exited zero; controller/Chrome PIDs, profile, writer lock, both ports and
profile-associated processes were absent. Both independent supervisor children
exited zero and the supervisor has no children. The messageboard watcher stopped.
Chrome was 151.0.7922.108 with native 945×889 viewport and real guest Workers.

One UUID-idempotent box `bx_9mp55buk` was created after observable independent
25-minute watchdog arming. Initial expiry was 2026-11-08T06:29:47.686Z. Final state
is **ARCHIVED**, expiry **null**. Normal stop receipt `stop_5df2850db5433feb`
completed at **06:07:38.629Z**, `forced=false`, error null. Evidence verification
completed at 06:07:36.620Z before the stop request. Disk stayed above 5 GB.
There were no guest patches, forced config/scene/clock/seed, private handlers,
source/media archives, old-box resume/delete, RAM gate, deployment or workers.
Git base, relevant binary diff, new-file patch and exact tested pins retain source
recovery without a tree archive. No new build claim is made for this docs-only
change. Full27, parity, audio and unmeasured FPS remain open.
