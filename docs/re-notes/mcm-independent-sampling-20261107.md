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
