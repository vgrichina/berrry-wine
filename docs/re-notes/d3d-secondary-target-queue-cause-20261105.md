# Secondary-target queued drawing observation, 2026-11-05

The timeout retained by `e708ba0f7` was a fixture scheduling error. Public
ordinary and indexed secondary drawing enqueue correctly, retain the selected
device, and produce the expected pixels through the normal public readback
fence. No renderer or target-dispatch change was warranted.

Evidence is in `scratch/runs/20261105-d3d-secondary-target-queue-cause/`.
The implementation base, relevant binary diffs, module/input paths and hashes,
and this note's new-file patch are recorded there. Git is the source archive;
no module, media, or source-tree copies were staged.

## First causal boundary

Read the prior viewport-depth note and retained `browser-second`,
`browser-third`, and `browser-interleaved` failures before changing the fixture.
The fresh `browser-baseline` restores B for the held depth draws and adds
read-only adapter diagnostics. It reproduces the ordinary secondary timeout:

| Observation | Before held green draw | At timeout |
| --- | --- | --- |
| Submitted sequence | 108 | 108 |
| Completed sequence | 107 | 108 |
| Adapter messages while holding | — | none |
| Producer slot 0 device | A | B, `149033264` |
| Producer slot 0 first color/depth | prior draw | green `0xff20c040`, `.6875` |

The public draw and EndScene return success. The green canonical vertices
are copied into a changed producer buffer for the exact B device, but that
buffer has not been submitted. The last posted batch is B's red competitor.
The adapter watches the correct single legacy endpoint; it incorrectly assumes
the next small draw necessarily posts a batch before any public fence.

Source inspection traces public VB drawing through `d3dim_draw_primitive`,
`d3dim_worker_route`, and host opcode `0x20000` to `Encoder.enqueue` in
`lib/d3d-command-stream.js`. The encoder submits a small draw immediately only
when its previous submission has completed; otherwise it accumulates it.
Completion alone does not submit the next producer buffer. Offscreen EndScene
does not fence/present it; public Lock does. Both A and B in this fixture use
caps `0x2840`: A is the initial target, not a DDSCAPS_PRIMARYSURFACE. The prior
note's “primary target” wording referred to A.

The isolated production-Encoder probe records the same boundary. More
importantly, both modules now execute deterministic real-public ordinary and
indexed B controls: hold the red competitor batch, submit green, require new
green bytes in a changed B producer slot with unchanged submitted sequence,
then forward red and use public Lock to submit/read green. Final red pixels
prove the queued mapped green depth remains occluded. These controls do not
accept a timeout.

## Fixture repair and validation

Before holding the next immutable depth packet, the fixture now observes the
red competitor through public Lock/Unlock. This verifies its pixels and leaves
the producer idle. Held depth draws cover A and B, ordinary and indexed. The
adapter records queue snapshots and asserts the packet's exact device ID.
Production batching, secondary EndScene semantics, target selection, and
primary presentation paths are unchanged.

Additional public ordinary/indexed A/B/A pixels distinguish target routing and
depth ownership: B writes green at depth 0; A retains red at .5, then accepts
green at .25 independently; B retains its green. Wrong-device routing and
adversarial depth contamination each fail their designated pixel oracle.
Separate ordinary/indexed B queued-depth corruption controls fail the exact
`B buffer`/`B strided` pixel oracle. Existing unsupported/failure-atomic checks,
other-target output, and depth/lifetime regression behavior remain active.

Both modules pass public COM software tests (1,908 records/55 pixel
checkpoints each), browser software/direct WebGL (1,900/55 each), and
production queued rendering (2,231/67 each). All 20 browser negative controls
are rejected at their designated oracles. The first post-repair browser run
retains a missing negative-control error-pattern assertion; its positive cells
passed, and the final `browser-accepted` run completes the full matrix.
The baseline and all six accepted captures were personally inspected.
Seven focused regressions and the required locked full build pass; receipts
and final module-hash comparison are in the run directory.

The initial cleanup checker misread profile strings as objects; its shell ran
the isolated Encoder probe despite that error. The corrected complete release
check passed before any browser/build/shared edit. This is retained explicitly
in `release-gate.json`. Browser/server cleanup is normal and verified.

Chrome reports WebGL2 through ANGLE/Mesa Intel UHD 620; physical GPU execution
is not independently established. Native Windows is untested. Historical27,
computed alpha, and nonuniform-normal qualification remain outside this work.
No original games, leased boxes, held crash/texture-lifetime investigations,
or deployment were run. The coordinator retains shutdown ownership.
