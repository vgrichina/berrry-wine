# Shadow Man immediate zero-transfer provenance, 2026-10-23

**Implemented and offline-tested; native execution remains unqualified.** This
candidate adds one opt-in immediate-transfer record to historical accepted source
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`. It distinguishes an instrumented
native `CACA0005` assignment, a 32-bit guest RET consuming zero, and unknown
provenance. It does not establish the writer in the original captured session.
The original `61e1ea2d` capture remains **REJECTED** by its required event order.
No game repair or acceptance-order change is included.

The diagnosis at `db440558dc58f67c5f026be55ff549a6eec2f8eb` is the input:
the original had an existing modal pump `0x1001c`, pending return `0x4015d4`
(guest byte `C3`), and abandoned earlier Config/OK callbacks. The synthetic
instead opened a modal inside its callback. Matching final state never proved
which transfer wrote zero. This patch supplies a future observation at that
boundary; it makes no new historical causal claim.

Strict SSH [read-only remote context](shadow-man-zero-transfer-provenance-20261023/strict-remote-context.receipt.json)
returned main `32c0b9bcf4cbaeee3102a5944ca905ca9298169a`. Main was not the
implementation base. The private task branch starts exactly at `b41a7c5`;
its object-store alternate reads standing shared objects without changing root
or donor refs/index/files. The only shared write is the append-only messageboard.

## Source and protocol

The [focused source patch](shadow-man-zero-transfer-provenance-20261023/focused-source.patch)
uses zero context (`git apply --unidiff-zero`) and changes only these files:

- `src/13-exports.wat`: bounded instance-local state, before-transfer snapshot,
  first-zero validation/invalidation, existing field accessor extension.
- `src/09b-dispatch.wat`: immediate `CACA0005` writer and deferred-unload
  invalidation.
- `src/05-alu.wat`: `th_ret`, `th_ret_imm`, and `th_pop_run_ret`, using the
  very word already read for the transfer, including fused fast/slow reads.
- `tools/shadow-man-null-capture.cjs` and `tools/shadow-man-null-preload.cjs`:
  opt-in selection and synchronous immutable serialization in the existing
  first-zero record.

The actual CLI `test/run.js` is byte-identical to the base, SHA-256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
[Source identities](shadow-man-zero-transfer-provenance-20261023/source-identities.json)
bind original blobs/full hashes and patched bytes. No producer hashes were
refreshed. No named import/export, opcode table, region declaration, or linear
memory allocation changed. The diagnostic protocol explicitly expands:
`set_null_diag(2)` enables provenance; modes 0 and 1 keep it disabled.
`null_diag_field(9)` is capability/version 1, and fields 10–28 expose the
record. This adds 96 bytes of mutable global values per instance, plus engine
implementation overhead and source/code size; it is not a linear-memory arena.
Function/global index and module byte identity necessarily change. Source
census checks are not a new compiled ABI/producer qualification.

The preload opt-in is `SHADOW_NULL_ZERO_TRANSFER=1`, valid only with the
existing `revised-first-zero` mode. The selected action still resolves the live
dialog and binds exact instance/PID/runner/action sequence. Its pre-arm receipt
is retained/fsynced before native mode 2 is enabled and before the actual send.
The existing runner hash/module hash/watchdog/single-instance checks remain.
An old module lacking field version 1 is rejected before arming. Absence of the
new flag keeps mode 1 and the legacy record shape/classification.

Immediately before EIP/ESP mutation, native code snapshots site/kind, actual
architectural pre-EIP/ESP, predicted post-EIP/ESP, actual thunk address and the
dispatcher's loaded metadata marker, consumed RET word/address where applicable,
i64 invocation token/root, depth/event count, modal pump/return/ended and shared
modal state, and both named continuation thunk values. RET records set thunk
address/marker to zero rather than borrowing stale `current_thunk_eip`.
`preEip` is the emulator's actual architectural EIP, which can name the current
decoded block; it is **not** a promised exact x86 instruction VA. The native
site and threaded cursor identify the handler boundary without guessing from
`dbg_prev_eip`.

At the existing zero guard, saved token/root/depth/event count and predicted
ESP must still match. The first-zero callback independently requires actual
EIP zero and matching post-ESP, depth and count adjacency. Its token/root strings
are the live values already matched against saved native i64 values, without
lossy JS conversion. The adapter records `native-caca0005`, `guest-ret-zero`,
or `unknown`; a mismatched actual/named synchronous thunk is retained explicitly
as `syncReturnThunkMatches:false`, not interpreted as a legitimate return.

There is no additional observer event or pending JS writer history. The same
first-zero envelope is sealed, deep-frozen, retained/fsynced and stopped through
the existing synchronous OS-exit-86 path. Its native returning-observer trap is
unchanged. Missing required block still fails **after retaining first-zero**;
there is no resume to obtain outer modal events and no automatic ordinary-exit
acceptance from a known writer.

## Transfer coverage and conservative unknown cases

[Exact-candidate path inventory](shadow-man-zero-transfer-provenance-20261023/transfer-path-audit-corrected.json)
and [reviewed excerpts](shadow-man-zero-transfer-provenance-20261023/remaining-transfer-review.receipt.json)
record the source boundaries, including thunk dispatch before ordinary tracing.

| Transfer | Treatment |
| --- | --- |
| `CACA0005` in `$run`'s explicit thunk-entry dispatch | Snapshot before assignment; require actual pre-EIP equals actual thunk. |
| Near 32-bit `RET`, `RET imm`, fused POP/RET | Snapshot the actual consumed word/address before EIP or final RET ESP changes. For fused POP/RET, pre-ESP is after the preceding POPs. |
| Inline CALL/JMP-to-thunk dispatch | Unknown: callers can overwrite EIP after dispatch. A transient explicit-entry flag and pre-EIP check prevent attribution from these routes. |
| Deferred DLL unload after dispatch | Invalidate unconditionally before deferred handling. |
| New/reentrant run, rearm, next nonzero loop iteration | Clear record kind. Invocation/count/ESP mismatch also clears it. |
| Other native assignments, modal `CACA0004` return, thunk auto-return, host-supplied EIP, indirect CALL/JMP-to-zero, Win16/far/extended returns | Uninstrumented, therefore unknown; no inherited predecessor is fabricated. |
| Chained or tier-generated transfers | Actual adapter's existing range-trace arming sets debug chain/tier guards; source shows RET tails return to the run desk. Tier writers themselves remain uninstrumented. No broader tier/native correctness claim is made. |

The record helper does not write guest memory, call the observer, schedule a
modal, or change emulated registers. Its only extra memory reads in enabled
mode are the existing context values. Off-mode handler comparisons preserve
modeled EIP/ESP; this is an offline claim, not a benchmark or native equivalence
proof. No every-instruction logging or general observer expansion was added.

## Offline acceptance and limits

From the task checkout, run:

```sh
python3 docs/re-notes/shadow-man-zero-transfer-provenance-20261023/guard.py offline-check node --max-old-space-size=256 docs/re-notes/shadow-man-zero-transfer-provenance-20261023/offline.test.cjs
python3 docs/re-notes/shadow-man-zero-transfer-provenance-20261023/guard.py source-check python3 docs/re-notes/shadow-man-zero-transfer-provenance-20261023/audit.py
```

[Accepted test receipt](shadow-man-zero-transfer-provenance-20261023/offline-seal-accepted.receipt.json):
exit 0, **24 checks PASS**, 1,653 captured bytes, all descendants reaped.
[Source audit](shadow-man-zero-transfer-provenance-20261023/audit-final.receipt.json)
and [JS syntax checks](shadow-man-zero-transfer-provenance-20261023/syntax-checks.receipt.json)
also pass. The executable JS test parses the actual edited WAT forms and
evaluates the selected helpers/handlers with a deliberately small interpreter,
modeled memory and helper primitives, then invokes the **actual** capture
serializer/selected-send adapter. This exercises emitted field selection and
serialization rather than only checking source strings. Fused POP setup and
branch-end helpers are modeled; it is not x86 execution, canonical WATX
compilation, a native fixture, full CLI execution, or Wasm instantiation.
[Evaluated examples](shadow-man-zero-transfer-provenance-20261023/offline-evaluated-records.json)
are explicitly offline-generated, never original-game or native evidence.

Controls cover distinct writers and RET stack adjustments, inactive/default and
unknown behavior, token/root/depth/count/ESP staleness, rearm/run reset, wrong
instance/PID/action/sequence, synchronous pre-arm ordering, malformed exports,
unchanged required-block rejection, and returning-observer trap. A rejecting
mutation changes the actual RET writer-site argument in the evaluated source;
the expected emitted-site test detects it. The preload's new environment
validation is evaluated offline without loading runtime code.

There were no failed implementation test runs. Three own bookkeeping mistakes
are retained and corrected in this task: an unscoped private-checkout diff
reported unmaterialized files as deletions (none staged), corrected with private
skip-worktree flags; and the first audit used a nonexistent tier filename,
corrected from the exact candidate tree. See
[initial index diagnostic](shadow-man-zero-transfer-provenance-20261023/initial-index-diagnostic.json),
[initial transfer audit](shadow-man-zero-transfer-provenance-20261023/transfer-path-audit.json),
and the original command receipts. The first commit attempt also rejected
whitespace-only blank context lines inside the retained patch artifact; the
artifact was regenerated with zero context, preserving normal staged whitespace
checks. The failed commit receipt is retained externally as `commit.receipt.json`;
the original context patch is also retained in `source-review.receipt.json`.
The earlier seal manifest is retained as superseded history, not a claim about
the corrected artifacts. No source/oracle or resource limit was
weakened to correct these.

**Remaining independent qualification:** review this exact new candidate and
its focused patch; under a separately authorized resource allocation, verify
compiler/ABI/census provenance, build the canonical complete include closure,
and execute the new native writer and RET paths against the same first-zero
capture binding (including unknown/inactive controls). Only after those gates,
a separately authorized original actual-CLI first-zero observation could decide
the historical writer fork. It must retain the full required-order rejection
when applicable. None of that execution is authorized or performed here.
Retained module SHA-256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`
is unchanged historical standing input, not compatible proof for this patch;
it was neither copied, compiled nor instantiated. Historical retained-module
acceptances remain historical.

