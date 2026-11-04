# MDK2 construction waits for a Lua resource, not gameplay

The next native prerequisite after b1a22f69d is **completion and consumption of
the type-10 Lua request at 6174784 (`0x5e3840`)**, followed by execution of the
level script. No controller or production defect is demonstrated. The latest
run ended at 3408; an earlier retained run has the same pending request at 3408,
completion at 3424, and a new level-resource load at 3472. These historical step
numbers are observations, not a completion deadline or permission to run again.
Black construction is not loading artwork, comic, tutorial or playable progress.

This investigation is offline only. Evidence and the reproducible small audit
are in `scratch/runs/20261104-mdk2-construction-resource-contract/` (RUN).
It reads original PE/archive bytes and retained JSON; it makes no guest calls,
writes, repaint/fault-clear operations, Chrome/CLI game runs or box accesses.
Only this note is committed. No helper change was justified or made.

The original executable is
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`, SHA-256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
The original `data/scripts.zip` alongside it has SHA-256
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`.
RUN records paths/hashes, selected disassembly and script excerpts; no source
archive, decoded script tree, media or module copy was created. The captures
refer to historical execution source `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`
and canonical module `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`,
not today's build. Investigation started at `b1a22f69d10374ad63af53a4d33f572f9c83916c`.

The original contracts distinguish these boundaries:

| Original contract | Meaning at this boundary |
| --- | --- |
| `mdk2.lua:373–398` | `level(l,cp,sec)` applies/pends game controls, clears `Level`/`Save`, collects garbage, sets checkpoint/level/section, then calls `dofile(format("Level%d",l))`. Nil `Level` during the script resource request is expected. |
| `0x44f550`, table `0x44f5a0 + 9*4` | Type 10 selects `0x44f58b`, returning the string `.lua` at `0x4a0a88`. It is a resource enum, not ZIP compression method 10 (DCL), although this archive also uses that method. |
| Archive directory and decoded `level1.lua` | `level1.lua` is the unique scripts.zip entry with decoded size 192320; decoded SHA-256 `7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe`. Its first four lines create `Level`, set scenegraph processing and name `l1`/`loadscreen1`. Type, size and calling source strongly identify the pending request as this script. Its request name was not captured, so that identity is an inference, not a direct name read. |
| `0x452140` | Resolves direct-file/archive input, allocates output, writes buffer at entry+0 and size at entry+8, publishes request pointer `0x4b87d4`, completion `0x4b87d0=0`, request flag `0x4b87cc=1`. Prepared `0x5ce0b4=1` means preparation succeeded, not load completion. |
| `0x451f30–0x451f51` | File worker clears requestPending **before** calling `0x4520b0`; only after that call returns does it set completion=1. Pending0/completion0 is compatible with work in flight. |
| `0x4520b0` | Direct branch reads/closes the file; archive branch calls `0x457600`. Each adds entry size to completed bytes `0x5ce08c` after the work. This counter is a resource-completion witness, not a streaming decompression cursor. |
| `0x4522d0` | Sleeps through `0x4515c0` / `SleepEx(10,TRUE)`, then returns completion. It does not itself complete the request. |
| `0x44fa80`, especially `0x44fb73–0x44fbec` | Synchronous demand loading polls the requested entry, marks status2 on completion1, calls finalization and clears active. `0x44fc40` invokes this path while status1 persists. The asynchronous pump at `0x44f930` has the analogous status/finalization path and a five-retry cutoff. A captured pointer alone does not identify the current caller/PC. |
| `0x44f4a0`, table `0x44f518 + 9*4` | Type-10 finalization selects `0x44f515`, just `pop esi; ret`. There is no type-specific rendering or Lua execution callback here. Resource completion precedes script execution and `Level` creation. |
| `mdk2.lua:477,567–628` | Later level loading queues section resources/sound and invokes `mdkShowLoadingScreen`. This is a separate prerequisite after the level script, not proof supplied by the first Lua request completing. |

