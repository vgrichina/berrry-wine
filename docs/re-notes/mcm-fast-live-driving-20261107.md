# MCM fast live identity validation — 2026-11-07

Evidence: `scratch/runs/20261107-mcm-fast-live-driving/`. Prior evidence in
`20261107-mcm-bound-input` is immutable. This is a continuation of its measured
7.286-second admission / 13.917-second stale refusal, not a driving claim from
that run.

`tools/mcm-bound-input.cjs` now recovers and hashes each immutable CDP WASM
script once per actual Worker/session/target and complete script-inventory
signature. A changed signature forces retrieval; failed, incomplete or ambiguous
inventories refuse. Live process, page object, endpoint, Worker, module object,
instance, document and renderer identities are still read, never cached.
Independent guest and renderer reads and initial module transfers run together.
After them the page, guest instance and owning renderer instance are checked
again, along with session membership, detachment and module inventory. Read
receipts include operation durations, transferred bytes and cache hits.

The existing 12,000 ms freshness limit and screenshot-start timestamp remain.
There are no guest callback, physics, clock, configuration or input-semantic
changes. Native release remains independently timed; UNKNOWN and partial input
remain sticky closures without replay.

Generated real-Chromium controls use the actual capture/admission/hold helper,
real Workers and production renderer physical-state handlers. Trusted Up+Left
advances guest and owning renderer counters wholly inside the balanced hold.
Nine process/endpoint/Worker/module/document/guest-instance/renderer-object/
renderer-instance/renderer-endpoint replacements reject with zero events.
Stale, partial, UNKNOWN, late-ACK and stale-dependent requests close as required;
slow capture cannot re-date pixels and a slow sampler cannot prolong release.
The generated labeled fixture image was personally inspected. Commands:

```
node scratch/runs/20261107-mcm-fast-live-driving/generated-browser.cjs
flock /tmp/wine-build.lock bash tools/build.sh
```

Both pass. A separate real-browser comparison uses generated WASM modules with
2,097,194 bytes apiece. The old chain makes eight module transfers including
collector recovery, capture and admission; the new chain makes four and none
on admission. New admission's complete live validation is 6.684 ms on this quiet
local fixture. Capture-to-dispatch age is 498 ms before, 329 ms after. These are
fixture timings, not an explanation of every millisecond on the previous heavy
box. The initial large-fixture attempts failed before input because renderer
instantiation was not ready; those failures are retained and the readiness
condition was corrected. See `latency-comparison.json` and per-CDP read logs.

## One original: freshness repaired, at-speed prerequisite unproved

Repair commit `b2be783e344fea122af1a1c9021ea7a4e6663a8c` is published on
main. One UUID-idempotent box `bx_jrgerftp` was allocated at 08:35:22.692Z.
All 931 staged file pins matched remotely before the sole original launch;
316 local and remote HTTP pins cover registered media and resolved DLLs. The
registered runtime/fonts/module/helper closure and exact Git plus relevant
uncommitted/new-file patches are retained, without a source or media archive.
The complete inventory matched again at termination.

The ordinary route was video-memory OK → RIDER → Single Player Event → Stunt
Quarry → Practice/two opponents → T-riffic → default rider/yellow bike → Start.
The settled race was personally inspected in Chrome 151.0.7922.108, V8
15.1.206.16, actual guest endpoint 1 / owning renderer endpoint 1 legacy WebGL,
ANGLE Intel UHD Graphics 620, Mesa 23.2.1. Actual loaded module:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.

The actual first guest module transfer took 72.191 ms and hashing 1.059 ms;
the owning renderer's first transfer took 82.547 ms. Subsequent reads show
cache hits for both 2,182,493-byte modules. Real post-screenshot validation can
still wait seconds for Workers: the settled capture's simultaneous guest and
renderer reads took 2,152.748 / 2,149.202 ms; the next capture took
2,701.916 / 2,684.126 ms. This identifies passive Worker responsiveness as a
remaining cost, rather than attributing the predecessor's entire 7.286 seconds
to byte transfer without evidence. Every read duration is in capture bindings
and `original-timing-summary.json`.

Two Up requests were refused at the initial freshness check with exact-ID,
zero-effect replies; neither began live validation or dispatched a key.
A third request used a new personally inspected capture and succeeded:

| Measurement | Result |
| --- | --- |
| Screenshot-start timestamp | 08:39:20.254Z |
| Screenshot validation completed | 08:39:24.177Z |
| Admission live identity validation | 824.163 ms |
| Scene age immediately before dispatch | 11,068 ms, within 12,000 ms |
| Up hold / release initiation | 08:39:31.323Z / 08:39:33.325Z |
| First complete in-hold sample | 19 ms, slice 8971, flips 24, render completion 212 |
| Second sample | 3,694 ms, finishes 08:39:35.139Z, excluded from in-hold evidence |

The second sample sees slice 8980, flips 25 and renderer completion 216, but
only after its read completes outside the physical hold. One complete in-hold
sample cannot establish an in-hold delta. Release remained independent and
prompt at 2,002 ms. Console Up dequeue messages are not DirectInput polls or
guest-step timestamps. No callback, instruction marker or clock was injected.

Personally compared `race-settled`, `throttle-fresh`, `throttle-result` and
`final-no-input`: upright central RIDER, ravine contours, far flat ridge and
near-zero speedometer. Small framing/terrain shifts do not establish an
at-speed trajectory; INFERNO/ROCKY motion and the changing red arrow are
excluded. No supported speed baseline or steering result is claimed. No
Left/Right input was sent. The new measured boundary is a multi-second passive
renderer read spanning the bounded hold, with no established at-speed player
motion. After measuring it, only passive capture/diagnostic and ordinary quit
were performed. No uncertain input was replayed.

One premature image read before its capture download finished failed locally
without effects. The first terminal census ran before all processes had been
reaped and refused; a later passive inspection confirmed all absent before
final census. Those failures remain in evidence.

## Terminal state

All 17 commands 0–16 have matching exact-ID replies. Before ordinary quit,
physical and async high-bit keys were released and the queue was empty. All
14 recorded processes are absent, both ports refuse, profile and writer locks
are absent. All 183 terminal artifacts (8,923,232 bytes) were retrieved and
hash-verified before the delegated normal nonforced stop. The box is
**archived**, stopped **08:41:28.893Z**, active expiry **null**, a lifecycle of
6 minutes 6 seconds. Local generated browsers, ports and profiles are clear;
free `/home` stayed above 2 GB. No assigned runtime remains running.

Next work is a generated-first passive sampler that can observe page execution
and renderer progress independently without waiting on a blocked renderer,
then a separately authorized original driving attempt. This run stops at the
measured boundary. No FPS, audio, parity, full27 or public deployment claim.
`result.json` is published last after artifact checks and Git publication.
