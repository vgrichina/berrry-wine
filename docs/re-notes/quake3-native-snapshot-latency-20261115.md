# Quake III actual snapshot causal latency, 2026-11-15

The predecessor stopped before native qualification at a foreign census mismatch.
Its retained evidence is `scratch/runs/20261115-quake3-native-snapshot-latency/`.
The continuation uses
`scratch/runs/20261115-quake3-latency-after-census-repair/`, referencing the
predecessor artifacts without copying their bundles. Current qualification and
original outcomes are recorded in that run's result after closure.
The original published with `ac8fb9b43` / report `6a5983b78` stays permanently
closed. Its exact operations file hashes to
`054638201db54bd9bd09128bbe0666295a51f1ed7871ebc1417939a12389462d`.
Request 808 is the unchanged 47-byte snapshot expression and expired at the
fixed three-second deadline. Its valid object response arrived passively after
3605.703374 ms. There were zero postterminal requests, consent images or inputs.
Queue, body, inspector scheduling and native GL occupancy remain UNKNOWN.

## Existing work and the missing evidence

Read the startup snapshot latency, fullscreen visibility, original public
visibility, original startup task, operation cause and source-inventory dedup
notes before designing this task.
`quake3-startup-latency-controller.cjs` already provides snapshot wrapper/body
timestamps and synthetic delayed queue/body/notification controls. Those earlier
controls and shader timings cannot supply missing measurements for request 808.
The retained task controller already wraps native/import/GL calls, with its
first sixteen and slow completed calls logged **after return**. Its note explicitly
acknowledges that a call that has not returned lacks completion evidence. The new
VM prototype reuses that exact instrumentation, announcing native entry before
every observed call up to the existing hard event limit, and separately records
the actual native start after the binding emission. Twenty consecutive fake
shader-status calls prove the entry remains available inside call twenty;
the old first-sixteen behavior cannot silently lose that pending interval.
Native duration excludes binding emission. This is a diagnostic design fixture,
not current Chrome or original evidence. More binding notifications have real
scheduling cost. Actual entry-emission intervals will be reported separately
before deciding whether to launch; they cannot bound all inspector perturbation.
The current observer's snapshot body itself only reads JavaScript counters,
context/owner maps and canvas dimensions; it contains no shader-status call.
Source reuse remains verified inventory equivalence, separate from actual
production script and WASM byte receipts.

The proposed addition must connect helper invocation/send/return boundaries,
actual Worker snapshot entry/body/exit and ordinary synchronous GL calls under
the same live target/session/unique-context identity. Native timing must wrap
calls the renderer already makes, preserving receiver, arguments, return and
exception; it must never add a GL query. Entry records must survive a hung call
without depending on a later snapshot or post-UNKNOWN request. Sink delivery time
must stay separate from the Worker timestamp. An entry without completion proves
only an open observed call, not its ultimate duration or driver root cause.

The prepared composition preserves the actual production renderer and WASM
bytes. It evaluates the retained task observer once before each paused Worker
starts and installs no transformed renderer or host source. The exact 47-byte
snapshot expression and the verified inventory implementation remain unchanged.
Its helper wrapper records function invocation, immediately-before-send and
send-return samples on one host monotonic clock, while preserving wire bytes.
A passive listener records wire arrival before the existing helper handles the
response. The helper's original three-second timer remains the timer of record.
Broken diagnostic sinks do not issue requests or change returns.

Bindings retain live target/session/numeric-context/unique-context identities.
Exact snapshot requests and snapshot entries are correlated by their per-context
serial order; overlapping requests and composite expressions that could invoke
snapshot repeatedly make correlation unsafe. Replacement, missing/duplicate
samples, overflow and invalid native pairs cannot qualify. The first observable
Worker JavaScript entry is the snapshot wrapper's entry, not an internal V8
inspector dispatch timestamp. Inspector-internal duration remains null.

The prepared native controls use the actual production render Worker and GL
command transport with a finite synthetic clear/present and triangle. They add
no game and no evaluation polling loop. Separate cases schedule a bounded
synthetic native wait, place a bounded wait inside a fixture snapshot body,
delay the helper's response handling after wire arrival, and briefly pause/resume
the actual Worker inspector. These are independent calibration causes, never
claims that the same causes occurred in an original. All intentionally late
cases must remain terminal and send zero later requests.
The inspector control records whether snapshot entry occurs before or after
resume. It does not assume a paused Worker prevents inspector evaluation.

