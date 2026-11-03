# Alice held-phase and relocation prerequisites, 2026-11-03

**STOP: the first native instruction-fault qualification failed.** The task-local
adapter holds ordinary and cooperative-thread breakpoint stops, and the original
DLL passes relocation-aware instruction checks after a real native loader run.
However, a native fault still exits the CLI instead of retaining the earliest
inspectable process/thread stop. Alice was never launched in this task.
`usableForFooting=false`; no coherent authentic ground sample or movement claim
exists. The known unsupported/airborne comparison remains needed.

Exact input source was `8365c62ee8f0f516210a2aafd3253425db5dd334`.
Only this note is committed. All candidate adapters, native instruction fixtures,
commands, logs, original PE/assets, hashes and recovery files are retained in
ignored `scratch/runs/20261103-alice-held-phase-relocation-repair/`.
No production paths changed; no foreign WIP entered the runtime source closure.
There was one worker and one fresh boat, without subworkers or successor work.

## First failing native prerequisite

The failure occurred at **2026-11-03T16:49:59.992Z**, after the preceding
breakpoint and relocation cases passed. A disposable native instruction fixture
loaded the original winmine PE, allocated its own instruction/stack spans, placed
`0f 0b` (`UD2`) at actual guest address `01022a74`, and armed a later `inc ebx`
instruction at `01022a77`. It submitted one four-credit request.

Actual CLI PID **14844**, session
`bc3b3b4e-9ded-4dd5-9f11-ad0dcdff9620`, logged:

```text
*** CRASH at batch 0: unreachable
EIP before batch: 0x01022a74
EIP=0x01022a74 ... ESP=0x01024a78
01022a74  0f 0b  db 0x0f, 0xb
```

The original `RuntimeError: unreachable` and WASM stack are preserved in
`native-fault-cli.log`; they were not suppressed or converted into a successful
boundary. The pending step lost its socket. A subsequent inspection could only
report `ECONNREFUSED`, recorded separately from the original native fault in
`FIRST-native-fault-prerequisite-failure.json`. `native-fault-event.json` retains
the actual instruction address, process/session and first transport consequence.
The focused fault fixture exited1. There was no retry, later fixture, original
opening, route input or extension of a guest deadline after this failure.

The immediate repair boundary is concrete: the adapter calls its hold observer
only after a successful `run()` return. An exception bypasses that observer and
reaches the CLI's existing crash handler, which calls `process.exit(1)`.
A complete observer must latch the original fault and owning instance before
that teardown, park every scheduler admission and preserve pending-credit state,
while retaining the original error as failure. That path is not qualified here.

## Why the retained authentic boundary did not remain held

The prior [authentic capture](alice-tested-poll-authentic-capture-20261103.md)
was reproduced read-only with its retained `reproduce-prerequisite.py` and
receipt29; independent PID/session and archive hashes passed. Its two failures
remain separate: EIP `00453411`/halt1 instead of `00452f63`/halt5, and DLL
`02d40000` instead of original `10000000`. Sticky caller `02dd7aa2` corresponds
arithmetically to `10097aa2`, but establishes no held phase.

`exact-control-source.json` preserves the relevant pinned source extracts and
command order. Commands27–29 were arm-by-eval at batch4104, `step1`, then eval
at batch4105. Frozen credits account **outer batches**, not individual native
`run()` calls. Within a credited batch the ordinary main run is followed by
cooperative worker slices, with as many as three interleaved main runs under
the default four-slice schedule. The native breakpoint sets `bp_skip_once` on
halt; another `run()` at that EIP dispatches the stopped block once. No persistent
scheduler latch connected that native stop to frozen control.

The post-run WASM breakpoint path around `test/run.js:10716` logs/rearms; it
does not await a scheduler hold. In this authentic session the breakpoint was
armed through `exports.set_bp()` by eval, so that action did not itself populate
the CLI's `breakAddrs` array. The original trace preserves subsequent movement
boundary/return instructions, including a boundary with a fresh run budget.
Only at the next control boundary does `finishPreviousControlBatch()` drain the
one credit and resolve the step; receipt29 therefore observes the completed
outer batch rather than the first native breakpoint return.

This explains the missing scheduler hold. The retained trace has no admission
site labels, so it cannot identify whether the first hit was ordinary or an
interleaved main run. No finer historical attribution is claimed.

## Concrete task-local candidate and passing native cases

`cli-adapter.cjs` compiles an exact, hash-checked copy of the pinned CLI in memory;
it does not edit production files. Its task-local ThreadManager transformation
returns immediately when a cooperative native breakpoint is captured, before
another sibling can run. `held-gate.cjs` captures actual exports, registers,
process/session, thread census, batch and pending credits synchronously, then
parks the async caller before later scheduler work. Read-only span captures use
that same instance and epoch. Arbitrary eval, step, input and unfreeze commands
are refused while held; inspection eval exposes only the saved `held` anchor.
Explicit token release disarms once and grants no new credit. Capture errors
retain the earliest breakpoint epoch and error and refuse release.

These are actual x86 instruction fixtures executed by the compiled WASM, not
receipt labels or authentic Alice footing:

| Fixture | Measured result |
| --- | --- |
| Main, PID11005 | `inc eax; jmp` reaches actual `01022a77`, halt5; EAX1/EBX0, batch0 and all four pending credits remain held. |
| Repeated inspection | Three snapshot/eval/read passes preserve registers, thread census and credits; native instruction bytes read `40eb0043eb00ebfe`. Mutating eval and additional steps are refused. |
| Main release | The original request completes exactly four credits; EBX becomes1. Duplicate token release is inert and leaves the exhausted-credit snapshot unchanged. |
| Capture error | A separate breakpoint epoch rejects an invalid span, keeps its original native stop/error and refuses later reads and release. |
| Cooperative, PID13508 | Actual Win32 thread ID2/cache slot1/handle`e1000` stops at `01022a87`, halt5, before the next sibling runs; both live thread EIPs and four credits remain stable through inspection. Release completes the original four-credit request. |

