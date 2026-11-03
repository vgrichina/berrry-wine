# Alice cooperative native fault ownership and bounded stack capture, 2026-11-03

**Full tested candidate retained; no production code published.** All four
actual CLI/native cases pass, including cooperative UD2 and ordinary unarmed
failures. Publication is blocked by this worker's input admission error: the
ignored external `pngjs` package was missing from the preallocation pins and
staged closure. Its import edge was inventoried, but its bytes were not pinned.
A subsequent exact local-package transfer repaired the environment and every
focused/native check passed. That does not retroactively satisfy the original
requirement to verify ignored imports before allocation. Acceptance is not
weakened. All eight owned production/test paths were restored to exact input
**`a441d1912a9c80d8a6d7457735c3c18815b13f7b`**; new candidate-only files were
removed after preservation. The complete candidate and patch remain in ignored
`scratch/runs/20261103-alice-cooperative-fault-owner-repair/`.

The [predecessor](alice-fault-termination-repair-20261103.md) retained the original
native Error and passed main UD2, but its first cooperative case reported slot1
as native thread ID2 and lost the stack diagnostic when a128-byte request
crossed the mapping boundary. Its retained candidate, actual first failure,
main proof and accepted breakpoint/relocation evidence were read and hashed.
No Alice executable was launched here. This is not original-game or gameplay
acceptance, nor general callback lifetime/retirement qualification.

## Candidate change and production helper tests

The candidate retains the predecessor's nullable input-queue cleanup and durable
termination. Cleanup releases physical/async/pressed keys, modifiers, mouse
buttons, buffered DirectInput events and pending/scheduled/cross-thread input
without guest dispatch. Exclusive evidence creation syncs the file and its
parent directory before waking the failed caller. Persistence failure leaves
inspection and explicit retry available; the actual first Error remains private
and is used to reject the pending command.

Cooperative capture now passes `schedulerSlot` and the actual thread handle,
without reading a diagnostic getter before retaining the native Error. The
retained faulting exports object supplies the native register snapshot and
`owner.nativeThreadId`/`owner.tid`; `owner.schedulerSlot` remains separate.
A WeakMap assigns an instance identity to that exact exports object, which is
retained for read-only inspection. The thread census explicitly reports both
scheduler slot and native ID. The reviewed host census seal changes no callback
lifetime assertion; ownership remains pending.

Stack capture reads a bounded contiguous prefix through the production byte
translator, stopping on the first unreadable byte. It reports address,
`requestedLength`, `capturedLength`, `complete` and actual bytes, with a secondary
stack diagnostic. An unreadable ESP still leaves explicit zero-capture metadata.
No thread fixture stack was fabricated or substituted. Requested inspection
spans retain their existing strict all-or-error behavior.

Before allocation, cheap production-helper tests passed first-error retention,
duplicate capture, stale process/generation/token rejection, nullable input
cleanup, persistence failure/retry and duplicate successful termination. New
helper regressions passed0/8/128-byte readable prefixes, exact faulting exports
identity, distinct slot1/native2 and stopping at the first invalid byte. These
host tests are separate from the actual native cases below.

## Actual native results

One300-second outer suite ran four actual CLI processes using the retained
isolated winmine adapter. All passed:

| Case | Result |
| --- | --- |
| Armed main UD2, PID9182 | Native thread1, slot0, full128-byte capture; original failure persisted, input released, exit1. |
| Armed cooperative UD2, PID9194 | Native thread2, slot1, handle000e1000, valid8/128-byte partial capture; original failure persisted, input released, exit1. |
| Unarmed main UD2, PID9203 | Existing crash report retains `RuntimeError: unreachable`, exit1. |
| Unarmed cooperative UD2, PID9212 | Existing thread retirement; four credits complete, sibling sentinel becomes1; ordinary quit exits0. |

