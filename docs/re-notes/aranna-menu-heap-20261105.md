# Aranna: measured menu heap refusal boundary

One original run reached the EULA, rendered cinematic, and Main Menu, but did
not reach Single Player setup or gameplay. The first returned heap allocation
failure was an emulator temporary vertex-packing allocation, not an identified
guest malloc. No production repair is justified by this evidence alone.

Evidence is retained in `scratch/runs/20261105-aranna-menu-heap/` (ignored).
The tested source was main `11a9dc75cf3701d66e001b1374533a81a97f7099`.
`validation-source`, `controls-source`, `before-original`, and `final-source`
records contain exact source hashes, relevant `git diff --binary`, and patches
for new run-owned helper files. Git is the source archive. The 28 canonical
media files were referenced and rehashed in place at
`scratch/game-media/aranna-demo-20261105/extracted/`; none was copied or downloaded.

## Boundary actually observed

`observations.jsonl`, `heap-summary.json`, diagnostic module callsite tables,
and `console.log` distinguish three events:

* At 2026-11-06 00:44:30.614Z the first observed failed backing placement was
  the 65,536-byte leaf of a split sparse commit attempt, path 201. This is not
  itself a returned heap allocation failure: the allocator can reclaim wholly
  free arenas and retry.
* At 00:44:32.442Z the first OOM notification requested a 1,048,576-byte arena,
  reason 3, followed at 00:44:32.457Z by 45,064 charged bytes, reason 1.
* At 00:44:32.465Z the first recorded returned allocation refusal was site 430,
  `src/09ab-handlers-d3dim-core.wat:2442`, `$d3dim_pack_fvf_vertices`:
  1,408 vertices times 32 bytes = 45,056 requested bytes, 45,064 charged bytes
  including header/alignment. Guest EIP was `0x65f8d8`; the first copied stack
  word was `0x65f8ff`. Subsequent same-site failures requested 18,688 and 34,400
  bytes, explaining the 18,696 and 34,408 charged sizes. Stack words are caller
  candidates, not a validated unwind.

Four bounded censuses completed under the existing map writer lock. The first
two show actual backing placement exhaustion:

| Measured quantity | 00:44:30.614Z | 00:44:32.368Z |
| --- | ---: | ---: |
| Sparse map records | 522 | 524 |
| Backing occupied bytes | 301,248,512 | 301,350,912 |
| Backing free bytes, total | 741,376 | 638,976 |
| Largest backing gap | 327,680 | 327,680 |
| Shared heap arenas | 298 | 298 |
| Arena reserved bytes | 315,269,120 | 315,371,520 |
| Arena live charged bytes | 9,183,360 | 9,183,360 |
| Arena high-water bytes | 299,874,152 | 299,947,200 |
| Sparse backing mapped to heap arenas | 255,500,288 | 255,602,688 |
| PTE/backing inconsistencies | 0 | 0 |

The fixed 512 MiB module has a 301,989,888-byte sparse backing range
`[0x08000000,0x1a000000)`. Both aggregate free backing and its largest gap are
smaller than a minimum 1 MiB arena. No overlapping map ranges were found.
The low window also had less than a minimum arena remaining; current low and
sparse bump tails were about 3 KiB. The second census follows the existing
whole-free-arena reclaim/retry path; that path was not missing or bypassed.
There were 982 retained decommitted pages, so these numbers describe backing
placement/ownership, not simply resident committed payload.

Most arena reservation was not live charged data. This supports stranded free
space/fragmentation as a substantial pressure mechanism. It does not prove a
complete free-block graph, absence of a guest leak, or absence of corruption
outside the checked map/PTE structures. Arena charges may race with peer frees
even while map/reservation records are locked. Ordinary free lists are local to
instances, while the arena table is shared. The current-instance ordinary list
hit its 512-node census cap; peer lists were not walked. Both large-block
allocation/free journals hit 8,192 records at 00:43:08, before the first refusal.
Consequently the retained prefix cannot assign every live block at failure.

## Generated comparison, without changing the original

`fragment-controls.json` records four ordinary owning-Worker PE cells:
standard/compatibility modules, each baseline/diagnostic. All guest output words
were identical. With unchanged fixed memory, each case:

1. Allocated four 16 KiB blocks, retained a guard in the fourth, then held
   another 21,920 allocations until ordinary `HeapAlloc` returned zero.
2. Freed the first three through `HeapFree`. A 45,056-byte request still failed.
3. Called ordinary public `HeapCompact`, which returned 49,244 usable bytes.
   The same 45,056-byte request then succeeded inside the freed span, and the
   adjacent live guard remained `0x5a1234a5`.

The initial review incorrectly assumed a 16,392-byte pointer stride. All four
cells had already completed with identical results: the real stride is 16,416,
because each public allocation reserves a 16-byte Toolhelp record (24 charged
bytes), and `HeapFree` frees that record too. Source confirms this in
`src/09a0-handlers-base.wat:5491` and `src/09a0d-toolhelp.wat:33,73`.
The failed assertion/log and correction are preserved; corrected assertions
were run offline against retained cells, without a runtime repeat.

This demonstrates recoverable allocator fragmentation in a generated control.
It does not establish that the original's complete free graph can satisfy the
request after compaction, nor that implicit coalescence is a required Win32
semantic. Existing public `HeapCompact` already sorts/coalesces same-arena
extents; ordinary allocation misses do not invoke it. No speculative global
coalescing change, memory increase, guest modification, or failure suppression
was made.

