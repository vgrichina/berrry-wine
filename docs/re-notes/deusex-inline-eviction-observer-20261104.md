# Deus Ex CoreCreate inline retirement observation

`lib/deusex-inline-eviction-observer.js` closes the specific CoreCreate inline
eviction gap left by [the startup source](deusex-startup-cache-coverage-20261104.md)
and [native method source](deusex-native-cache-lifecycle-contract-20261104.md).
It records complete before/after transitions for the pinned ordinary decoder
blocks that remove a hash identity, recycle physical metadata, and publish the
selected replacement identity. These are observations of original instructions,
not invented guest lifecycle callbacks. **Full native cache lifetimes remain
unproved.**

Evidence: `scratch/runs/20261104-deusex-inline-eviction-observer/`. Offline only;
no Chrome, game startup, remote API, box, deployment or lifecycle operation.
There was no assigned box; ID/state/expiry are not applicable. The coordinator
retains lifecycle ownership. Existing observers and renderer are unchanged.

## Original instruction contract

Media: `test/binaries/candidates/deus-ex-demo/installed/system/core.dll`, SHA-256
`2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167`.
Addresses below are RVAs, valid at either tested relocation base. Export Create
is `0x254e0`, six stack arguments, this in ECX. At the internal cutpoints EBP
must equal entry ESP minus four, and EBX must still be the observed cache object.

| Transition | Delivered before / after boundaries | Original effect and checked postcondition |
| --- | --- | --- |
| Selection failure | `0x25648` | `xor esi,esi; cmp edi,esi; jne 0x256c0` falls through with EDI zero. Records no candidate, no successful publication. |
| Nonselected identity removal | `0x256cb`, then `0x2570d` / `0x2572d` | Item at `[ebp-0x14]`; matching hash-chain link in ESI changes from that item to its hashNext via `mov [esi],eax` at `0x25710`. Zero-ID items branch directly to recycling and need no unhash event. |
| Physical metadata recycling | `0x2572d` / next `0x256c0` | Previous.next and next.previous bypass the removed item; item.next becomes the old free-metadata head; cache free-metadata head becomes the removed item. |
| Selected identity removal | `0x25750`, then `0x25792` / `0x257b2` | Selected metadata in EDI remains physical; matching hash-chain link in EDX changes to hashNext at `0x25795`. Zero ID bypasses removal. |
| Replacement ID/cost/hash publication | `0x257b2` / `0x25812` or `0x2587e` | ID stores at `0x257da/0x257dc`, cost at `0x257df`, hashNext at `0x25802`, hash bucket head at `0x25809`. Verify requested 64-bit ID, size plus lock cost, and computed bucket head. |

There is **no literal ID clear** in the inline recycle block. The removed record
retains stale ID/data bytes while on the metadata free list. Its post-recycle
snapshot therefore explicitly has no physical range. Likewise selected-item
replacement overwrites its old ID without first storing zero. Calling either
operation a FlushItem clear would lose the real distinction. The inherited
startup observer still reports the genuine three-store FlushItem ID/cost clear.
Core Unlock decrements a lock cost; it does not free an allocation.

The original conditional/direct branch targets force the above block entries
through the current ordinary decoder. Relocation-free byte pins cover the
critical removal, recycle, replacement and hash publication blocks; tests also
independently read original PE bytes and decode branch displacements. A nonzero
identity needs an observed matching-link precondition and unlink postcondition;
a recycle needs both physical neighbors and the free-list postcondition; a
publication needs prior selected-item history. Missing delivery or changed bytes
terminates support rather than guessing a transition. A successful-looking
Create return without a completed observed publication is rejected.

Publication here means ID/cost/hash publication. Data alignment, helper splits,
caller out-reference and return can follow it; the inherited method-return cache
snapshot captures the resulting state. It is not a claim that an allocation has
already been consumed or has a certified lifetime serial. Repeating the same ID
at the same metadata address still produces separate ordered transition records.

## Optional use

Inside the actual owning Worker, after independently verifying original media
and binding its live loader mapping:

```js
const { InlineEvictionObserver, CORE_SHA256 } = require('./deusex-inline-eviction-observer');
const observer = new InlineEvictionObserver(instance.exports, {
  workerSlot: 0, coreSha256: CORE_SHA256,
  maxBoundaries: 1000000, maxRecords: 256, maxMs: 10000
});
// The existing optional local slice seam may use observer.run(exports, steps).
// Persist observer.finish('terminal-reason') at the first existing run bound.
```

