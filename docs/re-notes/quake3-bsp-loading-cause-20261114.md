# Original Quake III BSP loading boundary, 2026-11-14

The single fresh 600-second diagnostic reproduced `LOADING... MAPS/Q3DM1.BSP`
after the ordinary Major / I Can Win / Fight route. At the bound the original
engine was advancing through map shader lookup and text parsing. This is
positive evidence of loading work, not evidence of a fixed parser cursor or a
repeated pending-file wait. No generic semantic defect was established, so no
production code was changed. Arena entry and combat remain unproved.

Evidence is retained in ignored
`scratch/runs/20261114-quake3-bsp-loading-cause/`; the predecessor is described
in [the native GL arena note](quake3-native-gl-arena-20261114.md). All paths
below are relative to the new run unless stated otherwise.

The predecessor's final EIP `0x4261f9` lies in the exact original executable's
text-token parser, beginning at `0x4261d0`. Its instructions skip whitespace
and comments, handle quoted/ordinary tokens, and advance an input pointer.
That one predecessor sample alone could not establish a stall. In the fresh
run's final minute (540–600 seconds), read-only sampling instead observed:

| Observation | Result |
| --- | --- |
| Samples at 250 ms intervals | 240 |
| Samples inside original token parser | 105, with 105 distinct EAX pointers |
| Distinct shader query names | 31; all 31 belong to original Q3DM1's shader lump |
| Parser text matching existing original shader files | 104 of 105 samples; retained examples match 40 bytes exactly |
| Executed-block / API-call deltas | 128,280,000 / 2,718 |
| Process CPU deltas | 55.653 seconds user, 3.621 seconds system |

`loading-boundary.json`, `progress.jsonl`, `progress-summary.json`, and
`progress-readable.log` retain the measurements. Queries continue changing
through `textures/gothic_trim/pitted_rust` near the final sample. Stack words
at offset +16 include `0x45bc47` or `0x426520`; these are code-address
candidates, not a validated full unwound stack. Their instructions and the
changing text/query bytes consistently support the shader-scan interpretation.
The static word `0x7be3d8` was prematurely labelled “shadercount” in the fixed
prelaunch plan; its meaning was not established and is not used for this
conclusion. The world shader-lump count at `0x5cf314` reaches 94.

The final cumulative file observation records 4,105 `fs_read_file_result`
calls returning zero (success), 12,876,288 completed bytes, and 3,631
`fs_seek_result` calls returning zero. These result functions did not return
997/pending. File creation also included unsuccessful probes (one error 2,
four error 183, and two invalid direct handles); “all file operations
succeeded” would be inaccurate. The evidence supports successful advancing
reads, not an exhaustive proof of every asset's later use. Selected original
codec string cross-references and sampled codec PCs are retained, but this
run does not attribute the entire loading time to decompression.

The original shader lookup at `0x45baf0` initializes a cursor from `0x5cd2dc`
at `0x45bc12`, calls the parser at `0x45bc42`, compares names, and skips
nonmatching lines/braced sections before continuing. Repeated scanning for
successive material names is therefore an original loading call path. The
last minute is consistent with that path making progress. The parser/scan
cost may warrant targeted performance attribution; neither incorrect guest
instruction semantics nor a safe generic optimization was proved here.
A larger deadline retry is not the result of this investigation.

Static records are selected disassembly of the original token parser, shader
lookup, brace skip, collision loader, renderer loader, and an audio sample
clamp loop, plus compact string/caller cross-references. The collision loader
at `0x412470` references `CM_LoadMap`, reads through `0x41f100`/`0x41f450`,
and checks BSP version 46. The renderer loader at `0x464da0` references
`RE_LoadWorldMap`, reads through its import table, and checks version 46.
Names are anchored in original PE strings; functional interpretation follows
its instructions. No replacement engine source or media was substituted.
The original executable SHA-256 is
`2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`.

All 307 predecessor media pins matched before and after the diagnostic.
Offline ZIP/CRC inspection of existing media found Q3DM1 BSP version 46,
1,906,708 bytes, with 94 shader entries; 27 original shader files total
583,154 bytes. Existing offline npm recovery reproduced all 162 native
package pins, also unchanged after the run. Media is referenced by existing
path and hash, not copied. Run-local recovered `node_modules` was removed
after verification; package/lock files and recovery metadata remain.

