# Cooperative GLTron audio service, 2026-11-07

One incorrect host completion decision is proved and repaired: a headless
waveOut stream counted a drained queue's idle time as playback of later
requests. GLTron still does not reach its menu after that repair. This is a
partial primitive fix, **not a demonstrated fix for the menu blocker**. No
further scheduler repair is justified by this run.

Evidence: `scratch/runs/20261107-gltron-audio-service/` (ignored). This follows
[the ring-decoder investigation](gltron-ring-decoder-20261107.md), uses its
retained data first, and adds one fresh UUID / one passive cooperative original
execution. No repeated decoder census or nested workers were used.

## Request, clock and completion decision

Original waveOutOpen requests 22,050 Hz, stereo, 16-bit PCM, CALLBACK_FUNCTION
at `0xa3e990`. Thus throughput is 88,200 bytes/second and each 22,048-byte
request represents 249.977324263 ms. SDL alternates guest WAVEHDRs 33441592 and
33441624. These addresses identify this execution, not stable ABI constants.

WAT `handle_waveOutWrite` reads the original header length, clears WHDR_DONE,
sets WHDR_INQUEUE, submits PCM, then calls `host_wave_out_schedule_done` with
that same length/header. The host schedules an ordered byte frontier and
`dueMs = max(nowMs, previousDueMs) + durationMs`. In this Node execution there
is no AudioContext. `test/run.js` supplies `sharedAudio.audioClockMs` from
`batchClock.batchTicks()`, with the original default 200-ms step and 1,000-block
main slice. The audio pump runs after publishing each outer batch's clock,
before that batch's main execution; cooperative worker/main interleaving
follows later. Neither the selected clock nor these budgets changed.

The pump's actual eligibility branch uses the byte cursor whenever the queued
item has `dueByte` and a live voice. It does **not** use the computed `dueMs`
in that case. Before this fix, the headless stream origin was set only on its
first submission. Its cursor was
`min(bytesWritten, floor(elapsedFromFirstWrite * bytesPerSecond))`, with rate
integration where applicable. Once the queue drained, extra elapsed time
remained in that origin. A subsequent write raised `bytesWritten` and exposed
that idle time as already-played new bytes. The pump could therefore set DONE,
clear INQUEUE and queue the consumer callback immediately.

