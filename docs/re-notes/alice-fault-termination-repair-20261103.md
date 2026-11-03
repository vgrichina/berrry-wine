# Alice native fault termination: bounded repair, 2026-11-03

**STOP: cooperative fault identity is still wrong. No runtime code is published.**
The retained candidate repairs the null input queue termination failure and
passes actual main-thread UD2 termination. The next native case fails because
the cooperative owner reports scheduler slot `1` while its native instance
reports Win32 thread ID `2`. Its stack capture also crosses an unreadable span.
Both full build attempts are consumed. All owned production files were restored
byte-for-byte to the input revision; the complete candidate remains in ignored
`scratch/runs/20261103-alice-fault-termination-repair/candidate/`.

Input: **`4ce1e916a1905143b1f20ed691b72544ed840f82`**, committed blobs plus
the explicitly owned candidate overlay. Jedi's concurrent decoder, string,
dispatch and SEH work was excluded. One fresh boat, one worker, no subworkers.
Alice was never launched. `productionReady=false`, `usableForFooting=false`.

## Repair and focused host tests

The [predecessor](alice-native-fault-latch-repair-20261103.md) retained the first
native fault but termination dereferenced `inputQueue.length` when the ordinary
CLI initialization had left that optional `--buttons` queue null. The candidate
keeps this meaningful startup sentinel and extracts host-only cleanup into
`lib/cli-fault-input.js`. It clears optional button/renderer queues, pending and
scheduled input, cross-thread messages, physical/async/pressed keys, modifier
owners, mouse buttons and buffered DirectInput keyboard events. No guest key-up
or native run is dispatched. Production persistence creates an exclusive file,
syncs its contents, closes it, and syncs the containing directory before waking
the failed caller.

Before allocation and again on the boat **before the admitted full build**,
focused tests invoked these production helpers directly. Both null and populated
button queues passed, including absent renderer state, key and DirectInput
release, failed persistence leaving the latch parked, successful retry, duplicate
successful termination without rewriting evidence, and stale identity rejection.
The actual first Error remains primary through failing register/meta/stack
capture, inspection, cleanup and persistence. Duplicate capture cannot replace
it. These are host tests, not substitutes for native acceptance.

## Native results and first remaining failure

| Case | Result |
| --- | --- |
| Main UD2 | PASS: actual native fault through durable input-releasing termination and exit1. |
| Cooperative UD2 | FAIL: owner `tid=1`, native `current_thread_id=2`; stack capture also unreadable. |
| Unarmed main/thread native failures | NOT RUN after the first cooperative failure. |
| Prior breakpoint and original-PE relocation proof | Retained by hash; not rerun or claimed as new acceptance. |

At **17:26:32.775Z**, actual main CLI **PID9459**, process UUID
`8e801654-e2b4-439d-aaa1-016587c3fa05`, generation1, retained
`RuntimeError: unreachable` at **`01022a74`**, path `ordinary`, native thread1.
Original stack includes WASM functions536 and12483. ESP was `01024a6c`, EBX0,
`last_run_halt=0`; a128-byte guest stack was retained. Batch0, four pending
credits and the original previous-batch flag remained frozen.

Three delayed read-only passes preserved registers, census, status and credits.
UD2 bytes stayed `0f0b`, and the later sibling's absolute-memory increment left
its sentinel zero. Eval, input, step, unfreeze, ordinary quit, resume and
breakpoint release were rejected. Wrong PID, UUID, generation and fault token
were rejected. An actual unreadable inspection, two explicit ENOENT persistence
failures and a deliberately closed HTTP connection preserved the original
native error. Inspection after these errors still showed the original registers,
four credits and zero sibling sentinel. Valid termination persisted that original
failure and empty input state, rejected the pending step as `unreachable`, then
exited1. This is failed execution, not halt5 or resumed guest execution.

