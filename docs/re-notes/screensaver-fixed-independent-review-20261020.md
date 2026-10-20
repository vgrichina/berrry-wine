# Screen Savers fixed candidate: independent source-slice acceptance

Reviewed candidate `95d2f43d868d60d84d945b20f393863176622d64` against main
`c918629780ca97b871886e417fc46a800ab3203b` on 2026-10-20.
**Accept the repaired renderer-to-native input source slice. No remaining
blocking production defect was found in this bounded review. Proceeding to
full-VM/browser validation is justified; this is not full lifecycle acceptance
or permission to skip integration/build gates.** No production changes or main
merge were made.

The retained clean `/tmp/wine-screensaver-input-boundary-fix` was read-only.
Original review and fixed evidence were read without repeating the recovery
search; all 8 and 11 respective manifest entries verified. Evidence is in
`scratch/runs/20261020-screensaver-fixed-independent-review`. A durable copy of
the tests, identities, reconciliation and results accompanies this report in
`screensaver-fixed-independent-review-20261020-evidence/`.

## Input ownership and control behavior

The applet now uses the existing host `check_input` owned dequeue, followed by
`check_input_hwnd` with live focus and separate full-width wParam/lParam reads.
The browser host prefers renderer process identity, falling back to the
process HWND range/instance policy. The test puts a foreign-process event
ahead of owned input and proves it remains queued while owned input proceeds.
It covers that ownership branch, not all Worker/thread ownership variants.

Actual renderer `handleMouseDown`, `handleMouseUp`, `_dispatchMouseEvent` and
`takeInput` feed the production host input block. The compiled closure runs
the applet, native dispatch, BUTTON/LISTBOX/STATIC state and wndprocs,
notifications, mouse activation, capture and USER focus helpers. It observes
list row 2, matching STATIC file text, and Preview of ARCHITEC.SCR only on
release. It does not replace control input with a synthesized WM_COMMAND.
The small applet fixture still uses direct post injection and is only
supporting coverage.

The unchanged original candidate `4c98907328917f5917a59445bb4d5ce3e2caca09`
fails the new regression at **renderer DOWN selects real listbox row 2**.
All four mutations fail at specific behavior assertions: omitted poll,
wrong HWND, omitted mouse activation, and dropped native button notification.
Compilation failures or unrelated exceptions cannot satisfy these oracles.
The original applet regression and its three controls also pass, as does
the host wiring fixture with its six failure/cancellation cases.

The pump snapshots event fields, constructs the MSG tail, performs USER mouse
activation, then sends accepted input to the native target. Work is bounded
to 64 input events; the 65th remains queued. Renderer release deferral is
honored and the host schedules another step after 50 ms. Independent checks
enqueue DOWN and UP before any pump: the first pump acquires capture without
launching, the next release launches once and releases capture. Original
outside-release and WM_CANCELMODE cases pass.

## Fixture focus gap found and addressed in review evidence

The candidate fixture's `wnd_get_thread: () => 0` adapter disagrees with the
compiled `current_thread_id` initial value of 1. Consequently real `set_focus`
rejects child targets. Compiling the focus helpers alone did not qualify focus
transfer; the earlier fixed-evidence wording was too broad. The independent
supplement initially exposed this as HWND 100 instead of expected 102.
`initial-supplement-failure.json` retains that result.

The supplement changes only this adapter to return 1 and adds wrapper exports
for existing production USER focus/capture helpers, in memory. No production
form or retained file changes. It then verifies real focus transfer, keyboard
DOWN routed using live list focus, cancellation of a mouse-origin button press
through USER focus loss, and cancellation through real capture transfer with
the new capture owner preserved. All pass. The keyboard event is queued
directly; this does not qualify DOM keyboard handling or dialog Tab navigation.
The original fixture gap is a coverage correction, not evidence of a
production owner-thread bug.

## Close and lifecycle boundary

Native BN_CLICKED calls the class-35 parent synchronously through
`ctrl_notify_parent`/`wnd_send_message`. The input pump checks `scrsave_hwnd`
after dispatch and returns immediately if Close cleared it; the post path
also stops after Close. Both original native Close and the independent queued
WM_CLOSE test prove one MSG free and no subsequent dequeue, even with another
event queued behind Close. Additional pump calls return zero.

