# Deus Ex native cache contract: bounded native-call source; full lifetime history unavailable

This publishes a tested prerequisite for [540ef7524's missing native cache
observation](deusex-upstream-observer-coverage-20261104.md): an optional read-only
source of original Core cache method entry/return intervals in the owning Worker.
**It does not close the full eviction/reuse history prerequisite.** Original bytes
prove that Core `Create` evicts inline and SoftDrv acquires/releases locks inline.
An exported-method observer cannot supply those missing events. Every record
therefore retains `allocationLifetime: 'unknown'`; the existing producer observer
and consumer arithmetic are unchanged.

Evidence: `scratch/runs/20261104-deusex-native-cache-lifecycle-contract/`.
This was offline fixture execution only, with no Chrome, game launch, remote API,
boxes, subworkers or deployment. No box was assigned; ID/state/expiry are not
applicable. The coordinator retains runtime lifecycle ownership.

## Pinned original contracts

The media stays at its existing path, without copies:

| Original file under `test/binaries/candidates/deus-ex-demo/installed/system/` | SHA-256 |
| --- | --- |
| `core.dll` (790,528 bytes, preferred base `0x10100000`, image size `0x1b8000`) | `2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167` |
| `softdrv.dll` (389,120 bytes, preferred base `0x10d00000`) | `25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18` |

`audit.py` independently resolves PE exports, ordinal function entries and the
original relative JMP stubs to these Core **body RVAs**. The test pins the
original entry signatures and the specific distinguishing instructions. These
are bytes-derived observations, not reconstructed upstream C++ source contracts.

| Method | Export stub RVA → body RVA | Entry contract |
| --- | --- | --- |
| `Create` | `0x21f8 → 0x254e0` | ECX cache; stack ID low/high, item-reference address, size, alignment, extra-space; `ret 24` |
| `Get` | `0x1064 → 0x16a70` | ECX cache; stack ID low/high, item-reference address, alignment; `ret 16` |
| `Unlock` | `0x1389 → 0x168a0` | ECX item; no stack arguments; `ret` |
| `FlushItem` | `0x1a69 → 0x24c70` | ECX cache; stack item, locked-item handling flag; `ret 8` |
| `Flush` | `0x23bf → 0x25290` | ECX cache; stack ID low/high, mask, locked-item handling flag; `ret 16` |
| `CreateNewFreeSpace` | `0x2ce8 → 0x25170` | ECX cache; five stack words; `ret 20` |
| `MergeWithNext` | `0x1488 → 0x24c50` | ECX cache; stack item; `ret 4` |
| `Init` | `0x14f1 → 0x24a00` | ECX cache; four stack words; `ret 16` |
| `Exit` | `0x2022 → 0x24ba0` | ECX cache; one stack word; `ret 4` |
| `Tick` | `0x25cc → 0x25900` | ECX cache; no stack arguments; `ret` |
| `Unhash` | `0x1c30 → 0x16b60` | ECX cache; stack ID low/high; `ret 8` |

Only Create/Get/Unlock/Flush/FlushItem execute to completion in this task's
fixtures. The other entries have pinned export/signature/static disassembly
coverage; their complete behavior has not been dynamically qualified here.

Original item accessors establish a **32-byte metadata record**: 64-bit ID at
`+0/+4`, data pointer `+8`, 16-bit time `+12`, byte segment `+14`, extra byte
`+15`, cost/lock word `+16`, next/previous physical items `+20/+24`, hash-chain
link `+28`. `GetSize` at `0x16900` subtracts this item's data pointer from the next
physical item's data pointer. This physical capacity can exceed requested size
and differs from an aligned returned pointer. A pointer alone is insufficient
to identify either a cache ID or a lifetime.

`Get` increments the cost/lock word by `0x01000000`, returns an aligned data
pointer and stores the selected item through its reference argument. On a miss
it returns zero without clearing that reference. The event source deliberately
records no selected item for a miss, even if the reference still holds an old
pointer. `Create` writes the new ID at `0x257da/0x257dc`, writes requested size
plus `0x01000000` at `0x257df`, inserts the item in its hash chain at
`0x25802/0x25809`, and eventually writes the reference at `0x25894`. It can split
free space when metadata is available. None of these writes is a heap malloc.

`Unlock` is exactly `81 41 10 00 00 00 ff c3`: subtract `0x01000000` from the
item's cost/lock word, then return. It preserves ID/data/links. It is a lock
release, not item eviction, metadata destruction, or heap free. The native
signed comparison against `0x01000000` gates locked-item behavior in FlushItem;
the observer never substitutes JavaScript arithmetic for that behavior.

