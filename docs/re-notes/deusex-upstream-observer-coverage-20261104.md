# Deus Ex upstream coverage: descriptor block entry fixed; lifecycle prerequisite remains

The optional observer now captures the descriptor at the **ordinary setup block
entry**, and can retain setup observed before the first Draw. Actual queued
Worker/WASM fixtures reproduce the old omission and verify the correction with
identical guest execution. **The full requested instruction-writer plus
allocation/free chain remains unavailable:** there is no native cache-item
lifecycle event source, and the adapter still reports boundary intervals rather
than certified instruction retirement. No natural run or visible-pixel result is
claimed.

Predecessors are [the original natural trace](deusex-preflighted-original-writers-20261104.md)
(`a3a6746c1`), [physical Worker integration](deusex-worker-observer-integration-20261104.md)
(`0d3a8cbed`), [ordered recording contract](deusex-ordered-producer-observer-20261104.md)
and [upstream address analysis](deusex-upstream-light-provenance-20261104.md).
Evidence is `scratch/runs/20261104-deusex-upstream-observer-coverage/`.

## What the recovered trace can establish

`audit.cjs` checks the exact recovered `ordered.json`: **481,009 bytes**,
SHA-256 `76416e19d0e1b59b143475c17605c453da5929e4e6038141db71601bd956634f`.
Its terminal state is `time-limit`, monotonic start **14687.225 ms**, stop
**24687.495 ms**: 230,874 delivered boundaries, 27,556 decoded store candidates,
zero overlaps, 203,318 unrecognized boundary instructions, no record/pending
drops. The 228 retained records are one pointer selection and 227 consumers;
all consumers have null descriptors. First/last consumer sequences are
**57617 / 79890**. There is no evidence that extending the ten-second cap would
recover an earlier writer. Limits are unchanged and no restart is introduced.

The accompanying exact `producer.json` is 873,320 bytes, SHA-256
`b0824523cd758e2ccb723abcf44f612ef08cb94e79e05471401513ee6a7213ea`.
Across its complete 27.819-second collector interval it counts **538** deliveries
of SoftDrv RVA **0x36472**, and none at
**0x3647f / 0x36483**, where the old observer sampled descriptors. The first
retained 0x36472 sample has ECX **0xfffffffd**. Original code first executes
`mov ecx,[eax+4]`, then loads coordinate MM7, advances EAX and reads descriptor
texture data. Descriptor/MM3/MM4 loads and shift/mask stores are interior to
this ordinary decoder block. Waiting for their PCs misses setup even while the
upstream block executes repeatedly. Reading incoming ECX would capture a stale
value. This aggregate does not locate all 538 deliveries within the ordered
observer's shorter interval. The corrected sampler reads **[EAX+4] before the load**, after verifying
the exact original 13-byte load-chain signature, then captures 48 descriptor
bytes. A changed signature or unmapped input terminates observation explicitly.
This is a pre-load input observation, not an assertion that the block retired.

These artifacts retain selected records, aggregate counts and first samples per
distinct PC, not all 230,874 register/code boundaries. Their ordering cannot
reconstruct skipped instructions or the missing descriptor's memory bytes after
the fact. “Unsupported” includes ordinary loads, jumps and register operations;
it does not mean 203,318 unsupported writers. Zero overlaps establishes neither
absence of stores nor absence of unsupported/interior/API/concurrent writers.

## Narrow observer change

`lib/deusex-ordered-producer-observer.js` adds the guarded block-entry descriptor
read. Each consumer links its descriptor input sequence. Explicit `preDraw:true`
on `attach` also samples callbacks with `owner.frame === null`; those records
retain null frame identity rather than inventing a Draw. Setup can cross only
the transition into the first Draw in the same complete loaded-module identity.
A new Draw or changed module generation clears it; pending store pairs never
cross identity changes. Pre-Draw history is input provenance, **not allocation
identity or evidence that memory survived unchanged**.

Results add pre-Draw and missing-descriptor counters, a first-byte histogram of
unrecognized instructions (at most 256 keys), and the first 16 unsupported code
samples. Explicit gaps name unavailable pre-attachment history, boundary-only
granularity, missing allocation/free events and unsupported decoding. Consumer
allocation lifetime is always `unknown`. Record, boundary, sample and time
limits remain bounded. The store decoder and consumer arithmetic are unchanged.

The module remains optional. Default attachment still requires a Draw. No
ordinary Worker dependency graph, scheduling policy, emulator instruction,
guest memory, register, stack, argument or game configuration changed. The
existing natural driver still installs after readiness and attaches only when
its first frame exists; it must be recomposed explicitly to use pre-Draw mode.

## Actual composed execution and regressions

Run these local Node commands from the checkout:

```sh
node test/test-deusex-ordered-producer-observer.js
node scratch/runs/20261104-deusex-upstream-observer-coverage/transport.cjs
node scratch/runs/20261104-deusex-upstream-observer-coverage/audit.cjs
```

`fixture-loader.cjs` checks the predecessor integration helper's exact SHA-256
`a7e61017…`, then applies narrow fixture deltas in memory. It executes original
SoftDrv bytes starting at 0x36472 **before** a synthetic Draw entry, then the
existing seven store candidates and consumer marker. `transport.cjs` checks and
reuses the exact `b201cb17…` physical Node transport. The actual shipped
`lib/guest-worker.js`, queued `slice` commands, GuestRpc broker, loaded WASM,
decoder and OwningDrawObserver execute; no parser-only x86 executor substitutes
for them. Only the predecessor's appended fixture accessor exposes its instance
and collector. All fixture memory/stack/module rows and bridge jumps are
synthetic. Consumer execution ends at UD2; this is not pixel-math qualification.

