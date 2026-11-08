# Browser startup sweep after the COM registry repair, 2026-11-08

Evidence: `scratch/runs/20261108-graphics-post-renderer-repair-sweep/` (ignored).
This investigation exercises actual browser startup after **37ce9588e**.
Recovered serial execution completed all 24 intended browser cells and three
additional Quake II controls. No classified escaped trap, unimplemented API,
guest exit, setup failure or case deadline was observed. Quake III did not
reach its menu, Hexen II stayed at its notice, and Forsaken reached its logo
only. No generic emulator repair was demonstrated or attempted.

## Trigger and tested runtime

The triggering repair is the `host.js` guard around `init_dx_com_thunks`:
`GuestThreadHost.loadPe` initializes on the owning guest Worker;
`WineAssembly.loadExe` imports that identity into its idle page shadow with
`init_thread`, and now initializes locally only when there is no guest Worker.
Previously the shadow replaced the shared registry while the owner retained
its original vtables. Later workers consequently misidentified DirectDraw4/7
creators and returned Surface2 views, rejecting valid 124-byte descriptors.
The [original Redline verification](redline-texture-realization-20261108.md)
establishes that cause, its failing-before/passing-after regression, locked
build and original texture/HUD repair. Those original gameplay observations
are retained controls, not new sweep observations.

The staged Git SHA is `3009948e8e4b224f1ba5f4426410a88d8d03dbe1`.
Its relevant tracked runtime diff is empty; no runtime files changed between
the trigger and this composition. The existing untracked
`lib/wininit-boot.js` is retained as a new-file patch. Git SHA, relevant diff,
trigger patch, exact helper versions and existing-media path/size/SHA-256
references provide recovery; no source/media archive is made.

The standard module is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The repaired `host.js` is 390,094 bytes, SHA-256
`36744b5215a24fd404f7dbb21d613096b2e994b90064e1fd497ca1c5a6acf6e3`;
`lib/guest-thread-host.js` is 76,722 bytes, SHA-256
`2d2df0111426195338f6432b05d278d4d1b880dcdc590d003c04ee39f5b705cd`.
`lib/host-audio.js` remains 211,499 bytes, SHA-256
`e2ae7f782e7fbeb246471acfb3a93d7ae80eec9b195e44f02072310e81373d15`.
Actual loaded identities are checked independently of these staged pins.

## Browser path and bounds

The named union is unchanged from `tools/crash-sweep.js` and the
[post-audio sweep](graphics-post-audio-crash-sweep-20261107.md): Quake II,
Quake III, GLTron, Hexen II, Heretic II and Forsaken. Their existing complete
closures contain respectively 67, 307, 92, 16, 1,826 and 873 paths. All retained
media pins matched before allocation. No guest clock, state, config or media
is edited, and no gameplay input is sent. Heretic II retains the registry's
existing `1998-09-01T12:00:00Z` clock override; the sweep adds no clock override.

The released native CDP browser driver, static server, Worker/module observers,
composited PNG capture and orderly drain are reused with a passive startup
tail. One heavy runtime runs at a time in one fresh box. Registered
`index.html?candidates&threads&app=...` launches exercise actual browser
`GuestThreadHost.loadPe` and `host.loadExe`, rather than the CLI's distinct
boot sequence. `no-threads` cases retain the local initialization control.
Both existing `gl-renderer` and `d3d-renderer` selectors select Software or
WebGL. Actual endpoint/context and software-mode reads determine coverage.

Each case allows at most 60 seconds for setup, observes four five-second
startup intervals once the registered app is running, and immediately requests
a composited PNG. Capture and subsequent diagnostics have separate timestamps;
their overhead is not included in the nominal 20-second observation. Each
browser also has an immutable 100-second cap. The independently detached box
watchdog has an immutable 25-minute deadline, armed before allocation.

The first driver version set only the D3D selector. Owning-context inspection
correctly showed that the two Quake II cases labelled Software still used
WebGL. These are preserved as extra WebGL controls, not software coverage.
The serial parent was stopped without interrupting its active browser; that
browser drained before the corrected observer/selector closure was staged.
`driver-transition.json` and both pin sets preserve the exact transition.
Corrected software cases use unique names and actual software-mode evidence.
No input stream or guest configuration was replayed.

All twelve CLI app/mode cases are deliberately unexecuted here: their previous
native llvmpipe results bypass the changed browser shadow sequence and add no
necessary distinct regression check. Native GL is not substituted for browser
coverage. Hexen II beyond its startup notice remains outside these passive
windows. The known Forsaken initial-black-to-menu behavior and cooperative
GLTron CLI clock model remain documented boundaries; image blackness alone is
not a crash classification.

## Results and shutdown

The first serial's four Quake II executions are retained. Its two named
Software cases actually used WebGL. The corrected serial completed 22 cases:
two actual Quake II software cases plus all four cells for each other title.
One already-scheduled cooperative Quake II WebGL ownership control completed
after that serial. Thus **27 executions cover 24 intended cells plus three
controls**, not 27 titles. No intended browser cell is skipped or unexecuted.
The twelve CLI cells remain deliberately unexecuted. `serial-progress.json`,
`serial-v2-progress.json`, `serial-completed.json` and `q2-owner-completed.json`
retain exact execution identities and return codes.

| Original | All four intended browser cells, personally reviewed |
| --- | --- |
| Quake II | Game/Multiplayer/Options/Video/Quit menu with console text behind. Both wrong-selector originals and the extra ownership control also show menus. |
| Quake III | Three gray guest regions; cooperative WebGL white. No menu reached. |
| GLTron | Colored Game/Video/Audio/Quit menus in all four cases. |
| Hexen II | Accelerated-version notice with OK; undismissed in all four, no GL/world startup. |
| Heretic II | Textured Main book menus in all four cases. |
| Forsaken | Heart/sword logo against black in all four; no menu or gameplay reached. |