Unlocked `FlushItem` clears ID low/high and cost at
`0x24ca6/0x24caa/0x24cad`; it can coalesce adjacent free items of the same segment
and return metadata records to the cache's free-metadata chain. A locked item
takes another path, including diagnostics depending on the flag. `Unhash`
removes a hash-chain link; this alone does not prove item destruction.

Most importantly, `Create` has its **own inline unhash and metadata recycling**:
the hash link writes at `0x25710` and `0x25795` and the physical-link/free-metadata
rewrites at `0x2572d–0x25748` bypass `FlushItem`. The same selected item's old ID
can be replaced by a new one at `0x257da–0x257df`. Observing only FlushItem would
miss eviction by Create. The fixture executes precisely that reuse.

The original SoftDrv palette call at `0x265af` still resolves through IAT
`0xaf364` to Core's decorated Create import. The preceding original arguments
include size `0x800`, alignment `8`, extra-space `0`; return publication occurs
at `0x265ba`. A hit can publish at `0x26596` without Create. SoftDrv's inlined
hit path at `0x26573–0x2657c` increments the lock word directly. It does not call
Core Get. Ten pinned SoftDrv RVAs contain `81 40 10 00 00 00 ff`, the same lock
release through EAX: `0x94c2`, `0x38769`, `0x421de`, `0x45c4d`, `0x4613c`,
`0x46609`, `0x46b07`, `0x46fbc`, `0x474e9`, `0x47544`. This is a concrete list
of missed client release sites, not a completeness claim for every module or
instruction encoding. SoftDrv does not import FCacheItem::Unlock.

## Optional source and exact limits

`lib/deusex-native-cache-observer.js` exports `attach` for a real
OwningDrawObserver inside main Worker slot 0, thread 1. It wraps `owner.observe`
without replacing its run implementation. Each delivered boundary reads the
current owning exports, fresh live Core module identity, PC/ESP and necessary
registers/stack/item bytes. It works before a Draw frame exists. It never writes
guest state, calls guest functions, arms instruction watching, changes a decoder
or scheduler, flushes heap bins, or calls `get_free_list`.

Entry records retain native method, cache/item this pointer, original stack
arguments, saved caller, module index/base/size/generation and item fields when
applicable. Return records link their entry sequence, require the exact saved
PC and callee stack cleanup, and retain EAX plus the selected/item snapshot.
Repeated identical PC/ESP observations are suppressed conservatively; identical
tight-loop landings may also be suppressed. Saved-PC/ESP pairing is boundary
evidence, not certified CALL/RET retirement. Unwinds/tail calls can remain pending.
No allocation serial or lifetime inference is made from a changed ID or address.

Defaults are 100,000 delivered boundaries, 128 records, 1,000 ms and 16 pending
intervals; hard maxima are 1,000,000, 256, 10,000 ms and 32. Saturation stops
recording with an explicit reason and pending count. Observer failures are
contained; the wrapped method's return value and original exceptions propagate.
Explicit stop restores the previous observer when it still owns the wrapper.
Detach composed wrappers in reverse attachment order. No timer or restart is
installed. Every result explicitly names pre-attachment/pre-readiness history,
boundary granularity, inline Core eviction, inline client acquisition/release,
other-thread coverage and incomplete lifetime knowledge.

The caller must independently verify original media SHA and bind it to the live
loader mapping. `coreSha256` is a required pin, not a cryptographic hash of the
relocated in-memory image. The source additionally checks original size, export
module identity and local entry signatures. Core absence, signature changes,
foreign instance/thread, stack mismatch, unload/reload/generation changes or
unmapped reads terminate explicitly. This source cannot attach before the
OwningDrawObserver's Engine mapping exists and then recover older initialization.

Example inside the actual owning Worker, after verified initialized mappings:

```js
const native = DeusExNativeCacheObserver.attach(owner, {
  workerSlot: 0,
  coreSha256: '2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167',
  limits: { boundaries: 1000000, records: 256, milliseconds: 10000, pending: 16 }
});
// Attach the existing ordered producer observer separately, with fresh run
// module/MMX binding and preDraw:true. Persist both results at the first bound.
// Stop the ordered handle before native.stop('terminal-reason').
```

There is no new ordinary Worker message/API or dependency-graph installation.
The source is a prerequisite library; the existing natural driver does not load
it automatically. Call sequences cannot be joined to a consumer merely by
matching record sequence numbers from separate observers.

## Actual composed verification

Run from the checkout:

