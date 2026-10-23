# Shadow Man NULL boundary capture mechanism

Delivered an offline-tested synchronous capture helper and default-off source
observation hook, not a modal correctness repair. Historical runtime is
58e90870a40a541a4083cae5e987ca8de31889e6; canonical module remains SHA256
ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553,
1,879,387 bytes. Accepted diagnosis 26dffaa0995cdf19d61ae30117729ca0588108b9
and preflight f0341d5d269baad2afed6a801768566e53d159be were read in their donors.
The three edited source blobs are identical in actual runtime and assigned main
bb9c496ed13095cc832fdf607f0937fb9c14b7de before this change.

## Capture and stop contract

`tools/shadow-man-null-capture.cjs` arms existing `set_trace_eip_range` for
0x004015d4 and clears the competing EIP breakpoint. The host `log_eip` callback
runs synchronously before that decoded block, including recursive WAT `$run`.
It copies all eight GPRs, EIP, 128 guest stack bytes at ESP-32, and 64 **loaded
guest code bytes** at 0x004015d4 through read-only exports. No region addresses
are inferred. Immutable hex strings, metadata, sequence, schema version, stop
policy and a SHA256 seal form the record. The seal detects accidental changes;
it is not authentication. Only the first matching block is retained.

Default mode stops on that block. `tools/shadow-man-null-preload.cjs` wraps the
final `WebAssembly.instantiate(Module, imports)` call used by pinned `test/run.js`,
so runner import construction cannot overwrite the observer. It opens an
exclusive output file, synchronously writes and fsyncs each JSONL record and
exits the dedicated OS process with 86 at a terminal event. Terminal failure
also exits, even if final-record writing fails. Other exit statuses/missing
terminal records are capture failure. The guest is abandoned; this is not a
recoverable pause. An external watchdog is still required for a never-reached
address, guest spin, or OS failure. No export-level JS wrapper is claimed to
intercept recursive `$run`.

For a separately authorized **dedicated main-thread target process**, use the
existing installed Node in place, preload with `--require=.../tools/shadow-man-null-preload.cjs`,
set `SHADOW_NULL_OUTPUT` to an absent output filename, and supply the retained
canonical `--wasm=PATH`. Do not use `--break`, `--trace-at`, `--trace-eip`, guest
workers, or a spawned-child runner with this adapter. The adapter checks the
actual module file hash/size; missing required exports fail before guest work.
This task did not inspect the historical wasm export inventory. Child launcher
orchestration is outside this single-process adapter: choose the target process
explicitly in the next runtime assignment, rather than inherit it through an
installer tree. No complete guest/VFS/runtime command was invented here.

## Extra boundary hook and readiness

Existing interfaces cannot expose sender saved locals, private pump state or
first zero before sender restoration. The smallest source addition uses only
existing `host.log_eip`, with negative event tags while explicitly armed by
`set_null_diag(1)`. It allocates no linear-memory region and adds no mandatory
host import. Normal behavior is unchanged with the flag off; no modal ownership,
frame cleanup, sender restoration or dispatch policy is repaired.

| Event | Exact observation |
| --- | --- |
| -1 sender-pre | Saved EIP/ESP, current GPRs before pushing the synchronous callback frame, after invocation allocation |
| -2 sender-before-restore | Saved EIP/ESP and current registers immediately after nested run ends, before identity checks, depth leave and restoration |
| -3 modal-frame-consume | Current completion ESP before reading previous pump from ESP+4..20, after teardown |
| -4 modal-frame-complete | Current EIP/ESP after the 24-byte frame adjustment; savedEsp identifies the consumed frame; before ended/result reset |
| -5 first-zero | `$run` observes EIP==0, before returning to its sender; unconditional trap after callback if the host returns |
| -6 overflow | Attempted 33rd source event; trap even if host returns |

For each source event the host copies the same registers/stack/code plus saved
EIP/ESP, private pump HWND/return/ended, shared pump HWND/ended, current invocation
token/root and synchronous depth. Token/root are decimal strings preserving
64-bit identity. They describe current state, not an inferred sender-owned token.
Saved fields on first-zero are zero/not applicable; earlier sender events carry
the saved caller pair. Modal completion records the actual frame after sentinel
adjustment, not the initial CACA0004 entry ESP. No handler exit is labelled a
guest modal return. Pump state may already have changed during teardown; the
record reports its actual value at each named site.

