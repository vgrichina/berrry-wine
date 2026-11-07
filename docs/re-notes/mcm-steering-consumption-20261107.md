# Motocross Madness: steering-consumption preparation boundary, 2026-11-07

Steering remains **unproved**. No new box or original was launched. Preparation
demonstrated a concrete admission defect in the retained run helper: a fresh
review can authorize input after process, endpoint, Worker, module or epoch
replacement. The task requires those identities to stay bound to the reviewed
scene. The existing helper cannot safely carry the requested original forward.
This is a harness boundary, not a demonstrated game or emulator defect.

Evidence: `scratch/runs/20261107-mcm-steering-consumption/`. Historical execution
is separately recorded in `mcm-refresh-driving-20261107.md`,
`mcm-race-driving-20261107.md` and `mcm-turn-at-speed-20261107.md`.

## What the retained steering experiment measured

Personally inspected historical `throttle-fresh`, `left-immediate`,
`right-clear-three` and `forward-baseline` captures. The rear RIDER remains
near the center and upright. Quarry ground and horizon shift, but the speedometer
needle is near the low end without an established numerical speed. The separately
labeled green NEWTON rider crosses the view. Those opponents, the red direction
marker and capture-to-capture terrain changes cannot establish player steering.
These historical images are not a fresh baseline for another input.

The exact `ordinary-keys.cjs` sends native CDP keyDown for Up and then Left or
Right, sleeps for an integer 50–2000 **host milliseconds**, and releases every
attempted key in reverse order in `finally`. It neither waits for a guest poll
nor samples guest progress while the keys overlap. The numbered success reply
is written after the input helper, post-action wait and capture complete. It
therefore establishes completed harness execution, not guest steering consumption.
Prior generated trusted-event checks establish native delivery and balanced
release; they do not close this measurement gap.

The recovered console contains exactly nine accepted driving groups, matched in
order to commands and exact-ID replies. `consumption-timeline.json` preserves
their raw dequeue timestamps and post-action counters. Four combined groups
drain down/down/up/up within 1–2 ms despite requested 2000 ms holds:

| Command | Message dequeue span | Post-action slice sequence | Flips |
| --- | ---: | ---: | ---: |
| throttle-right | 2 ms | 7267 | 31 |
| left-pulse-two | 2 ms | 7308 | 39 |
| left-pulse-three | 1 ms | 7381 | 51 |
| right-clear-two | 1 ms | 7505 | 68 |

This newly extracted timing explains why the ACKs are inadequate. It does **not**
prove zero DirectInput polls. `host.js` emits `[input]` after `renderer.takeInput`
dequeues a Win32 message. DirectInput's GetDeviceState reads
`host_get_key_down_state`; Worker RPC can use the published physical bitmap when
no event is open, while an open event can use its key-state snapshot through
`lib/host-window.js`. These are distinct observations. Console receipt timestamps
also do not provide guest instruction timestamps. No emulator semantics mismatch
has been demonstrated, and none was repaired.

The post-action counters establish eventual execution and rendering progress:
the nine snapshots advance from slice 7174 / 18 flips / owner completion 181 to
slice 7532 / 72 flips / completion 516. They do not locate that progress inside
the physical hold or prove an at-speed simulation step. A local counterexample
executes the exact hold helper with production renderer input handlers, observes
physical overlap and balanced release, and receives helper success with zero
guest frames and zero guest polls. No guest runs in this control; it demonstrates
the helper's measurement contract, not original-game behavior.

## Ordinary bindings and available diagnostics

The registered media's `HELP/HELP.HTM` keyboard table identifies Up = Accelerate,
Down = Brake, Left = Steer Left and Right = Steer Right. Its existing path and
SHA-256 are recorded in `retained-fixture-identity.json`; media were not modified
or copied into this run. No guest physics, configuration or callbacks changed.

Production diagnostics already expose page `_workerLastSlice` sequence, blocks,
EIP and RPC counters; guest D3D flip/submission counters; and owning render
endpoint completion, command and error counters. A useful bounded observation
must sample these **while held**, maintain the same owner/module/epoch, and
distinguish guest progress from renderer backlog completion. Render fences are
not simulation steps and slice completion alone is not keyboard polling.

The actual retained module exports `get_tick_count`, `get_count`,
`get_logical_frame_addr` and `get_logical_frame_count`, confirmed by parsing its
export table without instantiating or running it. Worker `readExports` can read
live exports between commands. Logical-frame counts require a validated guest
step address; their presence does not establish a configured MCM step marker.
Address hit counters likewise need a validated poll/step location. None was
established here. No logical-frame marker, clock, pacing or guest state was set.

## Newly demonstrated admission boundary

`boundary-controls.cjs` invokes the **exact retained** `scene-guard.cjs` with a
fresh reviewed identity and a live app differing in one field. All five cases
dispatch: changed processId, endpoint, Worker target, module SHA-256 and epoch.
The helper ignores every supplied identity field. The production browser caller
is weaker still: its admission read projects only app name, running/stopped and
guestWorker presence, so it cannot supply the missing comparison. The capture
metadata holds label/hash/time without a bound owner or epoch.

This is a reproducible pre-original blocker under this task's identity rule.
The old helper remains unchanged; these are failure-detecting preparation
controls, not a repaired or qualified browser helper. No generated browser repair
or new original is claimed. The next implementation must bind capture admission
to the actual process, Worker target/endpoint, module and scene epoch, reject
identity changes with zero effects, and cover the change in a generated browser
before using any original. It must also record progress inside the bounded hold;
if that progress or the reviewed at-speed baseline is absent, stop that test
without further gameplay inputs or a steering claim.

The same local controls confirm stale input rejects with zero effects, and
UNKNOWN, late ACK after closure, partial failure and stale-dependent input create
no next command. Writer locks release. These checks preserve the existing
closure boundary; they do not weaken guards or authorize replay.

## Orphan terminal state, identity and completion

Read-only API inspection during this task independently confirms **bx_tevwnwhg**
is archived, normal stop completed, `forced:false`, stopped
**07:59:40.963Z**, active expiry null. No resume, remote exec, stop, delete or new
allocation occurred. The recovered terminal records show all six PIDs absent,
six ports refusing, three profiles and writer locks absent, keys released, and
all original commands 0–28 paired with exact-ID replies. The recovery's terminal
artifact verification and ownership release were checked. Its failed first
parent-exit assertion remains preserved in the recovery run, followed by the
successful read-only terminal census. No orphan input was replayed.

Historical actual identity is guest Worker, owning endpoint 1 legacy WebGL,
ANGLE Vulkan **SwiftShader Device (Subzero)**, module
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Original source commit was `958d2d11f0d91e3df22efc0befc929deb0921a0c` with retained
dirty patches and pins, not fresh-build provenance. The earlier race-driving
Intel provider must not be substituted. This task executed no original renderer.

Validation: exact-helper counterexamples, production renderer overlap/release,
sticky closure and stale controls, nine-group queue/console matching, retained
artifact SHA-256 checks, module export inspection, personally inspected historical
images, read-only lifecycle confirmation and documentation diffcheck. No emulator
code or shared helper changed, so no locked build was required or claimed.
Local free home remained above 2 GB. No source/media archive, public deployment,
held-risk retry, FPS, audio, parity or full27 claim. No assigned box is running;
ownership returns to the coordinator with this actionable harness boundary.
