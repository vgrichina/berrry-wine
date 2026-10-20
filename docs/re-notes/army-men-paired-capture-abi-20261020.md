# Army Men: actual paired BltFast capture

One authorized execution on `bx_6czhvg6m`, 2026-10-20
12:37:56–12:38:10 UTC, accepted eight real pre/post pixel pairs.
The single bounded assignment is complete. Stripe causality remains unknown.

## Review and exact tested identity

Independently reviewed diagnostic correction
`2c076caf4089c602654d1ad5aa4e5264f2af5c76`, verified its saved evidence hashes,
and extracted its test closure directly from Git. The retained original
paired fixture is byte-identical to the failed original capture. The original
callsite pushes six words including `this`; the pinned handler reads flags at
ESP+24 and cleans 28 bytes. The diagnostic metadata copy preserves the
production table and strict return validation.

All four focused suites passed:

```text
node tools/army-bltfast-observer.test.js
node tools/army-bltfast-captured-abi.test.js
node tools/army-bltfast-preload.test.js
node tools/jig-owning-api-observer.test.js
```

The corrected fixture fails with the old adapter at `assert(r.accepted)`.
The captured-CPU replay still rejects missing pixels; its inferred sixth word
is not used as actual capture evidence. Runner trace predicates also passed.

The existing `/home/user/icm-fullvm` build was retained without rebuilding:

- Built source: `8f6dcc71c7d3685e764da945e6c379ecca30fa49`.
- WASM SHA-256: `6642ceea29e035531819fafe795f949ad0d343460fa73af5d23ee3b2f2a968e2`.
- Sole new overlay: `tools/army-bltfast-observer.js` from correction `2c076caf`.
  SHA-256 `99d6dfac50d09950f8a6e617cec68cd4f6c25336aab8483bd9349e40b1a2ffc6`.
- Previous adapter SHA-256:
  `fcf9ebc58ef6e4286c6cb2192722208a1a000129f5c170caab4acc119207eaf6`.
- Existing owning observer SHA-256:
  `009bc34918cd5a8fe4e749bcb5672b5466170d8ed4d9b1aa0730e0226a0e7d94`.
- Matching region-map SHA-256:
  `982f784fb4fee814eea64aa03ead565bf913fc8ba7e9cb67bfab3b5ef0d202d1`.

All 6,415 canonical source blobs, module, observer closure and all 419
original staged files were verified before and after. The source manifest
was independently compared with Git. The prior 433-path reconciliation,
including 14 excluded generated placeholders, was reused; no installer,
asset provisioning, dependency hunt or build ran. PNG encoding with existing
pngjs 7.0.0 passed. Node was v24.18.1. This is **not combined current-main
fullVM coverage**. The report branch starts at fetched main `8580f3aac`.

## Single execution and actual observations

The prior ordinary Boot Camp input schedule was retained: click (320,180)
at batch 279, Numpad6 down674/up706, screenshots at 200/450/670/713 and exit.
The runner used 200,000-block batches, 750-batch/90-second bounds,
`--no-build --quiet-api --no-threads`, and
`--trace-api=__army_bltfast_observer_only__`.
Exact arguments and controller are retained in `recovered/launch.json`
and `recovered/run-capture.js`.

It completed 750 batches in 14.258 seconds, exit0, without controller timeout
or log cap. The log is 1,468,793 bytes and includes all input acknowledgements.
No second execution was made.

Eight selected calls at return address `0x407506` have actual six-word
arguments, complete source/destination metadata, pre/post bytes and HRESULT0.
All 24 retained raw records have ESP delta28, unchanged dispatch EIP, zero
yield reason and valid completion. Owner identity is pinned, pending depth0,
no ambiguity/errors, and imports restored. The 663 additional selected calls
were dropped at the documented raw-record quota; only eight have pixels.

The same source/destination surface has pointer `0x08221080`, slot16,
640×400 dimensions, 8bpp, pitch640, format0 and backing `0x1c1d4000`.
Copy rectangles start at x2 or3 and y0 or1, end at (640,386), and copy to
(0,0). Metadata remains unchanged across each invocation. All 72 sampled
eight-pixel spans (576 pixel observations) changed at the destination, and
every destination-post span equals its immutable source-pre span.
Source-post bytes are also retained. These are actual guest-memory
observations, not synthetic replay.

Visual inspection of the real 640×480 captures:

- `menu.png` shows Game Start and Boot Camp.
- `bootcamp.png` and `turn-before.png` are byte-identical and show the welcome
  panel over terrain and HUD.
- `turn-after.png` and `final.png` are byte-identical and show unobscured
  terrain, soldier, rocks, trees, fence, instructions sign and HUD.
  No obvious repeated stripe bands are visible in this final frame.

These samples support correct copying at the retained positions for these
eight invocations. They do not prove full-surface correctness, correctness
of later calls, or the absence/cause of the previously reported stripes.
Much of the pre-input screenshot is obscured by the welcome panel, and
there is no independent clean reference. Initial corruption remains unknown;
no renderer/game fix or broad playability claim follows.

## Evidence, recovery and release

Self-contained local evidence:
`scratch/runs/20261020-army-paired-capture-abi/`.
All 29 remote artifacts (6,299,676 bytes) were recovered individually and
verified by size and SHA-256, without a large archive. Important paths:

```text
report.md
review.json
replay.js
logs/
snapshot/
verification.json
verify-evidence.py
recovery.json
recovered/paired.json
recovered/launch.json
recovered/exit.json
recovered/output.log
recovered/{menu,bootcamp,turn-before,turn-after,final}.png
recovered/{preflight,postflight,overlay,source-manifest,original-manifest}.json
recovered/SHA256SUMS.json
```

`node replay.js` replays the source tests/negative control.
`python3 verify-evidence.py` verifies saved artifact hashes, Git source
identities, actual ABI/return/pixel assertions, input log and image identities.
Neither launches the game. `recover.js` and `remote.js` retain the
authenticated file-copy recipe; its source remains
`/home/user/army-paired-capture-abi-evidence` on the runtime. Recovery requires
an authorized accessible box and should target a new directory if repeated.
Ignored evidence is retained locally and remotely, not backed up by Git.

All 170 hashed pre-existing Army/ICM evidence files remain unchanged.
Postflight process inventory has no surviving guest/controller.
The runtime lease was released at **12:39:31 UTC**, leaving the box running
for callback qualification. The corrected diagnostic adapter remains in the
older runtime directory with its original saved in the evidence directory.
No further runtime action follows release.

The sparse report worktree plus evidence uses under 10 MB, with over 2 GiB
free. Only this report is committed; no main merge, renderer/game change,
gate bypass, worker launch, public deployment or laptop changes occurred.
There is no capture blocker. General stripe diagnosis remains open for the
coordinator's next assignment.
