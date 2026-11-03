# Alice native fault latch: bounded repair, 2026-11-03

**STOP: explicit fault termination still fails. No runtime change is published.**
The candidate retains the earliest real main-thread UD2 fault and leaves it
inspectable, but its input cleanup assumes the CLI input queue is non-null.
The first explicit termination throws `Cannot set properties of null (setting
'length')`. The two-build bound is exhausted. The candidate and complete native
evidence remain in ignored
`scratch/runs/20261103-alice-native-fault-latch-repair/`; all owned production
files were restored byte-for-byte to the input revision before publication.

Input was **`9a6516bbacd02860fdb5e1991b679904a99544b3`**, committed blobs only.
Jedi's concurrent decoder/ALU/string WIP was excluded. This was one task, one
fresh boat, no subworkers and no successor. Alice was never launched.
`productionReady=false`, `usableForFooting=false`.

## Failure and retained candidate

The [preceding held-phase investigation](alice-held-phase-relocation-repair-20261103.md)
preserved actual PID14844's UD2 at `01022a74`: `RuntimeError: unreachable`
bypassed the success-only observer and reached `process.exit(1)`. This task read
and sealed that recovered runtime log. Its retained `cli-adapter.cjs`,
`held-gate.cjs`, main breakpoint fixture and cooperative breakpoint fixture were
reused **byte-identically**, without relabeling receipt tests as native results.
The accepted original-PE relocation fixture/result was also sealed unchanged;
it was not rerun or claimed as new qualification.

The candidate adds a host `native-fault-latch.js`, CLI control/error boundaries,
and a four-line cooperative scheduler change. Explicit arming requires the
discovered process UUID/PID/generation and frozen cooperative control; Worker
mode is refused. The native error is installed before diagnostic reads. Main
calls park before post-run work; a cooperative catch returns before crash
reporting, retirement or another sibling. Original error/stack, owning instance,
registers, guest stack, thread census, batch and pending credits are retained.
There is no fault-resume operation and no conversion to halt5 success.

The candidate protocol is `fault-status`, `fault-arm`, `fault-inspect` and
`fault-terminate`. Only status, inspection, ping and snapshot remain available
after a fault. Eval, input, step, unfreeze and ordinary quit are rejected.
Termination is intended to release host input, persist the original failure,
reject the pending step with that error, and exit1 without another native run.
That last path is **not qualified**: `releaseInput()` clears renderer maps,
then executes `inputQueue.length = 0` when `inputQueue === null`, before file
persistence or scheduler release. The complete candidate is retained under
`candidate/`, with `candidate.patch` and `candidate-pins.json`.

## Actual native results and first remaining prerequisite

| Fixture | Result |
| --- | --- |
| Unchanged main breakpoint fixture | PASS: actual halt5, four-credit hold, repeated reads, explicit once-only breakpoint release and original capture-error retention. |
| Unchanged cooperative breakpoint fixture | PASS: actual target-thread halt5, sibling freeze and four-credit release. |
| Main UD2 candidate | FAIL at explicit termination, after the retained-fault checks below passed. |
| Cooperative UD2; unarmed main/thread failure | **Not run:** the suite stopped at the first remaining failure. |

At **17:08:49.157Z**, actual CLI **PID10821**, process UUID
`aaef5701-dd90-4e01-a211-cd532348a591`, generation1, retained the native main
thread1 fault at **`01022a74`**, path `ordinary`. Original error remained
`RuntimeError: unreachable`, with WASM frames536 and12483. Registers included
ESP`01024a6c`, EAX0/EBX0, `last_run_halt=0`; a128-byte guest stack was copied.
Batch0, all four pending credits and the original previous-batch flag stayed
held. This was a failure, not a breakpoint.

Three delayed inspection passes preserved status, registers, thread census and
credits. Actual instruction bytes remained `0f0b`. A disposable sibling's native
absolute-memory increment remained unexecuted: its four-byte sentinel stayed
zero. Additional step/eval/input/unfreeze/quit and breakpoint-release requests
were rejected. Inspection and termination rejected wrong PID, process UUID or
generation; inspection rejected a wrong fault token.

A real unreadable span produced a secondary inspection error. A deliberately
closed HTTP connection did not replace the original native error. Both attempted
termination paths instead produced the **same null-input-queue TypeError**;
there is no tested disk-persistence-error or successful key-release claim.
Valid read-only recovery after those failures still returned the original
native error, `0f0b`, unchanged registers and four credits. These commands and
their actual responses are in `main-ud2-commands.json` and
`remaining-prerequisite.json`. No later cooperative/unarmed case was admitted.

The failed fixture's SIGTERM did not release the parked gate. After recovering
the live read-only fault evidence, only its own PID10821 was OS-killed to retire
the failed helper, without guest advance. This is recorded separately from the
failed explicit termination in `own-failed-helper-retirement.json`. It does not
qualify production termination. No invalid instruction was resumed.

## Build, input closure and recovery

Before allocation, all15,792 committed blobs were read and size/full-SHA sealed,
all19 ignored PE/input pins passed, and191 exact relative import edges were
checked, including `launch-plan.json`. The FINAL polling bundle full SHA
`b7aefa122818d5c353e3df59ef03b21081620b342f149530f8abd0cb1ae29410`
was verified:16 protocol checks, four wrapper checks and the delayed1.5-second
single-submission zero-wait case passed. No pending command was resubmitted.
The remote source closure was streamed directly from committed Git blobs, with
only the explicitly owned candidate overlay. All source/input pins and exact
imports passed again before build.

Build attempt1 stopped before compilation at the required whole-file callback
ownership seal. The four-line scheduler delta was reviewed and its seal updated,
retaining ownership as pending. Attempt2 passed the locked full
`flock /tmp/wine-build.lock bash tools/build.sh`, keyboard-message-lparam,
frozen-stdin-control, CLI DI-mouse and thread-manager suites without skips.
The build retains its explicit absent-Git-HEAD API comparison and offline Big5
check. Native fixture budget: **three processes used**, maximum30; suite
deadlines300seconds. Two build attempts total; no further build or native retry.

The2089591-byte WASM SHA256 is
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`.
Both modules, candidate/source hashes, all original inputs, commands, errors,
build/focused logs and actual fixture results were recovered locally. All
**5939 payloads** passed size/full-SHA checks **before normal STOP**. Archive
117332948bytes, SHA256
`f14771531955590bfb752548c970343a2f5aabdd0b57cc4f059a5ea28904685a`.
See `RECOVERY.md`, `archive-verification.json`, recovered `payloads.json` and
`SHA256SUMS`. Evidence remains ignored, not committed.

Own boat **bx_74kksjy9**, finiteTTL3600, original expiry
**2026-11-03T18:02:12.159Z**. Identity, expiry and original-task delegated normal
STOP were recorded before use. STOP `stop_df57295b0bd2ad32` completed at
**17:11:40.727Z**, `error:null`, `forced:false`. Final state **STOPPED**, completed
available snapshot verified17:11:40.653Z; own helpers absent and port8123 closed.
Custody returns to the coordinator. No foreign/predecessor boat or process,
Claude, HeroesII, heldCACA003B or public deployment was touched.

Next prerequisite is concrete: handle absent CLI input queues during host-only
fault cleanup, then qualify successful persisted termination, cooperative native
fault ownership and unchanged unarmed failures. This task does not authorize
that successor. Callback/Player lifetime, actual retirement/reuse and authentic
supported/unsupported ground comparisons remain later work. There were no
Alice guest writes, injected engine calls, opening/route execution or gameplay
claims. AUTHOR RELEASE; single-task stop, no successor or reuse.
