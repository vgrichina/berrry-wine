# Alice pending receipt repair, 2026-11-03

The task-local reader/writer protocol is repaired and tested. **Authentic ground
capture remains unqualified (`usableForFooting=false`).** The sole original
attempt stopped at a host completion-wait timeout during startup. There is no
New Game/Easy selection, natural story opening, Player sample, footing,
thermal crossing, knife acquisition, attack or target-effect claim.

Exact runtime source input was `c82f3efd2cbb9f2a89f8b9a586dba89e670f9863`.
Only this note is committed. Helpers, tests, receipts, original recovery inputs
and captures remain in ignored `scratch/runs/20261103-alice-pending-receipt-repair/`.
No production code or original guest/config/asset bytes changed. The stopped
predecessor `bx_n87rcq58` was untouched; no other worker or box was used.

## Repair and tests

First, the unchanged predecessor `reproduce-first-error.py` reproduced the exact
missing `startup_more-request.log` read with a pending receipt, without a guest
or boat. The original reader required a log that `commands-local.py` wrote only
after its subprocess completed. That cause belongs to the retained task helpers,
not production control RPC or the engine.

The new small `receipt_protocol.py` provides explicit pending/completed/error
states. The writer claims labels exclusively, creates its log before execution,
and atomically publishes pending and terminal status. The reader treats absent
completion/log files as pending; incomplete response bytes remain pending while
the writer is active. Completed malformed/error responses, missing completed
receipts, writer nonzero exits and writer timeouts fail closed. Label validation
precedes path access. Finite waits report timeout, never success. The command
sequence stops on writer failure and never retries a request.

All16 cheap checks passed **before boat allocation**: missing pending log, log
creation, partial-response/completion race, valid completion, malformed/error
terminal responses, illegal labels, bounded timeout, writer failure/timeout,
missing completed receipt, valid subprocess publication and duplicate rejection.
Before guest launch, initial pending-status publication was tightened to use an
exclusive claim plus atomic status replacement; the same16 checks passed again.
This and detaching the bounded writer were the only prelaunch helper revisions;
`helper-supplement.json` records old/new hashes and the updated helper seal.

A wrapper gap then became evident: `get-local.py` had routed even a zero-wait
poll through the completion-wait function. After ending this attempt, it was
corrected so its default nonwaiting poll calls `read` and returns pending with
exit0; an explicitly requested positive completion wait still fails on timeout.
Four additional host-only tests execute the actual wrapper-generated remote
reader code: pending/default poll, valid completion, malformed terminal failure,
and positive-wait timeout failure. Final protocol16 and wrapper4 checks pass.
These checks are host fixtures, never runtime ground-observer qualification.

Reproduce the retained repair checks from the repository root:

```sh
python3 scratch/runs/20261103-alice-pending-receipt-repair/test-receipts.py
python3 scratch/runs/20261103-alice-pending-receipt-repair/test-get-wrapper.py
```

The final repaired helper bundle and its full-SHA manifest are retained alongside
`RECOVERY.md`. `reader-repair.tar.gz` SHA256 is
`b7aefa122818d5c353e3df59ef03b21081620b342f149530f8abd0cb1ae29410`;
its11 helper/recovery payloads passed full size/SHA verification. The remote runtime archive preserves the actual earlier reader
used during this failed attempt; it must not replace the final repaired wrapper.

## Exact first failure and bounded outcome

At **15:35:57.082–15:35:58.113 UTC**, boat command
`cmd_tlq5iqk4gl3x` executed `get-local.py startup 1`. I selected an inappropriate
**one-second completion wait** for the in-flight400-credit startup request.
The reader returned `done:false`, `state:timeout`,
`error:"bounded receipt wait expired"`. This is retained as the first host
observation error, not reclassified as success or an engine/RPC failure.