The next actual CLI **PID9472**, UUID
`1bc948d3-aad3-40d6-8eb5-0eab55efb793`, generation1, retained the cooperative
UD2 at **`01022a84`**, handle`000e1000`, path `cooperative-thread`, at
**17:26:33.385Z**. Acceptance stopped at `1 !== 2`: the capture passes
`thread.tid` (scheduler slot1) as `owner.tid`, while the same retained instance's
`get_current_thread_id()` is2. Existing CreateThread code explicitly distinguishes
slot N from native/Win32 ID N+1. Correctly naming the retained owner is required;
the assertion was not changed to accept the slot value.

The same fault also has `stack=null` and a secondary `unreadable fault capture
span`: ESP`7efffff8` is near the top of its real allocated thread stack, and the
unconditional128-byte capture crosses its boundary. That requires a bounded
partial-stack policy with explicit completeness, not a fabricated fixture stack
or erased diagnostic. Original native error and registers survive the error.

After this first failure, recovery used only status and explicit read-only spans:
UD2 still read `0f0b`, the sibling sentinel was zero, and credits remained4.
Explicit fault termination then persisted the original failure and released input
to retire this owned helper. This is **recovery evidence, not a passing cooperative
qualification**. No remaining native cases were admitted. See
`FIRST-fault-control-failure.json`, `thread-ud2-commands.json` and
`remaining-prerequisite.json` in the recovered run.

Next prerequisites: distinguish scheduler slot from actual native owner ID,
retain valid stack bytes without reading beyond the real stack, then qualify
the full cooperative case and unchanged unarmed native failures. No successor
is performed by this worker. Callback/Player lifetime, retirement/reuse and
authentic ground comparisons remain later work.

## Build, exact inputs and recovery

All committed source blobs, all19 ignored PE/input pins and exact static relative
imports were checked locally before allocation; the complete staged closure was
verified again on the boat. The previously accepted polling gate and relocation/
breakpoint evidence were retained without resubmission. The native suite used
two CLI processes under a300-second outer timeout; it exited1 at the first
cooperative failure. No passing suite was exhaustively rerun.

Build attempt1 was an unadmitted launch: a file checksum changed during candidate
streaming, but the shell continued to launch the baseline build. The worker
stopped its own process group during early gates, before compilation, recorded
the error, and counted it against the two-attempt bound. The corrected launch
requires a verified candidate and successful production host prerequisites.
Attempt2 passed `flock /tmp/wine-build.lock bash tools/build.sh` and all six
focused suites: fault lifecycle, native fault latch, keyboard-message-lparam,
frozen stdin control, CLI DI mouse and thread manager. The build explicitly
records absent-Git-HEAD API comparison and offline Big5 checks.

The2089591-byte module SHA256 is
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`, matching
the prior accepted module. The complete candidate, patch, both modules, source
and fixture pins, native commands, persisted failures, first assertion and all
build/focused logs are recovered locally. All **5926 payloads** passed size/full
SHA256 checks before STOP. Archive117267978bytes, SHA256
`7ad7904a8995d2bfe9d55f03cdad0683f8a7c72adf19c3b82e7168841fe4f827`.
See `RECOVERY.md`, `archive-verification.json`, recovered `payloads.json` and
`SHA256SUMS`; evidence and candidate are ignored, not committed.

**RUNTIME RELEASE was appended17:27:48Z**, before recovery/publication. Owned
production paths were restored and released17:28:23Z, including the shared
callback census for Jedi. No ready runtime change is claimed.

Own boat **bx_gckrwums**, finiteTTL3600, original expiry
**2026-11-03T18:22:00.500Z**, was recorded before use. The original task explicitly
delegated normal STOP after local fullSHA recovery. STOP
`stop_e2d930e28cd958e0` completed **17:28:56.555Z**, `error:null`, `forced:false`.
Final state **STOPPED**, completed available snapshot verified
**17:28:56.489Z**; own helpers absent and port8123 closed. Custody returns to
the coordinator. Disk remained above2GB. No foreign/predecessor boat or process,
Claude pane, HeroesII, heldCACA003B or deployment was touched. AUTHOR RELEASE;
single-task stop, no successor or reuse.
