# Original Kkrieger: bounded ordinary forward movement observed

## October 17 retained latency audit

Run118738 supports a specific follow-up: main-loop delay involving the guest
audio critical section, with expensive pre-physics work as another candidate.
It does not yet identify their relative cost or justify a scheduler fix.
This audit uses the tested source/module identities documented below; no new
runtime or performance measurement was performed.

The retained `imported/kkrieger-position-capture-run/browser.log` repeatedly
reports main EIP `0x078c3500`, yield9 and ESI `0x0083f8a4`. At tested source
`46691eb61`, host.js identifies yield9 as a critical-section wait and already
schedules cooperative holders after it. Original main-loop code calls audio
cursor helper `0x801c13` at `0x8053fb` before returning to message service.
That helper acquires section `0x83f8a4`; audio-thread routine `0x801c77` holds
the same section across generated-audio callbacks before release at `0x801dc9`.
The original disassembly is retained in
`scratch/runs/20261014-kkrieger-mesh-writer/unpacked-disassembly.txt`, SHA256
`8b0026617d971d6c82606d4824cc512346515b84861f775f3b238829563dd0b6`.
Live thunk identity and actual section owner were not recorded, so the audio
lock attribution remains an inference, not a measured cause.

All 70 retained phase samples have updateContext zero. Accepted input and
currentTime advance before requestedSteps/completedTime advance in both held
and release phases. This points to work outside the sampled active physics
context, but short updates between samples remain possible. Pre-update scene
work and renderer service have not been separated from lock waiting. The
guest also caps requested simulation steps at10, so long wall-clock holds do
not imply proportionate simulated movement. Host slice counts are not game FPS.

For the next already bounded W/release capture, add read-only main EIP/yield,
`get_cs_wait_addr()`, `get_cs_wait_owner()`, `get_cs_waits()` and owner-thread
EIP/progress to the existing timestamped samples. Resolve live IAT `0x81f060`
and the blocked stack before naming the section; correlate host enqueue/dequeue
with accepted guest input on the same clock. These wait exports already exist
in the tested source. Time the identified owner callback only if waits dominate;
otherwise measure pre-update scene/render boundaries. Do not extend the hold
merely to obtain more displacement or assume the scheduler omitted the owner.

The fresh original-game run reaches the first-person level and records forward
body displacement after ordinary W, with corresponding outward pillar movement
in the before/after screenshots. Root independently reviewed all four control
and movement images plus retained completed endpoints and agrees this supports
the narrow launch + one forward input + screenshot criterion. It does not
establish smooth playability, repeated controls, performance, audio or combat.
The stricter automated within-phase comparison remains insufficient.

The read-only movement reader is integrated into the existing bounded input
capture with `WA_POSITION_CAPTURE=1 WA_INPUT_PROGRESS=1`. It preserves the
20-second idle, original accepted-W/update-counter stop with a 60-second cap,
and at most 60 seconds of release observation. Release collection can continue
after the first cleared input sample to obtain two distinct completed times.
The outer cleanup sends unconditional W keyup and removes both readers, including
on code-pin, state-validation, or screenshot failure.

Each synchronous page read obtains the original input fields and movement
fields together. Every intermediate sample is saved before validation. Completed
comparisons require stable object identity, phase zero, cleared update context,
nonzero matching current/completed clock, and two distinct completed times.
Held endpoints additionally require accepted W; released endpoints require clear
host/guest held state. A clock decrease anywhere across phases invalidates the
comparison, including wrap/reset. Nonfinite vectors/orientation and invalid
clock values fail closed. Initialized zero clocks never count as completion.

The summary retains first/last endpoints, every completion time, xyz deltas for
player/body/collision-reference/previous-body/camera, horizontal distances and
projections onto the first and last normalized horizontal forward bases. A zero
horizontal basis produces a null projection. Yaw and pitch changes are retained.
Insufficient completion samples remain explicit; collection never extends a
hold to chase spatial thresholds. Neither displacement nor the requested-step
counter establishes FPS, unobstructed control, or playability.

Nineteen focused canonical-delivery/input/reader/collector tests pass with the
original unpacked image supplied, no skips. They include original-image and
code-span hashes, HTTP/page substitution failures, full synthetic phases,
intermediate/duplicate/zero clock rejection, cross-phase wrap, NaN, replacement,
zero-basis handling, preservation of a failed sample, and unconditional release
after collector failure. No local full build or guest VM was run.

