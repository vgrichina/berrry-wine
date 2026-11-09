# Quake II bounded frame writer witness, offline 1335

`tools/quake2-frame-writer-witness.cjs` adds an explicitly enabled, bounded
observer of the shipped owning CPU's existing `native_store_arm/get` API.
Default attach is OFF and calls no APIs. No production hook is installed.
The helper owns only the two native watch ranges, current frame
`0xa9ce98..0xa9cf88` and published ring `0xa9cf8c..0xa9de8c` (exclusive ends).
It refuses an already armed observer. `close()` disarms and preserves the
previous debugger instruction watch through the existing native API.

A synchronous controller can call `boundary(copy, 'before')` and
`boundary(copy, 'after')` around each **existing** copy, in this fixed order:
`motionFirst.current`, `motionFirst.published`, `damageFirst`,
`motionSecond.current`, `motionSecond.published`, `damageSecond`.
These signals are caller supplied. The helper does not wrap the production
reader, traverse guest pointers, decode frames, read guest bytes, retry reads,
choose another frame, or participate in acceptance/first-loss decisions.
The offline test observes the unchanged serialized reader's existing typed
array iterations to supply these boundaries; this is a test adapter only.
No browser/worker integration or native experiment is implied.

Each retained point contains the raw PC/address/width/epoch/arm-generation,
host flag, invalidation and overflow receipt. Adjacent points report epoch
deltas and the last retained completion. Delta zero says **no retained store**,
not no writer. Delta greater than one cannot identify intermediate PCs.
Reset, rearm, disarm, range changes, overflow, owner/memory replacement,
missing/reordered signals and capacity exhaustion invalidate continuity
conservatively. Earlier point evidence remains available. Snapshots are
historical evidence at those points, not current continuity checks.
Maximum default storage is 64 points; the helper never allocates an unbounded
trace. Boundary evidence failures do not throw into a reader.

The executable remains at
`test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe`,
323584 bytes, SHA256
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
The helper verifies that SHA and exact increment/store, packet reset,
publication and clear instruction bytes. Controls execute those original
instructions at their actual addresses in the shipped built CPU. Register
setup and instruction scheduling are authored. An existing debugger watch
selects instruction granularity in both OFF and ON controls; bounded `run(1)`
calls stop without appending substitute branch instructions to the executable.
This does not reproduce a native game invocation or establish the cause of
historical1265.

The scalar count store is observed at actual PC `0x402a9f`, address `0xa9cf80`,
width 4. Scheduled between damageFirst and motionSecond, it increments the
count and the unchanged reader still rejects `motionEqual`; publication
validation remains short-circuited. A same-byte CPU store also increments the
epoch, although the unchanged byte predicates continue to accept.
Two different original scalar store PCs exercise last-completion-only history.

The important negative control executes the actual `rep movsd` publication
at `0x403527`: all 60 dwords are copied, the reader rejects the mismatch,
but the native store epoch is unchanged. The original `rep stosd` frame clear
at `0x403342` and client clear at `0x409221` likewise change the reader's
frames without retained store epochs. Bulk/native reset writes are uncovered.
The observed arm generation is **not** a parse/frame generation. Entity decode
at `0x402aad`, packet return at `0x402ea7`, reset/reentry, aliases and ABA cannot
be ordered fully with these receipts. No full publication/order proof exists.

An unarmed real peer CPU instance and raw host write/restore also leave this
owner's epochs unchanged. Exported `guest_write32` is retained with host=1,
PC=0; it is not native instruction evidence. Aliases, peer/host imports, bulk
and locked stores, partial faults, code replacement, frame/edict ABA, and
all-writer coverage remain UNKNOWN. Cross-worker message delivery cannot order
the copies. `nativeQualification` is always false; native remains REVOKED.

Validation: 15 OFF/ON real shipped CPU controls compare architecture/lazy flags,
frame/ring memory, exact shared guest read count/order, results and every
executed/short-circuited predicate. Disabled controls lack evidence; enabled
controls retain it without changing reader results. Stable boundaries invent
no writer. Reset/rearm, peer/host, bulk publication/clear, overflow, capacity,
missing boundaries, detached snapshots, exclusive observer ownership and
watch-preserving close are exercised. Existing native-write-core,
passive-attack/damage, 18 old/new rejected-frame controls with the complete
generated health consumer, independent UP/sticky first failure, and exact1265
binary decoder/replay controls pass. Locked build passes.

Evidence is in `scratch/runs/20261109-quake2-frame-writer-order-witness-1335/`:
Git base plus a small binary patch recovers owned source; SHA/size and gzip CRC
checks seal logs. No source tree, module, binary or media archive is staged.
The decoder's intentional corrupt-gzip test inputs are retained and identified
as expected failures. Free /home remains above 1.5 GB.

No Box/browser/localChrome/game/native experiment, agents or workers were
created. No new box ID, expiry or stop receipt exists. Inherited1265
`bx_vkc8ygzp` / `73881327-5a8f-45e1-8654-be4b78254b9b` was not contacted;
the inherited record says ARCHIVED/PHYSICAL_DRAINED, stop
`stop_22c93d116b808404`, initial expiry 2026-11-09T12:33:37.727Z,
final archiveAfter null, expiresAt not returned.

Next boundary requires separately scoped observation of bulk publication and
parse/reset generation on the same owner as the existing copies. This helper
provides bounded scalar-store evidence only. No new native run is authorized.