Six ordered contact sheets were generated from retained original PNGs and
personally inspected, together with the three additional original Quake II
PNGs. All 27 original PNGs pass CRC/IDAT decoding; guest-region pixel analysis
is separate from crash classification. Raw console, startup logs and Worker
slice diagnostics were inspected. The repeated ole32 fallback warning in
Quake III/Forsaken is retained; it is not an observed unimplemented-API trap.
The first scheduled D3D probe wrapper had a Python string syntax error;
`probe-all.log` preserves it. Its corrected wrapper completed four read-only
probes successfully. This observer correction is not a guest/runtime fix.

Quake III's threaded Software samples progress through EIPs `0x4ab79a`,
`0x41d1e7`, `0x4438b2`, `0x406ca3`; threaded WebGL through `0x406caf`,
`0x4438e9`, `0x4438c1`, `0x456a98`. Cooperative raw slice logs likewise
continue through changing EIPs. Gray/white after this bounded observation is
therefore an unresolved startup checkpoint, not evidence of an escaped crash
or a menu. Observations span 20.004–20.980 seconds including timer delay;
captures and diagnostic overhead have their own timestamps.

`analysis.json` checks 4,766 full HTTP reads, 96 actual loaded-host reads and
27 instantiated standard-module reads with zero pin mismatches. Every capture
keeps the same process/endpoint/Worker/module/epoch/canvas/render-owner across
capture. Each case's applicable page/Worker registry observers agree on the
82-entry registry and DirectDraw4/7 and Surface4/2 identities. Threaded cases
have an actual guest Worker; cooperative cases have local boot. This checks
the repaired boot sequence without claiming every later COM call is covered.

Corrected Quake II, GLTron and Heretic II Software cases retain real software
contexts; Quake III Software contexts are also marked software, although its
sampled threaded CPU software flag is zero during startup. Corresponding WebGL contexts
are observed, with cooperative page reads identifying ANGLE Intel UHD 620/Mesa.
Threaded bridge wrapper `exportsMatch=false` is retained explicitly and is not
substituted for owning Worker identity/context evidence. Hexen II has no GL
context before its notice. Forsaken has a type-20 device but no GL context;
its four read-only D3D provider probes find no live provider except cooperative
WebGL, whose owning exports/memory match but whose context is null and whose
draw/upload counts are zero. Its backend selectors establish requested paths,
not demonstrated active D3D WebGL rendering or backend parity.

The original launcher handle 63066 ended with status 143; its worker/Codex
processes and outer final/result were absent at the first takeover. Recovery
launcher 47080 subsequently also ended with status 143, without an outer
final/result; the assigning owner confirmed its Codex process absent before
this final takeover. Both interruption causes remain unknown. The first
recovery's written note and `final-review.json` are retained as partial work,
not fabricated outer completion reports.
The surviving serial and scheduled probes had already completed normally;
their evidence is recovered without a new box, restart, duplicate execution,
deadline extension or replacement CLI run. No first-attempt success is invented.

`retrieval-final-verification.json` inventories **816 artifact references,
645 unique hashes**; `retrieval-verified.json` independently rereads every byte
before requesting stop. Original logs/captures, actual loaded hosts, both build
modules and per-case module reads are retained. `postflight.json` verifies all
3,788 staged pins and all 27 controllers/Chrome processes absent, listening
ports closed, profiles absent and command directories empty. Chrome exits are
all zero. Existing local media and reused control hashes were rechecked;
`owned-helpers.patch` preserves run-specific helper recovery without source or
media archives. Evidence stays ignored.

The final worker's own `final-recovery-validation.json` independently rehashes
all 816 retained artifact references (645 unique hashes), checks all 27 module
reads and 96 loaded-host identity records against the staged pins, and rereads
51 applicable page/Worker registry observations across the 27 executions.
Within each execution the registry count is 82 and the DirectDraw4/7 and
Surface4/2 entries agree; Surface4 and Surface2 remain distinct. It also checks
raw startup/console/error records separately from pixels and confirms the
retained postflight and stop/delegate receipts. The final worker personally
reviewed the six four-cell sheets and three extra Quake II originals, including
the WebGL renderer text in the wrongly labelled Software captures. This is
validation of the original sweep's evidence, with no new runtime or cases.
All retained artifact paths resolve inside this run. The repository-wide
evidence checker still reports seven unrelated containment errors; its output
is retained in `final-recovery-containment.log` and is not a clean global gate.

Assigned box **bx_2pvtrvvj** normally archived at **2026-11-08T02:27:57.099Z**,
before the unchanged **02:35:34.107Z** watchdog deadline. Final expiry
`archiveAfter` is null (allocation expiry was 02:35:34.266Z).
Stop receipt **stop_4944e2fa8266c2ec** completed at **02:27:57.116Z**,
`forced=false`; `normal-stop-confirmed.json` retains it. Normal and watchdog
delegates exited zero, supervisor remaining children are empty, and the owned
messageboard watcher was stopped. Observed local free disk remained above 5 GB;
remote postflight had 57.97 GB free. No resume, deletion, manual archive or
public deployment was performed.

Retained focused browser-boot, Surface3/DirectDraw4/7 descriptor and sweep
classification regressions pass. This recovery changes only this note and
ignored evidence; it introduces no production code and requires no new build.
Startup survival is not gameplay, equal-scene parity, FPS, audio quality, full
playability or full27 completion. Next work is separately scoped browser
progress/causal diagnosis for Quake III and Forsaken, and ordinary notice
dismissal before qualifying Hexen II graphics; no such input was sent here.
