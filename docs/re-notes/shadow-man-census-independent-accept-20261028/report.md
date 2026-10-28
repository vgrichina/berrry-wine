# Shadow Man independent census acceptance — 2026-10-28

**ACCEPTED, bounded SOURCE INVENTORY ONLY.** Independently reviewed correction
`fa9f8069936a16093896ddb07ca6b4c85b1ead5e` against production source
`2e6f5984d3f64d7781fb02da09bbb8d564302123`. The correction legitimately removes
the stale callback-census prerequisite barrier for this source. It does not
establish callback ownership, the zero-transfer writer, compiled correctness,
or game acceptance. It can unlock consideration of a separately admitted
canonical build; this task neither authorizes nor executes that build.

## Independent evidence

The first behavioral operation ran the actual unchanged production CLI
`/usr/bin/node --max-old-space-size=320 tools/callback-ownership-census.js`
with the original production revision checked out. It exited 1, with exactly
eleven diagnostics identifying six changed and two unknown producers. Then the
same CLI at the corrected revision exited 0 with 410 boundaries. Both raw
results are retained under `operations/`. There was no manually assembled
scanner, altered production runner, or predecessor wrapper execution.

The new independent test passed 80 rejecting controls: unknown producers,
body/hash drift, unsupported ownership assertions, invalid lifetime categories,
missing provenance, changed targets despite refreshed body hashes, and ten
removed helper guards. It also checks source-derived ordering and helper
effects independently of matching hashes. Six existing records changed, two
were added, 402 are byte-for-byte identical as JSON records, and every record
still says `ownership: pending`. The unchanged-record ordered JSON digest is
`e96c36ff6100a06772327c9f52b090523df02d1b65e0269b3282beb0e4f6c430`.

`input-pins.json` seals 276 input files, including the actual scanner, parser
loader/stages and complete production scanner source closure. `reconciliation.json`
verifies all eight predecessor review records against before/after inventories
and records the correction's changed-path list: no production source or scanner
changed. It pins inherited passing groups without rerunning them. The inherited
existing-controls heap-flag deviation remains supplementary evidence only.

## Actual contracts inspected

| Producer | Independent source and lifetime assessment |
| --- | --- |
| `$th_ret` | `guard16`, one ESP/word load into locals, kind-2 snapshot, then EIP from that same `$ret`; ESP advances by 4, followed by diagnostic `cs_pop` and existing `branch_end`. |
| `$th_ret_imm` | Same ordering with kind 3 and ESP increment `4+op`. No owner acquisition/release or inference of the guest word's writer. |
| `$th_pop_run_ret` | Preserves `stack_run_pop` early return before `guard16`. Fast `sr_delta` or `gl32` load supplies the same local used in kind-4 snapshot and EIP. ESP becomes `cur+4+imm`. |
| `$win32_dispatch` | Existing hook/return EIP targets and resource-pin/API-depth scope remain. Deferred unload clears diagnostic kind before its possible redirect. This is existing mixed dispatch, with pending lifetime ownership. |
| `$win32_dispatch_inner` | CACA0005 sets `handler_set_eip`, records kind 1 with current thunk and marker, then sets EIP to zero and returns. No new stack pop. Existing targets are unchanged. Caller restoration remains the enclosing synchronous caller's responsibility. |
| `$run` | Entry invalidates kind and thunk flag before initializer/service calls; zero handling checks correlation before the diagnostic event, and each nonzero iteration invalidates again. Explicit Win32 thunk dispatch brackets its entry flag. Existing auto-pop target, saved budget/start/API-depth behavior remain. The category is the existing `host-entry`. |
| `$null_transfer_record` | Mode-2 enable guard, invalidation before target/route rejection, nonzero-target rejection, and kind-1 thunk-entry/EIP equality guards precede capture. Reads supplied return word/address and predicted post-ESP, current validated invocation token/root and modal state. Publishes kind last. Writes diagnostic globals only. |
| `$null_transfer_check` | Mode guard followed by count, sync-depth, token, root and post-ESP mismatch invalidators. Its sole direct call is `invocation_current`; it writes diagnostic kind only. |

