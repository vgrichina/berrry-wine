# Independent final window registry review — 2026-10-20

Accept ecf1850383c4c155aae0650de3ef5ab8b8661326 over ac72debe7522d4d57034627712b8ec000f8e1d92 for the six reported defects at the tested source and compiled-slice boundaries. This is not full-VM or launcher/game qualification. No production changes or main integration.

Read the finalize receipt and complete prior iw-lifecycle-repair-acceptance report at a56f9b6014a939fdf08c22e9dfd877f734e6d9fb. Independently replayed both exact Git revisions, including the prior rejection oracle; fixture reads are redirected to the selected immutable tree, with filesystem writes forbidden. All 348 recorded source input hashes match their respective exact trees.

## Six acceptance oracles

| Defect | Exact baseline | Exact repair | Required |
| --- | ---: | ---: | ---: |
| Foreign production-created unpublished native child | 0 | 700 | 700 |
| Foreign unpublished continuation HWND | 0 | 82 | 82 |
| Foreign unpublished parent containing published child | 0 | 92 | 92 |
| Retained publication after actual owner row removal | 101 | 0 | 0 |
| Retained publication after different-HWND slot reuse | 101 | 0 | 0 |
| Retained publication after original-HWND lifetime reuse | 101 | 0 | 0 |

These are executable regressions, not source-pattern assertions. Native construction uses the actual compiled ctrl_create_child and find_window_core through the actual host find_window implementation. The lifetime oracle uses compiled wnd_table_set, wnd_slot_reset, wnd_table_remove and lookup helpers. Registration and publication checks retain actual W/ExW registration adapters, class-table operations and the CreateWindowEx publication expression.

Source inspection confirms the generation assignment occurs before HWND publication in wnd_table_set. Removal retires the row and calls the host invalidation import before clearing the row; the callback is outside the final WND lock. Host publication identity holds owner plus generation. Registry enumeration resolves each owner's strings from that owner's memory, without borrowing caller pointers. Same-generation retirement stays hidden, while a newly allocated native lifetime can appear without inheriting a retained old renderer class/title. The new 2056-byte region is appended; submitted assertions verify all 265 prior region descriptors unchanged.

## Independent additions and controls

Seven added groups pass:

- An entirely unpublished foreign UTF-16 class containing CJK, Greek and a surrogate pair, with an ANSI Latin-1 title queried through W; a different Greek class rejects. The entire owner memory remains byte-identical across lookup.
- Caller application atoms resolve by name despite different owner atom-slot numbers, through both A and W queries.
- Separate renderers stay isolated; late assignment to the same renderer exposes the foreign native row.
- Three caller contexts agree on native child ordering, continuation termination and rejection of an unrelated continuation HWND.
- Actual allocation changes generation; subclassing and retirement retain it; removal returns zero; slot reuse changes it without altering the adjacent live generation.
- Never-queried publication removal followed by different-HWND and original-HWND reuse cannot revive old metadata; explicit new publication binds successfully.
- Caller removal with a colliding foreign numeric HWND preserves every byte of foreign owner memory and keeps the foreign publication discoverable.

Replayed 89 prior checks with five rejecting mutations, 67 prior independent checks, and 29 submitted focused result entries with three additional rejecting mutations. Candidate execution compiles 75 slice modules including these additions; baseline execution compiles 39. The baseline reproduces all six defects. The eight submitted controls reject missing reset/reconciliation/retirement/encoding/atom-publication and disabled registry/generation/invalidation behavior. Group counts include grouped assertions and imported gate results; they are not counts of independent end-to-end runs.

Existing host-relation tests, import signatures, logical-AND, six fragment checks and generated-map freshness replay pass. Region/silent-stub module imports are not represented here as separate CLI gate executions; the finalize receipt separately records its CLI gates. No new production gate result is inferred from that receipt.

## Reproduction and evidence

Run from a repository retaining candidate, baseline and prior review objects:

    node docs/reviews/iw-registry-independent-final-20261020.js REPO OUTPUT.json --accept

Evidence directory: scratch/runs/20261020-iw-registry-independent-final-oct20/. tests.json includes both exact revision runs, checks, controls, module hashes and input seals; setup.json and validation.json record sparse paths, protected file hashes, cap and WIP checks. receipt.json records the final commit and exact remote verification. The committed JS and report are the recovery recipe; ignored run evidence remains local.

A fresh isolated repository installed exact non-cone sparse patterns before checkout and uses the supplied object alternate read-only. Git reports a deeply nested older alternate as ignored; every required object was nevertheless available, and all replay source seals were verified. No alternate was rewritten. Shared HEAD/index/config and all six original WIP content seals match. Every mutation used a fresh conservative available >= 2277507072-byte gate, retaining the entire 8 MiB allowance rather than subtracting usage. Allocation before publication was 2564096 bytes. Two review-runner quoting errors were corrected before successful testing; neither changed tested production inputs.

## Limits

The ordering/parallel-table fixture, geometry, allocator and callback boundaries are controlled. Full WND allocation/removal is compiled separately; the whole CreateWindowEx handler, full destruction chains, actual Worker RPC/CLI IPC and cross-realm unpublished owner registration were not executed. The registry is module-local; the tests establish same-module shared-desktop contexts and publication-backed foreign owners. They do not establish a desktop registry across isolated realms with no publication.

UTF-16 tests establish the stated code-unit preservation and query behavior, not general Windows Unicode/codepage fidelity; some legacy local string comparators remain fixture imports. Sequential and nested removal-lookup checks do not qualify arbitrary concurrent replacement/reentrant destruction. A matching generated map remains required with a newly compiled VM.

No full VM/build, browser, Boat runtime, runtime403 retry, public deployment, Claude panes, laptop HeroesII/WarcraftIII, workers, refill or main integration. Accept the six repaired source-boundary defects; retain the above runtime limits. Stop after publishing this bounded review.