The immutable `trace-plan.json` preceded launch: one 600-second runtime,
independent 620-second watchdog, native GL, real ticks, default 1,000-block
batches, no guest threads. Observer wrappers call original file functions
once with identical arguments and results. Bounded register/text/stack and
CPU samples are read only; IO summaries occur every ten seconds. Existing
GL activity is observed without injected GL work. No console map, forced
guest call, state/config/clock/AI change, autoplay, or second runtime occurred.

Personally reviewed selected checkpoints establish the actual route:

| Checkpoint | Seconds after observer start | Visible result |
| --- | ---: | --- |
| `menu-visible.png` | 70.3 | Original main menu |
| `roster-ready.png` | 150.7 | Major, Arena Gate / Q3DM1 roster |
| `fight-hover-reviewed.png` | 216.7 | Roster Fight gold under pointer |
| `difficulty-ready.png` | 263.2 | Difficulty menu |
| `easy-selected-away.png` | 301.6 | I Can Win white with pointer away, Fight gold |
| `ordinary-loading.png` | 310.8 | Connecting to localhost after Fight |
| `bsp-loading-reviewed.png` | 469.9 | Loading SOUNDS over levelshot |
| `map-shader-progress.png` | 514.6 | Loading MAPS/Q3DM1.BSP |
| `final.png` | 600.5 | Still loading MAPS/Q3DM1.BSP |

Dependent input followed reviewed effects; stale captures were waited through
without replay. Four menu press pairs (Enter, three clicks) each had an
independent release armed before DOWN and acknowledged UP. No gameplay
movement or attack was delivered. The levelshot/loading image is not world
rendering. Native GL context creation succeeded, `gl_sw_enabled` remained
zero, and totals were 704,791 draws / 5,464 presents. Preflight identified
llvmpipe LLVM 20.1.2; native backend use does not imply a physical GPU.

Five input and three lifecycle controls passed, including dead-consumer/no
replay and independent deadline/both-EOF cases. Observer identity, argument,
return-value and bounded-sampling controls passed. Native GL preflight and
`flock /tmp/wine-build.lock bash tools/build.sh` passed under the shared
heavy-runtime lock before launch. No production edit required another build.
The fixed existing profile window 600,000–620,000 produced 63,686 samples;
`cpu-profile-summary.log` retains its compact summary. The name-expansion
helper failed ENOBUFS; plain summarization succeeded. This V8 main-isolate
profile is not complete attribution of guest execution across all threads.
`profile-recovery.json` records the removed raw profile's size/hash.

The loaded module was 2,199,488 bytes, SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
Launch HEAD was `11029c55c5d649e4f4cd792cb0f28839d70d82e8`.
`launch-source-pins.json` records 317 paths; relevant dirty Git patches and
owned new controller patches retain recovery inputs. `boundaries.jsonl`
records hashes at JavaScript/native module load, not hashes reconstructed
from the final checkout. After the run, coordinator reconciliation changed
17 source paths; `postflight.json` records that drift and later HEAD
`a79e3b23f664bf3315d2eb725c2bdfb358a6d5f4`. The runtime result belongs to
the pinned launch source/module, not an untested claim about that later tree.

Native lifecycle records are intact: runtime wait 0, stdout and stderr EOF,
watchdog wait 0, and deadline helper exit reason `runtime-terminal`. The
native process stopped at its fixed bound and the heavy lock was released.
The outer tool/check wrapper returned 143 without its own wait/EOF receipt;
its cause is unresolved. `outer-supervision-gap.json` explicitly retains
that gap; native success does not establish outer completion. Orphaned owned
helper watchdogs were individually verified and stopped, with PID absence
recorded in `helper-stop.json`; no actual wait is claimed for reparented
helpers. No replay followed this interruption.

This bounded result narrows the boundary to progressing original map shader
loading. Completion time and the complete performance cause remain unresolved.
The next useful investigation is targeted attribution of original shader
lookup/parser execution cost, with a fresh exact plan, rather than an
assumed semantic repair or a larger-deadline attempt.

No box was created: ID null, state `NOT_CREATED`, expiry null, stop receipt
N/A. No public deployment or media download occurred. Foreign WIP is preserved.
