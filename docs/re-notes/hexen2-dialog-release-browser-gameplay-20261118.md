# Hexen II independent release and browser encounter, 2026-11-18

The independent Enter release reader is repaired. A fresh unchanged registered
`hexen2_demo` reached the living courtyard, moved up the ramp into a chamber
with two visible spiders, received incoming damage, and quit through the normal
menu and Y confirmation with process exit code 0. Enemy damage or a kill is
not proved. No game runtime, guest, config, registry or save was patched.

Evidence: `scratch/runs/20261118-hexen2-dialog-release-browser-gameplay/`.

## Repair and controls

Published helper/test commit `34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af`
adds `tools/process-input-owner.cjs`. Physical release binds document epoch,
process object/ID, guest endpoint/link/Worker/module, renderer and canvas.
It does not traverse GL, window or bridge readiness. Dialog destruction and
GL creation may change their owners without invalidating the physical UP;
replacement of the document or process still refuses release.

The old run-local reader removed the explicit GL guard but still evaluated
`gps.workerEpoch`. Native Node and an isolated authored browser control
reproduce `TypeError: Cannot read properties of null (reading 'workerEpoch')`
when a GL port exists before its bridge. Exact Runtime.evaluate expressions,
responses and CDP exceptionDetails are retained; the new reader passes that
same case. This isolates an unsafe helper dependency, not the missing thrown
exception from the predecessor's calibration1. A fresh old-helper production
control actually passed; a deterministic original-runtime old failure is not
claimed. The first isolated browser probe used insecure about:blank and failed
on `crypto.randomUUID`; its result remains separate from the secure control.

All offline syntax and process guards passed before each authored launch.
There were four finite authored scopes, with no replay or requests to a closed
scope. The first passed with the old reader. The corrected-reader scope retained
a visible raw-PNG notice, balanced independent Enter and real GL creation, then
closed on an incorrect backend-observer assertion. Its natural present receipt
already reported WebGL; the adapter's snapshot is private, not a public method.
The next scope closed on a partial command-file JSON read, after successful
Enter release. Command publication now uses exclusive temporary write plus
atomic rename. These are controller corrections, not runtime repairs.

The final control qualified actual GL owner/module/backend, balanced
ArrowUp+Control and Mouse1, ordinary Escape ExitProcess(0), and stale-owner
refusal before arming. Actual process replacement was 1000 to 1001 in the same
document. Reload then produced process 1000 with a different document epoch.
Both stale release children exited 1 before DOWN/UP, with actual wait and EOFs.
Independent UP never waited for the separate GL-ready observation.

The final control's first screenshot was genuinely early teal; its recorded
"notice visible" annotation is withdrawn. Visible-notice/Enter-to-GL evidence
comes from the separate corrected-reader scope. The original admission receipt
predates this pixel-audit correction; qualification is the combined controls,
not a claim that the final first frame visibly contained the notice.

Raw PNG decoding also corrects the predecessor's cal3 presentation claim.
Its two whole PNGs differ, but their dialog rectangle at (65,345), 299 by 125,
has the exact same RGBA SHA-256 as the known visible notice:
`00dd825eb41e2087b9ac81374142ac7f021b34a6356567e8e5f67ff815de9e19`.
Gray body and black OK glyph pixels survived transport. No compositor repair
or forced redraw is justified.

Focused process-owner tests and the locked full build passed. The initial
unwrapped build tool returned 143 despite its complete log; the subsequent
wrapped locked build has an actual exit-0 child wait and both EOFs. Publication
of the helper used explicit own paths and immediate strict pull/push.

## Original observations

The original used published Git `34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af`
through the memory-only Git server; foreign shared overlays were excluded.
The compiled, served, and independently recovered executing guest/render
Worker module is 2,418,470 bytes, SHA-256
`1504acf2ea5cac3ec3b8c627f4edc64c564e62ad37c06928f288bd8ae83b4f37`.
The owning GL-GPS endpoint and natural present receipts report `webgl1`, with
ANGLE Intel UHD Graphics 620 / Mesa 23.2.1. Chrome is headful; viewport
emulation is disabled. All captures are whole X11 display frames.

All 18 manifest/media/registered-control references were hashed before launch
and remain unchanged. Root `glh2.exe` SHA-256 is
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The registered Hexen2 Flag and modern controls were preserved. Normal guest
and render Workers, ordinary clocks, polling and focus behavior were used.

Reviewed native menus selected Single Player, New Game, Paladin and Apprentice.
Model meshing completed naturally. `loaded-world.png` shows upright fists,
health 81 and the courtyard statue/ramp. A short ordinary right turn and W
holds changed the view and carried the player up the ramp, through the skull
doors and into the chamber. `landing.png` shows two spiders and health 81.
After an ordinary 1,800-ms Mouse1 hold, `spider-combat.png` shows upright fists
and health 50. Incoming damage while alive is established; a hit or kill of
either spider is not. Subsequent health 11 and the rolled health-0 view record
the native death consequence.

The physical Mouse1 release has its independent CDP ACK and passive state 0.
The DOM ledger retains trusted mousedown and click, but no mouseup; a complete
DOM pair or guest attack-consumption ACK is not claimed. Likewise, the browser
consumed the first Escape DOWN while releasing pointer lock: the DOM ledger has
one Escape DOWN and two UPs, separate from the two paired transport receipts.

The first Escape released browser pointer lock. The next opened the native
main menu over the death view. ArrowUp selected Quit; Enter opened credits
with "Press Y to Exit". The original controller lacked Y, so a separate guarded
ordinary Y sender was syntax/guard tested before use. It bound the current
reviewed whole frame, exact process/GL owner and prearmed independent release.
KeyY used virtual/native keycode 89. UP returned physical state 0 before the
guest finished exiting; the tested natural-retirement fallback was not used.
`ordinary-quit-exit.json` records processExited=true, running=false and code 0;
the whole terminal frame shows the shell Ready with no guest window.

## Bounds, cleanup and recovery

Predeclared bounds were startup 180 seconds, each authored scope 300 seconds,
original 1,200 seconds with a 240-second Quit reserve, cleanup 20 seconds,
and independent watchdog 20 seconds beyond each runtime cap. Holds were at
most 1,800 ms, release fallback 5 seconds, CDP 15 seconds, whole capture
10 seconds, and review 90 seconds. No cap was extended. Original runtime
finished well within its bound. UNKNOWN closes a scope without endpoint
requests or replay; all failed scopes stayed closed.

Every browser/display/supervisor/launcher/watchdog and enclosing invoker has
an actual drained child wait. Containment receipts report no leaks; profiles
and owned processes are absent. The direct board-watch tool returned 143;
it has no separate enclosing child-EOF receipt, so that watcher gap is explicit.
No runtime cleanup depends on that watcher. The original disk watchdog's
minimum was 2,007,670,784 bytes, above the 1.5-GB floor.

Git is the source archive. Source/module/media manifests, relevant binary
worktree diffs, owned patches, selected named frames, unique helpers and module,
recovery instructions and verified artifact hashes are retained. Some evolving
run-local helpers lack contemporaneous prelaunch hashes; reconstruction and
that limitation are recorded separately from the authenticated runtime graph.
There are no source snapshots, game media copies, frame series, Wine, Python,
agents, workers, boxes or deployment. Foreign UT/AoW2 and held BloodII work
were preserved. Box ID null, state NOT_CREATED, expiry null, stop receipt null.