The initial main adapter preceded the thread-target dispatch extension. The
unchanged gate and actual final thread/fault adapter are retained; the initial
main adapter version was reconstructed by reversing the recorded extension.
`adapter-versions.json` states that provenance explicitly: there is no independent
per-execution seal of the initial adapter. The production source and module are
independently sealed. Worker-backed and nested callback scheduling are not
qualified by these cooperative tests.

## Strict original-PE relocation candidate

`relocated-module.cjs` requires the full original file hashes:

- Engine: `61857b521eb7260c28b3ae6960fa8ee18d4d3679b6190f5221131e382e0f3a72`.
- DLL: `42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c`.

It reads the actual process DLL table and parallel lifecycle rows, including
recorded path, live state, generation, image bounds, reservation/capacity and
allocation token. It rejects ambiguous loaded spans and requires a unique
fgame mapping. It compares complete mapped PE headers with the pinned original,
including sections and relocation directory. Original signature bytes must match
their manifests before translating RVAs; expected mapped bytes apply the PE's
individual HIGHLOW relocation entries. Partial relocation operands and unsupported
relocation types are rejected. No preferred-base fallback or blanket byte-delta
normalization is used. Later translations recheck process/session and the actual
mapping row/generation.

The native fixture instantiated the freshly built module, loaded the original
engine, and used the existing `loadDlls()` path for the original DLL, including
its normal DllMain. Actual DLL base was **`01039000`**, lifecycle state2,
generation1; DllMain returned EAX1 and initialization completed. **53 original
signature windows and370 relocated operands passed.** Original
`10097000: b8 00 d2 1c 10` was actually mapped at `010d0000` as
`b8 00 62 20 01`, returning mapped export-table address `01206200`.
This is real loaded-PE relocation evidence, not a synthetic module table.

Eight checks rejected changed DLL hash, wrong process/session, wrong module RVA,
nonexecutable section, invalid cross-section/image span, partial mapped read and
stale process epoch. Actual retirement/reuse of a lifecycle generation was not
exercised; callback provenance, Player allocation lifetime and post-boundary
sample rejection remain prerequisites for complete capture integration.
The accepted selector24/decoder17 proofs and original manifests were reused
unchanged and hash-checked. Their synthetic cases were not relabeled as runtime
ground. The prior `capture-expression.js` and strict decoder were retained but
not invoked against Alice, and a complete relocated live-ground decoder was
not qualified before this task stopped.

## Build, preflight and recovery

Before allocation, the FINAL polling bundle SHA256
`b7aefa122818d5c353e3df59ef03b21081620b342f149530f8abd0cb1ae29410`
passed verification, followed by16 protocol checks, four actual wrapper checks,
and the delayed1.5-second single-submission zero-wait case. No former faulty
runtime wrapper was extracted. All19 original/support/fixture pins, including
notepad and winmine PEs, passed existence, size and full-SHA checks before
allocation and again before build.

The committed source closure was sealed and streamed without foreign WIP. The
boat-side locked full build and keyboard-message-lparam, frozen-stdin-control
and CLI DI-mouse suites passed without skips. The compiled module was2089591
bytes, SHA256 `0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`;
the relocation fixture directly instantiated those bytes. Production source and
original fixture pins matched again during recovery.

Preparation limits are retained. Initial transport identity/template errors
preceded native admission. After build and focused suites passed, the task-host
import checker found an omitted `launch-plan.json`; adding that host file made
the exact import preflight pass without a rebuild or guest-fixture retry. Native
instruction fixture logs warn that winmine's optional original system DLLs were
absent; those fixture programs executed no application APIs. They establish
instruction/control behavior, not full winmine compatibility. The full build
also retains its explicit absent-Git-HEAD API comparison and offline Big5 check.

All **5935 remote payloads** were retrieved and locally checked for size/full
SHA256 before normal STOP. Archive116514442 bytes, SHA256
`b92f8cf42a6150963b7e717119264c91e484e7d9572fe7cf8f2da39a1d567beb`.
`RECOVERY.md`, `archive-verification.json`, `payloads.json` and `SHA256SUMS`
preserve recovery. No PNG was produced by these instruction-only cases, and
there is no new authentic game image.

Own boat **bx_fj5qxw5h**, original expiry **2026-11-03T18:08:59.729Z**;
ID/expiry and original-task delegated normal STOP were recorded before use.
Normal stop `stop_0d2bc64850586acd` completed **16:53:23.697Z**, `error:null`,
`forced:false`. Final info confirms **STOPPED**, completed available snapshot
verified16:53:23.637Z. Own runtime helpers were absent and port8123 closed before
stop. Custody returns to the coordinator. No predecessor/foreign box or process,
Claude pane, other game lane, heldCACA003B or public deployment was touched.
Fixture-only setup writes were confined to disposable native test instances;
Alice PE/assets/config/save bytes were unchanged, with no Alice guest execution,
injected engine call, cheat, map load or movement.

This single task ends at the reproducible native fault-retention failure.
The partial adapters remain uncommitted evidence; only this tested investigation
note is published. Native fault retention must pass before a separately
authorized original opening and coherent supported-ground capture. The supported
sample, allocation continuity and explicit unsupported comparison remain needed.
AUTHOR RELEASE; no successor or runtime reuse.
