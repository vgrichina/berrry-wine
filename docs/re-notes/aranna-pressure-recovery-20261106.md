# Aranna: bounded allocation recovery under demonstrated fragmentation

The allocator now makes one bounded coalescence attempt after its existing
allocation/reservation/reclamation paths fail, then retries ordinary allocation
if a sufficient owned extent exists. Generated controls demonstrate automatic
recovery of the 45,056-byte request in both standard and compatibility modules,
without increasing the fixed 512 MiB memory. This advances
`NEW-GAME-ARANNA-DEMO-20261010` at the measured allocation boundary. It does not
prove a game fix or a mandatory Win32 implicit-compaction semantic.

Evidence: `scratch/runs/20261106-aranna-pressure-recovery/` (ignored).
The original observation remains [aranna-menu-heap-20261105.md](aranna-menu-heap-20261105.md):
the first returned refusal was `$d3dim_pack_fvf_vertices`, 1,408 × 32 = 45,056
requested bytes, 45,064 charged bytes. The original's complete free ownership
and menu input causality remain unknown. After the applicable checks, exactly
one original was launched at the coordinator's request with the pinned repaired
canonical standard module. Reviewed captures show EULA, rendered cinematic and
Main Menu; ordinary Single Player mouse input and Enter both left Main Menu.
Player setup and gameplay were not demonstrated. FPS and audio remain unknown.

## Fail before, recover after

The first regression ran before the source change. A generated ordinary x86 PE
calls public `GetProcessHeap`, `HeapAlloc`, `HeapFree`, and `HeapCompact` in the
production owning Worker after normal real-PE DLL initialization. It holds
16 KiB allocations until allocation returns zero, frees adjacent allocations,
then requests 45,056 bytes. It checks an adjacent live payload guard, EBP/EDI
sentinels and guest completion/branch behavior. There are no heap/backing cursor
setters in this public control. Both modules produced these values:

| Public control | Held fill allocations | Baseline automatic | Repaired automatic | Explicit compact usable bytes | Allocation after explicit compact |
| --- | ---: | ---: | ---: | ---: | ---: |
| Three adjacent frees | 21,920 | 0 | 0 | 49,244 | 6,324,300 |
| Four adjacent frees | 21,919 | 0 | 6,324,324 | 65,660 | 6,340,716 |

The baseline request failed after the frees, then succeeded after explicit
compaction on unchanged memory. The repaired four-free request succeeds inside
the same owned freed span. A successful automatic allocation is freed before
the subsequent explicit-compaction check. Every cell retained live guard
`0x5a1234a5`, EBP `0x77665544`, EDI `0x1234abcd`, completion `0xcafebabe`, and
536,870,912 memory bytes. Pointer stride is 16,416, including Toolhelp metadata.

The three-free control intentionally remains a refusal. Public allocation first
reserves a Toolhelp record (24 charged bytes); that live record can split the
available run into extents too small for 45,056 bytes. After refusal, its cleanup
returns the record; explicit compact can then join the full run. Recovery must
not merge across that live allocation. The four-free control leaves enough
contiguous space on one side of the record.

The second regression calls the real internal `$d3dim_pack_fvf_vertices` with
1,408 vertices and a live source buffer. Under actual exhaustion, three adjacent
freed 16 KiB allocations fail on baseline, then the same pack succeeds after
explicit compaction. After the change it recovers automatically from three
owned frees, both in the low arena and in a sparse arena under backing pressure.
It verifies copied vertex data and all retained live payload guards. Each module
held 18,264 fill allocations; baseline explicit recovery returned 68,161,556.
Repaired automatic results were 68,161,556 (low) and 1,829,687,788 (sparse), both
charged 45,064. Final checks covered 18,201 live guarded allocations per module.
This is an internal temporary-allocation test, not an API-only proxy.

`control-review.json`, `baseline-public/results.json`,
`repaired-public/results.json`, and the two `*-internal.log` files retain the
reviewed values and exact loaded module identities. The canonical repaired
standard module is SHA-256
`33503ea5b68e0d17926530c0908e9ecc4001ddca7fb2f894f65b2ffe91bb90fe`;
compatibility is
`7382b37a7acde7faa512bf40d74bf5ba09e732fdd4e7845e3ed0fb9dbb9c3748`.
Internal test modules have additional exports and separate recorded identities.

