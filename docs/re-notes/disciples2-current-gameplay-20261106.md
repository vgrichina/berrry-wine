# Disciples II current gameplay attempt, 2026-11-06

**Harness error before Disciples launched. Current gameplay remains unverified.**
Evidence: `scratch/runs/20261106-disciples2-current-gameplay/`.

The single browser session opened Notepad after an unchecked picker selection.
The reviewed `startup.png` and `terminal.png` show “Untitled - Notepad”, and the
runtime log says `Launching notepad.exe`. No Disciples menu, leader movement,
movement-point change, second ordinary response, rendering owner, logical FPS
or audio quality is qualified. No Disciples guest input was delivered. The
session stopped at this first failure, without a second launch or restart.

The normal `index.html?debug` picker excludes local candidate apps.
`index.html:2176` requires `?candidates` on a local host to include
`LOCAL_CANDIDATE_APPS`; `initAppSelector` applies that policy. Disciples II is
in that local list. The helper called `page.select` but did not check its
returned selection or the resulting DOM value before the trusted Launch click.
This establishes a harness selection failure, not an emulator discrepancy.
No production repair was made and the existing first-click fix was untouched.

Static follow-up also found that `host.js` only publishes
`WINE_WASM_IDENTITY` with `?perf-stream`. The page report was null in this run.
CDP still captured the accidentally launched Notepad Worker: slot 0,
endpoint 1, guest thread 1, 512 MiB, instantiated standard module SHA-256
`ab1ce417568573f42448f031ab6cb4d8c7db0d33adb7727ca97b7e3a5be3a692`.
Its bytecode matches the actual HTTP response and the freshly built module.
This is not Disciples owning-Worker evidence. Disciples `_perfLogicalFrame`
was absent, its raw WinePerf sample ring was empty, and its verifier remains
unconfirmed. Audio is unassessed; no sample or listening claim is made.

The acquisition window was 10:30:44.744960–11:15:44.744960 UTC, including
cleanup, after exact ordered LegacyMip0900, KKnD0905 and GLFog0925 releases
and independent PID/port/profile checks. The trusted Launch was at 10:31:47;
the browser closed at 10:32:22. Source commit was
`b9bb8c5de0bed64af11750dca79113c865ef2289`, with the recorded 63,105-byte
binary diff containing shared VFS work in progress and recorded new-file
patches. The VFS owner froze its four libraries during this run. No source or
media archive was created. All 127 retained manifest files (170,741,632 bytes)
were rehashed against the earlier preflight immediately before launch;
installation and the obsolete installer path were not prerequisites.

Validation: `flock /tmp/wine-build.lock bash tools/build.sh` passed for standard
and compatibility modules. The passive HTTP observer passed streamed 200,
inclusive 206 range, HEAD and deliberate mismatch controls. Browser helper
syntax passed. Those controls did not validate picker membership, and must not
be described as successful launch qualification.

The run-local helper now prepares `index.html?debug&candidates&perf-stream`,
asserts the picker result and actual value before pressing Launch, and retains
early `WinePerf.start({draw:false})`. This correction is source-prepared only;
it was not executed in another browser. Prelaunch and follow-up helper patches
preserve both versions. A separately assigned session must first verify the
selected app and configured metric, then inspect ordinary menus, map movement
against fixed landmarks, movement points and another ordinary response.
Record raw primary/verifier and per-thread counters as verifier-instrumented
correctness evidence, without claiming production throughput. Historical
27.4 FPS remains unconfirmed.

Owned local processes, profile, listener, watcher and runtime holder are released
and independently checked in `final-cleanup.json`. No test boxes were created
or stopped; box ID/state/expiry are not applicable.
