# Nox exact-control repair and prelaunch blocker, 2026-11-07

The missing I/Home/Space support is repaired and qualified in actual Chromium.
**No new original gameplay or equipment evidence was obtained.** The sole fresh
driver terminated during a negative-duration preflight, before Nox was selected
or launched. This is another harness defect, not an emulator or game defect.
The previous terminal run `20261107-nox-weapon-interaction` and its command 31
UNKNOWN result remain untouched; neither session was replayed or resumed.

Evidence is in `scratch/runs/20261107-nox-qualified-equipment/`.

## Input repair and verification

Published helper `ops/browser-native-input.cjs` centralizes checked CDP key
descriptors, required-control assertions, bounded key combinations, and left/right
mouse holds. I is `key:i`, `code:KeyI`, VK 73; Home is VK 36; Space is `key:" "`,
`code:Space`, VK 32. Key/button release runs on an independent timer and in
`finally`, including partial delivery. A slow diagnostic or persistence callback
cannot defer release. Physical host intervals do not prove guest polls or steps.

The new driver generator checks every replacement anchor and replaces the
bound helper's complete hold implementation with the shared helper, rather than
silently trying to extend a textual key-table suffix. The outer ordinary wrapper
uses the same descriptors and delegates to the actual bound helper. Required
I/Home/Space and navigation controls, plus both bound input methods, are asserted
before any original launch. Arrow-only qualification is no longer sufficient.

`generated/exact-controls.json` reproduces the old mismatch in Chromium: the
legacy ordinary wrapper validates each of I/Home/Space, then the actual legacy
bound hold rejects each before dispatch, with zero native events. Its after
rows independently exercise all five required controls through the bound API
and through the ordinary wrapper delegating to that bound API. All ten paths
produce exactly one trusted down/up pair. I/Home/Space have the exact DOM
key/code values; released keyboard bitmap entries are zero. Both mouse buttons
produce native button pairs. Each path uses a 300 ms diagnostic with an 80 ms
hold; native release completes while that diagnostic is still pending, and all
completed samples are explicitly excluded from in-hold progress evidence.

Both `generated/` and `generated-corrected/` pass the actual browser chain's
five owner/process/endpoint/worker/module/epoch replacement cases, stale and
slow-capture refusal, independent release, native partial delivery, sticky
UNKNOWN and late ACK closure. Those tests use generated fixtures only; their
worker/module identities are not original Nox identities. The generated labeled
canvas capture was inspected. The three focused reusable-helper tests and
`flock /tmp/wine-build.lock bash tools/build.sh` passed before helper publication
`d10ebc5d6` on main.

## Exact first blocker in the fresh driver

Box `bx_u7qt7nrc` was allocated with a persisted UUID idempotency key at
09:36:53 UTC. The authorized 35-minute window ended at 10:11:53 UTC; the box's
initial expiry was 10:16:53.940 UTC. There was one driver/Chrome attempt.

At 09:37:29.345 UTC, `browser-run.cjs` line 101 tested invalid hold durations
using `assert.rejects`. The new outer `ordinary-keys.cjs` wrapper performed
validation synchronously, so an invalid-duration assertion escaped before a
promise was returned. The inherited wrapper had an async API. That compatibility
mistake was introduced in this task; exact valid-key tests did not catch it.
`original/first-browser-failure.json` and `runtime-browser.log` retain the first
fault. The original selector/navigation code was never reached. No original
commands exist, and no original native-input recorder events exist. The generic
launch-parent receipt labels the driver allocation `originalLaunches:1`; the
separate `launch-accounting.json` corrects this to one browser attempt and zero
original guest launches, without rewriting the receipt.

`ordinary-keys-fixed.cjs` restores an async `holdBound` API.
`generated-browser-fixed.cjs` repeats the actual Chromium checks and additionally
executes the exact inherited invalid-duration assertion loop: six rejected
promises, zero native effects. `generated-corrected/invalid-duration-contract.json`
and its controls pass. `browser-run-fixed.cjs` is a reviewable corrected next
driver, **not executed against an original game**. No original attempt was
restarted after the fault. A future original run requires fresh authorization.

## Closure, evidence and lifecycle

All 125 originals match the retained SHA-256 manifest and shipped FILESIZE.INI
paths/sizes: 50,450,550 bytes, preserving original layout. The registered 124 data
files plus separately loaded `nox.exe` cover that closure. Original EXE SHA-256
is `496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
All 764 staged runtime/input pins matched before the attempt and after teardown.
The tested source commit is recorded in `source-commit.txt`; relevant dirty and
owned new inputs are retained as patches. Git remains the source archive.
No source/media archive was created.

The current standard module is 2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The preflight HTTP resolver fetched and verified it. **There was no live original
guest module, process, guestWorker, renderer owner/backend or scheduler to
observe.** Chrome retained native viewport geometry, `defaultViewport:null`,
with no emulation. These facts do not establish any Nox rendering or gameplay
result. No FPS/audio/parity, equipment, pickup/HUD/action or damage claim is made.

Chrome exited normally with code 0 and no signal. The controller exited after
the first failure. Independent terminal checks confirmed both PIDs absent,
both server/DevTools ports closed, no Chrome processes, no profile/writer lock,
and no held recorded input. All 29 unique remote artifacts (206,356 bytes) were
retrieved and SHA-256 verified before explicitly delegated normal nonforced stop.
An initial local retrieval comparison caught a formatting-only newline difference
in a locally reconstructed cleanup JSON; matching the remote bytes allowed the
complete verification. No runtime or input was replayed for retrieval.

The box was then stopped normally; the final state and completed nonforced stop
are recorded in `local-cleanup.json`. Local free disk stayed above 2 GB at the
recorded checks. The stopped box is handed back to the coordinator and must not
be resumed. Next work is a separately authorized original run using the corrected
driver and its exact prelaunch assertion coverage, then ordinary equipment
exploration. Target damage still requires an actually observed target.
