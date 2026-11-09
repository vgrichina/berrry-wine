# Q2 repaired staged parent-wait offline checks; terminal verification error

Evidence: `scratch/runs/20261109-quake2-staged-parent-wait-guard-progress-1626/`.

Gameplay screenshot, guard defeat and onward-door consequence remain
**UNVERIFIED**. No production repair was made in this task. No remote box,
allocation plan, runtime watchdog, changed native fixture, cancellation fixture
or original attempt was created. The task ends at a concrete verification
failure, not a native qualification.

The worker mistakenly invoked `tools/quake2-browser-owning-binding.test.cjs`
as an additional check without reading its browser-launch implementation.
It starts local Chrome, violating this task's explicit prohibition. It exited
1 with `Quake II canonical PATHHASH build/wine-assembly.wasm`: this historical
test uses the historical default observer and expects `a320d4c8…`; the authorized
current primary is `3e491c08…`. The failed test is not a current-policy native
fixture pass and supplies no authority to repin providers or change defaults.
No test retry, later input/capture, remote allocation or later runtime attempt
followed. There is no demonstrated new production defect to repair from this
historical test failure. The worker reported the mistake immediately.

The test's finally path closes its browser, awaits its process exit and
watchdog exit, then closes its HTTP server. Independent read-only local census
after tool exit found no Chrome processes and port 40955 refused connections.
The empty stdout is not proof. Browser PID, browser separate stdout/stderr EOF
and a persisted browser parent-wait receipt remain **UNKNOWN**. The observed
Node tool exit is 1. `local-browser-mistake-drain.json`, `binding-controls.stderr`
and `terminal.json` preserve the actual failure and limits.

Before that failure, fresh production preparation from `a48191173` passed.
The exact fresh manifest has 742 providers, SHA-256
`014f32cdc8310cde73865a567f04cbbb45389c5a8853eb70d015d52156926e6f`.
Its six additional inputs are the three existing retained hooks and this run's
control/controller/input scripts. No positive provider substitution, broad
repin, old stage-closure invocation or weakened authority check was used.
Canonical EXE, owning Worker slot0/native writes, primary CPU
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`,
compatibility CPU
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`,
policies and existing deadlines were preserved.

The actual generated provision branch passed offline with real provider reads
and hashes, real startup barrier and explicit production
`--consumer-preflight /absolute/run/runtime-pins.json`; only transport/upload
were local. The composed consumer exercised health/fixture/wire/preflight with
Git forbidden and stopped before Chrome. The actual generated launch branch
passed through the production owning caller, actual retained 1645 helper import
and real kernel supervisor. Its Python audit records actual `runpy` file reads
of the declared 961-byte `pipe-wait.py`, SHA-256
`5c67aa36ea6d6c5251129309f0cd532937bf855c5cecec46bb71d63c9804e933`.
Generated-parent, remote-supervisor and caller waits have actual wait receipts
and separate EOF. Kernel reaps are complete, unresolved sets empty and lock
released. The published retained caller direct regression also passed.

The retained local stdin controller passed explicit ready/start and early
refusal checks, with actual waits and separate EOF. Existing actual caller
signal/exit/separate-pipe terminal controls passed, including pending commands,
no replay and normal completion. Consumer-preflight missing-manifest/directory,
omitted/missing/damaged helper, omitted observer and damaged policy controls
passed. Staged provider damage, forged repins, wrong authority/version and
historical default refusal controls passed. The current browser policy unit
suite passed without Chrome. `flock /tmp/wine-build.lock bash tools/build.sh`
passed and both CPU hashes remained exact. These are offline controls only.
An initial run-scoped controller-check quoting error refused at Python parse
time before spawning any child; its stderr is retained and the corrected
controller check passed before the terminal browser-test failure.

The predecessor `bx_y37jnhc6`, UUID
`fd8fb7e6-b84e-4ff0-9ee0-a715bc859c6c`, was independently read through the exact
API as ARCHIVED with normal unforced completed stop
`stop_2175d0a06f9c43a9`. Its 13 unique compressed objects were independently
SHA/size/gzip-CRC checked; physical drain, six actual kernel reaps, two runtime
parent waits and watchdog actual JOIN0/separate EOF were checked. Its generated
outer parent wait remains **UNKNOWN** from the missing helper. This task did
not convert that historical UNKNOWN into a pass.

Runtime order was Q3 first, Redline second, this task third, gated on both final
published releases and independent exact API/drain/watchdog checks. This task
never reached allocation. Redline later released without allocation because
Q3's final publication was absent at its bounded fallback. This task did not
use a queue timeout as permission to allocate. The coordinator's 16:33:30 board steering placed a fresh Redline1634 after
this task; this terminal task does not allocate or hold that lane. Q3's owned
offline repair paths did not intersect this task's production manifest; no peer file was edited.

Evidence uses an exact Git base plus small relevant/run-input patches and
existing media path/hash references. There are no source-tree, game media or
module archives. The board watcher is stopped and actually joined with its
own separate EOF receipt before release. Free `/home` stayed above 1.5 GB at
recorded observations. No agents, workers, deployment, box resume/delete or
messages to external services were launched.

Final task BoxID/state: **NOT_CREATED**. Expiry and stop receipt: **N/A**.
No remote runtime was left billing. All-writers, aliases and ABA remain UNKNOWN.
Next: a separately assigned run must retain the no-local-Chrome restriction,
inspect test implementation before execution, independently verify both queue
releases and exact drained states, then prepare fresh production pins and arm
an observed immutable 25-minute UUID watchdog before its sole allocation.
This worker makes no further attempt.