The already-submitted startup step ran **15:35:57.062600–15:35:59.985259 UTC**
and completed all400 credits. Its pre-submitted read-only snapshot and PNG
finished afterward. No additional execution credits, key/mouse commands,
breakpoint or eval followed the failure; no repair/retry or second launch was
used. The ordinary-stop marker was submitted at **15:36:18.957490 UTC**.
Original supervisor/game PIDs **7645/7646** exited normally with guest exit0 at
**15:36:19.101252 UTC**, after **30.567660 seconds**.

The complete ledger is five gap-free commands: snapshot, step400, snapshot,
PNG, supervisor quit. All native replies succeeded; there were no held keys.
The startup PNG was personally inspected: a gray640×480 canvas, with no menu,
player or support surface. It is a later capture, not the exact timeout instant.

The immutable original limits were1800 guest/1860 outer seconds,400 commands,
ordinary100000 block budget from startup, and200ms frozen tick. Session was
`0a75c6cf-918a-46b6-9e94-0b7af269ac37`; start15:35:48.533591 UTC,
guest cutoff16:05:48.533591, outer cutoff16:06:48.533591. Process start ticks,
boot ID, parent/command line, control-ready log and loaded module anchors are
retained. Neither deadline nor budget changed.

## Build, qualification boundary and recovery

The boat-side locked build and native keyboard-message, frozen-CLI and DI-mouse
focused checks passed, without skips. The streamed build closure contained5863
sealed inputs from committed Git blobs plus owned helpers, excluding foreign
WIP. The fresh AST dependency closure retained119 files,243 edges and three
reviewed dynamic requires. The final strict-import/intentional-absent-EXE
preflight passed without guest/Wasm execution. All241 final pins passed again
after exit; original15/exact14 mappings and the pinned Minesweeper fixture were
preserved. Existing build limitations remain explicit: no Git HEAD for the
append-only API comparison, and offline Big5 header/invariant validation.

Actual compiled **and instantiated** module:2089601 bytes, SHA256
`43a4937f568fbbd7549fe0a7f2559da2556c99e1e8903cfcb4edf9712cba69fd`.
Its change from the predecessor follows the requested newer exact source input;
no predecessor module was substituted. Original engine/DLL hashes remain
`61857b521eb7260c28b3ae6960fa8ee18d4d3679b6190f5221131e382e0f3a72` /
`42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c`.

The accepted engine-selector24 and ground-decoder17 offline proofs were reused,
not rerun as runtime qualification. The capture expression and strict decoder
remain unchanged. Native post-movement `00452f63` was never armed/captured;
module/client/qport/record/state/contact/generation identity, coherent neutral
support and ordinary unsupported comparisons remain unproven. No pointer-only
or synthetic observation was promoted to footing. The guarded plank/thermal
trajectory was never entered.

All285 remote archive payloads were retrieved and fully SHA256-checked locally
**before normal boat stop**, including original inputs, runtime module, build
logs, command receipts and capture. Archive86700423 bytes, SHA256
`5eee61cde101002b025d9e329ce41b15c5eba07828f9b20de7f9dd205b976442`.
`archive-verification.json`, `download-verify.py` and `RECOVERY.md` preserve the
safe regular-member extraction and complete per-payload verification recipe.
Original processes/request helpers were absent and8123 closed before stop.

The next separately authorized attempt must use the final repaired polling
wrapper and qualify the synchronous native capture before any footing decision.
This worker launches no successor and does not reuse the failed attempt.

Own fresh boat **bx_9xp8h9nj**, original expiry **2026-11-03T17:03:29.050Z**;
ID, expiry and delegated shutdown owner `alice-pending-receipt-repair` were
recorded before first use. Normal stop `stop_cba2181a300ebabf` completed
**15:38:05.461 UTC**, `error:null`, `forced:false`. Explicit final info confirms
**STOPPED**, completed available snapshot verified15:38:05.401 UTC. Custody is
returned to the coordinator. No resume, second boat, guest writes/injected
calls, cheats, direct maps/saves, browser, foreign cleanup or deployment occurred.
