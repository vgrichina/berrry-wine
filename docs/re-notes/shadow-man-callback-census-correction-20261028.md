# Shadow Man callback census correction — source inventory only

Candidate: `2e6f5984d3f64d7781fb02da09bbb8d564302123`. This branch changes
only eight entries in `tools/callback-ownership-census.json`, adds the focused
`tools/shadow-man-callback-census.test.js` regression, and retains this review
and its evidence. No production WAT, host JS, scanner, or nonlocal gate changed.

The exact candidate's unchanged production scanner rejected six changed
producers and two unknown producers. The same scanner now accepts 410 source
boundaries: six renewed entries, two additions, and 402 untouched entries.
Every entry still says `ownership: pending`. This closes this source-inventory
blocker; it does not prove callback ownership or accept gameplay.

## Eight-producer disposition

The candidate-to-parent source delta and complete before/after inventory records
are retained beside this note. Existing producer categories are preserved.
The new `context-restore` records inventory diagnostic context observations;
neither helper actually restores or owns a guest context.

| Producer | Source review supporting disposition |
| --- | --- |
| `05-alu:$th_ret` | After the existing 16-bit guard, reads guest ESP and its return word once into locals. Kind 2 snapshots that word before assigning EIP from the same local; ESP still advances by 4. The target AST changes from an inline load to the local containing that load. No owner acquisition/release. |
| `05-alu:$th_ret_imm` | Same load/snapshot/assignment ordering, kind 3; ESP still advances by 4 plus the immediate operand. The return-word writer remains unknown. |
| `05-alu:$th_pop_run_ret` | Existing `stack_run_pop` early return and guard remain. The existing fast `sr_delta` load or `gl32` load is captured in a local, snapshotted as kind 4, then assigned to EIP. ESP remains `cur+4+imm`; no new callback lifetime. |
| `09b-dispatch:$win32_dispatch` | Preserves resource-pin save/restore, API depth, and existing redirects. The only added operation invalidates diagnostic kind before deferred DLL unload can redirect after the inner handler. Existing EIP targets and ownership boundaries are unchanged. |
| `09b-dispatch:$win32_dispatch_inner` | Existing CACA0005 completion sets `handler_set_eip=1`, then EIP=0 to end nested run. The new kind-1 snapshot precedes this write; no ESP pop is introduced. The helper rejects inline-dispatch attribution unless explicit run thunk entry and EIP/thunk equality hold. The enclosing synchronous caller still owns caller-context restoration. All other inventoried targets are unchanged. |
| `13-exports:$null_transfer_record` | New instance-local, overwriteable diagnostic snapshot. Mode-2 guard, clear-kind-before-rejection, nonzero-target rejection, and explicit kind-1 route guards precede capture. Copies already-read word/address, predicted post-ESP, diagnostic/modal state, validated current invocation token and root; publishes kind last. Writes only diagnostic globals. No run/host callback, EIP/ESP mutation, invocation enter/leave, or retained reference. |
| `13-exports:$null_transfer_check` | New diagnostic invalidator before the first-zero event. Mode guard; count, synchronous depth, current token, root or post-ESP mismatch clears kind. Writes only diagnostic kind. `invocation_current` calls the existing validator and reads the token; it can trap on invalid context and does not retain an owner. Matching fields establish bounded correlation, not a writer/lifetime proof. |
| `13-exports:$run` | Fresh/reentrant entry clears kind and thunk-entry flag. Each nonzero loop boundary clears them again. Explicit thunk dispatch brackets the entry flag. The zero branch checks the record before `null_diag_event` increments count and calls the synchronous host observer; a returning observer traps. Existing budget/API-depth restoration and auto-pop EIP target remain unchanged. |

`cs_pop` only updates diagnostic shadow-stack depth. The RET paths retain their
existing `branch_end` path; this inventory renewal does not certify its entire
transitive execution graph. The snapshot helpers have only the direct
`invocation_current` call, which validates thread/epoch/root and reads the
current slot. They contain no ownership writes or guest dispatch.

