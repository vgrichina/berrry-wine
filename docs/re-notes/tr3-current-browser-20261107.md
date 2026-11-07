# Tomb Raider III current browser Jungle — 2026-11-07

**Personally reviewed current-main Jungle movement and a distinct weapon-draw
action on WebGL.** This fills the current-build evidence gap for TR3 within
GLD3D-CORPUS-27-20261006; historical October 6 browser Jungle was already
established. It does not establish full27 or backend parity. No emulator defect
was demonstrated, and no production code changed.

Evidence: `scratch/runs/20261107-tr3-current-browser/`. Tested source commit
`2e456d08de4f5eb6e11be89cfc9923e860431fb5`, individually pinned runtime files,
relevant dirty/new-source patches, and actual guest Worker Wasm
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`
are retained. No source snapshot/archive or repeated media was placed in the
evidence directory. Local runtime/source/build ownership was left with Aranna,
then Lords; this run used one fresh separate boat.

## Route and personally reviewed result

- The actual welcome dialog showed the playable-demo notice and ordinary OK.
  The actual setup selected Direct3D HAL, Hardware Acceleration, 640x480 High
  Colour (16 Bit), and ZBuffer; its observed ordinary OK was clicked.
- The title capture showed the closed red passport selected as “Game.” Balanced
  Enter for 300 ms opened it; after 6500 ms, the fully open passport visibly
  said “New Game.” A second balanced 300 ms Enter selected it. This was an
  explicit New Game route, not the idle `jungle.DEM` attract demo.
- Jungle loaded with Lara and the Controls overlay over the fading INDIA
  picture. Its own text documented Up “Run,” Alt “Jump,” and Space “Arm.”
  A 300 ms Enter and then 300 ms Up did not visibly remove the overlay in their
  captures. A later bounded 2000 ms Up removed it and produced a running pose.
  After a further 10 seconds without input, Lara was grounded at a changed
  position with the camera behind her looking downhill, compared with the
  initial side view against the wall. `jungle-up-short.png`,
  `jungle-after-up.png`, and `jungle-settled.png` distinguish these observations.
- A balanced 1200 ms Alt had a complete ACK and visible key-down/key-up log,
  but the retrieved captures did not show an airborne pose. Jump remains
  unproven; neither a jump success nor an emulator defect is inferred.
- The freshly reviewed `before-arm.png` showed empty hands and holstered
  pistols. Balanced Space for 2000 ms, followed by 10 seconds without input,
  produced `jungle-armed.png`: Lara visibly holding both pistols raised beside
  her head. A further 10-second settled capture,
  `jungle-action-settled.png`, retained that armed pose. This is the distinct
  documented action. No attack, enemy, damage, or combat result was tested.

All these PNGs and their state/capture records are under `review/` in the run.
Actual numbered commands, reviews, admission records, ACKs, and browser input
logs were retrieved. Two expired live requests were refused before dispatch
with zero effects; fresh captures were reviewed before new IDs were submitted.
All 18 numbered commands have ACKs. No partial or unknown command was replayed.

## Preflight and rendering evidence

All ten existing registered files were hashed, with `data/` and `pix/` VFS paths
preserved. `fixture-identity.json` contains their full SHA-256 values. The
920064-byte executable hashes to
`8c7b25460f62c180ae675c2696ac66c8f97948a16458d0598ba72794ddcc7814`,
matching the retained note's abbreviated hash and size. `provenance.json` and
the referenced historical run directories are absent; no complete historical
ten-file hash record was recovered. Current local identity is established,
upstream provenance is not. No download, replacement media, or guest/media/
save/config edits occurred.

The actual import closure is DINPUT, DSOUND, DDRAW, WINMM, USER32, GDI32,
MSACM32, and KERNEL32: all built-in-only under the current resolver. TR3 uses
no native COMCTL32 in this route. The corrected TR2 serving adapter's
`/binaries/` to `/test/binaries/` rewrite was retained; all ten media URL
preflights returned HTTP 200 with exact bytes/hashes. All 578 runtime pins
matched remotely before launch and after normal browser close. The copied
verification helper prints a static `originalLaunches:0` field even on its
post-run invocation; the single actual launch is established by
`launch-parent.json`, `launch.json`, and the execution window, not that field.
The HTTP audit matches 187 successful responses with zero mismatches.

The actual owning D3D render Worker is target
`2310CCA767C15D382D4801AAADD857F6`, session
`83B15E68D6411955F108C4B1B4605D30`, legacy WebGL endpoint 1. At the final
reviewed action capture, returned endpoint counters show 6014 draws, 14961 draw
calls, errors 0, and both software/fallback-software draws 0. Direct CDP
inspection of that owner shows failed=null, control error=0, completed=2314,
batches=1503, commands=15405. Renderer: ANGLE Intel UHD Graphics 620, WebGL 2.0,
Chrome 151.0.7922.108. These are endpoint/owner observations, not separately
instrumented GL-call traces. Audio, FPS, combat, and parity remain untested.
Pastel passport pages and the fading loading overlay remain known rendering
questions, not newly established defects.

Nine transport controls, six retained executor recovery cases plus the new
invalid-duration case, and fourteen balanced production-renderer keyboard
events passed. Run-only duration validation now executes before writer
admission and before executor dispatch. Invalid durations including 3500 ms
produce no command files, locks, admissions, state reads, or key events;
ordinary holds are bounded at 2000 ms. Stale scenes, duplicate IDs, and
partial/unknown terminal behavior are covered by generated controls. No
emulator regression or full build was needed for this findings-only change.

## Retrieval and closeout

All 165 terminal inventory files were retrieved or matched locally with exact
size/SHA-256, including unique modules, logs, captures, and input receipts.
A local retrieval parser initially read the Boat JSON envelope as the payload;
it failed before any download and was corrected to decode the nested stdout.
No remote operation was retried. Chrome exited normally with code 0 at
00:46:04.715 UTC. The controller was still present immediately after close;
the later final process check verified both controller and Chrome absent.
Both ports refused connections, and profile/writer lock were absent.

Fresh boat `bx_pfrdm58n` was created only after the UUID Idempotency-Key was
persisted and fsynced. The task explicitly delegated normal shutdown:
`stop_14ad0c2d32fc4e2d` completed at 00:46:58.973 UTC, forced=false, error=null;
state archived, active expiry null. Allocation-to-completed-stop was about
422 seconds, below 35 minutes. Disk stayed above 2 GB. No safety flag, second
original, resume, nested worker, or shared runtime/build use occurred.

Next: separately scoped evidence for an airborne jump, combat, audio, FPS, or
backend parity if requested. This task stops after publishing findings and
result.json last; there is no separate acceptance/publication worker.