```sh
DEUSEX_NATIVE_RESULT=scratch/runs/20261104-deusex-native-cache-lifecycle-contract/native-result.json node test/test-deusex-native-cache-observer.js
python3 scratch/runs/20261104-deusex-native-cache-lifecycle-contract/audit.py
node test/test-deusex-ordered-producer-observer.js
node test/test-deusex-owning-draw-observer.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The new test uses the actual shipped `lib/guest-worker.js`, queued `slice`
commands, GuestRpc transport, OwningDrawObserver, ordered producer observer,
native source and compiled decoder. Only an appended fixture accessor exposes
the actual Worker instance and collector. Core and SoftDrv are loaded and
relocated by the real PE loader; initialization completion is fixture metadata,
not a claim that original DllMain or the game startup ran. Engine metadata,
cache/stack/storage and the caller are synthetic. All executed Core routine
bytes are original; the caller uses natural x86 CALL/RET, without supplying
observer lifecycle callbacks. Instruction watching is enabled only in the
instruction-mode fixtures, equally in both control arms; the source never arms it.

At Core bases `0x900000` and `0x1100000`, in ordinary block and instruction
fixture modes, the observed and control arms match all queued slice commands,
returned block counts, registers/lazy-flag state, entire 512 MB memory hash,
UD2 trap and post-trap state. Explicit duplicate observations also leave memory
and architectural getters unchanged. The ordered observer remains active before
Draw with its original consumer code untouched.

Each observed arm records ten entry/return pairs: three Create, two Get (one
miss with stale out-reference), three Unlock, one Flush and its nested FlushItem.
The three Create returns select the same metadata address and data pointer for
IDs `5566778811223344`, `12345678abcdef01`, `8765432198765432`. Between the last
two Create returns, only Unlock completes; no FlushItem event supplies that
inline eviction. Unlock costs are `0x01000040`, `0x40`, `0x40`. The final native
Create cost is `0x01000040`. These are test cache identities, not natural palette
lifetimes. `audit.py` independently verifies original export resolution,
client-inline bytes, exact stack cleanup, ID reuse and every control parity arm.

Failure controls use actual owning exports after the parity fixture, with
clearly separate fixture mutations. They cover module generation changes,
foreign instance, signature mutation, bad return ESP, duplicate boundaries,
pending/record/boundary/time caps, malformed pins/limits, duplicate attachment,
restoration and original return/throw preservation. They do not execute fake
native lifetimes. The preceding ordinary producer transport fixture also passes
with original descriptor/setup/store bytes and physical Worker controls.

Locked full build passes. Tested normal WASM SHA-256:
`84057ee689bbd778023ec64f1f2f5ecbeef217095d3f19cd21ae8ec281d5c971`;
compatibility: `86343aa6a96856b7efbea59ef473cde43d4ae0a73b6ba1dc2fb5481bf65d9842`.
Those build inputs include concurrently published renderer commit `748e1a896`;
this worker did not edit renderer source. Initial fixture failures (nonexistent
flags getter and an incorrectly same-segment sentinel) and the first build's
literal-ratchet failure are retained. The fixture sentinel now matches Init's
distinct terminal segment. The raw literal was a guest fixture offset equal to
a region base; expressing it relative to the item fixes the gate without
changing that guest address. No production arithmetic was changed.

## Precise remaining prerequisite and actionable recipe

A **complete native cache lifetime source remains unavailable**. The new source
is sufficient for bounded verified method intervals only. Late attachment,
inlined client operations, Core internal eviction/metadata recycling and
unobserved threads prevent a claim that a palette/descriptor item survived from
creation to consumption. Method-call records cannot be promoted to lifetime
events, and a malloc/free trace cannot repair that distinction.

Before allocating another natural run, implement and qualify a startup-capable
read-only source independent of the Draw collector's initialized Engine
requirement. Pin every participating module and capture the first cache Init or
mark prior cache history unknown. Cover Core's internal unhash/recycle/ID
publication sites above plus FlushItem/MergeWithNext/CreateNewFreeSpace/Exit and
the client inline lock paths. Test metadata split/coalesce, multi-item eviction,
same-ID/address reuse, locked/failed paths, module reload, nested calls and
other-thread gaps through the actual decoder. The ordinary decoder can skip
interior stores; either prove mandatory observable CFG cut points and their
input/output contract or provide passive retirement observations at those sites.
Enabling debug instruction watching in a natural run is not supplied by this task.

Then compose that source with descriptor/store observations before the relevant
history, correlate the **cache object, 64-bit item ID, metadata/data/range,
observed invalidation and consumer order**, and preserve explicit unknown history
where any link is missing. Keep first terminal result and existing bounds;
never force Draw, patch guest data, change inputs, extend limits or manufacture
callbacks to fill a gap. Verify full-memory/state/return parity and exact served
module bindings before a separately authorized natural attempt. The current
source and tests are an implemented prerequisite, **not a full-lifecycle launch
package or natural execution/pixel claim**.

Git supplies the source archive: the run records exact Git SHAs, relevant binary
diffs and owned new-file patches. Media/modules are path-and-SHA references.
Closed logs are compressed with SHA roundtrip verification; no source archives,
copied media/modules or predecessor evidence rewrites are used.
