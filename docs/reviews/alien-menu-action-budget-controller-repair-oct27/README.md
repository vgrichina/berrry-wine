# Alien Shooter menu/action budget repair

The new production CLI `tools/alien-menu-gameplay-controller.py` drives the accepted
real sequence controller immediately from a human-reviewed menu. It reserves
action/evidence time, three captures and cleanup inside an existing supervisor
deadline. Missing approval or insufficient reserves stops before input. The
directory, budget seal, approval/frame identity, verified control-process owner
and durable accepted ledger bind one invocation; repeated approval cannot replay
a possibly issued click, even from a different evidence directory.

The accepted sequence entry point remains SHA-256
`4ae9e957ffdb03c99be55242e796b58e9c482c0b102bebdd571be3ade9e7a17f` and helper
`db75a7f3316be2c919b55423c0275c5e4fe544f5c4b50eed60372d3a98167d39`.
The new CLI imports that entry point and runs its `Controller`/`HttpTransport`,
adding scheduling at the actual accepted send callback and reviewed-batch validation.
It retains step ACK/frozen-zero-credit validation, write-ahead uncertainty,
durable-terminal fail-fast, no retry, no reconnect and one-owner behavior.
The CLI is an executable orchestration path, verified by real subprocesses and
production-compatible local HTTP, rather than a generated plan awaiting wiring.

The historical incident remains unchanged: evidence commit
`247556b558f5c80e23db1fa53577c878aea4fe51`, run
`scratch/runs/alien-accepted-dispatch-menu-mission-oct27/result.json`.
The inspected menu at batch 4722 was followed by an unnecessary 1024 batches and
duplicate menu capture at 5746, taking 19.6748 seconds. The guest ended at
118.14731607 seconds before any New Game send. There is no established resumable
menu-memory checkpoint and no proven guest fault. The archived `package.py` and
three control scripts retain their supplied byte hashes. The offline reproduction
executes unchanged phase/drive/newgame source against fake remote/control boundaries;
it models historical timing rather than executing another guest.

Before/after results:

| Check | Result |
| --- | --- |
| Original duplicate-settle path | 4722 -> 5746, 19.6748 modeled seconds, duplicate capture, terminal refusal, zero New Game sends |
| Approved repaired CLI | first requests snapshot -> one reviewed click, no pre-input step/capture |
| Repaired evidence/cleanup | two post-action bounded steps, three reserved captures, final Quit ACK |
| Actual CLI safety tests | 24 passing cases; exact argv, controlled clock, complete HTTP request/response bodies and persistent receipts retained |
| Unchanged accepted transport unit group | 8 passing tests, including every command boundary/response failure and durable no-replay |

The safety cases include slow startup, insufficient action time, insufficient
capture credits, default missing approval, changed frame, wrong review batch,
bad frozen snapshot, partial step ACK, uncertainty/no replay, terminal before any
control and during connection, budget exhaustion during connection, cleanup
reservation and refusal to renew a previously sealed allowance. The actual send
callback is exercised after socket connection and before HTTP bytes.

Source review found that directory-only ownership would permit another directory
to target the same live guest. Before publication, ownership was extended to the
supervisor-supplied PID/start-tick identity and its verified loopback listening
socket. A boot/process/endpoint registry survives the CLI and spans directories.
New cases reject a second live owner, replay after completion, endpoint spelling
aliases, stale process identities and unrelated PIDs. All 24 affected CLI cases
were then rerun; the earlier 19-case result remains historical evidence. The
unchanged accepted transport's eight passing tests are reused without repetition.

See `test/fixtures/alien-menu-controller/README.md` for the supervisor contract
and invocation recipe. No production fake-clock switch was added. Fixture clock
injection occurs through the test subprocess's Python startup only. A new attempt
must reach and review its menu within 75 seconds, retain at least 30 seconds for
the action/evidence plus 10 seconds for cleanup, and fit the original <=120-second
deadline. This does not authorize increasing or resetting an existing allowance.

Evidence in this directory retains commands, full fake HTTP responses, before/after
receipts, source/fixture manifests, resource measurements and all initial incidents.
The exact test invocations are in `commands.json`; unchanged transport tests execute
the donor test file against the exact accepted files in this task tree. Tests use
one light pool permit and the existing physical 128 MiB process-tree supervisor,
CPU 90 seconds, wall 120 seconds, file 24 MiB, output 2 MiB and excerpt 8192 bytes.
Python executable/limits are recorded; DATA/address space remain unlimited for
Python. No Node execution was needed. Git alone receives DATA 512 MiB and uses
both pool permits, then `/tmp/wine-ops-production-git.lock`, with physical 256 MiB
whole-tree supervision. Trusted SSH configuration is unchanged.

Source recovery incidents: the provided `ca6c2de` ref is absent in the supplied
physical donor. Its actual HEAD and published accepted overlay are `a9d65e0`,
explicitly authorized by the task, and both required source hashes match. A local
fetch attempted traversal of deliberately missing unrelated blobs and failed.
The isolated repository instead uses the donor's standing readonly object alternate
and a sparse index; no bulk checkout, full clone or unrelated tree replacement.
Both original failures are retained. One historical fixture path typo was corrected
before its passing reproduction. One test preflight stopped on disk projection;
the coordinator then replaced the completed 48 MiB Enigma lane with a new 44 MiB
independent lane. Another packaging preflight later stopped 118784 bytes below the
floor without executing a packaging child. At 01:14 the coordinator replaced that
completed peer with a 36 MiB process-ownership repair. Fresh gates use that changed
allocation and its measured materialized lower bound. This task's 44 MiB allocation
and host floor remain unchanged; peer sessions/WAL are not subtracted from its
remaining reserve. Process-owner registry bytes count in this task's footprint.

Offline behavior is qualified; gameplay is not. Independent source acceptance and
task integration remain required before a separately admitted runtime assignment
with exact production closure, fresh resources, supervisor deadlines/capture plan
and actual human frame review. New Game response, mission/gameplay, movement/combat
and normal guest Quit still need real acceptance. Future latency can exhaust an
allowance despite pre-send checks; uncertain/terminal transport cannot be reconnected
for cleanup. The supervisor owns guest termination and box lifecycle. This task
executes no guest, browser, native game, Boat, build, game assets or public deployment.
No box was assigned or queried; the coordinator reports old boxes STOPPED. Claude,
Heroes II ownership, GL provider restriction and all other platform denials remain.