## Input and reviewed product captures

The original used trusted ordinary mouse holds and Escape/Enter key events.
Actual owning-Worker copied `DispatchMessageA` WndProc frames, rather than sender
logs alone, establish delivery of Single Player mouse down/up and Enter
down/character/up. The down coordinates were `(398,152)` and the up coordinates
were `(400,300)`; copied `GetCursorPos` outputs also changed accordingly. Cursor
recentring/mapping semantics were not independently isolated, so this is not
proof of correct game hit testing or an input defect. No heap/input causal claim
is made from their temporal proximity.

Personally reviewed captures in the run:

* `startup.png`: original EULA; the visible accept button was clicked.
* `loading-review.png`: rendered Gas Powered Games cinematic. Earlier black
  `after-eula.png`/`intro-review.png` frames do not prove a cinematic by themselves.
* `menu-first.png`: title splash, despite the filename.
* `main-menu-review.png`: actual Main Menu with Single Player visible.
* `single-player-response.png` and `enter-response.png`: still Main Menu after
  the ordinary inputs; no player response/gameplay was reached.
* `heap-refusal-menu.png` and `terminal.png`: still Main Menu; partial heading
  rendering occurred in some intermediate frames. `terminal.png` visibly has
  Main Menu and Single Player, not an in-game scene.

There are no two gameplay response captures to review. FPS and audio are unknown.

## Validation and observer limits

The locked full `tools/build.sh` passed, followed by focused tests:
`test-heap-oom-trace`, `test-heap-oom-stack`, `test-heap-arena-release`,
`test-heap-arena-cross-instance-release`, `test-heap-arena-tail-reuse`,
`test-heap-large-free-map-pressure`, and `test-default-reserved-worker-web`.
Twelve ordinary owning-Worker heap/virtual/input cells passed in both modules,
baseline versus diagnostic, including exhaustion, accepted free/reuse, WndProc
arguments, return/stack behavior, and nonvolatile register/branch sentinels.
An initial free-journal review assumption confused an allocator-created tail
with the first explicit guest free; retained cells were corrected/reviewed
offline, without runtime repetition. Sixteen pager cells passed across both
modules, baseline/diagnostic, committed/reserved and eager/lazy: saturated generic
API observations did not consume the independent targeted validator/pager budgets,
and real guest SEH committed a reserved page with nested ordinary file input.

Baseline modules were byte-identical to canonical build outputs:

* standard `d42c4fbcc91d8f20eac4c489f08d9cb2730f4bf2288d72903a09864c4ebb2f09`
* compatibility `6ca9a332279300ec89ccee7f9958c28c2e917ee36c6f23851e1c0782eb975ed3`

Diagnostic module identities were:

* standard `072232b8499d982f4a1694c59a994616873fd8661551e539e43f550ae6d96e7e`
* compatibility `f1a25d30e52f398f9f1224d42a33fdb640ec9f1a78d37c5a981e3a485fab2f00`

The original root and seven auxiliary Worker starts all identified the standard
diagnostic module above. A compiler-helper omission of the canonical region
layout section was caught before execution; all four unexecuted unstamped
artifacts are retained. The helper was corrected to compute the real canonical
layout stamp rather than copying or bypassing one.

Observation was passive copied scalar state through the actual owning Worker;
no live CPU setters, execution exports, breakpoints or guest patches were used
for the original. The run transform preserved single evaluation of allocation
calls and recorded exact source sites only on refusal. Census bounds, journal
saturation, zero observer errors and module identities are explicit in the logs.
Mirrored host-instance calls are not a complete owning-Worker journal. The
targeted validator and pager budgets each reached 128 in the original; the pager
prefix contains 32 complete episodes, not proof about later activity. Existing
hot compiled block coverage remains limited. Observation changes timing.

The predecessor `25cd5f11331d880ea27277b8b2f0427fdf1bcee2` remains distinct:
its 2,538 heap refusals, first 1 MiB/34,408-byte notifications, generic observer
saturation before the target pager, and menu-only captures established neither
allocator defect nor input causality. Its later filtered helper controls were
not a second original. This run supplies a new measured boundary, not a
retroactive interpretation of that missing evidence.

## Release and next work

Source-only gating was preserved through Conan2300, legacy2305, and
D3D9multiply2320 exact final releases and independently verified cleanup.
The immutable execution window was 00:31:06.041430Z–01:16:06.041430Z on
2026-11-06. Exactly one materially changed original ran, 00:38:55–00:46:27,
then exited normally; no unchanged original was repeated. Generated follow-up
controls ended at 00:50:36. Independent cleanup at 00:52:18 verified 159 absent
PIDs, 24 refused ports, 19 absent profiles, four free locks and no heavy runtime.
No boxes were assigned; box ID/state/expiry are not applicable.

The remaining blocker is the original's complete free-block ownership and the
menu's decision after delivered input. A future separately authorized run should
first validate an exhaustive bounded fragmentation discriminator and cursor-warp
delivery control, then choose one original observation. These findings do not
authorize an additional original in this task. No shared source was changed;
the committed deliverable is this finding, with reproducible run-owned controls.
