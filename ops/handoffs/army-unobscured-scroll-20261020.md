# Army Men: unobscured ordinary-input scroll capture

Completed two bounded executions on `bx_6czhvg6m` on 2026-10-20.
Both have an unobscured Boot Camp baseline before ordinary Numpad6 input,
an unobscured shifted gameplay frame afterward, and eight actual paired
BltFast observations. No obvious repeated stripe bands are visible in either
reviewed frame. Stripe causality remains unknown.

## Exact identity and preflight

This is the retained older fullVM, **not current-main qualification**:

- Built source: `8f6dcc71c7d3685e764da945e6c379ecca30fa49`.
- Runtime directory: `/home/user/icm-fullvm`.
- Module SHA-256: `6642ceea29e035531819fafe795f949ad0d343460fa73af5d23ee3b2f2a968e2`.
- Existing diagnostic adapter: `tools/army-bltfast-observer.js` from
  `2c076caf4089c602654d1ad5aa4e5264f2af5c76`, SHA-256
  `99d6dfac50d09950f8a6e617cec68cd4f6c25336aab8483bd9349e40b1a2ffc6`.
  This is the correction integrated into main `fa71596694afb4afd07d47277741629dd57d995d`.
- Existing owning observer SHA-256:
  `009bc34918cd5a8fe4e749bcb5672b5466170d8ed4d9b1aa0730e0226a0e7d94`.
- Region-map SHA-256:
  `982f784fb4fee814eea64aa03ead565bf913fc8ba7e9cb67bfab3b5ef0d202d1`.
- Node v24.18.1; headless Win98Renderer, pngjs 7.0.0; 640×480 PNGs;
  `--no-threads` cooperative scheduling.

Preflight reused the original 433-path reconciliation: all 419 retained
files match their sizes/hashes and all 14 excluded generated placeholders
remain absent. The 6,415-entry source manifest was verified against the
runtime and independently against Git; the existing corrected diagnostic
adapter is identified separately. Module and host closure hashes passed
before and after execution. PNG encoding passed. No rebuild, dependency
recovery, source change, guest-memory/code patch or silent stub occurred.

## Exact route and executions

Both runs used 200,000-block batches, maximum 750 batches/90 seconds,
`--no-build --quiet-api --no-close --no-threads`, and the original staged
EXE/registry/VFS. Full arguments are in each `run*/launch.json`.

| Batch | Ordinary input or capture |
|---|---|
| 200 | Menu PNG |
| 279 | Click (320,180), enter Boot Camp |
| 450 | Welcome panel PNG |
| 500 / 501 | Enter down / up (VK13), dismiss Welcome |
| 600 | Dismissed gameplay PNG |
| 670 | Unobscured baseline PNG |
| 674 / 706 | Numpad6 down / up (VK102) |
| 713 | Unobscured after-input PNG |
| Exit | Final PNG |

Run 1 ran 12:50:20.952–12:50:33.721 UTC. It used the established
`--trace-api=__army_bltfast_observer_only__` filter, exited 0 without a
controller deadline/log-cap event, and retained the complete 1,469,371-byte
log including input acknowledgements. The runner measured 750 batches in
12.533 seconds. This is batch throughput, **not FPS**; FPS was not measured.

Run 2 ran 12:51:34–12:51:50.986 UTC with the same route and
`--trace-api=IDirectDrawSurface_BltFast`, intended to locate selected calls
relative to input. That filter logs many other BltFast callsites too.
The controller received 88,974,899 bytes, retained only the first 8,325,370,
and recorded `reason: "log cap"` with code 0 and signal null. Its SIGTERM
request did not produce a signalled exit. The resulting before/after/final
PNGs and complete paired JSON exist and match run 1 byte-for-byte, but the
retained trace stops before the later input markers. **Do not treat run 2
as an uncapped trace or claim exact per-call batch alignment from it.**
No third execution was attempted.

## Visual review and paired pixels