## Resources and publication

[Fresh admission](shadow-man-zero-transfer-provenance-20261023/admission.json)
measured the focused manifest before dependent execution: 45,863,912 /
67,108,864 projected bytes including private Git/index/new objects, focused
checkout/evidence/outputs/temp, external launcher growth, **separate own Codex
session** growth, future growth and an 8 MiB reserve inside the allocation.
Host projected free 4,791,291,904 bytes exceeded the 2,982,150,144-byte floor.
Installed Node/Python and read-only donor bytes were measured separately as
standing inputs, executed in place, and not concealed by materialized links.

The supervisor enforces CPU/wall 60 seconds, Node old-space 256 MiB for these
commands, MemAvailable at least 805,306,368 bytes, file cap 24 MiB, aggregate
capture 524,288 bytes (196,608 reserved for initial direct-tool output),
fail-closed 125, TERM then KILL after five seconds, subreaper and full reaping.
No unchanged denied operation was retried. Final allocation and strict push/
actual remote SHA proof are retained externally in
`/home/user/wine-assembly/scratch/usage-watch/shadow-man-zero-transfer-provenance-oct23/`
and appended to the shared board. Git retains the source patch/tests/evidence,
not historical module/game binaries or runtime artifacts.

No guest, Boat operation, compiler, canonical build, native fixture replay,
native Wasm, integration, worker or game repair ran. Root/shared/donor files,
indices and refs, Claude B&W2, RichEdit and POSITIONT remain unmodified by this
task. The board says coordinator snapshot-stopped `bx_jxut8krh` after preserving
PNGs; this worker did not query/change it. Last reported state STOPPED, expiry
`2026-10-23T09:37:37.793Z`, lifecycle owner coordinator; Claude box
`bx_pfbppnmu` was untouched. All supervised groups are reaped; the board watcher
is joined at release. Stop after tested publication; no next task is selected.