The fresh runtime source is `46691eb61cb61e5edb475eebef66439bd57a8d36`, based
on main `5f69500eb2c1cbdda3f0bd1d09e655432cdfc195`. The later collector-test-only
commit does not alter that checkout. All 6531 physical source files matched
Git blobs. The WAT/compiler/build closure matches clean donor
`750bc13fd07a59dfed1e49b19533a561ffea1208`; the physically contained module
SHA256 is `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
Of 290 production/compiler files, only `lib/d3d9-software-backend.js` differs:
the already merged passive first-free-list-failure diagnostic, with unchanged
rejection. The original three fixtures and parent manifest were copied from
`/home/user/wa-kkrieger-long-input`. No donor files were mutated.

Evidence/recovery root: `scratch/runs/20261015-kkrieger-position-capture/`.
Remote roots are `/home/user/wa-kkrieger-position-capture`,
`/home/user/kkrieger-position-capture-run`, and
`/home/user/kkrieger-position-receipts`. Recipes and physical hash manifests
are retained independently of Git.

## Fresh runtime result

Controller PID118738 started 13:25:07.722Z; its capture budget was
13:25:07.840–13:45:07.840Z. The documented `boat extend --ttl 3600` and API
check first established box expiry 14:21:55.587Z. The preceding Jedi controller
had finished and the runtime inventory was empty before this execution.
Actual HTTP200 body hashes passed for the module, original three files and
parent manifest; the page verified the canonical module digest. Chrome was
151.0.7922.108, fixed guest memory 2GiB, viewport 1100×800. There was no observer
attachment or viewport change.

Personally reviewed scene47 shows the Start new game menu. Its gate was written
13:33:30.927Z; Enter was held once, 13:33:37.554–13:33:52.587Z. The copied gate
recipe initially retained reviewer label `kkrieger_long_input`; the actual reviewer
was this position-capture worker. Scene59 shows first-person weapon, HUD, lit
pillars and floor; its level gate was written 13:35:53.720Z and consumed
13:35:55.672Z, with over nine minutes left.

The reader captured 10 idle, 30 held and 30 release samples. Original pins pass;
object 25369268 stays phase 0, orientation zero, forward basis [0,0,1]. W is accepted
in 19 held samples with forward `0.002499997615814209`, but only one subsequent
requested-counter change is observed while accepted. `acceptedProgress` is false.
The configured 60-second cap produced actual keydown-to-keyup 60.534 seconds
(13:36:16.538–13:37:17.072Z): the existing two-second poll loop overshot by
534ms. This is a timing limitation, not an intentional extension or threshold
chase. The first accepted guest input sample is 22.154 seconds after the first
physical-held sample. Host keyup precedes guest clear: the first release sample
still has guest forward set, and clear is first seen 18.125 seconds later
(last-event becomes `0x80000057`). Thus the raw endpoint progression includes
delayed guest input/release and subsequent physics. There is no second input run.

Each strictly filtered phase has only one distinct completed time, so **all
three phase comparisons are insufficient**. The summarizer correctly emits no
within-phase displacement or projection. Raw completed endpoints nevertheless
retain a useful distinction between body and camera motion:

| Capture state | Completed clock | Body/player/collision xyz | Camera y |
|---|---:|---|---:|
| Idle, clear input | 277539 | (0, -0.836708, 0) | 0.692172 |
| W physically held, guest not yet accepted | 297198 | (0, -0.833286, 0) | 0.603732 |
| Accepted W | 326508 | (~0, -0.654347, 0.137860) | 0.741292 |
| W physically released, guest field still held | 352598 | (~0, -0.553618, 0.427356) | 0.881783 |
| Host and guest clear | 382561 | (~0, -0.626278, 0.686228) | 0.840213 |

Body/player/collision-reference positions agree at those completed endpoints;
camera x/z agree with body. These observations record horizontal body changes
across a mixed input-transition interval, distinct from camera-y-only motion.
They do not supply two accepted completions per phase, a valid idle comparison,
an unobstructed-control qualification, or the exact collision branch. Intermediate
body/collision/previous-body vectors remain available for review; no rate/FPS or
playability claim follows.

The idle-before/after images already show vertical settling and weapon appearance.
Before-W (13:36:16.536Z) versus after-release (13:38:17.802Z) shows a small outward
shift of the paired lamp/pillar features, consistent with the recorded forward
body-position change, plus weapon-animation change. There is no held-only PNG:
the inherited collector captures that image only when its accepted-progress
condition succeeds, and this run hit the cap. The before/after images span both
held input and release/inertia; they do not isolate the accepted-W interval.

The controller finished and wrote postflight pins passed at 13:38:18.593Z.
Independent postflight at 13:38:43.156Z found all 6531 source hashes unchanged,
clean tracked state, canonical module, matching fixture/manifest hashes and
no runtime survivors. Boat status/history instead labels the process `lost`,
nonrunning, with null exitCode and history finishedAt 13:38:24.837Z; **exit0 is
not established**. The slot was released; no recovery/restart/retry was performed.

All 160 capture artifacts (23116287 bytes) were copied locally and individually
SHA256/size verified, independently repeated by root. The 22685476-byte archive
at `/home/user/kkrieger-position-final.tar.gz` has SHA256
`e98eda91390ffb64202f4ceca603f8bdaadf9228d60e78ceb77651d703dc68ec`.
`result.json` was published last, with the narrow movement criterion passed and
every broader limitation explicit. The global evidence checker still reports
the unrelated historical Zuma external artifact.