Both baseline and changed observers run the same fixture, with collector-only
controls. The baseline is loaded directly from Git `666137016`, without a source
snapshot. It loses every pre-Draw descriptor. The changed path retains the
descriptor and links it to consumers in both modes. **29 instruction-mode
slices** expose seven stores, including both pre-Draw shift/mask stores;
**8 ordinary-block slices** expose four and miss those two interior stores plus
one palette-lane store. This directly reproduces the granularity gap. The
instruction-watch facility is armed only in isolated fixtures, equally in
controls; the observer never arms it. All records remain conservatively labeled
`boundary-interval-only`; repeated callbacks are not new retirements.

Baseline/new/control arms match full 512 MB memory hashes, register/MMX traces,
returned counts and trap/post-trap states within each mode. Explicit observation
also preserves full memory and architectural getters. Fixtures assert stores
are recorded before the consumer record, including pairs completed at that
same pre-consumption boundary. They explicitly assert lifecycle **unknown**;
there is no fixture claiming allocation/free proof.

The portable regression covers stale ECX, changed signature, pre-Draw lineage,
later Draw/module rejection, bounded unsupported samples and existing
instance/thread/throw/restoration controls. The existing physical integration
passes raw/collector/observed parity at two bases in both granularities,
zero-to-zero store retention and generation-change pending rejection. The
existing owning-Draw suite passes for local exports and physical Workers,
including original EXE/Engine loading, identity and ESP/return cases.
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Tested normal WASM:
`06650eb0804c3c3c686ee638c61bc66e3ef8d08e74480750ebc0280ca3db1fa2`;
compatibility WASM:
`62f299d07ddefa67c0fff4360d322f75153f2d42ac68130b85897c67c7085609`.
Concurrent renderer work is captured in the relevant source diff, not attributed
to this observer change. No binary was copied into evidence. Earlier helper-hash
and strict sequence-order assertion failures remain in logs; the latter was
corrected to allow a completed store pair preceding a consumer record at the
same boundary. Neither was a guest failure.

## Concrete missing prerequisite and separately allocated natural recipe

The original indirect call at RVA **0x265af**, through IAT RVA **0xaf364**, resolves
in the original PE to
`Core.dll!?Create@FMemCache@@QAEPAE_KAAPAVFCacheItem@1@HHH@Z`.
`audit.cjs` independently resolves this import and verifies the call bytes.
This is a native cache-item creation candidate, not proof that the observed
palette came from it. Cache hits can select an existing item at 0x26596; the
creation return can publish one at 0x265ba. A malloc/free-only observer would
not establish cache-item eviction/reuse identity. The current observer has **no
event source** for native FMemCache item creation, eviction, release or reuse.
`get_free_list` is also unsuitable as a passive lifetime source: its exported
implementation calls `heap_bins_flush`, and a snapshot cannot supply allocation
serials or missed transitions. This task does not call it.

The full goal therefore stops at this specific unavailable prerequisite. Before
a separately allocated natural run can claim the requested chain, its prepared
driver needs verified live Core cache-create/eviction/reuse contracts and a
bounded read-only event source, plus instruction-retirement/gap reporting that
covers the relevant stores. Those contracts and events are absent from the
recovered trace. Fabricated fixture lifecycle callbacks would not close the gap.

For the implemented **partial** descriptor path, an owning-Worker caller can use
the published `attach(owner, {workerSlot:0, moduleSha256, mmxBase, drawId,
preDraw:true, limits:{boundaries:1000000,records:256,milliseconds:10000}})` before
its first frame, once Engine/SoftDrv identities and the current main-slot MMX
binding are valid. Persist `handle.stop(...)` at the terminal boundary. Fresh
values and module identity checks are required; module absence fails explicitly.
Installing after readiness cannot recover initialization that predates readiness.

A full natural attempt must install its startup observation before that history,
retain module/thread/cache-item identities and descriptor/store sequences before
the first relevant consumer, and report every unsupported or omitted interval.
It must preflight the newly composed driver and exact inputs, rerun the actual
Worker/decoder controls, and verify served module hashes/isolation immediately
before one original launch in a separately assigned box. Preserve ordinary
guest calls and inputs, the existing bounds and first terminal result; no forced
Draw, repaint, guest writes or limit extension supplies missing evidence. This
is a conditional recipe, **not a qualified full-lifecycle launch package**.

## Evidence and custody

Git SHA, relevant binary diff (including concurrent build inputs), and small
owned-new-file patches provide recovery. Original logs/media/modules are
referenced by path and SHA; no predecessor artifact was changed and no source
archive or media/module copy was made. All evidence in this task is local.
No Chrome, original game, remote API, allocation, lifecycle action, subworker or
deployment ran. No box was assigned; box ID/state/expiry are not applicable and
coordinator lifecycle ownership is unchanged. This worker publishes the narrow
tested improvement and concrete remaining prerequisite, then stops.

The run-evidence checker has no error, missing artifact or invalid record for
this run. Its global exit 1 retains 16 errors in unrelated runs.
