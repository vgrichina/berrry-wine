# Natural Deus Ex Draw attempt: launcher prerequisite failed

No authentic Deus Ex execution or native Draw trace was obtained. The sole
browser attempt stopped before the requested executable booted. No collector
start/status/stop was sent, no original Engine mapping or export instance was
observed, and no Deus Ex media was requested. This is a failed prerequisite,
not a negative finding about Draw or the published observer.

## Exact first missing boundary

The run inherited `index.html?debug&no-log` from
`scratch/runs/20261104-deusex-blank-world-cause/prepare-driver.py` and its
feasible-region driver. On current main, `index.html` defines `LOCAL_DESKTOP`
only when a localhost URL has `?candidates` (without `?prod`). Its
`initAppSelector()` includes `LOCAL_CANDIDATE_APPS` only under that condition.
`apps.deus_ex_demo` exists regardless. Consequently the driver's registry-only
readiness predicate passed while Deus Ex was absent from the actual selector.
The driver did not check the selection result before clicking Launch.

The actual log at 06:24:04.300Z says `Launching notepad.exe...`; at
06:24:04.553Z it reports the missing `binaries/notepad.exe`. The staged input
set also omitted common `test/binaries/tlbs/stdole2.tlb`, producing a preceding
system-data warning. The driver detected stagnant boot state at 06:24:12.099Z
and closed Chrome at 06:24:13.106Z. Its failure detection should have stopped
on the launch error immediately; the intervening polling produced no guest
execution. An operator close request at 06:24:16Z found Chrome already gone
(`ProcessLookupError`); no signal or lifecycle action occurred.

`test-launch-prerequisite.cjs` subsequently reproduces the exact catalog gate
without a browser: the actual URL excludes the candidate, while the same URL
with `&candidates` includes it. It also confirms the missing common system
input. No second browser, reload, gameplay input, save, configuration edit,
guest write/call, forced Draw/repaint, breakpoint change, or synthetic native
result was attempted. No PNG was captured or accepted as gameplay.

## Current observer and staged identities

The staged published source commit was
`c7072e648acf5c7b5c7cd6b3177416ee002a6e3b`, containing observer commit
`95d489747cec3ce841170681e5db9819019b1d78`. Source inputs came individually
from that commit; concurrent unrelated uncommitted rendering changes were
excluded. Exact Git identity, relevant binary diff, per-input hashes and owned
new helper patches are in the run directory. Git is the source archive.

The staged `build/wine-assembly.wasm` was 2,143,712 bytes, SHA-256
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`, matching
the published observer's `tested-source-refs.json`. It differs from the
historical feasible-region WASM (`8459597c…`, 1,898,260 bytes). Current main's
`guest-worker.js` and `deusex-draw-observer.js` were staged and tested; no
historical Worker substitution occurred.

Original installed media was referenced by existing path and SHA-256 and
transferred once directly to the assigned runtime. Engine.dll retained SHA-256
`3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`.
The 117 media inputs total 237,027,108 bytes; no media/source archive or local
evidence copy was made. The source/media staging manifest contains 320
individually pinned inputs, including the small run helpers. Original Win98
support DLL paths follow the feasible-region recipe. The optional count14
save was not used because current-main compatibility was not established.
Existing registry SoftDrv/fullscreen INI transforms were retained unchanged;
the run introduced no configuration changes.

The run-only helper uses the real `wine.guestWorker.link._ask` transport,
requests `{t:'drawObserver',action:'start',options:{maxBlocks:50000,maxMs:1000}}`,
and uses status/stop without driving guest execution. It gates start on a
running owning Worker and an actual LIVE Engine mapping read at that Worker's
JS event boundary. This integration was prepared but never reached in the
browser. Its offline checks did not cover the actual selector prerequisite;
that gap caused this failed attempt.

## Tests and evidence

Before the browser, the assigned runtime verified all 320 staged pins and
passed actual Puppeteer-core 25.7.0 imports, the run-helper imports, and the
shipped `test/test-deusex-owning-draw-observer.js` actual-WASM/local-exports
and actual owning-Worker fixtures. These exercise synthetic x86, including
relocation, call/return order and incomplete/rejected routes; they provide no
original-game native trace.

The actual driver integration test passed transport bounds, start/status/stop
messages, invalid command/owner/reply/start rejection, no guest-executing
commands, and pinned HTTP isolation plus missing/mutated input negatives.
Those tests were insufficient to establish browser launch readiness. The
postfailure offline selector reproduction identifies that gap precisely.
Final remote verification again passed every pin and found no Chrome or Node
process. Ten unique browser artifacts were recovered with full SHA-256 and
size checks, including raw console/boot/served/refused logs, the first failure,
launch identities, registry records and cleanup. No native trace is present.

Evidence: `scratch/runs/20261104-deusex-natural-draw-trace/`. No production
file was changed, so no production build was required. This note is the only
tracked change published by this worker.

`engineRender` and `viewportPlayer` remain NULL. Object lifetime and
viewport-to-host-surface binding remain UNKNOWN. No route return, GPU
completion, world publication, or gameplay success is claimed.

## Handoff

Assigned box `bx_9ffuymfg` is left RUNNING (API state `idle`, healthy/hydrated),
expiry **2026-11-04T07:19:23.841Z**, with coordinator shutdown ownership.
The only browser ran **06:24:01.680Z–06:24:13.106Z** (Chrome 151.0.7922.71);
recovery and process/pin verification completed before 06:26Z. No box
allocation, resume, stop/delete, subworker, successor, public deployment,
local heavy run, or Heroes II action occurred.

Next prerequisite for a separately authorized attempt: validate the actual
candidate selector and selected executable before launch, provision/pin the
common system TLB, and reject launch errors immediately. Then use this same
published observer through the real WorkerLink during ordinary original boot.
This task stops here, preserving the one-browser constraint.
