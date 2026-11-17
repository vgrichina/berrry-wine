# Disciples II mapped NewQuest continuation, 17 November 2026

Evidence: `scratch/runs/20261117-disciples2-mapped-native-quest-continuation/`.

The one authorized fresh original reached the Single Player submenu, then its
New Quest intent exceeded the 500 ms confirmation limit. The controller closed
permanently. Its independently prearmed fallback release acknowledged physical
UP; no later HTTP request, capture, rebind, replay or second original followed.
Local cancellation reaped the native runtime, watchdog and both supervisor
parents with actual zero waits and both EOFs. This was host cleanup, not native
Quit. No quest-selection transition, map action or turn consequence is claimed.

The original used published main `9025b309fa5b68ee5f48cd07cc6fb3fbae03fdc4`,
source SHA-256 `00eb8bf228e789f4ce555e165a9e059d93281280ee524bcf3dc27e78d378994a`
and module `33ef36c2de1c86ca1302b5659f02bb48f1794dfc4e20945821251198f04cb03e`.
All 4,580 Git source bodies independently matched that revision, with no owned
patch or foreign WIP adopted. Compilation and sealing preceded the fixed
3,600-second native clock, prearmed 3,620-second watchdog and 300-second Quit
reserve. All 128 original media hashes matched; only the shipped scenario `.sg`
was present. No imported save, `f.sg`, EXE, configuration or clock change was used.

The exact sealed runtime passed seven native mapping cases, normal queued DOWN,
early cancellation and fourteen synchronous native DialogBox/BUTTON cases.
The synchronous fixture required only an evidence-inventory list-to-map adapter;
its original sealed manifest was retained. One slow65 release client hit its
250 ms HTTP timeout despite native DOWN and UP. The unchanged slow65 recheck
passed with 390 ms confirmation and 163 ms from native consumption to UP ACK;
the first failure remains retained. No timing or admission bound was changed.

The original Single Player intent confirmed in 78.697 ms and independently
released in 122.041 ms. A subsequent complete personally viewed frame showed
New Quest. That next finite intent at canvas (785,183) timed out. Its final
public log contains WM_MOUSEMOVE at (499,129), hit-test and UP at (630,154),
and no corresponding DOWN. The native guard's final ticket state was not
queried after timeout. The absent DOWN does not establish its precise queue
removal point or the cause of the missed confirmation deadline.

## Newly proved hover coordinate boundary

Reviewing those logs also exposed a separate, reproducible mapping defect. In
the retained authored 1024x712 fixture, the hover preceding the coordinate
press reached native (558,252), whereas DOWN reached the intended (700,300).
The original's differing hover and button points show the same transform
pattern; this does not prove that it caused the New Quest timing failure.

`handleMouseDown` in `lib/renderer-input.js` is a non-strict function. It
rewrites its formal canvas coordinates into native coordinates, then passed
`arguments[0]` and `arguments[1]` to `handleMouseMove`. Those argument slots
alias the rewritten parameters, so the hover mapped a native point again.

The repair preserves the original canvas coordinates in local constants before
mapping and clipping, and forwards those constants to the existing hover call.
It changes no input ordering, hover barrier, empty-pump acknowledgement,
receipt, lifetime, target containment, release or freshness policy. The explicit
owned-source inventory permits this renderer file to be sealed as an owned
patch. Its callback producer has an anchored review; broader ownership remains
pending.

The new regression failed before the repair with actual forwarded (390,252)
instead of canvas (500,300), then passed across identity, scale, offset,
letterbox/DPR and clipping. The native mapping suite now independently checks
the actual public WM_MOUSEMOVE lParam against DOWN. All seven cases passed;
the scaled native fixture now records hover and DOWN both at (700,300).
Native child BUTTON transition and clipped/changed-viewport refusals remain
covered. The 460 accepted transform points and 740 refusals, retained-context
checks, guarded-input/transport tests, authentic SDL pointer pump and native
first-selection regressions, and currentquest media/admission tests pass.

The additional legacy input-event-scope fixture suspends the native input
consumer yet expects a CONSUMED ticket after host application. It fails that
assertion with both the repaired runtime and the unchanged published baseline;
this diagnostic is retained separately and its validator was not relaxed.

The canonical flock build passed after the anchored producer review. No second
original is authorized by this repair. A future separately authorized route
must qualify its exact published runtime and freshly review each finite intent;
menu evidence here establishes no map consequence or native Quit.
