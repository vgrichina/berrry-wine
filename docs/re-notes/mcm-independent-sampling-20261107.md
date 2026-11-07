# MCM independent passive sampling — 2026-11-07

Evidence: `scratch/runs/20261107-mcm-independent-sampling/`. Historical accepted
MCM driving remains separate; the immediately preceding fast-live run admitted
Up but had only one complete in-hold sample and proved neither driving nor
steering.

`tools/mcm-bound-input.cjs` separates page-reported guest progress and actual
owning-renderer progress into individually timed streams. Each stream has at
most one outstanding read, runs independently, and stops scheduling at physical
release. The renderer stream reads only the actual owner, verifies its epoch,
module inventory and live session, and checks page ownership again after its
reply. Page samples retain process, endpoint, Worker/module-object and document
checks plus live Worker/session/module-inventory validation. These counters are
passive execution observations, not DirectInput polls or simulation steps.

The hold helper accepts `renderSample` alongside `sample`; release remains an
independent timer. Every observation has its own start, finish and stream, and
is excluded unless wholly inside the physical hold. Slow reads finish after
release without extending it. Capture-start dating, the 12-second freshness
limit, admission validation and UNKNOWN/partial sticky closure are unchanged.

Actual Chromium qualification passed with production physical-state handlers:

- Normal trusted Up+Left: 701 ms release; seven whole page samples with guest
  sequence 15→47, six whole owning-renderer samples with completion 15→44.
- Deliberately busy actual renderer (450 ms evaluation): 261 ms release;
  three whole page samples, sequence 60→71; zero whole renderer samples.
  The late renderer observation is retained and explicitly excluded.
- Page renderer-owner replacement during an outstanding slow renderer read:
  rejected, balanced Up+Right release, closed admission chain.
- Nine pre-input owner/instance/module/document replacement cases: zero input
  effects. Stale, slow capture, slow sampler, partial, UNKNOWN and late-ACK
  regressions pass. Generated labeled fixture personally inspected.

Commands passed:

```
node scratch/runs/20261107-mcm-independent-sampling/generated-browser.cjs
flock /tmp/wine-build.lock bash tools/build.sh
```

One fresh original attempt follows publication of this tested sampler repair.
No original driving or steering result is claimed by these generated controls.
No FPS, audio or parity claim.

## Original result: guest sampling repaired; at-speed prerequisite remains

Sampler repair `7715eab3fe3cbc4f429fb850ccc0ccd58e5796ed` was published before
allocating the sole UUID-idempotent box `bx_z3xstz2x` at 08:47:52.767Z. All
930 staged runtime/original file pins matched before launch and at termination;
315 HTTP resolver pins matched. Git SHA, relevant uncommitted hunks and the
owned small run-input patches are retained. No source/media archive was made.
The 311 registered original files remain separately pinned, not copied into
run evidence. All runtime pins still match locally after retrieval.

Personally inspected the ordinary route: video-memory OK → RIDER → Single
Player Event → Stunt Quarry → Practice/two opponents → T-riffic → default
rider/yellow bike → Start. Chrome 151.0.7922.108 / V8 15.1.206.16 used actual
registered `mcm`, process 1000, guest endpoint 1 / slot 0 and guest target
`2CB000C5A8049B998F44AF6550F7D9F2`. Owning renderer target
`2DC985FBF7D2C7426DBAD9C7DC839F33`, endpoint 1, reports legacy WebGL, ANGLE
Intel UHD Graphics 620 / Mesa 23.2.1, no fallback. Both actual recovered live
modules hash to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.

Four throttle requests had exact-ID, proven zero-effect stale refusals; each
was followed only by a fresh capture. Local request handoff was shortened,
without changing capture dating, admission checks or freshness. A premature
fetch after the first refusal found no result capture, failed locally and
remains recorded; it did not dispatch input or replay an uncertain request.

One ordinary Up hold was admitted, at 8,425 ms scene age after 1,954.239 ms
live identity validation. Physical interval: **08:52:21.329–08:52:23.330Z**,
2,001 ms; release was independent of diagnostics. The repaired sampler retained
20 whole page samples (1–3 ms each), all showing physical Up high and other
arrows released. Two distinct whole observations establish guest sequence
**7893→7901**; it then stays 7901 through the remaining whole samples. These
are actual page-reported guest execution observations, not logical frames,
DirectInput polls or guest-step timestamps.

The owning renderer has exactly **one** whole observation: completion 296,
20 ms read. Its next read starts 123 ms into the hold and takes **2,707 ms**,
finishing at 08:52:24.159Z after release with completion 298. It is excluded.
No renderer delta is inferred from that one whole observation. Crucially, this
late renderer reply no longer delays or erases the independent page evidence.
See `original-throttle-summary.json` and the full admission/hold/JSONL receipts.

Personally compared `race-settled`, `quick-fresh`, `quick-response` and
`passive-after-throttle`: RIDER's helmet/body rises transiently in the first
response and returns to the centered upright pose; near-ground textures and
ravine framing shift slightly, with the same distant plateau/ravine ahead and
near-zero gauge. That establishes a visible transient response but **not a
sustained forward displacement or an at-speed terrain trajectory**. FELINE,
INFERNO and the changing red HUD arrow are excluded. No Left/Right input was
sent; there was no held-risk retry or UNKNOWN replay, no forced state, injected
callback, clock or guest marker.

The first remaining blocker is the unestablished at-speed player trajectory:
real renderer responsiveness still spans a bounded hold, despite independently
observable guest progress. Driving and steering remain unproved for this run;
accepted historical driving is preserved separately. Next work must address
that concrete responsiveness/at-speed boundary before another original steering
attempt. No FPS, audio, parity or historical-27 claim.

## Terminal state

All 20 commands (0–19) have matching exact-ID replies. Physical and async
high-bit keys were released and input queue empty before ordinary quit. All
14 recorded processes are absent, both ports refuse, profile and writer lock
are absent. All **201 terminal artifacts / 9,797,865 bytes** were retrieved and
SHA-256 verified before the explicitly delegated normal nonforced stop.
`bx_z3xstz2x` is **archived**, stopped **08:53:48.148Z**, stop completed with
`forced:false`, active expiry **null**; lifecycle 5 minutes 55 seconds, within
the 30-minute bound. No assigned runtime remains running. Generated local
Chrome PID/ports/profile are clear. Free `/home` remained above 2 GB.

`result.json` is written last after this note's publication and artifact checks.
