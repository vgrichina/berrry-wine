# Aranna native hover journal, 2026-11-07

The run-local harness repair passed both-module controls. The single registered
original advanced through **Main Menu → Single Player → Start New Game → Choose
Hero → Difficulty**. Player-controlled world movement remains untested: the
global observer transport reached its unchanged 8,192-record limit at Difficulty,
and native point certification refused. No production emulator defect or repair
is established. Evidence and reproducible helper patches are retained in
`scratch/runs/20261107-aranna-hover-journal/`.

The [previous run](aranna-setup-input-20261106.md) had no original target click:
lock expired before dispatch, producing zero effects. Its generated post-arm
acquisition moved the cursor to (396,-22); measured movement reached (399,156),
but DRAW and MANAGER shared an exhausted eight-store journal. This investigation
repaired that demonstrated observation gap before launching another original.

## Run-local repair and controls

`observer-transform.cjs` separates bounded DRAW/input stores (eight) from MANAGER
stores (sixteen). Stores no longer consume hover transaction admissions. Hover
deduplication also requires an unchanged manager-store revision: returning to an
identical coordinate after acquisition produces fresh evidence. The observer
still executes each guest store once. Arming remains one-way; the 32-transaction
hover limit and global 8,192-record transport remain bounded. Saturated manager
coverage, stale evidence and incomplete transactions refuse certification.

The adapter preserves actual Worker/session/module, app, scene/provenance,
receiver/vtable/native return, focus, geometry, movement and protocol checks.
Ordinary mouse operations retain separately timed down/up attempt and completion
receipts. Unknown or partial outcomes are terminal. A stale lock transition
remains a typed refusal before input, with zero effects; no held operation is
replayed.

Capture now records the adapter's initial browser pointer bookkeeping, including
the ordinary launcher click. Node-only adapter reload reconstructs from that
captured baseline and completed receipts, verifies it against live bookkeeping,
and resumes without browser evaluation or guest-state writes. Reconstruction
rejects unknown/partial receipts. Actual reload evidence is in
`control-target-standard2/input-module-reload.json` and its compat counterpart.
An earlier generated reload exposed the missing launcher baseline and terminated
without further input; its failed evidence remains retained.

`route-qualification.json` passes the actual natural expiry → stale zero-effects
refusal → trusted canvas acquisition → measured retarget → fresh native hover →
target activation route in **both modules**. Reviewed standard2/response-08 and
compat3/response-10 captures show ACTIVATED TARGET A, hit=1 and down/up=3/3.
Acquisition itself had hit=0 and down/up=2/2. The fresh final point (398,155)
equals the pre-acquisition point, explicitly exercising identical-coordinate
revisits. Browser traces establish trusted `requestGuestPointerLock` acquisition
and natural `releaseExpiredAutomaticLock` expiry.

In compat3, the first completed return movement instead reached (400,332).
Strict proof refused before a target command was queued. A fresh reviewed
capture and measured correction returned to (398,155), after which a new complete
proof admitted activation. No uncertain input was retried. Compat2's activation
passed but did not exercise identical coordinates; it is not the final qualifying
case. The evidence retains these distinctions.

The two full-shell routes produced no post-arm DRAW writes. Separate generated
controls therefore establish the actual DRAW-before-later-MANAGER ordering:
`draw-manager-ordering.json` records eight DRAW stores through serial 1341 and
sixteen MANAGER stores through serial 4810 in both modules, via ordinary API and
owning Worker execution. The generated saturation fixture itself exhausts hover
admissions and is not accepted as a live target proof. Fresh hover certification
is established by the full-shell routes above.

Both twelve-cell baseline/disabled/armed passivity matrices pass: actual module
and owner identity, CPU/lazy flags/live FPU, guest memory, input/public API state,
COM/draw behavior, DLL initialization, reserve and SEH results match. The changed
observer remains inactive when disabled. Results are in `controls/` and
`controls-draw-churn/`. The first matrix's initial offline validator referenced
predecessor metadata by mistake; the corrected review passes on its retained
results. The second matrix passed directly. Incorrect initial full-shell DRAW
coverage assertions were replaced with the separate actual ordering evidence.

Additional passing controls cover 22 mutations of actual route receipts,
including wrong owner/module/native target, stale protocol/point/movement,
later stores and exhausted/missing journal coverage; 32 contract boundaries;
12 retained-proof negatives; pointer reconstruction; and five dispatch mocks
including partial/unknown terminal outcomes. The retained prior exhausted journal
still rejects. Unchanged earlier controls are referenced rather than rerun.

## Original and concrete remaining blocker

The sole original ran from **00:32:31.271Z to normal exit at 00:42:53.967Z**,
within the authorized forty minutes including review and cleanup. The actual
owning standard observer module was
`56f8521938f3fcc8e0b2806926b436575a64cbde270ff30e5136aade1027b860`.
`original/action-10.json` records fresh native Single Player proof at (398,155),
serials 2548–2553, and completed ordinary down/up. Reviewed response-11 shows
Single Player; response-15 shows Choose Hero; response-19 visibly contains the
ordinary typed name Aranna; response-22 shows Difficulty after Next.

At Difficulty, action-23 completed balanced ordinary reacquisition. The transport
first reached 8192 at **00:42:36.000Z**, event 89, on the actual owning Worker.
The subsequent read-only `measure-point.cjs original response-23` refused on the
global saturation assertion. The exact first helper invocation time is unavailable;
the refusal is retained in `original/difficulty-measure-refusal.log`. No Normal
click was queued. Reviewed response-23 is the final Difficulty screenshot.

`original-assessment.json` records fifteen completed input actions, nine balanced
clicks, and 545 complete observer transactions with no incomplete packets. There
was no safety flag, unknown/partial input outcome, forced lock, injected guest
state, second original, or guest/media/config edit. The original did not require
the generated control's post-arm first-target recovery: its first target click
completed before expiry. Later ordinary reacquisitions were reviewed separately.

The next work is a bounded fresh observation window or reduced unrelated trace
traffic that preserves complete owner/scene/native-target proof throughout later
setup. Qualify its changed observer controls before any separately authorized
original. Do not reuse this saturated journal as proof. World loading, movement,
combat, audio and sustained performance are not established by these captures.

## Reproduction and handoff

`source-identity-v7.json` pins Git revision
`f4473ab2936e22ac5fdd02267eec3504bd425aa2`, relevant binary diff and individual
run-local helper patches. Observer builds derive from production revision
`e5c075a59ea84bcb3abc0334c6e3986ebc96a96b`; baseline module bytes match shipped
standard/compat builds. Source and HTTP identity checks passed before the
original, and source identity still matched after closure. Media remains at its
existing path with SHA-256 references. No source tree or media archive was made.
This publication changes documentation only; no production build is claimed.
Aranna has no candidate-corpus manifest entry; `candidateId: null` retains this
as investigation evidence and is an explicit dashboard-schema exception.

`runtime-cleanup.json` verifies all owned runners, Chrome processes and recorded
descendants absent, ports refused and temporary profiles absent. All browser
sessions closed. `runtime-release.json` records terminated holder 1110100 and
all four local runtime/build locks independently free. Runtime/source/build
release was posted explicitly for Lords2 immediately after cleanup. No boxes
were allocated or changed. Free /home space remained above 2 GB.