## One original observation

The existing app mapping and 28 media references remained usable. The original
used canonical standard module
`33503ea5b68e0d17926530c0908e9ecc4001ddca7fb2f894f65b2ffe91bb90fe`,
not a diagnostic WAT build. Root and seven auxiliary Worker-start records identify
that module. The run-owned wrapper copied scalar `heap_oom_trace` notifications
from the owning Workers and forwarded the original host callback; it made no
guest export calls or guest/module changes. It does not observe successful vertex
packs, complete ownership, or the menu's input decision. Notification counts and
the final observation interval are retained in `original-review.json`.

The session ran 01:47:11.446677–01:53:39.181507Z and exited normally. The final
log contains 176 notifications at 01:53:34.737–01:53:38.735Z: 88 reason-3 arena
commit refusals and 88 reason-1 final ordinary allocation refusals. Final charged
sizes were 34,408 (22), 45,064 (22), and 18,696 (44). The first reason-1 refusal
was 34,408 at 01:53:34.752Z; 45,064 followed at 01:53:34.788Z. These scalar
notifications do not identify a validated new callsite, so matching charged sizes
are not a new vertex-pack callsite proof. The original still encounters real
allocation failures. No game fix, complete free graph, or heap/input causal
relationship is established, and timing/order differs from the predecessor.

An initial status said zero notifications before the final log drain. That was
premature: the late events arrived immediately before closure. The raw log and
`review-correction.json` retain the correction; no original was repeated. A
follow-up generated exhaustion control validates this unchanged scalar hook in
both modules: 14 actual notifications include the 45,064-byte reason-1 refusal,
and all four guest output arrays equal the repaired controls without the hook.

Personally reviewed original captures:

* `original/startup.png`: EULA; accepted with ordinary trusted mouse input.
* `original/after-eula.png`: black transition, not proof of a cinematic.
* `original/loading-review.png`: rendered icy logo cinematic.
* `original/menu-review.png`: cinematic transition despite the filename.
* `original/after-intro.png`: actual Main Menu with Single Player visible.
* `original/single-player-response.png`: still Main Menu after trusted mouse
  input at page `(340,356)`, held 300 ms at 01:50:27Z.
* `original/enter-response.png`: still Main Menu after ordinary Enter down/up.
* `original/late-menu.png`, `original/allocation-outcome.png`, and
  `original/terminal.png`: still Main Menu, with partial heading ornamentation
  in the final frame; no world/character gameplay scene.

The two response captures are menu observations, not gameplay response evidence.
Input was ordinary; no independent new cursor-warp/hit-testing discriminator or
complete owning-Worker WndProc capture was added. The original's full free graph
and heap/input causality remain unresolved. This single session is not an
unchanged original replay, and there will be no second session in this task.

## Implementation and limits

`src/10-helpers.wat` invokes recovery only at the final small/ordinary allocation
pressure boundary, after the existing low/sparse reservation and reclaim paths
fail. A local retry flag allows one attempt. It retries through the existing
serving path without recursively calling `$heap_alloc`. Successful ordinary
allocations do not compact. A refusal still returns zero and emits the existing
OOM trace; oversized allocation errors remain visible. Earlier reason-3 arena
pressure notifications may precede successful recovery.

The actual public compact helper is in `src/09a0b-handlers-base-late.wat`.
Recovery reuses its allocation-free radix sort and same-arena merge, with these
additional pressure constraints:

* Exact-boundary validation shares a 262,144-header-visit budget across bin and
  list checks. The existing 65,536-node cap and 29 radix passes remain bounded.
  Budget exhaustion refuses recovery; it does not guess at unchecked extents.
* All 31 private bins have their chains, exact sizes and tail identities checked
  before flush writes through their tails. The ordinary list is fully validated
  before sorting/merging. An invalid exact boundary short-circuits before another
  translated load of the rejected pointer.
* Every metadata header examined by pressure validation must already be mapped.
  Recovery does not invoke the guest pager or allocate memory to validate itself.