Independent controls must distinguish equal total delays before entry, inside
the body and after exit; helper logging delay is a fourth interval. Missing,
duplicate, out-of-order, replaced-context and incomplete records must refuse
attribution. A returned heartbeat is insufficient. Inspector pause/resume and
ordinary real Chrome GL controls must be measured separately from artificial
Worker waits. Cross-process clock comparison retains explicit uncertainty;
within-Worker body/native durations use its monotonic clock.

## Predecessor scope and admission

Heavy work began only after both explicit TIMunsent426317 and FT467402
source/build/runtime releases. TIM's 96 named SHA receipts and 97 PIDs/groups,
and FT's 148 named SHA receipts with 74 native/watchdog/supervisor-child closures,
297 PIDs and 223 recorded groups were personally checked. All direct actual waits
have both EOF; all recorded PIDs and matching groups were absent. Both locks
were personally observed free. Historical detached outer/ancillary gaps remain
UNKNOWN. Only a new diagnostic tool, new test and this note are owned; existing
renderer/helper/host and foreign WIP are preserved.
One fresh original is conditional on materially useful diagnostics being
qualified and published, with fixed 1800/1820 deadlines, 180-second Quit reserve,
registered arguments/realticks/cooperative10000, immutable capture and independent
finite UP unchanged. No original has been launched by this task.

Fifteen offline/VM checks currently pass, including an independent interval
oracle for equal-total queue/body/delivery delays, pending call twenty, event
overflow, result/exception/receiver preservation, missing and replaced identities,
helper wire preservation and a broken sink. The proposed tool was retained only
as an unapplied new-file patch throughout the predecessor's live work, then
installed after release. The test now imports the tool directly and has no
dependency on ignored patch files.
Overlapping returned native intervals use their union, rather than adding
durations twice. Duplicate/orphaned native pairs, negative duration and changed
clock origin refuse attribution; a pending announcement alone has no duration.

## Predecessor outcome: build blocker before native qualification

After the explicit releases and direct closure checks, the focused suite passed
57 tests with one expected native opt-in skip. The helper regressions passed,
including finite independent key/Mouse1 UP, immutable capture, cancellation and
irreversible UNKNOWN behavior. These remain fixture results.

The required unmodified `flock /tmp/wine-build.lock bash tools/build.sh` failed
at the callback producer census. The restored incoming foreign census contains
`lib/ne-guest-bridge.js` hash `a66ad01d…`, whereas the current shared file is
`26c6b4f0…`; `lib/ne-lifecycle.js` contains `377c6911…`, whereas the file is
`a99d2108…`. This mismatch predates the new diagnostic tool. Updating those
foreign rows would violate this assignment's exact foreign-WIP preservation
constraint; no census or production file was edited to bypass the failure.

At predecessor closure the tool/test/note remained uncommitted and unqualified.
No Chrome, native causal control or original was launched. There was no published
diagnostic commit, current Chrome attribution, general render correction or
gameplay claim. The one fresh original authorization remains unused. The next
step was reconciliation of the two foreign census producer rows, followed by a
passing shared build and the prepared native qualifications.

## Continuation after the exact census repair

The coordinator refreshed only the two working-tree census hashes and released
the passing unmodified full build at 07:51:51 UTC. Foreign code and all other
metadata were preserved; mixed census metadata remains uncommitted. The new
worker personally verified that repair, the predecessor's 92 artifact hashes,
19 actual waits with both EOF and 18 absent PIDs/groups, then waited for TIM and
Sims to release source/build/runtime. TIM's direct closure and named waits, and
Sims' 205 named actual waits with both EOF and 216 absent PIDs/groups, were
personally verified before heavy work. Historical ancillary gaps remain UNKNOWN.

Two additional independent controls found that the analyzer accepted reordered
snapshot body samples and native end-before-begin records. Both controls failed
against the retained analyzer. The minimal correction requires the received
snapshot phase order and native begin/end order, preserving null attribution
for incomplete or ambiguous evidence. All seventeen offline controls pass with
the initial correction. Actual Chrome then exposed the retained wrapper's
redundant snapshot `begin` marker, which the hand-built protocol fixture had
omitted. That run was rejected. The analyzer now validates the complete emitted
five-phase order, and an additional positive VM control feeds actual
instrumentation records into the analyzer. This is a diagnostic evidence correction, not a reproduced
renderer defect or an explanation of request 808.

The continuation keeps the prepared real Chrome queue/body/delivery, actual
WebGL and inspector-pause controls, actual source/WASM identity, finite native
key/Mouse1 UP, immutable capture, visibility and irreversible UNKNOWN checks.
It uses the existing qualification guards as a separate prelaunch precheck.
Only qualified, published, materially changed diagnostics can admit the single
unused original authorization. Fixed 1800/1820 deadlines, the 180-second Quit
reserve, three-second operations and independent UP remain unchanged.
