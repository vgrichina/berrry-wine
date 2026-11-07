# Nox complete transport preflight and native delivery blocker, 2026-11-07

No new original Nox gameplay or equipment evidence was obtained. The corrected
transport passed positive Chromium request/consume/native-key tests locally.
The sole fresh remote driver then terminated during its native 50 ms keyboard
preflight, before original selection or launch, with
`AssertionError: input delivery exceeded hold bound`. This is a harness delivery
deadline failure, not evidence of a Nox gameplay defect. The first blocker ended
the attempt; there was no replay, replacement box or second remote driver.

Evidence: `scratch/runs/20261107-nox-complete-transport/`.

## Corrected transport and actual local preflight

The staged `transport.cjs` now imports the actual staged
`ordinary-keys-fixed.cjs`, fixing the previous missing `ordinary-keys.cjs`
dependency. Its request path also checks the returned ACK ID against the
requested ID; the underlying generic ACK client did not enforce that identity.
Both changes are run-specific harness inputs retained as patches, not changes
to the emulator or shared production helpers.

`generated-corrected/positive-transport.json` records successful numbered key
and combo requests through the exact staged transport, atomic publisher,
consumer, ordinary adapter and native Chromium input. The key is I; the combo
is Up+Left. Both produce the exact expected ACK and trusted DOM down/up events,
empty physical sets and cleared renderer keyboard bitmap entries. Releases
complete while a 300 ms diagnostic is still pending for an 80 ms hold. These
are generated-fixture proofs of transport operation, not original gameplay.
The labeled generated canvas was inspected.

The fixture retains five process/endpoint/Worker/module/epoch replacement
refusals, stale/slow capture refusal, native partial delivery cleanup and
independent release. UNKNOWN and late-ACK tests now require the exact
`ACK deadline; never resend` error, actual published command and sticky closure
artifact; subsequent requests require the intended closure error. Stale
refusal requires the specific fresh-capture-only error, partial delivery requires
its injected native-delivery error, and a wrong ACK ID explicitly closes the
transport. Missing modules and unrelated exceptions fail these tests.
The initial local fixture correctly failed because its expected legacy-key
error text was inaccurate; the predicate was corrected to the actual assertion
and the complete fixture reran successfully. That failed fixture is retained.

The exact `browser-run-fixed.cjs` production entrypoint also ran locally in
Chrome 151.0.7922.108, including native key/name/combo/partial preflights, HTTP
pin checks and final Nox app selection. Only its fixture environment flag
suppressed launch; `runningApps.length` was zero. The flag was absent remotely.
The declared 765-file pin/deadline prefix passed all missing/corrupt-file and
invalid-deadline controls. The actual staged filenames and positive transport
execution replace the predecessor's false-positive broad rejection checks.
Three focused `ops/browser-native-input.test.cjs` tests passed. The locked
build passed after the attempt. No shared emulator or helper code changed.

## Sole fresh attempt and exact blocker

UUID-idempotent box `bx_waf55qq6` was created at 09:53:00 UTC. The inclusive
35-minute deadline was 10:27:59.858 UTC, browser cap 10:21:59.858 UTC, initial
archive expiry 10:33:00.058 UTC. All 765 uploaded pins matched before execution.
One driver and Chromium started at 09:53:23 UTC. At 09:53:24.113 UTC, the native
helper rejected delivery in the driver's first key-preflight loop, line 99:
`bounded` detected that its independent release had already started before
the keyDown CDP call returned. The guard remains intact; it was not weakened.
The log does not identify which loop key failed, and no timing receipt was
persisted for that failed call. Exact remote DOM delivery counts are unknown.

There is no `launch.json`, selector record, guest process/Worker/module identity,
original renderer/backend, game input or gameplay command. The generic
`launch-parent.json` field `originalLaunches:1` counts the driver attempt; actual
original guest launches are **zero**, as terminal inspection establishes.
No Multiplay/Host/Bunker, equipment, pickup/HUD/action consequence, target damage,
FPS, audio or parity claim is made. Balanced inputs alone would not prove those.

## Pins, recovery and lifecycle

All 125 original files were rehashed locally against the retained original
manifest: 50,450,550 bytes, exact paths with no extras/missing files. EXE SHA-256:
`496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
The tested source commit is `af80bc10f507c9722d8b5d5c1fcc4fa29151db29`,
also recorded in `source-commit.txt`; relevant dirty source hunks
and owned run inputs are retained as binary Git patches. Git is the source
archive; no source/media archive was made.

The standard module is 2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
It matched local and remote HTTP/pin checks and was recovered independently as
`tested-module.wasm`. It was never a live original guest module in this run.
Remote Chrome was 151.0.7922.108, V8 15.1.206.16, native inner geometry
1024×712, `defaultViewport:null`, without viewport emulation.

All 31 remote artifacts, 2,394,714 bytes including the module, were retrieved
and SHA-256 verified before delegated normal nonforced stop. Terminal checks
verified both controller/Chrome PIDs absent, both HTTP/DevTools ports refused,
no Chrome processes, profile or writer lock. Original input recorder and
command directory were empty; input clearance is based on native helper
finally/timer cleanup and complete browser termination, not a remote DOM
balance receipt. Chrome exited code 0. The box is archived, stopped at
09:53:58.822 UTC, expiry null, stop completed with `forced:false`. Ownership
returns to the coordinator; this terminal session must not be resumed.

Local free disk exceeded 2 GB before allocation; shared activity later reduced
it to 1,833,259,008 bytes after all runtime had ended. This worker removed no
peer files and launched no further runtime. The incident is retained; the final
local check recovered above 2 GB free (2,629,058,560 bytes).

Next work is a separately authorized repair/qualification of cold-browser
native delivery versus the 50 ms preflight interval, preserving independent
release and exact admission guards, followed by fresh original equipment/action
exploration only after that passes. The corrected positive transport evidence
is reusable input coverage; it does not resolve the new remote timing blocker.