* Free lists, bins and the work counter remain per-instance. Recovery does not
  walk or borrow a peer's private free list. Coalescence never crosses an arena.
* A fully freed carved sparse arena must not become the whole-arena-header shape
  used by the shared releaser to recognize dedicated large allocations. Pressure
  merging leaves the final two extents separate in that case, preventing a peer
  from reclaiming/reusing an arena still referenced by our private ordinary list.
  Partial sparse runs still merge; whole-arena consolidation is deliberately
  limited. Existing public explicit-compaction policy is retained.

This relies on the allocator's existing per-instance free-list ownership
protocol, as public compaction already does. Structural validation is not an
independent live-allocation ownership database and does not repair arbitrary
forged exact-boundary metadata or prove the original's complete ownership graph.
Finite budgets also mean some recoverable but expensive fragmentation may still
return failure. No global private-list publication or ownership redesign was
introduced.

## Validation and reproducibility

Both new regressions passed before/after as described above. Internal negative
controls passed in both modules: peer frees remain unavailable and unchanged;
live guards survive; a one-header budget refuses without list mutation;
malformed/tagged/escaping headers, unmapped/interior links, corrupt bin tails,
cyclic bins/lists and a missing sparse metadata PTE are refused. Trap-on-unmapped
mode proves the missing header does not enter the pager. A fully freed retired
carved sparse arena retains two free nodes; peer reclamation returns zero and
the arena remains resident. An actual adjacent pair across arena boundaries
stays separate. Fast successful allocation leaves the compaction counter unused.

Thirteen neighboring heap checks passed: GlobalCompact, HeapValidate, heap API
handles, bins, free-block validation (including noncontiguous sparse backing),
free-list cycles, arena release, cross-instance release, arena tail reuse,
large-free map pressure, empty-arena reuse, OOM traces and OOM stacks. The
ordinary owning-Worker default reserve/real-SEH commit-resume regression also
passed in both modules with committed controls. See `control-review.json` for
individual logs. The unchanged GlobalCompact and HeapValidate fixtures duplicate
the canonical `test_get_last_error` export. Raw GlobalCompact fails identically
on the baseline before execution. A run-owned runner renames only the duplicate
fixture export and references; GlobalCompact assertions pass on baseline and
repair, and HeapValidate assertions pass on repair. Shared fixtures were not
edited. Three initial neighbor launcher failures passed a wrapper's mode word as
a module filename; their logs are retained, and direct unchanged reruns passed.

`flock /tmp/wine-build.lock bash tools/build.sh` passed on baseline at
01:35:39–01:36:14Z and after the change at 01:37:19–01:37:52Z. No production
source changed after that passing build. Layout hash `7613635e22710ee1` stayed
unchanged. Canonical standard/compatibility build outputs were saved and loaded
by the public tests, not inferred from the current files after execution.

Tested base: main `c34ec10ccd60e128fa3df69e009c0483187262b3`.
`baseline-source.binarydiff`, `applied-source.binarydiff`, final source records
and new-file patches preserve relevant uncommitted changes, including the
pre-existing untracked `lib/wininit-boot.js` dependency. `committed-source.json`
records the final published SHA. Git is the source archive; no source trees were
snapshotted. `media-references.json` records the existing 28 files under
`scratch/game-media/aranna-demo-20261105/extracted/` by path/SHA-256, rehashed in
place; no media was copied or downloaded. `retained-control-references.json`
identifies the prior fragment controls without copying them.

The Conan matrix-write2358 then legacy-point discriminator0025 exact final
releases and independent cleanup preceded execution. The immutable window was
01:35:25.195345–02:20:25.195345Z. One coordination mistake is recorded on the
board: the new test drafts were copied seconds before the OWN append, after
board review with no other owner; production source was edited only after OWN
and successful baseline controls. No boxes were assigned (ID/state/expiry N/A).
Final cleanup and artifact hash verification are retained in the run. Because
Aranna has no exact candidate-corpus manifest entry, the final investigation
record remains unlinked; it is not attached to an unrelated dashboard candidate.

Next work is to establish the original's full free ownership and menu decision
following ordinary input in a separately authorized investigation. The tested
allocator improvement alone supplies no gameplay acceptance.
