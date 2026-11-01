# Bounded D3D render-wait crash sweep — 2026-11-01

Stopped at the first unexpected failure: the native x86 continuation fixture
passed, then the mock scheduler fixture failed its peer-progress assertion.
No implementation, tests, helpers or assertions were changed. No reruns or
implementation repair were attempted.

| Original fixture, sequential order | Terminal result | Wall time |
| --- | --- | --- |
| `test/test-d3d9-render-wait.js` | PASS, exit 0 | 4.751 s |
| `test/test-d3d-render-wait-scheduler.js` | FAIL, exit 1, line 31 | 0.069 s |
| `test/test-d3d-render-park-batches.js` | NOT RUN: first-failure stop | — |

Each executed fixture had an outer `timeout 120s`. Neither timed out or exited
by signal. No native crash or unhandled Wasm trap was observed; the failure
was a JavaScript `AssertionError`:

```text
parked renderer does not stall peers
1 !== 2
at test/test-d3d-render-wait-scheduler.js:31:52
actual: 1, expected: 2, operator: strictEqual
```

## Coverage and limits

The first fixture instantiates compiled native Wasm, loads `calc.exe` as its
PE substrate, and executes synthetic x86 CALLs through real D3D9 COM thunks.
Both success and failure completions pass for DrawPrimitiveUP, DrawPrimitive,
DrawIndexedPrimitive, DrawIndexedPrimitiveUP, Present, Clear, Query Issue and
device Release. Assertions check parking, no duplicate submission, polling,
balanced stdcall frames, HRESULTs, deferred unbinding/query effects and owner
retention on failed Release. The GPU host is a protocol double returning a
negative token and controlled completions; it does not render. Clear explicitly
checks that canonical pixels remain unchanged. This establishes actual guest
continuation ABI coverage with a simulated completion source, not worker/GPU
pixel coverage or a game run.

The second fixture uses the real JavaScript `ThreadManager` with mocked machine
exports and deferred promises. Its mock peer's `runs` counter is 1 where the
test expects 2 after two `runSlice(100)` calls. Earlier assertions for one
render-wait callback and zero parked runs/clears passed. No actual guest module
or worker thread executes in this fixture. Rejection recovery, mock worker
resumption, nested pumping and retained SendMessage-frame scenarios occur later
and were not reached. The assertion alone does not establish a native guest
continuation failure or its cause.

The third fixture, which would exercise actual software-worker draw/Present
continuation and default-versus-legacy batch accounting, was not launched.
There is no general crash-freedom, gameplay or real GPU claim.

## Tested identity and accepted build

Requested baseline: `3f73153cf72477f1a3aa55630533b9dd2431931e`.
Actual test HEAD: `7970860ac3ca524715db48280e43aed612dbfdb3`, differing only in
`TODOS.md` and `ops/STATUS.md`. Node v24.18.1, Linux x86_64.
All 4,462 accepted-build input hashes match before and after the tests.
The 67 observed parent-process read identities remain unchanged; all 44 tracked
identities match the requested baseline. Installed dependency identities are
retained separately in the evidence, without claiming they are git tracked.

Reused the successful locked build recorded in
`scratch/runs/20261101-d3dim-worker-fallback-repair/build.log` and `build.exit`
(exit 0). No build or unrelated fixture was rerun. Primary module SHA-256:
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.

The exact instantiated continuation-test module is retained as
`test-d3d9-render-wait/module-1.wasm` under this run, SHA-256
`d80a00bbe3a70660a052e636175ff3ec4e8358ffef35c6a522ed673028c0ca72`
(2,025,491 bytes). Compared with the primary module, only noncustom sections
3, 7 and 10 differ, consistent with the original fixture's extra functions and
exports. Other noncustom sections match. The scheduler fixture instantiates no
guest module.

## Evidence and bounded reproduction

Evidence root: `scratch/runs/20261101-d3d-render-wait-crash-sweep/` (ignored).
`results.json`, per-fixture `exit.json`, `stdout.log`, `stderr.log`,
`loaded.json`, `node-exit.json`, the module capture, accepted-input checks,
`environment.json`, `loaded-verification.json` and `verification-summary.json`
retain the terminal results and identities. `result.json` marks the stopped
sweep and the unrun third fixture.

Exact recorded commands use the existing read-only evidence observer:

```sh
SWEEP_CASE_DIR=scratch/runs/20261101-d3d-render-wait-crash-sweep/test-d3d9-render-wait timeout 120s node --require ./scratch/runs/20261101-d3d-draw-buffer-crash-sweep/observe.cjs test/test-d3d9-render-wait.js
SWEEP_CASE_DIR=scratch/runs/20261101-d3d-render-wait-crash-sweep/test-d3d-render-wait-scheduler timeout 120s node --require ./scratch/runs/20261101-d3d-draw-buffer-crash-sweep/observe.cjs test/test-d3d-render-wait-scheduler.js
```

