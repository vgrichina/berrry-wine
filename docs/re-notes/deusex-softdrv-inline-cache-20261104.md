# Deus Ex SoftDrv passive cache lock blocks

`lib/deusex-softdrv-cache-observer.js` supplies one supported original-path
collector: the palette fast/hash-hit acquisition blocks, their failed-lookup
fallthrough, and the release epilogue beginning at SoftDrv RVA `94bf`. It records
lock changes with metadata/ID64/data/range before and after. **Lock release is
not retirement or invalidation.** This is bounded block evidence, not complete
native cache lifetimes, loader integration, natural startup or game execution.

Evidence: `scratch/runs/20261104-deusex-softdrv-inline-cache/`. Offline only;
no Chrome, game, remote API, assigned box, subworkers or deployment. Box
ID/state/expiry are not applicable; runtime lifecycle remains coordinator owned.

The source reuses the passive reads, finite bounds and ordinary `run(1)` adapter
from the [startup observer](deusex-startup-cache-coverage-20261104.md). The
[Core inline source](deusex-inline-eviction-observer-20261104.md) remains the
separate evidence for real unhash/recycle/replacement transitions. This source
does not compose their histories or infer a cache object for a release from an
item pointer. Release records intentionally have `object: null`.

## Original mapping and mandatory blocks

The original file remains at
`test/binaries/candidates/deus-ex-demo/installed/system/softdrv.dll`, 389120
bytes, SHA-256
`25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`.
Preferred image base is `10d00000`, image size `b9000`. Tests independently
map its PE sections, compare original instruction bytes, decode direct branch
displacements and load the whole original through the actual WASM PE loader.
No original instruction is changed in the parity arms.

All following addresses are RVAs:

| Path | Mandatory pre/post boundary and native effects |
| --- | --- |
| Fast palette hit | Original comparisons at `26506/2650a` lead to `2650f`; cache `+16` supplies the selected metadata. `26518–26521` adds `01000000` to cost. Metadata is written to `[EBP-14]`; EAX becomes data rounded up to 8 bytes. `jmp` at `2652c` delivers `26594`. |
| Hash palette hit | Original null/ID comparisons at `2654e/26552/26558` lead to `2655f`. EAX is metadata, ECX cache, EDX/EDI ID low/high, EBX alignment. The block updates cached ID/item, out-reference and item's low 16-bit time, then adds `01000000` at `26573–2657c`. EAX becomes aligned data; `jmp` at `2658b` delivers `26594`. |
| Miss | Null branch at `26550` delivers `26592`, which clears EAX. `26594` is an interior fallthrough on this route and is **not delivered**. The original test/global store/conditional branch reaches mandatory `265a1` with EAX zero. The stale metadata out-reference remains unchanged. Execution stops before the original Create call and palette fill. |
| Release | `94bf` loads metadata from `[EBP-14]`; `94c2` adds `ff000000` to its cost. The contiguous epilogue restores registers and FS exception link, then `ret 24` at `94d9` delivers the saved caller. Expected post ESP is original EBP+32 and EBP is the saved frame value. ID, data, range, time and links remain unchanged. |

The delivered ordinary block PCs are `2654e,26552,26558,2655f,26594`
for a hash hit, `26506,2650a,2650f,26594` for a fast hit, and
`2654e,26592,265a1` for a miss. Each release executes in one block from
`94bf` to its saved caller. Interior ADD/MOV instructions need no instruction
watching. Complete contiguous block signatures and relevant decision bytes
are rechecked at both ends; the relocated global-store operand is checked
against the actual module base.

Before/after records require the same module identity, item and frame, observed
pre-boundary history, expected cost delta and unchanged metadata fields except
the hash hit's specified time update. Acquisition checks the selected 64-bit ID
and alignment. Release requires a positive lock and an external saved caller;
internal returns are unsupported. These are bounded PC/ESP and state contracts,
not certified CALL/RET retirement or exception-unwind tracking. A trap or missing
postcondition leaves the pending block explicit. A completed miss names no item.

The source stops unsupported on entry to nine other known release blocks:
`38766,421db,45c4a,46139,46606,46b04,46fb9,474e6,47541`.
Their actual ADD sites are three bytes later, matching the predecessor's ten-site
static census including `94c2`. This list is not a completeness claim for all
SoftDrv code or other encodings. These other paths require their own mandatory
post-block/epilogue contracts and actual-decoder tests before broader coverage.

