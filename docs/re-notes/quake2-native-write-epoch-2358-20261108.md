# Quake II native write epochs

Run: `scratch/runs/20261108-quake2-native-write-epoch-2358/`.
Offline only; no box, browser, original gameplay, or agents.

NodeWorker init can enable `quake2LoadObservation: true` together with
`quake2NativeWriteObservation: true`. Both default off. The existing
`quake2LoadObservation` query then includes `nativeStores`; conversion,
startup completion, and later headnode-use records retain their receipts.
Direct Node hosts pass the same options through `createHostImports`.

The shipped CPU records completed gs8/16/32/64/128 helpers against two bounded
guest ranges. Each range retains a saturating epoch and the last completion's
instruction PC, address, and width. Overlapping and crossing stores count even
when bytes are unchanged. Sparse split stores can produce fragment receipts.
The Node binding supplies an instance UUID and binds actual exports/memory.
Instruction decoding reuses the existing instruction-watch mode, clears cached
blocks on arm/disarm, and disables tier/chaining and the SBH scan shortcut.
Off mode performs only disabled-flag guards at the store/run boundaries; no
range scans, store translations, counters, callbacks, or receipt allocations.

`native_store_arm(alo, ahi, blo, bhi, limit)` configures half-open ranges;
zero ranges disarm. Zero limit selects 2147483647. Rearming changes generation;
overflow never wraps. Reset/load invalidation is sticky. The fixed-field
`native_store_get` ABI is listed beside the CPU globals and in the Node binding.
Standalone guest-write exports count with PC zero, outside native execution.

Actual shipped-module tests cover 14 off/on store pairs plus raw/other-instance
writers, reset/rearm/disarm, reload, and existing debugger state. Ten original
native conversion/startup/use NodeWorker pairs preserve architecture, lazy
flags, all declared direct guest regions, and sparse source bytes. Baseline
conversion records 350 model stores and startup 34 table stores; same-byte
controls advance these to 351/35 and write-restore controls to 352/36. Existing
12 continuity pairs and facade controls pass unchanged, as does the protected
memory-CALL/instruction-mode regression and the locked build.

Receipts retain the last PC, not an unbounded history. Raw SharedArrayBuffer,
host/import, bulk or locked helpers that bypass gsN, partial-fault stores, and
other instances remain UNKNOWN. Epochs do not prove all-writer coverage,
allocation identity, or edict ABA. A missed/repeated loader generation still
rejects continuity. The expected raw source release remains REVOKED;
derived-storage receipts do not extend its lifetime.

Next gameplay step: in a separately authorized paused runtime, arm this mode
before acquisition/conversion/startup, retain later-use receipts and observed
writer PCs, and close remaining writer/edict lifetime gaps before certifying
the guard/onward-door use. This task performs no gameplay retry.