Host records are capped at 32, including the block; the independent source cap
is 32 source events. Reaching either limit is terminal failure. In the explicitly
selected `SHADOW_NULL_UNTIL_ZERO=1` mode, the first block is retained and execution
is authorized to continue only until first-zero or the record cap. This mode
requires `SHADOW_NULL_REVISED_SHA` matching the **new diagnostic module**, and
requires its diagnostic exports. Historical module identity stays separate in
metadata. Do not present a revised module as historical canonical execution.

Readiness verdict: historical-module pre-block capture mechanism **OFFLINE
TESTED**, actual canonical export compatibility **NOT EXECUTED**. Sender/modal/
first-zero hook implementation and event schema **OFFLINE FRAGMENT TESTED**;
actual handler call sites and revised whole-module compatibility **NOT EXECUTED**.
It cannot yet discriminate the historical failure in a live run. Actual zero
transfer instruction/writer/target-word provenance remains unavailable. The
first-zero event observes zero before restoration; it does not identify the
instruction that wrote zero or distinguish CALL/RET/JMP/CACA continuation.

## Verification

Run `node test/test-shadow-man-null-capture.cjs` in this checkout. Exit 0;
[tests.json](shadow-man-null-capture-mechanism-20261023/tests.json) lists checks.
The 902-byte native fixture uses an 8 MiB arena. It executes the actual source
hook declarations, extracted trace predicate and zero branch against fixture
register/pump globals, including recursive callback-to-host capture. It does
not execute complete production handlers or simulate the Shadow Man incident.

Positive/rejecting tests cover address filtering, register/stack/code copies,
immutability after memory changes, terminal block stop before a native marker,
missing/wrong address, missing registers/bytes, changed stack, continued
execution, missing exports, retention failure, record quota, default-off hook,
first-zero and source quota traps with a returning host observer, and metadata
callback values. The exact pinned runner instantiate call form is executed;
full test/run.js is not launched. A real child Node process loads the preload,
flushes source events and exits 86 before its continuation marker. The fixture
and driver are retained for review; compiler support files were copied unchanged
only for this focused test, and are not proposed changes.

## Resource, lifecycle and next requirement

[admission.json](shadow-man-null-capture-mechanism-20261023/admission.json) was
measured before checkout: projected task-owned staging 26,289,471 bytes including
8 MiB evidence/temp allowance and 8 MiB reserve; projected host free exceeds
2,982,150,144 bytes. Read-only donors and installed tools have separately recorded
sizes/identities. Installed Node 123,656,816 bytes was executed in place, never
copied or installed and never double-charged as new task storage. No symlink or
hardlink staging; no fetch/archive/root-index/donor changes. Final measurement
and actual remote SHA are in the publication receipt under scratch/runs.

Next minimal assignment: first review the hook placements; separately qualify
and build a distinctly hashed diagnostic module from the pinned baseline plus
these three edits under an explicit build allocation. Then authorize one bounded
single-process capture using the retained complete original fixture and watchdog,
choosing default pre-block terminal capture or explicit until-first-zero mode.
Canonical-only first capture needs no rebuild, subject to export compatibility.
No runtime is authorized by this handback. If the goal is CALL/RET provenance,
additional actual transfer-writer observation remains necessary after inspecting
the loaded code and these records; do not infer that provenance from this hook.

No guest/runtime/Boat/full build/production repair/worker launch/deploy/main merge.
Configuration OK, genuine 50-byte cfg and enabled Spielen remain accepted;
persistence/Play/gameplay untested. Partial 479-file VFS remains invalid input.
Box bx_fn7pn7yg remains coordinator-reported snapshot STOPPED by
stop_428de72b6f35166b at 03:03:34.606 UTC, historical expiry 03:46:00.580 UTC.
No box contact or lifecycle action. Coordinator owns any next assignment.