The two additions are conservative inventory boundaries because they call
`invocation_current`, not previously missed guest dispatch paths. Neither has
EIP writes, guest stores, indirect/tail dispatch, host callbacks, or owner writes.
`invocation_current` calls `invocation_validate`, then reads its token slot;
validation can trap on root/thread/epoch/slot mismatch but neither function
acquires an owner. The `context-restore` category is an existing inventory enum;
the renewed prose explicitly says these helpers do not restore a context.

The diagnostic record is one mutable record per instance. A nested `run`
invalidates it rather than retaining an outer attribution. A returning nested
operation can leave a record only subject to later invalidation and token/root/
depth/count/ESP correlation; this review does not prove arbitrary host reentry,
unobserved ownership transitions, races, or all transitive `branch_end` behavior.
Fields other than kind are not attributable when kind is zero. Correlation and
matching hashes cannot prove who wrote a guest zero word or retained a callback.
The scanner enforces pending ownership and supported categories; semantic truth
of human review prose still requires source review, not automatic hash refresh.

## Resource and operation scope

Actual worker PID 1973461 was identified by executable plus `exec --profile
wine-worker`, model `gpt-6.1-sol`, medium effort, total compaction 200000.
Initial MemAvailable was 3,215,962,112 bytes; three actual production client
RSS baselines are preserved. The task uses 64 MiB storage including 8 MiB
reserve; two other 64 MiB reservations and the 2,982,150,144-byte projected
free-disk floor were retained. The post-test checkout was sparsely reduced;
recovery expands exact pinned inputs before rerunning the test.

Successful startup records the exact `/usr/bin/node`, 320 MiB old-space flag,
environment and inherited limits. The heap flag is not a total RSS cap. Child
operations use 90 CPU seconds, 120 wall seconds, 512 MiB sampled process-group
RSS plus aggregate client growth, 2 MiB captured output and 1 MiB non-Git file
limits. Git alone receives 256 MiB RLIMIT_DATA and its file exception. Python
current RSS is bounded at 128 MiB. No DATA/address-space cap was applied to
Node, the shell, Python or the Codex client.

Original/corrected scanner sampled child peaks were 367,026,176 and 366,780,416
bytes. Reconciled observed child-plus-client-growth bounds were 370,327,552 and
370,970,624 bytes, below 512 MiB. Independent controls peaked at 119,713,792
child bytes. These are sampled observations, not exact unsampled peak proofs.
The initial monitor used per-operation client baselines; the retained growth
reconciliation adds growth from the initial actual-client baseline. Later
operations directly use that initial baseline. This limitation is distinct
from source correctness and is not hidden by rerunning passing groups.

Incidents are preserved: an initial broad terminal read exceeded the requested
terminal output bound; a startup supervisor falsely stopped on Python's
inherited historical RSS high-water mark, then was corrected to current RSS
without raising a limit; the independent harness initially expected run's
category to be mixed-dispatch rather than its legitimate unchanged host-entry,
then passed after that assertion correction. No production correctness
counterexample was found, and no failure receipt was promoted to success.
No whole-task all-operation resource-compliance claim is made. The first staged whitespace check also detected Git init advisory trailing spaces; that unchanged raw log is retained losslessly as init.stderr.gz, and the final staged check passes.

The canonical mount parser accepted an enumerated tree-control containing
`comma,bearing.txt`. Actual filename-bearing runtime mount argv is empty:
no runtime operation was assigned or performed. Strict configured GitHub SSH
is used for publication; no trust files or credentials were changed.

## Remaining gates and handback

Historical `61e1ea2d` remains **REJECTED**. Writer **UNPROVEN**. Callback
ownership **PENDING**. Full module, compiled ABI, native engine behavior,
original-game execution and gameplay remain **UNQUALIFIED**. The previous
canonical build failure before compilation remains an unchanged historical
failure. No build, native, guest, browser, Boat operation, worker launch, main
integration or public deployment occurred here.

A later admitted canonical build must qualify the actual final source and
compiler closure. Compiled ABI/native checks and original-game first-zero
capture still require separate execution evidence and admission. Actual
callback ownership requires invocation/lifetime instrumentation and rejecting
reentry/dual-entry controls; writer attribution requires evidence at the writer.
Inventory acceptance substitutes for none of these requirements.

No box is assigned. Predecessor `bx_k4htahnf` remains recorded stopped at
2026-10-28T21:05:09.614Z, without this task querying, resuming or changing it.
Coordinator retains lifecycle ownership. This single bounded task stops here.