Browser scripts load the startup library first, then this library exposes
`DeusExInlineEvictionObserver`. It inherits the startup source's loader checks,
INITIALIZING/LIVE support, fixed finite bounds, duplicate suppression, foreign
thread/instance rejection, unmapped-read handling, original exception propagation
and ordinary run(1) adapter. No Engine or Draw is required. Reads are passive;
there are no guest writes/calls, instruction watches, breakpoints, timers,
register restoration, scheduling changes or new Worker messages. This task
does not install the library in the natural driver or dependency graph.
Inherited physical-chain snapshots support at most 32 metadata records and
16 nested method frames; a larger cache or deeper stack stops as unsupported.

## Actual ordinary Worker verification

```sh
DEUSEX_INLINE_RESULT=scratch/runs/20261104-deusex-inline-eviction-observer/inline-result.json node test/test-deusex-inline-eviction-observer.js
node test/test-deusex-startup-cache-observer.js
node test/test-deusex-native-cache-observer.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The new test extends the existing actual `lib/guest-worker.js` queued-slice
fixture. Only a test-local appended accessor exposes the Worker's real exports
and optional collector seam. Control leaves that seam empty and runs the shipped
ordinary `ex.run(1)` path. No instruction watching is enabled in either arm.
Original Core is loaded by the real PE loader at `0x900000` and `0x1100000`, still
INITIALIZING, with no Engine mapping. Synthetic cache/storage/stack/caller and
the allocator stub are fixture dependencies; original Init constructs the lists
and original Core routine instructions are untouched. This is not original
DllMain, allocator initialization, natural startup or game execution.

At each base, 82,475 successful-route slices per arm produce eight Create
publications, five nonzero-ID hash removals and three metadata recycles. Filling
four 64-byte spans then creating 256 bytes removes three distinct IDs, recycles
their metadata and replaces the selected first ID with the same ID at the same
address. A subsequent Create replaces that address with a different ID. The
earlier original Flush sequence clears two IDs, coalesces adjacent spans, and
the following split reuses recycled metadata. Original locked FlushItem and
creation beside a locked item leave that locked identity intact. A failed Get
returns zero and leaves its stale out-reference unchanged.

A separate actual Create with the final full-span item still locked reaches
the original no-candidate diagnostic boundary in 19 slices. Its metadata bytes
remain identical and no removal/recycle/publication is emitted. The test stops
there with the Create interval pending: the uninitialized logging/fatal subsystem
and failure unwind are **not qualified**. No fake logger, lifecycle callback or
patched Core routine is supplied to manufacture completion.

Every arm compares the full 512 MB memory hash and architectural registers,
lazy flag operands/result/width, EIP, yield/halt/block counts and returned slice
values. The per-slice state digest, command digest (82,495 commands including
the failed-selection prefix and final UD2), final state, trap and post-trap
memory match. The failed-selection prefix has its own full-memory/state/digest
comparison. Duplicate observer calls also preserve memory and state. Explicit
negative fixture mutations occur separately after the parity snapshots; they
are not evidence of native lifetimes. They reject absent entry/pre-unhash/
pre-publication history, skipped transition at return, incorrect frame/stack,
mutated original bytes, unload/reload, foreign preferred image/thread/instance,
bad pins and bounds. The existing startup and native-source regressions pass.

The serialized locked full build and callback census pass. Tested normal WASM
SHA-256: `b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf`;
compatibility: `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00`.
An overlapping validation attempt reached its configured 10-second observer
limit during final readback; that log is retained. The final focused run passes
with the same bound. Record-cap tests also preserve an incomplete terminal
result without counting an event that could not be recorded.

## Remaining scope

SoftDrv inline acquisition/release, other Core invalidation paths including Exit,
unqualified helper paths, other modules, all loader/worker scheduling seams,
concurrent writers and other-thread histories remain unproved. Loader snapshots
are not atomic with guest execution. History before attachment is unknown;
seeing Init does not certify absence of earlier cache objects. Identical PC/ESP
landings can be suppressed. Call/return pairing is bounded PC/ESP evidence,
not certified retirement or exception-unwind tracking. Module media binding is
an external requirement; the required SHA option is not a hash of relocated RAM.

Next: qualify the actual SoftDrv inline paths and remaining invalidation/loader
seams, then join cache object, ID64, metadata/data/range, invalidation order and
descriptor/consumer evidence under one module binding. No full-lifetime,
palette-survival or natural consumer-chain claim follows from this observer.

Evidence records exact input/tested Git SHAs, relevant binary diffs and owned
new-file patches. Git supplies source recovery; binaries/media are referenced
by existing path and SHA. There are no source archives or copied modules/media.