The source clears applet globals before destruction, recursively sends native
WM_DESTROY through `wnd_destroy_tree`, removes records, calls host window
destruction and sets quit. The fixture's recursive removal merely deletes
map entries; its free/read guards are not a production allocator/UAF oracle.
Production destruction, HWND focus/capture cleanup, host stop/unwind and shared
renderer cleanup remain full-VM/browser obligations. The separate
`wnd_destroy_recursive` path must not be mistaken for the applet's tested
`wnd_destroy_tree` path.

Hit testing, geometry, window-record storage/owner metadata, allocation,
painting/GDI, default-button border work, recursive teardown, and shell
execution remain adapters. The launch array proves the selected filename
reaches ShellExecute, not that a saver starts or survives applet Close.
The inherited bounded temporary-caption/catalog allocations, low-memory
construction behavior, asynchronous startup cancellation/timer cleanup and
single-app queued launch semantics identified by the original review remain
explicit limitations; this input repair does not resolve or qualify them.

## Reconciliation with current main

Common ancestor is `4d57bb66dae7da0a488b9546ccb0b4f4f7ba2434`.
The only changed path common to both sides is `host.js`. Main adds MIDI
callback transport/dispatch wiring in the wave callback and audio setup areas.
Candidate adds no-PE startup/Worker suppression, ScreenSaver shell resolution,
font/startup cancellation checks and the applet run branch. The changes are
in separate functions/locations; the owned-input import block is byte-identical
on candidate and main. Native input/control/USER source dependencies are
unchanged by main's MIDI work. Main also changes audio/register/API/export
sources and generated import signatures, while candidate changes applet,
regions/manifest/native class dispatch and registry/shell paths.

`main-reconciliation.json` records every changed path and both complete host
diffs. This establishes source compatibility, not qualification of a combined
module. Preserve main's MIDI changes and generated signatures when integrating;
do not replace host.js wholesale with the older candidate. The combined tree
still needs canonical build gates and full-VM validation.

At preservation, remote main had advanced to
`aaf8599291b278b5cf1b9e53c654b5bb8cd5dfe6`. Its exact diff from the requested
main is only `docs/re-notes/madbomber-after-midi-original-20261020.md`;
there is no additional production delta to reconcile.

## Exact replay and next qualification

`tested-identities.json` records Git blob IDs and SHA-256 for all scanned native
source/compiler files and tested JS files, checked against every materialized
file in the retained candidate. Node was v24.18.1.

- Unmodified input closure: 23,280 bytes,
  `980e3a0cf223f2543d9152c21d0815abfbc9288ba2fe76458b79fd59dfc9d100`.
- Original defective applet closure in the same regression: 23,034 bytes,
  `7584941562a3498aee57180cff62e574c69eb268266fbdc3e9a4215bf18cec39`.
- Supplemental closure with three USER wrapper exports: 23,355 bytes,
  `b61e581ff93617a4466f5dac8e86daba74af53be997d8ee39123cbdabbcae7b8`.

These are focused compiled closures, not full application modules. Results
and individual mutation module hashes are in `checks.json`. Run
`node scratch/runs/20261020-screensaver-fixed-independent-review/replay.js`
with the retained exact candidate tree and prior sparse preload present.
No binary artifact is required: the bounded closures are rebuilt in memory.

Next validation should use the reconciled full module: cold no-PE startup and
real asynchronous cancellation; actual renderer hit testing, scrolling to
later entries and visible press/release/cancel/focus behavior; native recursive
teardown and all close routes; shell resolution and registered saver arguments;
Preview launching a separate saver, followed by applet Close while the saver
continues, explicitly recording desktop versus single-app mode. Actual DOM
input, shared renderer ownership, GDI repaint and resource cleanup must be
observed rather than inferred from this fixture.

No remote runtime, browser, heavy/full build, assets, deployment, workers or
other game lanes were used. Shared HEAD/index/config and original evidence
were preserved. This worker stops after preserving the report and receipts.