In both runs, `dismissed.png` and `turn-before.png` are byte-identical.
Both show unobscured terrain, a soldier, trees, rocks, instruction sign,
fence and HUD. After Numpad6, the sign, fence and other landmarks have moved
on screen; `turn-after.png` and `final.png` are byte-identical. The baseline
and after PNGs differ. Both runs reproduce the same PNGs and paired JSON.
Visual inspection found no obvious repeated horizontal or vertical stripe
bands in these frames. Fine terrain texture and object edges are visible.
This is a narrow visual observation, not proof that all frames are correct.

Each run accepted eight real same-surface calls at return address
`0x407506`, with six actual argument words, HRESULT0, ESP delta28,
unchanged dispatch EIP and zero yield reason. All 24 retained raw returns
validate; owner is pinned, no ambiguity/errors/pending calls, and imports
were restored. There were 677 selected calls: 24 raw records retained,
653 dropped at the raw quota, and only the first eight have pixel samples.

The source/destination is pointer `0x08221080`, slot16, 640×400, 8bpp,
pitch640, format0, backing `0x1c1d4000`. Rectangles begin at x2 or3 and
y0 or1 and end at (640,386), copying to (0,0). Surface metadata is stable
across each sampled invocation. Each call contains nine eight-pixel spans
with actual source-pre, destination-pre, source-post and destination-post
bytes. All 72 destination spans changed, and all match their own immutable
source-pre bytes afterward: 576 pixel observations per execution.

This establishes sampled-copy correspondence and unobscured ordinary-input
before/after frames from the same execution. It does **not** identify each
sampled call's batch, equate the PNG baseline with the exact pre-call
surface, establish full-surface correctness or later-call correctness,
provide an independent clean reference, reproduce the historical stripes,
or prove their cause/fix. No renderer/game fix or broad playability result
is claimed.

## Preservation, verification and handoff

All 9,425 recorded pre-existing Army/ICM/callback files, including the current
callback build/evidence, retain their hashes. All original assets and the
older build/closure also pass postflight. Process inventory shows no
surviving guest/controller. Runtime released at **12:53:06 UTC**, left
running for the queue (TTL 15:53 UTC); no runtime action followed release.

Self-contained local evidence is in
`scratch/runs/20261020-army-unobscured-scroll/`. The remote originals are
`/home/user/army-unobscured-scroll-evidence` on `bx_6czhvg6m`.
All 42 remote artifacts, 20,055,193 raw bytes, were recovered and
independently size/SHA-256 verified. The truncated run-2 log is stored locally
as lossless `run2/output.log.gz`; decompressed bytes match the remote hash.
Local evidence uses approximately 12.1 MB, below 20 MB, and coordinator free
disk remains above 2 GiB. Ignored evidence is retained locally/remotely;
Git backs up the report only.

Important evidence:

```text
report.md, receipt.json, verification.json, verify-evidence.py
preflight.json, postflight.json, preserved-before.json
source-manifest.json, original-manifest.json, original-preflight.json
overlay.json, snapshot/
run1/{launch.json,exit.json,output.log,paired.json,turn-before.png,turn-after.png}
run2/{launch.json,exit.json,output.log.gz,paired.json,turn-before.png,turn-after.png}
remote-SHA256SUMS.json, recovery.json, recover.js, remote.js
run1-controller.js, run2-controller.js, release-processes.json
```

`python3 verify-evidence.py` verifies hashes (including decompressed log),
Git identities, raw ABI joins, pixel correspondence, PNG dimensions/identities,
input acknowledgements and the explicitly different exit limitations.
It does not launch the game. No matching candidate ID exists in the local
manifest, so this is an investigation receipt rather than an unrelated
dashboard candidate result.

The repository-wide evidence checker found one pre-existing containment error
in `20261002T042949Z-reflexive-zuma-deluxe-startup` and ten invalid historical
records; none belongs to this task. Its full output is saved in
`dashboard-check.json`. The task's own offline verification and staged
report whitespace checks pass.

The report-only task branch starts at fetched main
`fa71596694afb4afd07d47277741629dd57d995d`. No source repair, main integration,
workers, new assignment, Claude invocation or public deployment occurred.
