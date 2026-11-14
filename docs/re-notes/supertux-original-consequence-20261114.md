# SuperTux original consequence, 2026-11-14

Evidence: `scratch/runs/20261114-supertux-original-consequence/`.

Fresh separately authorized local standard CLI task. Preparation verifies the
787 original files, authentic standing CRT and registered C:\\ working directory
with `--sdl --datadir data`. No remote runtime, box, download or deployment.
The original EXE and 119,228-byte manifest match the owner-supplied SHA-256 pins.

## Result: first-level timeout before reviewed gameplay input

One original launched on main `435ce2fc1129da8ed8051f70f41a34cea192e000`,
module SHA-256
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
`source-pins.json`, `source.patch` and `new-runtime.patch` identify the actual
loaded source including foreign WIP, without archiving source trees or media.
Postflight found no source, module or media drift. All six bundled SDL/image/
mixer/jpeg/png/zlib DLLs plus the authentic standing MSVCRT actually mapped;
the log confirms all seven DllMain calls succeeded and C:\\ was the guest cwd.

Personally reviewed Options showed sound and music enabled. Keyboard Setup
showed Jump = Space and Power/Run = Left Control. Neither binding nor options
were changed. Ordinary reviewed arrows/Enter opened Start Game, free Slot 1,
the world map and its first red node, Welcome to Antarctica. The intro passed
during loading; no readable story frame or story-skip input is claimed.
`loaded-story.png` is the **world map**, despite its capture name.

The first reviewed level capture, `fresh-firstlevel.png`, already showed
**TIME'S UP, score 0, coins 0, one remaining life**. No movement or jump was
sent. The old 75/3 and 125/5 screens are not used. Neither meaningful original
consequence nor level exit was achieved.

The exact tested limit is the unchanged standard CLI's default service clock:
`test/run.js` selects `createServiceClock(5000)` when neither real ticks nor
an explicit batch-clock flag/registry setting is supplied. SuperTux has no
registered batch-clock override. This clock aggregates retired blocks across
the guest partitions; it is an abstract CPU-service policy, not wall time.
The entry capture published guest time 344,562,171 ms; the first reviewed level
capture published 358,437,444 ms, only 7.792846 wall seconds later. That is
13,875,273 ms of virtual progress, about 1,780.5 times wall time. This supports
a route/timing blocker under the unchanged-clock constraint, not a new
production semantic defect or a historical review-expiry repair. No clock,
physics, score, profile or guest-state edit, alternate route or retry occurred.

The controller retained one permanent guarded input binding, unique nonces,
the 12-second reviewed-frame limit, independent prearmed release processes,
immutable per-pulse deadlines and postrelease batch progress. Fifteen
finite reviewed pulses had consumed DOWN receipts, successful independent
release receipts and later batch progress. The final Escape intent followed
the actual timed-out level frame. Its handler receipt alone does not prove
guest dispatch or a menu transition. The CLI's subsequent capture failed
because the guest had exited; this was not an UNKNOWN input replay.

Guest `[Exit] code=0` occurred at 204.844 seconds, before the fixed watchdog
deadline. This proves guest exit, **not reviewed native menu Quit** or causal
attribution to Escape. No host quit/timeout/kill was used for this original.
The independent watchdog was armed before launch with an immutable 600-second
bound, exited 0 without firing, and was actually waited. Native wait 0,
supervisor wait 0 and both output EOFs were recorded; all 18 owned runtime/
release identities were absent. Heavy lock released, free disk above 13 GB.
Box ID: none; state NOT_CREATED; expiry null; stop receipt not applicable.

## Validation and retained evidence

Current full build passed under both heavy-runtime and build locks. Actual
shared-WASM input-owner tests and the 22-check guarded CLI test passed,
including independent release, sticky UNKNOWN, ownership replacement,
deadline expiry and normal test-harness shutdown. Three run-local controller
checks passed, including a real HTTP release child and postrelease progress.
Run-local offline clock controls execute the actual CLI selector and clock
implementation, confirm 5,000 blocks/second and sibling aggregation, and
verify observation does not mint virtual time. Synthetic controls are not
original gameplay proof.

An additional existing `test-cli-tick-ms-input.js --source-only` diagnostic
failed before testing: its source-slicing marker for DispatchMessageA no
longer matches current `test/run.js`. That is a stale test marker, not this
gameplay failure; its log is retained and no foreign test/source was edited.
An optional additional native service-clock suite remained queued behind
another heavy owner and was cancelled before execution; no pass is claimed.

Only seven selected reviewed PNGs remain: title, Options, Keyboard Setup,
free slot menu, map, selected first node, and first-level TIME'S UP. Compact
control/capture metadata, logs, source/media hashes and Git patches are in the
run directory. Early `action:png` captures were stale composited black frames;
the run-local controller switched to the standard `cmd:png:PATH` capture,
which repaints. Those black frames are excluded. No production code changed.

Next: owner decision on an explicitly permitted wall-time launch policy before
any separately authorized fresh attempt. There is no active runtime to extend.
