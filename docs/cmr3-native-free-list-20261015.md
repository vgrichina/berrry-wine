# CMR3 stage-load free-list investigation

Source-only follow-up to original run 85638, canonical module SHA-256
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
Retained log: `scratch/runs/20261015-cmr3-lines-gameplay/output.log` in the
shared repository. First `invalid native free list` is line 1653, after batch
2402. No allocator node or arena snapshot was retained. Loading Warwick is
established; gameplay and the cause of corruption are not.

## What the contracts establish

`Device.prepare` calls `d3d_render_coalesce_heap` between submissions. That
export flushes this instance's bins, validates its list, sorts by address,
rejects overlapping extents before changing sizes, joins adjacent blocks only
within the same arena, then sorts by size. The same negative result covers
invalid nodes/cycles and overlapping sorted extents. It is not an OOM code.

Heap free-list globals and bins are per instance; arena records and backing
are shared. Free transfers a block to the freeing instance's list and
atomically decrements its arena's live bytes. Tail retirement publishes a
valid header/high-water and charges the tail before freeing it. Arena release
selects retired sparse arenas with zero live bytes, purges only the caller's
lists, unpublishes their records, and releases backing. The ordinary allocator
can cut an invalid list; the render coalescer deliberately rejects it.

Thus cross-instance pressure reclamation remains a plausible source of a
missing-arena node. Registration now invokes reclamation only after slot
allocation failure; the old eager-registration bug is already fixed. Other
release paths remain on reserve/commit pressure and explicit map allocation.
Neither their existence nor the comment about the old bug proves one ran at
this failure. Double free, overwritten size/link, overlapping ownership and
the bounded list limit remain alternatives. Shutdown RECLAIM and abandoned
parked calls are later observations, not causal evidence.

## First-failure evidence

The adapter now attaches the existing native passive reader's twelve fields
to the original error message, once per device. This survives transports that
serialize only Error.stack. Repeat failures preserve the first record and do
not rescan. Missing/trapping diagnostics retain the original rejection and
explicitly identify unavailable fields. No recovery or allocator policy is
changed.

The reader itself does not flush bins, store memory, update allocator hints,
or use side-effecting translation fault handlers. Calls rescan independently,
so `atomic:false` is explicit: parallel arena/mapping writers may change state
between fields. The record is taken synchronously immediately after the first
failed coalesce, before another submission or teardown. It describes the
post-coalesce list (bins may already have flushed, and overlap rejection may
already have sorted links), not the list before coalescing.

Fields: reason, head, current guest header, WASM header, raw size, next guest
header, arena record/base/end, allocated high-water, validated-node count and
arena count. Reasons 1 through 10 distinguish walk bound, alignment, absent
arena, unavailable mapping, malformed size, overflow, extent bounds, arena
count, header bounds and ascending adjacent overlap. Reason zero can occur
if concurrent changes removed the observed fault; it does not vindicate the
rejected submission. All native i32 addresses are represented unsigned.

## Validation and next authorized run

Local source-only checks passed: host diagnostic transport test, software
slice scheduling test, JS syntax, test-tier membership and diff whitespace.
The host test checks first-record retention, complete field mapping, unsigned
addresses, serialized stack evidence, missing/trapping reader behavior and
no reader calls after successful coalescing.

`test/test-d3d-render-lifetime.js` now also drives Device.prepare against a
real malformed WAT heap node and checks reason 5, header, raw size and arena
bounds. This full harness has **not** run for this change. Its existing reader
tests compare whole-memory digests and every mutable scalar global, including
nonempty bins, across all diagnostic reasons. Run this suite and the native
software-backend suite on the authorized canonical build/test slot before
integration. The production WAT source is unchanged.

For module reuse, first verify the donor's exact canonical hash above and
compare every production `src/` file and build/compiler input against the
candidate checkout. This task changes only adapter JS, tests and notes; do
not substitute that assertion for the byte comparison. Preserve donor and
candidate commits plus the comparison receipt. The diagnostic export already
exists in canonical 937466; reject reuse if it is absent. Native harness tests
with `extraWat` compile their own test module and must not overwrite the
canonical artifact. If any production build input differs through integration,
queue a fresh canonical build and record its new identity before replay.

After Kkrieger releases the sole box, obtain a new root runtime grant, pin the
exact source/module and fixtures, and use the existing bounded ordinary CMR3
route. Capture the first error and current frame, then stop the owned run;
do not wait for thousands of duplicate errors. Preserve the full log and
before/after identities. If reason 3 appears, retain a quiescent arena-table
and mapping observation before hypothesizing reclamation; reason 5/10 instead
requires the actual header/overlap and allocation ownership history. A cycle
or count limit needs a bounded chain census. Do not reset, discard or repair
the chain to advance gameplay.
