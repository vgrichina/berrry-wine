# Native USER causal producer

Run: `20261120-hexen2-native-user-causal-producer-implementation`.

The previous `10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`
module is a historical baseline. It lacks this ABI and its earlier runtime
qualification does not qualify a changed producer. This change does not diagnose
the earlier Hex NewGame UNKNOWN as a queue, filter, cache, or scheduling defect.

`src/09a5-handlers-window.wat` now provides native USER causal ABI 1. It uses
64 records in per-instance globals, with 17 fields each; no memory region,
guest allocation, shared scratch alias, or timer/security source changes are
needed. Collection defaults off. Native events describe API entry/exit, host
poll entry/result, cached input, filter admission/rejection, and cache removal.
The fields contain sequence, event, API, native thread, HWND filter, message
range, remove flag, packed cache, pending token, return token, yield reason,
yield flag, EAX, time, event detail, and local post count. Wait-related input
probes in the late USER handlers use the same producer. API exit is an emulator
handler boundary; it does not assert completion of a redirected guest callback.
PM_NOREMOVE is preserved and cannot be described as cache removal.

The existing `real_time_ms` import supplies a diagnostic clock/record-completion
doorbell only while the native diagnostic flag is set. On the actual owning
Worker this copies completed native records into the optional output SAB before
USER continues. Ordinary clock calls preserve their original implementation.
This is necessary even when a cache-only native call is immediately followed by
a busy guest loop. Native records are copied from that executing instance,
without a page-side or shadow queue consumer. The Worker also records slice
entry/exit, import entry/exit/error, and local waits. Queue publication fields
are the actual atomic input-depth and publication-generation samples; tokens
are native dequeue identities, and sequences order the observations. These are
diagnostics, never consumption receipts or synthetic evidence of input delivery.
Times use the owning Worker's clock modulo 2^32 milliseconds, ordered by native
sequence; the header preserves the full source deadline.

Each Worker configuration admits one exact 64-bit hexadecimal nonce. The SAB
header retains that nonce, endpoint identity, immutable deadline, count, and
explicit overflow. Native and output overflow freeze observation instead of
silently overwriting history. Cancellation, instance replacement, endpoint
retirement, command errors, and the fixed real 30-second deadline stop it.
The clock doorbell enforces expiry even when the Worker event loop is busy.
Readers can inspect already-published records without an endpoint request.

`tools/hexen2-native-user-causal.cjs` adds an explicit adapter for the actual
WorkerLink before start. It intercepts exactly one init for the supplied module,
memory, Worker object and endpoint, restores the transport immediately, and
prearms once. The caller must verify the actual served Worker SHA; the adapter
checks equality with that qualification. It retains local trace access after
first UNKNOWN and refuses another arm. It does not change input preparation,
receipt validation, complete-frame review, private identity, or physical UP.
The fixed policy is native 500 ms, source 30 seconds, review 15 seconds, fresh
frame 5 seconds, and hold at most 1500 ms. The existing Hex input controller
continues to own its input and independent-release decisions.

The evidence candidate is compiled in memory from Git commit
`62d4828c048e18589d7bc2dd695257c97083433e` plus only the two owned USER files.
Worker qualification uses that same Git library graph plus the two owned
Worker/observer files. `candidate.json` records every source hash, owned overlay,
module SHA, diagnostic-export text hash, and required ABI. No source tree copy
is retained. The standard full build separately checks the shared main tree.

`test/test-native-user-causal-observer.cjs` exercises real native WAT through the
production CPU Worker: default-off equivalence of input results/poll counts,
PM_NOREMOVE/cache, PM_REMOVE, filter retention, GetMessage, blocked broker
history, native/output overflow, cancellation, retirement, replacement, actual
x86 busy slices, cache-only records retained while native code remains busy,
and fixed real-time source expiry. Every owned Worker is terminated and joined.
The adapter test covers exact init/module/memory identity, Worker hash equality,
one prearm, restoration, fixed policy and zero requests after first UNKNOWN.
The run also preserves a deliberately omitted-doorbell native diagnostic
module to establish the retention failure and repaired result. That control is
separate from the historical baseline and establishes no Hex gameplay cause.

Publication, final test results, and any first blocker before the conditional
fresh original are recorded in the run's final `result.json`. NewGame,
movement, enemy interaction and ordinary Quit require their own fresh actual
original evidence; implementation and unit/native controls alone do not prove
those outcomes. No remote test box or public deployment is part of this change.