Reentry is explicitly limited: these globals are one instance-local record,
not a stack of retained owners. A nested `run` clears attribution rather than
preserving an outer record. A new nonzero iteration or deferred unload also
clears it; a changed count/depth/token/root/ESP invalidates it at zero. Fields
other than kind are not attributable when kind=0. Arbitrary host reentry,
uninstrumented transfers, shared-state races and original return-word origin
are not proven safe by matching fields or body hashes. No unresolved writer
or null-transfer path is relabeled proven.

## Validation and retained rejection

The earliest behavioral check was the unchanged pinned production scanner over
its actual full source closure (root JS, recursive lib JS, src WAT/WATX).
After resolving a sparse-checkout missing-loader setup error, it reproduced
the exact prior rejection: RET hashes/targets, dispatcher/run hashes, and two
unknown helpers. No substitute runner or full-build retry was used.

The corrected production scanner passes. The focused regression executes the
actual production parser/scanner on all eight functions and passes 58 negative
controls: eight omitted entries, 24 missing/unsupported ownership labels,
eight changed bodies with unchanged boundary calls/targets, six changed EIP
targets even after digest refresh, ten removed guards, and two mismatched
boundary lists. Two development assertions were corrected: parser arrays
belong to a separate VM realm, and removing the helper's only invocation call
correctly yields a stale producer rather than a changed producer. Their raw
failures are retained. The portable final test path passes the same controls.

The existing census mutation suite also passed as supplementary evidence.
It internally launches one Node `--dump` child without forwarding the 320 MiB
heap flag; this was discovered after execution. The supervised aggregate RSS
peaked at 408,760,320 bytes, below 512 MiB, and cleanup completed. That child
heap-configuration deviation is retained and is not a compliant acceptance
receipt. The primary baseline, corrected scanner and focused controls ran
directly with the checked `/usr/bin/node --max-old-space-size=320` configuration.
No passing group was replayed to conceal this deviation.

Primary Node operations use CPU 90 s, wall 120 s, sampled process-group RSS
512 MiB, aggregate captured output 2 MiB, file-size 24 MiB. Git alone receives
RLIMIT_DATA 256 MiB. The successful startup receipt records actual limits and
environment; V8 address reservation is not charged as physical RSS. Fast
operations with sampled peak zero are not claims of zero memory usage.
Canonical parser validation records no actual filename-bearing runtime mounts
and an enumerated tree-mount control containing `comma,bearing.txt`.

The previous canonical build report is reused unchanged:
`70fc442fef1d5af4ee2f851241d870eb1d39c4db`,
`docs/re-notes/shadow-man-admitted-remote-native-20261028.md` and its 54-file seal,
manifest SHA256
`95ccfb53608a151d0e35d52d940dc4e8d9fc5b38af8663e4698bb40777afd3d6`.
That exact-candidate build exited 1 before compilation in 2.471 seconds. Its
rejection remains historical evidence; this task performed no build, native,
guest, browser, Boat allocation/resume, or main integration.

Historical `61e1ea2d` remains **REJECTED**, writer **UNPROVEN**. Full-module,
compiled ABI, native, original-game and gameplay statuses remain **UNQUALIFIED**.
The predecessor `bx_k4htahnf` was already snapshot-verified and stopped at
21:05:09.614Z; this task has no assigned box and performed no lifecycle action.
Coordinator retains lifecycle ownership.

## Recovery and next gate

The adjacent evidence directory contains source-review records, unchanged and
corrected scanner output, targeted mutation results, resource/startup/mount
receipts, raw setup/test incidents and a SHA256 manifest. `RECOVERY.md` gives
portable commands using this branch and its exact parent, without /tmp inputs.
The canonical scratch publication receipt records archive identity and exact
remote branch/SHA. Ignored raw evidence is recoverable from that sealed archive.

Independent source acceptance should precede any later canonical build. This
review justifies proposing that build after independent acceptance; it does
not authorize or perform it, predict its success, or replace runtime proof.
