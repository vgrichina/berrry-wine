# Deus Ex startup cache source and one internal invalidation boundary

`lib/deusex-startup-cache-observer.js` supplies a read-only Worker-local source
without the initialized Engine/Draw collector required by
[d3ef3fedb's method observer](deusex-native-cache-lifecycle-contract-20261104.md).
Original Core Init executes from its entry through return in the shipped queued
Worker test. A separate, bytes-proved FlushItem cut-point pair captures actual
ID invalidation **before physical coalescing can recycle metadata**. This is one
supported native invalidation boundary, not a complete cache lifetime source.
Core Create inline eviction and SoftDrv inline acquisition/release stay unknown.

Evidence: `scratch/runs/20261104-deusex-startup-cache-observer/`. Offline only:
no game, Chrome, remote API, box, subworker or deployment. No box was assigned;
box ID/state/expiry are not applicable. Runtime lifecycle remains coordinator
owned. Existing renderer/tier/MDK2/Stronghold files were untouched. The separately
claimed callback census registers this new host execution adapter with ownership
still pending; it does not assert general callback safety.

## Original bytes and supported cut points

The existing original remains at
`test/binaries/candidates/deus-ex-demo/installed/system/core.dll`, 790528 bytes,
SHA-256 `2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167`.
Preferred base is `0x10100000`, image size `0x1b8000`. Media/module copies and
source archives are unnecessary. Tests independently parse the PE sections to
check the original control-flow bytes, then load and relocate that entire
original through the actual WASM loader.

All following addresses are RVAs:

| Site | Original contract and observation |
| --- | --- |
| `24a00` Init | ECX cache object; stack size, metadata count, supplied storage, segment size; returns with `ret 16`. Does not require Engine. |
| `24c96–24ca1` FlushItem decision | Load cost, compare signed against `01000000`, `jge +7b` to `24d1e`. |
| `24ca3` unlocked fallthrough | Mandatory pre-clear block entry after the decision. ESI is the argument item, EDI is zero; saved EBP/stack must match the pending FlushItem frame. |
| `24ca6`, `24caa`, `24cad` | Clear ID low, ID high and cost. No branch/call occurs between the pre-boundary and these three stores. |
| `24cb0` conditional branch | After all three stores, `je +2a` reaches `24cdc`, otherwise execution falls through to `24cb2`. These are the two mandatory post-clear block boundaries. |
| `24cb2–24d05` | Original optional previous/next coalescing, physical-link rewrites and metadata free-list insertion. These stores are not individually retirement observations. |
| `24d1e` locked branch | Captures `locked-no-clear`. Flag 1 returns without clearing; flag 0 follows original diagnostic handling, whose full behavior remains unqualified here. |

The pinned decision/clear bytes are:
`8b4610897dfc3d000000017d7b8b4618893e3bc7897e04897e10742a`.
The source checks them at the supported cut points. The ordinary decoder tests
deliver the pre-clear PC and one post-clear PC with instruction watching **off**.
This is evidence that the contiguous clear block executed, with its original
pre/post state, rather than a claim that every interior store was reported.
Traps, missing pre-boundaries or frame mismatches cannot produce a successful
clear pair. The later `24cdc` landing after a previous-neighbor merge is not
counted a second time.

Each clear pair records cache object, 64-bit ID as a fixed-width hex string,
metadata address, data pointer, physical `[data,next.data)` capacity, lock/cost,
time/segment bytes, physical/hash links and actual PC/ESP. Pre/post records share the method
entry and ordered source sequence. Return snapshots retain the resulting
physical chain and free-metadata head. Requested size, physical capacity and
Create's aligned EAX return are distinct values. None is an allocation serial.

## Startup use and limits

The API accepts the actual owning WASM exports directly, never caller-supplied
register or module snapshots:

```js
const { StartupCacheObserver, CORE_SHA256 } = require('./deusex-startup-cache-observer');
const source = new StartupCacheObserver(instance.exports, {
  workerSlot: 0, coreSha256: CORE_SHA256,
  maxBoundaries: 1000000, maxRecords: 256, maxMs: 10000
});
// In the existing owning execution loop, use the returned total block count.
const retired = source.run(instance.exports, requestedBlocks);
// Preserve the first terminal report, or explicitly finish at the run bound.
const report = source.result || source.finish('existing-run-bound');
```

For browser Worker use, load this standalone script with the same verified
version binding as the rest of that Worker's graph; the global is
`DeusExStartupCacheObserver`. It has no Draw or Engine dependency. This task adds
no browser message, automatic import or natural-driver installation. The test
uses a local accessor to the shipped Worker's existing slice seam; no replacement
decoder, scheduler or fabricated lifetime delivery is involved. An integration
must route **all relevant owning execution**, including any loader-driven runs,
through observation before the relevant cache Init. Direct loader runs or other
execution outside this adapter are missing history. No natural run is qualified.

The source can attach before Core exists. It accepts the actual loader's
INITIALIZING and LIVE states, allowing their transition without changing identity.
It rejects foreign preferred-image identity, ambiguity, unload or a changed
index/base/size/generation. The caller must independently bind the original media
SHA to the live loader mapping; a supplied SHA is not a live relocated-image hash.

Defaults are 100000 delivered observations, 256 records and 1000 ms. Hard maxima
are 1000000, 1024 and 10000 ms, with at most 16 pending methods and 32 physical
records per snapshot. Time/record/boundary/read/frame failures stop collection
explicitly. They do not alter guest execution. `run` continues its requested
ordinary quanta, respecting the existing yield/halt; the driver owns its existing
execution bound. Guest traps propagate, retaining the pending observation state.
No timer, register restoration, breakpoint, instruction-watch setting, guest
function call, guest mutation or forced Draw is installed.

Init/Create/CreateNewFreeSpace/MergeWithNext/FlushItem entries and saved-PC/ESP
returns are method intervals. They are not certified CALL/RET retirements or
cache lifetimes. Initial attachment, undelivered entries, tail calls, unwinds,
unobserved modules/threads and concurrent writers remain explicit gaps. Snapshots
are read-only but not atomic against other Workers. The same PC/ESP can suppress
a tight-loop landing conservatively. An observed Init establishes that interval
for that object, never absence of older objects or earlier process history.

## Verification and precise remaining work

```sh
DEUSEX_STARTUP_RESULT=scratch/runs/20261104-deusex-startup-cache-observer/startup-result.json node test/test-deusex-startup-cache-observer.js
node test/test-deusex-native-cache-observer.js
node tools/callback-ownership-census.js
flock /tmp/wine-build.lock bash tools/build.sh
```

At Core bases `900000` and `1100000`, with no Engine row and no instruction
watching, the actual shipped Worker receives ordinary queued `slice` commands.
The control uses its ordinary `ex.run(1)` path with no observer adapter. Every
slice's returned count, registers, lazy-flag tuple and halt/yield state are hashed
in order and compared, along with commands, the complete 512 MB memory, final
state and actual UD2 trap/post-trap state. The fixture executes 82182 pre-trap
slices per arm. Every observed arm delivers one complete Init, nested original
CreateNewFreeSpace helpers, two clear pairs and one locked rejection.

Fixture cache/stack/storage/caller and the allocator dependency are synthetic.
The allocator's guest stub returns preallocated metadata storage; original Init
performs all cache initialization, physical-list construction and hash clearing.
No Core instruction is replaced. This does not claim execution of original
DllMain, original allocator initialization or game startup. The fixture then
executes original Create, Unlock, Flush, FlushItem and failed Get. The failed
lookup returns zero while leaving its stale out-reference unchanged.

Three Create snapshots have physical-chain lengths 3, 4 and 3. FlushItem returns
have lengths 3 (locked unchanged), 4 (first item cleared) and 2 (both adjacent
free spans coalesced). The following split reuses recycled metadata at `item+96`.
The first metadata/data address and ID `5566778811223344` recur after the two
ordered invalidations. Records retain that ordering without interpreting reuse
as a complete lifetime. Failure controls separately cover INITIALIZING→LIVE,
reload, unload, foreign preferred-image/instance/thread, missing entry/pre-clear,
bad return stack, bounds, malformed pin/limits and active-adapter trap propagation.
The locked full build passes; normal WASM SHA-256 is
`b70c420e0a29c8664df1c3ed8b8074b590c342ed2a60078172b30e90922800cf`,
compatibility `4771c78ba2cc1b84875e1e90a743f7fa624975764607c3d86a516fbcd1cd5d00`.
The existing native observer regression also passes both bases in block and
instruction fixture modes. The new startup qualification uses block mode only.
Early fixture setup failures (allocator RVA, insufficient loop bound and terminal
trap placement) are retained in the run; they caused no production decoder change.

These controls are explicit fixture mutations after the parity snapshot, not
native lifetime evidence.

Remaining prerequisites are Core Create's internal multi-item eviction/unhash/
recycling/publication cut points, other invalidation paths (including Exit and
unqualified MergeWithNext execution), SoftDrv inline hit and release sites,
cross-thread/concurrent history, loader-run integration and descriptor/consumer
ordering under one verified module binding. Preserve unsupported paths as
unknown. The new source closes startup readiness and one genuine internal clear
boundary only; it does not authorize a full-lifetime or palette-survival claim.

The run records exact Git SHA, relevant binary diff and owned new-file patches;
Git is the source archive. Logs/results are retained with path/SHA references,
and any compression uses verified roundtrip gzip while retaining predecessors.
