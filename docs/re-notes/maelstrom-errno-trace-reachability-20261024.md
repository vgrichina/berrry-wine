# Maelstrom zero-record errno capture: offline closeout

The capture's zero records do **not** establish that native `_errno` returned,
that errno was four, or that CheckSockets retried. Offline inspection finds a
statically valid observation address and arming configuration, but cannot prove
that the retained guest actually reached the requested observation boundary.
The cause of zero records remains **unknown**. No networking or emulator repair
is justified by this evidence.

## Concrete reachability finding

SDL_net.dll loaded at `007a2000`, preferred base `10000000`, as recorded in
[raw output](maelstrom-errno-trace-reachability-20261024/guest-output.log).
Thus `10001366 - 10000000 + 007a2000 = 007a3366`; this is a guest virtual
address, not a WASM memory address. The requested numeric PC needs no further
`g2w` conversion. The retained [native disassembly](maelstrom-errno-trace-reachability-20261024/native-0.txt)
has `CALL EDI` at `10001364`, followed by `CMP [EAX],4` at `10001366`.

`--trace-at` observes EIP at block boundaries, not arbitrary interior x86
instructions. That limitation does not invalidate this particular PC: the
historical decoder ends the block after CALL r/m32 and records its next PC as
the return address. The register-call handler pushes that address and transfers
to EDI. A normal native RET restores that address into EIP and enters
`branch_end`. Its debug/breakpoint guard returns to the run loop; the run loop
checks EIP against the breakpoint and halts before dispatching the target block.
Setting a breakpoint does not itself split an arbitrary cached block, but this
target already is a call-return boundary. These are source semantics, not an
observed RET in this guest or a newly verified source-to-module build.

The exact historical runner parses `0x7a3366` unchanged and calls `set_bp` at
batch **36163**, before that batch's main `run(BATCH_SIZE)`, if the export is
present and no `--break` is selected. It also arms existing cooperative thread
instances. Logging accepts batches >=36163 and the first hit when limit=1.
There is only one trace PC; it does not trigger the multiple-address override
to batch size one. The startup pacing **PASS=1000** is reused unchanged.

The first parked observation is batch 36165 with select-return counter zero;
later observations show one, three, and finally 972. This gives post-arm
select-return activity, but not the instruction path after each counted block.
The raw capture has no breakpoint readback, actual `set_bp` invocation receipt,
halt-reason-at-target record or native `_errno` return record. Source-level
eligibility cannot fill those gaps. No late-arm, wrong-relocation or
interior-instruction explanation is established. No single cause is selected.

## Retained capture and failed assumption

The [complete command](maelstrom-errno-trace-reachability-20261024/guest-command.json),
[terminal receipt](maelstrom-errno-trace-reachability-20261024/guest-terminal.json),
[analysis](maelstrom-errno-trace-reachability-20261024/capture-analysis.json),
three raw PNGs and exact preload/observer/capture helpers are retained beside
this note. PNGs are retained without a new visual/playability review. Exactly
one historical guest ran; no second guest, build, browser, native execution or
WASM instantiation occurred in this closeout.

The failed assumption was that a valid static CALL-return observation recipe
would necessarily yield the requested runtime snapshot. It did not. Natural
host exit zero ended the unchanged 42000-batch budget; final EIP `075040f8`,
yield 8, EAX `53000001`, EBP 5 describe a parked select. They do not describe
registers at `007a3366`. Errno, completed select result, CheckSockets caller,
socket-set/timeout arguments at that boundary and selected branch remain null.
The 972 counter is neither 972 Sync iterations nor proof of one invocation.
The previous predicate report is preserved verbatim as `prior-report.md`;
its relative references describe its original bundle, not new execution here.

## Reproduce the narrow offline check

```
node --max-old-space-size=256 tools/maelstrom-trace-reachability-check.cjs
```

Run only after fresh MemAvailable >=805306368, with CPU/wall limits 60 seconds.
The retained `offline-test.json` records the actual command, memory, elapsed
time and exit zero. It verifies 25 byte seals, exact native anchors, translation,
decoder/CALL/RET/breakpoint source excerpts, and executes the actual isolated
runner arming and logging expressions with mocks. Negative controls cover
before/after the exact arming batch, a conflicting break, missing export,
pre-start logging and exhausted limit. These controls execute no guest code.
The excerpts total 5143 bytes and record full-file SHA256, revision, line range,
excerpt bytes and SHA256; raw inputs and historical module/runner identities
are in `capture-input-manifest.json`. The module was not copied or instantiated.

## Observation recipe and recovery boundary

The existing statically valid recipe remains exactly:

```
--trace-at=0x7a3366 --trace-at-start-batch=36163 --trace-at-limit=1
--trace-at-mem=eax:4,esp+0x124:12
```

The retained command fixes every other input, clock, batch budget and mount.
At a verified stop before CMP, EBP is saved select result; u32[EAX] is native
C errno; the three words at ESP+0x124 are caller return, socket-set and timeout.
This is a **static recipe, not runtime acceptance**. No alternative PC is
proven better by this evidence and no second run is authorized by this note.

If a coordinator separately assigns a future observation, first require a
bounded audit immediately around the existing main `run` call: after arming,
record `get_bp_addr()==0x7a3366`, debug guard and unchanged batch size; directly
after run and before renderer/scheduler work, record EIP, last-run halt reason,
breakpoint readback and the select-return counter. Fail explicitly on a missing
export or incorrect readback. Snapshot only on EIP `007a3366` with breakpoint
halt, before resuming. Keep the same 16 memory bytes and one-record limit.
This distinguishes missing arming, absent boundary, and later host-observation
loss; it does not assert any of them already happened. Until assigned and
observed, runtime reachability and zero-hit cause remain unknown.

## Publication, limits and lifecycle

The earlier publication denial is preserved, including the historical ops
result and disk receipts. Actual capacity changed before this task; fresh
combined admission passed at 45049880/67108864 bytes with >2.98GB projected
host free. Full historical/new session and launcher captures, positive SQLite
growth, original remote staging charge, future allowance and 8MiB reserve are
included. Installed tools and readonly inputs retain their separate identities.
No original or donor was changed. The prior exact canonical mount receipt is
retained; this offline task has no mount argv or conditional guest to validate.

Publication is only the assigned task branch, using the supplied dedicated
SSH identity/known-hosts and strict verification; no main merge or deployment.
Task-root publication, diff, final resource and cleanup receipts accompany the
final ops result, which is written last. The append-only board records the
actual commit and remote SHA. The bounded board watcher is stopped at handoff.

No box is assigned. Former box `bx_bac88fes` was confirmed STOPPED by the
coordinator at 10:29:59 in
`scratch/usage-watch/maelstrom-native-errno-stopped-oct24.json`; its former
expiry was 10:47:44Z. No worker box operation occurred; lifecycle remains with
the coordinator. Stop after this tested offline finding and verified evidence
publication; any further observation requires a new coordinator assignment.