## Optional use and supported boundary

```js
const {SoftDrvCacheObserver, SOFTDRV_SHA256} = require('./deusex-softdrv-cache-observer');
const source = new SoftDrvCacheObserver(instance.exports, {
  workerSlot: 0, softdrvSha256: SOFTDRV_SHA256,
  maxBoundaries: 10000, maxRecords: 128, maxMs: 10000
});
// Existing optional owning slice seam: source.run(instance.exports, steps).
// Persist source.finish('existing-run-bound') at the first existing bound.
```

Browser scripts load the startup library first; the global export is
`DeusExSoftDrvCacheObserver`. No browser dependency graph or natural driver is
changed. Original media-to-live-loader binding remains external: the SHA option
does not hash relocated RAM. INITIALIZING and LIVE are accepted without identity
change; unload, reload, foreign preferred image, ambiguous mapping, instance or
thread stop support. Other threads/concurrent writers and execution through
unobserved loader/scheduler seams remain missing history. Snapshots are not
atomic. Same-PC/ESP duplicate suppression can hide identical repeated landings.

Defaults and hard bounds are inherited: 100000/1000000 observations,
256/1024 records, 1000/10000 ms. The adapter continues the driver's requested
ordinary quanta after collection stops, respects yield/halt, and propagates
original traps. It installs no guest calls/writes, instruction watch, breakpoint,
timer, register restoration, scheduler change or new Worker message.

## Actual queued Worker verification

```sh
DEUSEX_SOFTDRV_RESULT=scratch/runs/20261104-deusex-softdrv-inline-cache/result.json node test/test-deusex-softdrv-cache-observer.js
node test/test-deusex-inline-eviction-observer.js
node test/test-deusex-startup-cache-observer.js
node test/test-deusex-native-cache-observer.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The fixture reuses the predecessor's actual `lib/guest-worker.js` transport and
test-local appended export/accessor seam. Control has no observer adapter and
uses shipped ordinary `ex.run(1)`. Both arms leave instruction watching off.
SoftDrv is loaded INITIALIZING at `900000` and `1100000`, with no Engine or Core
mapping required. Cache/metadata/data/stack/caller and register inputs are
synthetic, explicitly installed between independent original block fragments.
The original DLL entry, full enclosing rendering method, natural lookup chain,
Create miss completion and original process startup are not executed.

Normal and compatibility modules each pass both bases. Per arm, 11 successful
queued slices cover two acquisitions, two releases and one miss. Costs are
`01000040,02000040,01000040,00000040`; both releases preserve the same ID,
metadata/data address and physical links. Neither is an eviction. The failed
lookup leaves the stale item slot intact without manufacturing an acquisition.

Each segment compares the complete 512 MB memory hash and all general registers,
EIP, lazy-flag operands/result/width, yield/halt and returned blocks. Ordered
per-slice state digests, command digests, final state and actual UD2 trap/post-trap
memory/state match. Duplicate reads preserve all memory and architectural state.
Separate negative fixture mutations test missing acquisition/release history,
skipped block, wrong ID/frame, changed original bytes before/after, unmapped
metadata, unqualified releases, release without a lock, abandoned pending block,
INITIALIZING-to-LIVE, unload/reload, foreign image/thread/instance, bad SHA/bounds
and record/time/boundary limits. Those mutations are not native lifecycle events.

The focused matrix, predecessor Core inline/startup/native regressions, callback
census and serialized full build pass. The host-entry census change registers
only this optional adapter, with general ownership still pending. Automatic test
tier membership already includes the new offline test; no tier edit is required.
Tested normal WASM SHA-256 is
`b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf`;
compatibility is
`4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00`.

The next dependency is qualification of the nine remaining release blocks and
any other inline acquisition/invalidating paths, followed by all relevant
loader/Worker seams and cross-thread history. Only then can Core invalidation
and client locks be joined with cache object/ID64/metadata/data/range and actual
descriptor-consumer ordering. This collector alone supports no full-lifetime,
palette-survival, natural game-execution or pixel claim.

Evidence retains exact Git SHAs, relevant binary diffs and owned new-file
patches, with binaries/media referenced by existing path and SHA. No source
archives or module/media copies are needed. Early fixture logs are retained:
the initial miss test incorrectly expected the skipped interior join and reached
the uninitialized Create import; its corrected mandatory fallthrough is above.
