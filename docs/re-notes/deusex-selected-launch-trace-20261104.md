# Selected Deus Ex launch: diagnostic guard blocked before Launch

No authentic Deus Ex Draw trace was obtained. The single browser attempt
stopped before selecting or launching the game because the run-only error
guard incorrectly classified a generic page-resource 404 as a launcher error.
This was a defect in this run's helper, not evidence of a production emulator
failure or a negative result about native Draw. The guard is corrected and
regression-tested offline. No second browser or reload was attempted.

## Prepared prerequisites and exact identities

This task follows published note `60d7cb911` and observer
`95d489747cec3ce841170681e5db9819019b1d78`. The checkout at task start was
`5747079c8a9615034d75b1d6b016a44fe845b65c`, containing both. The retained
320 individually pinned inputs on `bx_9ffuymfg` were verified and reused
without source or media restaging. Current Git versions of `index.html`,
`host.js`, `lib/apps.js`, `lib/browser-shell.js`, `lib/guest-worker.js`, and
`lib/deusex-draw-observer.js` match the retained pins exactly. No historical
Worker substitution occurred.

The staged WASM remains 2,143,712 bytes, SHA-256
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
Original Engine.dll remains individually pinned at SHA-256
`3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`.
Neither binary was loaded during this attempt. Actual loaded Engine module
generation/export-instance identity was therefore **not measured**.

The driver now uses localhost `index.html?debug&candidates&no-log`. Before
Launch it requires the actual selector to contain `deus_ex_demo`, checks
Puppeteer's selection result, and checks the selected registry executable is
`test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe`, without
an executable-bytes override. After launch it checks the host's `_exeUrl`
against that same path. These browser checks were prepared but not reached.

Common `test/binaries/tlbs/stdole2.tlb` was staged from its existing local
path: 15,088 bytes, SHA-256
`db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895`.
The complete attempted manifest has 327 pins: the retained 320 plus that TLB
and six run helpers. The native support-path recipe was reused unchanged.
No save, INI transform, geometry, game configuration, or gameplay input was
changed.

## Tests, attempted browser, and correction

Before Chrome, local and remote tests executed the actual `initAppSelector()`
body and catalog gate from `index.html` in a small DOM fixture. They reject
missing candidates, `prod`, nonlocal URLs, absent actual options, wrong
selection/fallback, wrong executable, and dynamic executable bytes. They
also check that the guard runs before the Launch click and that the shell
uses `apps[select.value].exe` for `wine.loadExe`. These are offline tests,
not proof of an actual selected browser executable.

Remote actual Puppeteer-core 25.7.0/helper imports, all 327 pins, pinned HTTP
isolation/missing/mutated-input negatives, real WorkerLink command integration,
and the published actual-WASM/local-export and owning-Worker observer
fixtures passed before the browser. The observer fixtures use synthetic x86;
they are mechanism tests and are not a native-game trace.

The sole Chrome ran **06:29:57.615Z–06:30:00.694Z**. The helper failed at
**06:29:59.285Z**, at the guard immediately after page readiness. Its initial
error pattern included `Failed to (?:load|launch)`. Chrome emits `Failed to
load resource: ... 404` for ordinary absent page resources, so the guard
failed before any game selection, media request, or collector command.
The refused requests were `/build-info.js`, `/api/auth/user?...`, and
`/favicon.ico`. Their generic console messages do not identify each URL,
so a particular message cannot be assigned to a particular request.

The local helper now excludes generic `Failed to load resource` from the
terminal launch classifier while retaining `ERROR launching`, system-data
unavailability, explicit launch failures, Worker/runtime errors, and crashes.
A regression fixture derived from the recovered console and previous failed
launch proves all this attempt's ordinary page messages pass while the
previous real `ERROR launching notepad` fails immediately. Actual-index
selector/selected-executable negatives and transport tests still pass.
The corrected helper was not run in Chrome or substituted into the attempted
remote manifest. The attempted originals are preserved by their hashes and
recovered helper files; corrected local helpers are separately patched.

The prepared observer integration still sends only real owning WorkerLink
`drawObserver` start/status/stop, with start bounds `maxBlocks:50000`,
`maxMs:1000`, then leaves ordinary scheduling to execute the guest. It reads
actual Worker exports and module lifecycle at event boundaries. None of this
was reached. There is no native Draw/Lock/Unlock/tail/saved-caller evidence,
nor a measured missing native boundary: the first missing boundary is browser
launch readiness due to the overbroad diagnostic guard.

`engineRender` and `viewportPlayer` remain NULL. Lifetime and host-surface
binding remain UNKNOWN. No PNG, blank image, gameplay, GPU completion, or
native return-route success is claimed. No guest writes/calls, forced Draw,
repaint, breakpoint retargeting, gameplay pulses, save edits, or synthetic
native results were used.

## Evidence and handoff

Evidence is in `scratch/runs/20261104-deusex-selected-launch-trace/`: exact
Git SHA, relevant binary diff, owned new helper/note patches, staged references,
prebrowser tests, raw console/served/refused logs, failure and cleanup records,
full SHA-256/size recovery checks, and offline correction tests. Nine closed
artifacts were recovered before 06:31Z; final remote verification at 06:30:44Z
confirmed all 327 attempted pins unchanged and no Chrome or Node driver.
No source archive or media/module evidence copy was created. Only this
useful diagnosis note is a tracked change; no production build was required.

Box **bx_9ffuymfg** is left **RUNNING** (API `idle`, healthy/hydrated), expiry
**2026-11-04T07:19:23.841Z**. Shutdown ownership returns to the coordinator.
No lifecycle operation, allocation, resume, local heavy run, public deployment,
subworker, successor, or Heroes II action occurred. The next separately
authorized attempt should use the corrected guard and complete the prepared
actual-selector/executable checks before ordinary original boot. This worker
stops after publishing the tested blocker.