Microsoft documents buffer return after playback or waveOutReset, and identifies
WHDR_INQUEUE as queued for playback; no reset occurs in this reproduction.
See [WOM_DONE](https://learn.microsoft.com/en-us/windows/win32/multimedia/wom-done)
and [WAVEHDR](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-wavehdr).
The [PCM format description](https://learn.microsoft.com/en-us/windows/win32/multimedia/devices-and-data-types)
supports deriving duration from the original format. Immediate return of a new
nonempty buffer after an idle gap violates that playback contract.

`analyze-retained.py` correlates 32 retained samples where the latest submitted
header is already in the function-completion queue while its own computed
deadline is ahead of the selected clock. For example, submission 977 is queued
at clock 14,608,200 ms, while `nextDoneTimeMs` is 14,609,344.399093. This is
evidence of disagreement between deadline and eligibility; the retained data
does not contain each original submission's stream origin or exact pump time.

The focused failing regression supplies the missing discriminator. It uses
GLTron's actual format/length, drains one buffer, advances to an idle clock of
3,000 ms, then submits two ordered headers. Their deadlines are
3,249.977324 and 3,499.954649 ms. Loading the exact original Git blob in memory
(`baseline.cjs`, no shared-tree replacement) makes the production pump complete
**both at 3,000 ms**, where zero completions are allowed. The assertion fails
with actual=2, expected=0; the corresponding cursor incorrectly reports 66,144
bytes instead of the previously played 22,048. This proves the incorrect
decision before applying a production repair.

## Repair and focused verification

`lib/host-audio.js` now checks the old byte frontier before increasing submitted
bytes. If the headless stream has drained, it rebases its cursor origin to the
new submission while preserving the cumulative played-byte position and current
frequency, and discards the previous rate segment for that rebased origin.
The existing AudioContext branch already rebases drained streams. The pump
continues using real cursor eligibility, including pause and rate semantics.
There is no forced completion, audio suppression, guest configuration change,
clock reduction or WAT modification.

`test/test-waveout-audio.js` verifies no completion at resubmission, both sides
of each format-derived deadline, FIFO order, reused header identity, doubled
playback frequency after a drained gap, and delayed function-consumer wake.
Existing pause/restart, browser, reset and callback checks pass. Five additional
focused tests pass: waveout-pause-handlers, waveout-suspend-backlog,
waveout-invalid-lifecycle, waveout-callback-function-wasm and
wave-callback-scheduler. Callback census reconciliation tests pass; only the
whole-file host-audio hash changed after reviewing unchanged callback
admission/retirement code. The mandatory locked `tools/build.sh` passes.

An extra `test-audio-saved-carry.js` attempt fails compiling its unchanged
fixture with `Unknown global '$pending_seen' in $invocation_process_begin`.
That result is retained and is not reported as passing. The production locked
build and focused callback tests above pass. The global evidence checker still
reports unrelated errors; this run is unregistered and remains an investigation
note rather than a candidate-corpus completion.

## One original after repair; remaining boundary

The bounded service records retain 988 ordered submissions, with 11 cursor
rebases including initial origin creation. Every queued deadline agrees with
`streamOrigin + dueByte / 88200 * 1000` within 0.000001 ms; every new request is
249.977324–499.954649 ms ahead of the submission clock. The first two requests
share clock 13,907,200 and have deadlines 13,907,449.977324 and
13,907,699.954649. Whole-run aggregates count 1,936 origin changes and 135,892
output requests; the final synthetic clock is 50,664,600 ms over 125.675 wall
seconds. These counts are not an equal-progress performance comparison with
the previous block-traced decoder run.

The attempted direct pump wrapper captured no pump calls: host-imports assigns
`ctx.pumpAudioCompletions` only after the audio factory returns. Its zero pump,
early-completion and wake counters mean **unavailable observations**, not zero
early completions or wakes. Schedule/deadline arithmetic, local production-pump
regressions and existing callback lifecycle samples are the supported evidence.
The tested helper is retained unchanged; no second original was launched to
replace this missing trace.

The existing lifecycle trace supplies 2,051 paired callback admissions/returns
with exact saved-context restoration and 2,014 sampled semaphore grants
consumed. Those are sampled events, not whole-run submission counts. The
original decoder return `0x4132ac` remains on 112 sampled main stacks. Every
sample still has zero encoder geometry/commands; final GL counters show 172
texture uploads, one clear/publication and zero scene draws. All six screenshot
commands acknowledge; seven PNGs have verified uniform pixel inventories.
Reviewed captures are teal at five seconds and black thereafter. No menu or
ordinary round was reached, so no gameplay DOWN/UP was sent; no UNKNOWN or
replay occurred.

The precise remaining primitive boundary is **outer-batch clock publication →
wave completion eligibility → callback/semaphore delivery → runnable producer
budget before the next publication**. A 249.977-ms output interval spans only
about 1.25 default outer-batch clock steps, while the original producer is
still executing its multi-slice decode/refill. The previous ring arithmetic
already proved that consumption prevents reaching the fill threshold. This
run repairs idle-time banking but does not prove a wrong runnable-thread
selection, lost wake, or a WinMM violation in the remaining batch-clock policy.
The next causal discriminator needs exact service eligibility and execution
budget at that boundary, authenticated to the same requests and clock. Merely
reducing the clock or repeating decoder counts would not establish that cause.

## Recovery and shutdown

Runtime source Git is `87101594a` (full SHA in `source-sha.txt`), with relevant
binary diffs, the untracked wininit helper patch, owned helper/note patches,
runtime input pins and original-media path/size/SHA references. Git remains the
source archive. No source/media archive was created. Standard module SHA-256
is `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`
(2,182,500 bytes). All 129 loaded runtime reads match pins, all 546 staged pins
match before/after, and 162 native dependency pins match. Existing controls
were reused; fresh native GL and WGL checks pass.

47 artifact references / 42 unique contents, 16,350,279 referenced bytes, were
retrieved and SHA-256/size verified before normal shutdown. Local/remote launch
free disk exceeded 5 GB. The independent detached 25-minute watchdog and normal
stop delegate were armed and observed before allocation; maximum watchdog
heartbeat gap was 0.374 seconds. Owned guest processes were absent before stop,
with no ports, profiles or held input.

Box `bx_9875vqcf` is **archived**, current expiry null; original expiry was
2026-11-07T23:35:33.083Z. Delegated normal stop
`stop_9e871c33f44411f3` completed at 2026-11-07T23:14:28.343Z,
forced=false, error=null. `normal-stop-confirmed.json` retains the final state.
Both delegates exited zero and the detached supervisor has no remaining
children. No resume/delete or public deployment occurred. No menu, gameplay,
audio-quality, parity, FPS or historical coverage completion is claimed. This
single bounded task stops with the remaining boundary above.
