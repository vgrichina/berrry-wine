# NFS3 supported builtin controls, 2026-11-17

Ordinary COMCTL32 imports work through the supported builtin path. The fresh
original catalogue and first setup completed, and the second setup painted its
chooser. Its native combo listed Software Renderer and Direct3D Device 1;
selecting Direct3D opened the original unsupported-card warning. The run stopped
at that warning because the reused input helper omitted the reviewed native
button target required by the existing receipt fence. Driving was not reached.

Evidence: `scratch/runs/20261117-nfs3-supported-builtin-controls-driving/`.

Published `013d916c64632243ff0aa768debbbc39870f04d5` changes only
`test/test-init-common-controls-ex.js`. The old test fabricated a native COMCTL32
row and expected its named export to resolve, contrary to the deliberate
builtin-only policy. The corrected test checks ordinary builtin selection,
documented/invalid masks, caller-owned inputs, stdcall cleanup and no native PE
redirect. No production API, loader guard, registry registration or media changed.

Focused checks passed: builtin DLL execution/identity/export policy, actual WAT
GetClassInfoExA/W control procedures, 69 combo-box storage/dropdown/navigation/
selection/paint checks, and corrected initialization ABI/mask checks. The locked
canonical build passed before the explicit test commit and immediate strict
pull/push. An independent final compile selected that published commit with
module SHA-256 `cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`.
Its runtime bytes equal the earlier control module; the only source inventory
difference is the corrected test. Foreign WIP was excluded from execution and
retained separately as binary diffs, not adopted into the runtime graph.

The ordinary registrations were unchanged. Catalogue exported 120 registry
entries, then first setup imported that fresh export and exited zero with 123.
Chooser imported only that first setup export. Existing normal registration
includes DisplayName installation metadata; no new application registry seed,
old chooser import, chosen renderer override, config or media edit was added.
The 135 retained media paths, sizes and SHA-256 hashes matched before and after.

One setup host preparation failed before guest entry: the run-local source
preload reread Git in each host Worker and exceeded the unchanged desktop
startup deadline. The helper then used sealed in-memory source bytes instead;
its complete pin inventory was compared with the published module inventory
before native setup and chooser. There was no second catalogue or second
native first-setup invocation, no source archive and no deadline inflation.

Personally reviewed whole images are `chooser-ready.png`, `chooser-list.png`
and `chooser-d3d-warning.png`. Opening the combo and choosing Direct3D each
returned CONSUMED at the native-input-return boundary and independently released.
Warning OK returned UNKNOWN, handlerApplied true, nativeMessage null, reason
`handler produced no native input edge`. The independently prearmed release
completed and observed left/up/Escape all zero. No subsequent endpoint request,
rebind, replay, game launch or original retry followed.

The reused run-local pointer helper sent no `guard.intent.review.targetHwnd`.
`captureNativeButton` requires that identity to fence synchronous native WAT
BUTTON dispatch. Without it, a handler that produces no queued mouse edge cannot
be confirmed. This is a concrete helper preparation defect, not evidence that
normal imports or the builtin controls failed. Merely adding a target has not
been proved sufficient against this original warning. The existing typed BUTTON
identity/foreign/generation/disabled/deadline/sticky-UNKNOWN unit checks pass.

Own SIGTERM shut down the chooser promptly. Every supervisor's direct child and
watchdog has an actual wait and both pipe EOFs. The chooser's direct child was
the flock wrapper (wait -15): its Node grandchild's separate exit status was not
recovered. Both pipe EOFs, all known runtime PID absence and port refusal are
recorded independently; these do not fill that per-Node wait gap. No native Quit
is claimed. No box was created: ID null, state NOT_CREATED, expiry null, stop
receipt N/A. No worker, deployment, archive or media copy was made.

Setup acceptance, committed Direct3D selection, Controls/transmission review,
Pause, Continue, acceleration, steering, visible speed/road change and native
Quit remain unproved. The final shutdown export still selects Software Renderer
and is not an accepted chooser export. Next work must qualify the existing
reviewed native BUTTON target/receipt route in authored controls before a newly
authorized ordinary original sequence. This terminal session stays closed.
