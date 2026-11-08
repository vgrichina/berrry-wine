# TR2 exact source lifetime repair — 2026-11-08

A tested generic production repair moves the source epoch stamp from before
an awaited GPU fence to immediately before the synchronous WAT surface swap.
The dispatch writer remains active throughout the fence. A writer that has
already finished before the new source exists no longer destroys that new
source's proof. Native original qualification and gameplay consequences are
still open; no fresh native box was created for this task.

Evidence: `scratch/runs/20261108-tr2-source-lifetime-repair/`.
The retained production starting points are `b2af046ef` and `7a34e56a4`;
`source-head.txt` records the exact checkout used. Git plus the run's binary
diff and small new-file patches recover the change. Existing game media were
referenced and hash-checked, without copies or source archives.

Retained native evidence was inspected first. The three publication captures
contain raw23/90/133, all qualified0. Final accounting is 112 combined writer
rejections, 14 overwritten sources and seven coalesced sources. Twenty-one
sources sealed, at host versions 0 through 1743; the final capture is at host
version 1817. Source metadata page stamps, DIB page generations, requests and
host versions are retained in `retained-source-lifetimes.json`. Those captures
have no branch-specific source epoch entry/exit states. Neither their combined
reasons nor their later epoch words can identify missing stamp, nonsole writer,
poison or changed epoch retroactively. The overwritten disposition likewise
combines page and host invalidation. This repair is not claimed to explain all
112 native rejections.

The first demonstrated defect is the lifetime of the pre-fence source stamp.
The actual production dispatcher retains its writer across the asynchronous
fence. In the new integration fixture, a second writer enters and exits during
that fence, writing an unrelated page. The original source rejects the new
swap despite no writer overlapping its swap/seal interval. Its original failure
is retained in `baseline-before-repair.json` and the failing test log.
Reconstruction with the branch diagnostics shows epoch1 at the old stamp,
epoch3 at sealing, active1 and poison0: changed epoch only. A second case starts
with active2 and finishes the fence at active1: the old stamp is missing.

`lib/d3d-render-worker.js` now stamps after completed readback and before the
swap, with no await between stamping, swapping and sealing. It requires a
stable sole-writer sample, checks exclusion and epoch again on both sides of
page-stamp capture, and retains the stamped host version instead of sampling
a later host clock into the record. Subsequent host writes and page changes
still invalidate that exact version. Prior source associations still retire
before the fence. There is no execution hold, extra guest write, input,
callback or scheduling change.

Opt-in journal records now carry bounded before-fence, before-swap and sealing
states: active count, epoch before/after sampling, poison and host version.
Rejections name their exact branch and retain all simultaneously failing
causes and the sealing stage. The journal remains capped at 4096 records;
these small diagnostics fit existing slots. They do not create authority or
change the scene predicate, byte identity, owner checks or writer exclusion.

`test/test-d3dim-publication-source-lifetime.js` exercises the production
dispatcher, real compiled WAT swap/page watches, native RGB565 layer decoder,
actual layer proof and real compositor. It qualifies baseline0 versus
corrected1, with the exact red DX source visible on the display. Two additional
positive cases cover a writer already active before the fence and a completed
host mutation during the fence. Fifteen negatives remain qualified0: stale
request, wrong worker owner, host invalidation before/after decode, page writes
before/after decode, active overlap, poison, owner retirement, overlap and
poison during swap, missing stamp, epoch changes during swap or page capture,
and host-version change during sealing. Negative export facades inject only
test-controlled races while forwarding the actual WAT operations. Production
has no such hooks. Cached republication adds no source; retirement balances
every raw record. GDI underneath the DX layer cannot substitute for its proof.

All seven focused tests passed: the new source lifetime fixture, native DX
layer coverage (including its 20 guards), CLEAR observation, transient writer,
transient scene, broad producer publication identity and command wait handoff.
The required `flock /tmp/wine-build.lock bash tools/build.sh` passed. The rebuilt
WAT SHA-256 matches the tested module and accepted runtime:
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Callback census and test-tier checks passed without census changes.
A temporary development typo in host-version sampling is retained as a failed
log; it was fixed before the successful focused suite and locked build.

112 accepted control, existing-media and prior artifact references were
independently reread for exact size and SHA-256. Accepted native500ms,
actualWorkers4096, queue/handoff/retirement and prior native controls were
reused without standalone runtime reruns. The local runtime lock covered only
local focused execution and was released before analysis/publication. No
remote allocation, startup, inputs, watchdog or stop delegation was needed.
Box ID/state/expiry/stop receipt for this task: not applicable, none created.
The prior task's archived box was neither resumed nor modified.

This finishes a substantive first new generic integration repair without
spending the optional native attempt. Next is one separately scoped native
observation using the new source-writer branches, retaining native500ms,
default Graphics OK age <=12000 ms, independent release, actual owning WebGL
module and 4096 journal. Qualified actual DX display joins must precede Up,
Space or Control. Full27, parity, audio, game FPS and simulation FPS remain open.
