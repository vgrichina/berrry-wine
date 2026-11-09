# Redline side-door route 0642 — offline admission blocker

**No new original run occurred. Vehicle entry and driving remain unverified.**
Offline preparation found that the retained Redline controller does not implement
the requested live-module/owner admission before CPU execution and DllMain.
Starting it with freshly updated file pins would launch the original before
checking its live module. This task stops at that admission gap. It does not
establish a new gameplay failure or explain the earlier rear-corner obstruction.

Evidence: ignored `scratch/runs/20261109-redline-side-door-route-0642/`.
The prior report is `redline-car-door-native-20261108.md`, commit `cd78bb913`;
its recovery recipe and shipped `MAINDIR/Readme.rtf` were read.

## Selected bytes and admission ordering

Source base is `83971ae690a393c0a230a25b7c05b63b66d4fbe9` on `main`.
`frozen-provider-candidate.json` records 722 candidate source/runtime/media/helper
references. It is explicitly **not a launch-ready closure**. Thirty-one existing
providers differ from the old run, including the CPU, host, Worker, renderer and
DirectInput source. `relevant-uncommitted.patch.gz` preserves the 4,347-byte
relevant patch, including the existing untracked `lib/wininit-boot.js`.
No shared source was edited.

Under `/tmp/wine-build.lock`, the production WATX closure was compiled in memory,
including its production protected-writer transform and region-layout section.
The resulting 2,185,596 bytes exactly match the selected
`build/wine-assembly.wasm`, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
`selected-cpu-recompile.json` records the result. No module copy was saved.
The old `f9650607…` recipe and accepted mouse-consumption records are retained
references, not evidence authenticating these new bytes.

`startup-admission-audit.cjs` executes the retained driver's actual startup
prefix with inert browser/process/filesystem transports. Immediately before its
original `Page.navigate`, the audit refuses admission with
`MISSING_PRECPU_PREDLLMAIN_ADMISSION`. At that boundary there have been zero live
module bytecode reads and zero new-document flag installations. The driver has
no parked `loadDlls` barrier. Its live module/18-field owner check is called by
capture after navigation and the original-launch wait. Disk pin verification
before launch does not supply the missing live-instance admission.

This is an executed **ordering audit**, not an actual browser, native input,
DirectInput consumption or original-game fixture. Its mock exit-control events
do not qualify any control. The successful audit identifies the missing gate;
it does not claim production already enforces that gate. Initial local audit
setup errors (an inert filesystem descriptor and cross-realm fixture arrays)
are retained with their diagnostic logs and corrected. They issued no browser
or original input. Every command has an actual child wait and separate stdout
and stderr EOF records; logs are gzip streams from their first byte.

## Route preparation and preserved limits

The shipped Readme documents comma/period for on-foot left/right strafe, arrows
for movement and acceleration/braking/steering, and walking into either side
door for entry. Its path/hash/size are in `documented-route.json`. All 65
original media paths were independently rehashed without copying media.

The retained spawn and final settled PNGs were personally viewed. Spawn shows
the rear of the car ahead, with lateral terrain visible; the terminal prior
view still shows a close rear quarter, on-foot weapon and health 100. These are
historical pixels, not fresh authority for any new action. Their SHA, PNG chunk
CRCs and compressed pixel streams are checked by the evidence verifier.

The proposed route is to clear the rear corner laterally from a fresh spawn,
choose each side/step from freshly reviewed living pixels, then approach an
identifiable side door. Comma/period still require an actual native input
fixture before original use. **No strafe qualification or original strafe is
claimed.** No blind sequence of prior turns/holds is prepared or replayed.
The 24-count relative-motion limit, 5,000 ms helper hold ceiling, prior 3,500 ms
original holds, 120,000 ms freshness limit, exact ACK and held-owner checks are
unchanged references. A changed vehicle HUD/camera must precede any bounded
accelerate/brake/steer terrain-relative claim. No firing substitute, rebinding,
guest write, clock/scheduler change or longer hold was attempted.

Prior proof files are independently hashed in `prior-proof-references.json`;
their scope remains the prior runtime and exact unchanged helper semantics.
Native lifetime remains REVOKED; all-writer coverage and edict ABA remain UNKNOWN
where applicable. No other game's observation flags or observer was substituted
to manufacture Redline admission.

## Runtime and recovery

Runtime order was kept: Drakan `bx_yuspm6ar`, immutable UUID
`1cf87c53-ac3c-48ff-a96b-a4ae4e82fe05`, initial expiry
`2026-11-09T07:04:01.762Z`, precedes Quake II route 0635, which precedes Redline.
Both predecessors' exact ARCHIVED, PHYSICAL_DRAINED and board-release proofs
were not available during this offline audit. Subsequently the Drakan worker
posted its exact archive/drain release at 06:51:17Z, with normal receipt
`stop_0c5ed0ef9ded78e9`; Quake II remained next in line. Neither predecessor was
touched. The task's admission blocker independently prohibits proceeding, and
this worker relinquished its third-place runtime reservation on the board.

**This task's box ID: null; state: NOT_CREATED; expiry: null; stop receipt: null.**
There was no Chrome, game, box create/stop/resume/delete, worker/agent launch,
public deployment or runtime lock acquisition. There is no missing wait being
described as physical absence. The task's board watcher is terminated through
its owning parent and actually waited, with both streams drained, before
release. `/home` stayed above the 1.5 GB floor; no RAM gate was used.

Recover source from the exact Git base plus `relevant-uncommitted.patch.gz`.
`owned-run-inputs.patch.gz` preserves the small task-specific preparation,
in-memory compile, ordering-audit, verifier and log/watcher helpers. Reference
existing media/modules by their recorded paths and hashes. Do not replay this
candidate as a launch-ready runtime. No source tree, archive, repeated media
or module duplicate was added.

Next work requires a separately qualified Redline startup path authenticating
the selected module and owning native lineage before CPU/DllMain, with changed
providers tested in their actual composition. Then honor both predecessor
release gates, prearm the observable independent immutable-UUID 25-minute
watchdog before one finite-TTL create, and qualify the documented native strafe
fixture before attempting the freshly reviewed side route. This worker stops.