The cooperative fault at **17:40:38.658Z** has process UUID
`c420b699-9da4-4875-a758-f80781b96835`, generation1, retained instance identity
`d9a751bd-f2c2-4947-940a-d756e2e41c9c`, path `cooperative-thread`,
EIP`01022a84`, ESP`7efffff8`, native `current_thread_id=2`, EBX0,
`last_run_halt=0`. Its real mapped stack contributes8 bytes
`0000000000000000`; requested128, captured8, completefalse. The secondary error
is `unreadable fault capture span`; the original `RuntimeError: unreachable`
and WASM stack remain primary. The census matches handle000e1000/slot1/native2
and sibling handle000e1001/slot2/native3.

Both armed cases passed three delayed read-only inspections with stable
registers, stack, census, batch0, four pending credits and previousRantrue. The
later sibling store stays zero and the actual fault instruction stays `0f0b`.
Eval, input, step, unfreeze, quit, resume and breakpoint release are rejected.
Wrong PID, process UUID, generation and token are rejected. Unreadable
inspection, two ENOENT persistence failures and a dropped HTTP connection cannot
replace the first native Error or resume execution. Valid termination persists
the original fault and empty input state, rejects the outstanding step with
`unreachable`, and exits1. These lifecycle boundaries were retested because the
candidate's capture schema and ownership changed. Existing breakpoint and
original-PE relocation proofs were reused by hash; neither was resubmitted or
claimed as new acceptance.

## Build, admission error and recovery

All15,795 committed blobs,19 ignored PE/input files and191 relative import edges
were verified locally before allocation. The production source superset staged
5,853 files from exact committed blobs plus owned helper files, excluding foreign
WIP. Source, fixture and candidate hashes and relative imports were verified on
the fresh boat before the build. However, that check did not require the
inventoried external `pngjs` package to load: the preallocation/staging proof
was incomplete, as stated above.

A first launcher submission refused before starting any build because the
verified staging receipt existed only locally. The repaired staging helper
writes the remote receipt, and the launcher rehashes all candidate/fixture pins
before Popen. Exactly **one full build** ran, below the two-attempt limit:
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Its absent-Git-HEAD API
comparison and offline Big5-check limitations remain explicit in the log.
The2,089,591-byte module SHA256 is
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`,
matching the accepted predecessor module.

The first frozen-stdin focused test failed `renderer is unavailable`; an actual
renderer import identified missing `pngjs`. Exact local package bytes were then
hashed, transferred and verified, and actual canvas/renderer imports succeeded.
The failed focused test and remaining focused tests were run successfully.
All six final focused suites passed: fault lifecycle, native fault latch,
keyboard-message-lparam, frozen stdin control, CLI DI mouse and thread manager.
Native acceptance followed only after these passed. See
`renderer-prerequisite-failure.json`, `external-import-pins.json`,
`renderer-import-fixed.json`, `prelaunch-refusal.json` and the retained logs.
The next admission must include this external package before allocation and
must fail staging if it cannot actually load the renderer. This worker creates
no second boat or successor to repair its retrospective admission gap.

`RUNTIME RELEASE` was appended **17:40:49.098123Z**, before recovery or
publication. The full candidate, patch, source/fixture/external pins, two wasm
modules, all focused/native logs, command transcripts and persisted faults are
local. All **5,954 payloads** passed size/fullSHA checks before normal STOP.
Archive117,475,325bytes, SHA256
`acd20389a0fd4deccbd8d1b441b4082e512798d10c8eaab0bc1ad0394218cae0`.
See `archive-verification.json`, recovered `payloads.json`, `candidate/`,
`candidate.patch`, `production-restored.json`, `result.json` and `RECOVERY.md`.

Own fresh boat **bx_ngsxsp7f**, finiteTTL3600, original expiry
**2026-11-03T18:37:49.327Z**, was recorded before use. Original-task-delegated
normal STOP followed full local SHA verification and confirmed absence of
helpers/port8123. Stop`stop_218820dc8768d300` completed17:41:16.690Z,
`error:null`, `forced:false`; actual **STOPPED** at17:41:16.670Z, completed
available snapshot verified17:41:15.558Z. Custody returns to the coordinator;
there is no active expiry. Disk remained above2GB. No foreign/predecessor boat,
Claude pane, HeroesII, CACA003B or deployment was touched. Single worker,
no subworkers. AUTHOR RELEASE; single-task stop, no successor or reuse.