The worker/request/disassembly details also agree with
[the earlier loader investigation](mdk2-resource-loader-cause-20261104.md).
RUN's audit checks sixteen exact PE byte sequences, both original media hashes,
the type-10 extension/finalization tables, the decoded level-script hash, and the
source's `dofile` contract. No original binary was executed.

Actual captured inputs give a positive completion comparison:

| Retained run / step | Native measurements |
| --- | --- |
| deferred-request-native-replay / 3360,3376,3392,3408 | Level absent; queue1; active=request6174784; prepared1; requestPending0; completion0; retries0; type10/needed1/status1/size192320; completedBytes982692. |
| long-native-loading / same four steps | Same request/resource measurements. Guest clock differs slightly; this is a separate historical execution. |
| long-native-loading / 3424,3440,3456 | Level still absent; queue1; active0; request still6174784; prepared still1; completion1; completedBytes1175012. Delta **192320** exactly matches the pending resource size. Active-entry status is unavailable after active clears; status2 was not directly sampled. |
| long-native-loading / 3472 | Level table/file `l1`; queue105; new active=request6122816, type1/size699228/completion0; completedBytes reset0. Initial Lua completion was followed by the next resource-loading phase. |

Thus requiring queue0, prepared0 or requestPointer0 would reject an actual
completed boundary. Completion1 plus the matching byte delta and active clear
proves substantially more than an unchanged queue. It still proves no visible
scene. The latest run's four captures span only 48 additional slices / 960 guest
milliseconds. The exact executed classifier accepts both pending construction
and historical post-completion nil-Level captures as input-free continuation;
it rejects four actual startup/pre-construction captures. The last four latest
16-step commands report requested=ran=16 with successful ACKs. Quit117 was
acknowledged and Chrome exited0 before its recorded deadline. There is no
captured controller rejection or lost execution credit to fix here.

The precise next observation in a separately authorized bounded replay is a
fresh, input-free construction sample containing the same resource fields,
guest clock/credits and pixels. Look for this request's completion1, byte delta
192320 and active clear, then separately observe script execution producing the
identified Level table and its next resource queue. Do not use step3424 as an
expected timing requirement, send another menu/comic input, or treat black pixels
as gameplay. Historical completion demonstrates this boundary can progress;
it does not prove the latest run would have completed in another 16 slices.

If the request remains pending across the useful finite execution allowance,
the missing evidence is **the actual owning file thread**, correlated to handle
921600 (`0xe1000`): current PC/stack, suspend count, wait/sleep/yield/deadline,
scheduler turns, and direct-file/archive decode progress. RequestPending1 would
locate the unconsumed-submit side; requestPending0/completion0 calls for worker
read/decode/return evidence; completion1 with an unchanged status1/active entry
calls for main-thread polling/finalization evidence. A demonstrably suspended
owner or unserviced eligible thread could establish a scheduling cause; moving
decode PCs/cursors establish work despite stable aggregate fields. Frozen human
inspection time supplies no guest execution: pinned `host.js:_frozenPump`
returns with no credits and advances guest time per consumed slice. Present
captures contain no current owning-thread PC or decode cursor at 3360–3408.
No stall diagnosis or production fix follows without that distinction.

Reproduce the small offline audit from the repository root:

```sh
node scratch/runs/20261104-mdk2-construction-resource-contract/audit.cjs
```

It passes 16 original PE checks, 12 actual positive construction inputs, four
actual negative inputs, screenshot-hash checks and the final step/quit checks.
`audit.json` records every input path/size/SHA-256 and selected source excerpts;
`audit.log` records the result. No production path changed, so no build or guest
runtime test is claimed. Git SHA, relevant diff and small owned-file patches
provide provenance. No box is assigned to this offline task. Predecessor
`bx_yx4fcenz` was handed back RUNNING/API-idle, expiry
2026-11-04T12:26:08.336Z; the coordinator subsequently reported normal STOP
completed at 12:03:32.292Z with no error (messageboard update at 12:06:10Z).
That is a coordinator report, not a box query here; lifecycle ownership remains
with the coordinator. This worker publishes this note and stops.