The observer records parent file reads and Wasm instantiation bytes and forwards
the original calls. It was reused unchanged; no fixture assertions were replaced.
A future separately authorized investigation can begin with the bounded original
command `timeout 120s node test/test-d3d-render-wait-scheduler.js`; that additional
run was not performed here. The cause and any repair remain unproven.

Disk remained above 2 GB (2,360,016,896 bytes at final evidence verification).
Box ID/state/expiry and lifecycle: N/A; no boxes were assigned or touched.
No held guests, REP diagnostics, browsers, downloads, agents or deployment.
Next: coordinator reviews this failure and separately scopes any diagnosis.

## Scheduler repair — 2026-11-01

The separately authorized repair reproduced the original line-31 failure on
`be2e1b9af902ebc0a8b7761f13bb1d605e39c653`, a documentation-only advance from
`a9d798ad32205ee0a4667182e8f56a8161494e7c`. The cause is stale fixture setup,
not peer starvation. Production `lib/thread-manager.js` is unchanged.

### Contract and exact triggering path

An active cooperative thread with `_dllAttachNotified` unset first enters
`_notifyThreadAttach`. The constructor supplies the default DLL callback runner,
so this creates `beginDllThreadNotification` even with an empty notification
list. `runSlice` advances that operation **instead of** calling the guest's
`run`; completion marks the thread attached. Guest execution begins on its next
turn. Before editing, read-only instrumentation showed both records active:
first slice `threadsRun=1`, `blocks=0`, peer `runs=0`; second slice
`threadsRun=1`, peer `runs=1`. Thus the expected second peer run had actually
been preceded by an attachment turn. The renderer's yield-16 branch continued
past its pending readiness promise on both turns; it did not stall the peer.

The fixture now marks its already-running mock guests DLL-attached. It keeps
the original `peer.runs === 2`, parked-run/clear counts, readiness and rejection
recovery, worker resume counts, and retained cooperative SendMessage assertions.
It also asserts both parked and peer records remain active.

An in-memory attachment-only probe, before tracked edits, passed those early
scenarios and exposed a second stale setup in the previously unreachable nested
callback scenario: `Callback yield target is not a live registered thread`.
The current callback contract requires a registered receiving link and
`scopedThreadSendYield({frameToken, waitEpoch}, finish)`. A raw `clear_yield`
is fenced while a callback frame is retained. The nested mock now registers
its receiver, checks the exact frame/epoch on each scoped call, and fails if
the resolver tries the generic export path. Its existing pending-peer-pump,
zero-premature-clear and one-completion assertions remain. No production
eligibility, readiness or callback ownership checks were relaxed.

### Validation and limits

Commands ran sequentially with `timeout 120s` for each test:

| Check | Result |
| --- | --- |
| Original scheduler before edits | FAIL, original line 31, actual 1 / expected 2 |
| Repaired scheduler, all original scenarios | PASS |
| Original unchanged `test-d3d-render-park-batches.js` | PASS, 1.136 s |
| Supplemental original `test-thread-send-scoped-yields.js` | FAIL during helper construction, 0.052 s |
| Focused actual local + Worker render callback endpoints | PASS, 0.104 s |
| `flock /tmp/wine-build.lock bash tools/build.sh` | PASS, 29.592 s |

The supplemental suite fails before callback execution because its existing
`tools/repro-thread-send-wait-retirement.js` context constructs `ThreadManager`
without options, while the constructor reads `opts.callbackLifecycleTrace`.
That helper was left untouched; no PASS is claimed for that suite. The focused
evidence script instead supplies `{}` options and uses the unchanged tiny Wasm
fixture plus real `GuestThreadHost` local and `WorkerLink` endpoints. Both
paths verify pending pumping, fenced generic clears, preservation of a newer
nested frame after readiness, one readiness call and eventual scoped resume.
This is callback protocol coverage, not native x86 or GPU rendering coverage.

The park-batches fixture's serial default and legacy children both exited 0,
without signals (0.745 s and 0.336 s). Its per-child wall deadline is 90 s and
CLI guard is 45 s; the parent was bounded at 120 s. Default draw-window stats
were one wait and zero skipped batches; legacy stats were zero waits and 39
skipped batches. The original draw/Present completion and legacy-difference
assertions passed. Child stdout/stderr and exit records were retained. Both
children emitted the existing missing-shell32 warning; neither timed out or
reported a native crash or unhandled trap.

Reused the prior native continuation PASS (4.751 s). All 63 retained file-read
identities for that fixture still match; its test, runtime and native sources
were not changed. The mandatory new build produced the identical primary Wasm
SHA-256 `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
No native continuation rerun was needed.

Repair evidence: `scratch/runs/20261101-d3d-render-wait-scheduler-repair/`
(ignored). It includes original reproduction, before-edit contract and
instrumented probes, passing scheduler log, park parent/child logs and terminal
results, supplemental failure, focused endpoint script/results, dependency
hash comparison and locked build log. Disk stayed above 2 GB. Box
ID/state/expiry and lifecycle: N/A; no boxes were assigned or touched.
Next: coordinator consumes this single-assignment result; the supplemental
constructor-helper failure remains a separately scoped issue.
