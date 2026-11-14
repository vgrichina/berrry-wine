# Original Quake III shader loading cost, 2026-11-14

Original shader rescanning is established; a dominant native emulator bottleneck
is not. This offline investigation makes that distinction concrete without
another gameplay retry or an unsupported optimization. Arena entry, combat,
and the wider 27-game scope remain unproved by this work.

Evidence: `scratch/runs/20261114-quake3-shader-load-cost/`. Inputs are the
[retained BSP-loading investigation](quake3-bsp-loading-cause-20261114.md),
its original executable disassembly and observations, and existing registered
media. No guest, browser, Wasm runtime, build, or box was launched.

## How much original scanning is expected

The exact original PE's `0x45ed98..0x45ee80` reads the shader files, allocates
their combined text, and concatenates them in reverse enumeration order with
one leading LF per file. Reverse ZIP enumeration of the existing 27 shader
files reconstructs 583,181 bytes, comprising 583,154 file bytes and 27 LFs.
SHA-256 of the reconstructed text is
`605d6b3d1c30a867a1eec7cd5698850eee340ef3d0336e34ffcb924b04066b7d`.
The buffer itself is not retained or substituted into the guest.

This ordering is independently supported by **476 of 476** eligible retained
parser observations: the 40 bytes at each sampled EAX match the reconstructed
text at exactly `EAX - [0x5cd2dc]`, across both observed buffer allocations.
The largest matched offset is 582,989. Eligibility requires EIP in an input
cursor instruction range and at least 40 retained bytes; EAX at token-return
instructions is not mistaken for a cursor. This verifies much more than
finding a common substring somewhere in a shader file.

The BSP shader lump contains 94 distinct names. `analyze.py` transcribes the
original token, line-skip, brace-skip and case-insensitive comparison paths
to model one cold lookup per entry. The original lookup resets its cursor
from `0x5cd2dc` at `0x45bc12`, parses at `0x45bc42`, compares at `0x45bc77`,
and continues through line/brace skips. No precomputed text-name index is
used on this miss path. Its earlier hash table caches constructed shaders;
it does not eliminate the first text search.

| Cold 94-entry model | Work |
| --- | ---: |
| Names found in explicit shader text | 28 |
| Names reaching text EOF / subsequent fallback path | 66 |
| Aggregate cursor traversal | 46,303,950 bytes |
| Token parser calls | 2,284,431 |
| Case-insensitive name comparisons | 1,430,909 |
| Compared byte pairs | 3,837,067 |
| Token payload bytes | 20,233,376 |

These are **modeled work counts**, not measured emulator execution, CPU time,
or a completion-time prediction. Runtime cache hits and additional lightmap
variants change the number of searches; successful definitions also require
stage parsing, image loading and other work beyond this model. A missing
explicit definition can legitimately use the fallback path. It is not a
missing-file or emulator semantic defect. The model preserves the actual
`0x426510` depth-zero entry behavior, including returning after one nonbrace
token, rather than substituting a preferred parser algorithm.

## What the actual counters attribute

In retained samples from 540–600 seconds, 240 event-loop observations include
105 token-parser PCs, 18 line-skip PCs, 15 case-compare PCs, four brace-skip
PCs, and eight lookup PCs. The remaining 90 PCs are outside these ranges.
These are batch-boundary observations, **not unbiased CPU-time fractions**.
The same interval advances 128,280,000 executed blocks, 2,718 API calls, and
860,734 visits counted by the original parser/line-skip newline global
`0x58e934`. That global counts revisits too, not unique source lines.
Process CPU advances 55.652918 user seconds and 3.620775 system seconds.
The 31 distinct query names and changing pointers establish advancing work.

Shader text is already resident at the high guest addresses observed around
`0x7e...`. The byte-load path in unchanged `src/06b-core-handlers.wat`
(`$th_movsx8_ro`) calls `$gl8`, whose direct-window test misses for those
addresses. `src/03-registers.wat` then resolves through `$g2w_slow` and
`$guest_page_translate`, an atomic packed-PTE load plus address composition.
Thus sparse translation and ordinary dispatch are real costs of these guest
loads. Their relative native CPU cost has **not** been measured here; this
path is already constant-time and is not the obsolete mapping-record walk.

The predecessor's successful read/seek counters prove completed I/O and
exclude a repeated 997 wait at that observed boundary. They do not time host
file imports or count guest decompression instructions. Codec execution,
image work, imports, dispatch, sparse translation and native readback cannot
be assigned percentages from the retained counters alone.

There is also a profile-window correction: `--cpu-prof-window=600000:620000`
means **batches**, not milliseconds. The retained stdout confirms those batch
numbers; nearby block samples place the window approximately at 433–444
seconds, before the final BSP-shader interval. Its 10,948.3 ms summary assigns
57.7% to the CLI async-main frame, 21.9% to desktop `receive`, and 6.6% to
Wasm. `receive` contains `Atomics.wait`; those weights cannot be reported as
active readback CPU or as final-minute shader dispatch costs. The raw profile
was removed by the predecessor, with hash retained there, so complete stacks
cannot now be reclassified. No current function-name mapping is applied to
its old module indices.

## Concrete next generic experiment

Before changing code, obtain a native on-CPU profile of the actual executing
process and helpers during a **shader-query-triggered** fixed window, paired
with existing block/API counters, bounded guest-PC samples and separately
timed original file/GL imports. Keep the normal route, exact media/packages,
fresh HEAD/WIP/module pins and independent finite shutdown controls. A main
isolate batch window from an earlier loading phase will not answer this.

If that profile attributes material cost to the sparse byte-load call chain,
the concrete generic candidate is a present-PTE byte-load arm which avoids
the `$gl8 -> $g2w_slow -> $guest_page_translate` call chain. Preserve direct
and DIB handling, absent-page/fault behavior, remapping and synchronization;
do not cache a translation across mapping changes. First compare with the
existing generic uop memory-window machinery rather than introducing a
second unchecked cache. This is a candidate to evaluate, **not a proven
bottleneck or approved speed claim**. Any variant requires matching V8 and
SpiderMonkey generated native disassembly, semantic controls including
page boundaries/remaps/faults/DIB access, comparable measurements, focused
tests and the locked full build. No application-specific shader index,
parser substitution or fast-forward is proposed.

## Verification and provenance

`python3 -B scratch/runs/20261114-quake3-shader-load-cost/analyze.py` and
`check_analysis.py` pass: comments/quotes, case comparison, original brace
entry, full miss, all 476 exact offsets, the 94-name census and retained
counter agreement. JSONL is split on ASCII LF; Python `splitlines()` would
incorrectly split a valid literal U+0085 inside one Latin-1 text sample.
All 307 current media pins match. Original PE SHA-256 remains
`2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`.

Offline analysis HEAD is `435ce2fc1129da8ed8051f70f41a34cea192e000`;
the module observed on disk is `dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`,
which was **not executed** by this task. Runtime observations retain the
predecessor's separate launch epoch and module. Current memory/dispatch/
byte-load source and desktop receive source hashes match its source pins;
`test/run.js` differs by the later VFS-mount ordering change, with profile
window semantics unchanged. `input-pins.json`, `static-source-check.json`,
Git patches and the predecessor's existing launch patches preserve these
distinctions. No assumption about an old module applies to the merged tree.

No production file changed, so no optimization/build speed claim is made.
No heavy-runtime turn was consumed; TIM/SuperTux/Drakan turns were preserved.
Foreign WIP is untouched. Box ID null, state `NOT_CREATED`, expiry null;
stop receipt N/A. No owned runtime or watchdog needed cleanup.
