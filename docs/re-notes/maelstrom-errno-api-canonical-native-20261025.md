# Maelstrom errno latch: canonical compilation and controlled native qualification

Both canonical diagnostic binaries compile, validate, and pass full static ABI
inspection. Ten controlled compiled-native scenarios pass on `bx_k38z8byn`.
Errno **0, 4 and 37** reach status 4/event 3 through genuine owned select
completion, CALL EDI, a nested native return and the final C3 RET, before
`CMP [EAX],4` executes. This is controlled qualification with an explicit
synthetic CRT mapping and thread-data provider. Original-game errno, caller,
loader mapping and gameplay remain **UNKNOWN**.

The accepted implementation is unchanged: tool SHA-256
`5c54028907a49b602fd330fc888059b26fbfb486a838db58538865470a35641c`,
snapshot repair `1a87b46728222df4df0b1fee33f83e88776735a9`, integrated source
base `eeb4b3372c8b18361dae83509652b67281f67d0c`, tree
`ce75c16793ef8ee9fdde24a8a4e60d34a72943a8`. Existing source/model acceptance is
reused; this task adds actual compilation and native execution evidence.

## Exact build and ABI

The immutable canonical source worktree currently has HEAD
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`. Its historical manifest identifies
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; these identities are deliberately
distinct. All 140 original compiler/source files, 21,207,647 bytes, and the twelve
consumed latch source pins were checked by length and SHA-256 locally and again
as reconstructed on the test box. Authentic EXE, SDL_net and native CRT binary
pins and PE section-bound anchors were verified before transformation.

The 128 raw source files are retained in a hash-bound compressed bundle. The
driver reconstructs them in memory, uses the canonical compiler's byte decoder,
and builds its three identical VFS aliases per source. Only the four accepted
transformed fragments overlay that VFS; `src/main.watx` supplies the include
order, and every instrumented fragment is demonstrably reached. Source inputs
remain byte-identical. Production, standardWat, no runtime builtins, strict
declarations, no names/shake and the original dispatch trampoline apply.

| Binary | Bytes | SHA-256 |
| --- | ---: | --- |
| tailcalls true | 1,882,300 | `a77709fb784a21e6775771450f54b709373f0cc8ad2d4878012c949eaae88f69` |
| compat/tailcalls false | 1,884,873 | `365db557acdb39180d77acc61c8207e0b89d577c3071ba3e492e63c17900c7d8` |

The unchanged historical 8 MiB native-module guard is preloaded before either
synchronous fixed-Buffer Module constructor. Task output bounds are stricter,
2 MiB per module. Node 24.22.1/V8 13.6.233.17-node.58 successfully validates both
actual binaries, including the tail-call instructions.

Binary-only inspection compares all 291 imports and 2,267 function exports and
their signatures; parses every function type; verifies memory/noStart and exact
added getter/start signatures; preserves all baseline globals in order and adds
exactly 39 private mutable i32 zeros. Memory/data sections hash-identically to
the pinned original binaries. No host import or guest storage is added.
The full source/mirror inventory independently reconstructs 269 placements,
including DIRECT_WINDOW, and serializes/hash-derives `9a3bc9149d58209c`.
Compiled region stamping matches it. This is not merely a comparison against a
declared fingerprint. Omitted/changed-span controls reject; eight binary ABI
mutations reject, covering new imports, getter/start signatures and layout.

## Actual native behavior and limits

Each scenario uses one fixed shared 512 MiB arena and a 512 MiB Node heap limit.
Ten fresh fixture processes execute sequentially, never overlapping arenas.
Within each, OFF and ON fixtures reuse one instance with disjoint code, stack,
errno, fdsets and timeval storage. Signature/span preflight precedes native
admission. Actual counters must start at zero at both disjoint addresses.

Controlled CRT base is explicitly `0x522000`, **not a loader observation**.
Authentic `_errno` bytes at RVA c430 are `e82274ffff83c008c3`. Their real relative
CALL reaches a synthetic `_getptd` provider which returns an initialized
thread-data pointer; actual ADD EAX,8 and C3 RET then return to `007a3366`.
The source block is `007a3362`, decoder CALL-register/H119 uses EDI, and final
RET/H41 is in the block at CRT RVA c435 (RET byte RVA c438). The nested provider
RET below the owned post-ESP does not capture.

Errno 0/4/37 each capture token 1, thread 1, regbank `86228992`, select result and
EBP 1, pre/post ESP `0x07412000`/`0x07412018`, EAX `0x00451008`, authentic native
entry `0x0052e430`, predecessor `0x0052e435`, and successor `0x007a3366`.
Caller triple is `0x0040e12a`, `0x04103000`, `1000`, read at post-ESP + 0x124.
Only status 4/event 3 is accepted. Successor entry count remains zero; ordinary
one-block run budgets stop before CMP. No breakpoint, forced yield, diagnostic
clock/import, lazy mapping, or diagnostic guest mutation manufactures the visit.

OFF/ON normalized architectural registers, lazy-flag operands/results,
initialized guest fixture memory, API/import activity, counters, run budget and
yield states match for all three successful errno values. OFF private diagnostic
state remains zero. The private captured state cannot reset on another start.
Relocated fixture pointers are normalized explicitly in the retained test.

Seven additional actual-module controls pass by rejecting: wrong select return,
wrong native target, wrong CALL return PC, EBP/result mismatch, unsafe errno
read, return without the owned CALL, and block-executor mode. Stale token,
foreign thread/regbank, mismatched post-frame, unsafe caller-span, code16/uop,
and nested CALL rejection are **not compiled-native qualified here**. The
4096-attempt cap and disabled unused-getter rules retain prior source-level
acceptance; this run does not claim their native exhaustion/host-oracle coverage.
There is no full-memory equivalence claim beyond initialized guest fixtures,
compat native instantiation, native overhead measurement, full authentic
`_getptd`, original guest, loader proof or gameplay acceptance.

## Execution, recovery and publication

APIexec only; no SSH/scp, credential transfer, public server, remote agent or
replacement box. Compiler detach command is `cmd_6xdyzkqxkrxi`, PID 25883;
static qualification is `cmd_nvp6kssi3nwv`; native batch is `cmd_x2b986j2uixo`.
Compiler supervisor: 5.333 s, 555,347,968-byte peak child RSS. Native batch:
0.669 s, 73,953,280-byte peak child RSS. Both exit 0, reap all groups, produce
bounded output and release the exclusive heavy lock. Node oldspace 2048 MiB
for compilation; CPU/wall 900 s compiler, CPU90/wall60 native, cheap CPU/wall60,
24 MiB file bounds, 512/128 KiB compiler/native capture and five-second cleanup.

The first expanded-source disk projection exceeded 64 MiB by 993,940 bytes and
was not executed. Compressed source staging then passed fresh admission.
One preflight adapter failed source pinning because the compiler decoder can
sanitize a Buffer slice in place; disposable decode copies fixed this before
compilation. An oracle control initially propagated its expected bounds
AssertionError; its handling was corrected. CLI forbids --timeout with --detach;
that local parser error started no compiler and was corrected using supported
detach/status. One overly broad source inspection was truncated; later reads
were narrowed. These setup/capture incidents are retained, not acceptance runs.
There was no compiler, ABI or native implementation rejection and no unchanged
heavy retry. The final light source oracle was rerun under the bounded supervisor.
Publication bookkeeping initially included the manifest itself and omitted
`git add --sparse`; both were corrected before the commit.

Focused non-cone sparse checkout uses dependency-first readonly alternates,
without fetch/clone/repack/object-store copy. Local work is lightweight only.
Resource receipts count both hosts' new bytes, compressed inputs, Git/index and
publication growth, all current shared WAL, positive SQLite growth, full worker
session/launcher logs, future growth and an 8 MiB reserve. Local minimum is 1 GiB;
remote minimum 2,684,354,560 bytes; post-growth disk floor 2,982,150,144 bytes.
Standing installed tools and readonly donors are separate. Final receipts and
verified task-branch SHA are recorded in external ops/publication.json and the
append-only root messageboard. No main integration is authorized or performed.

Committed evidence lives in `maelstrom-errno-api-canonical-native-20261025/`.
The hash-verified compressed remote evidence contains exact full ABI/types,
source/compiler/transformed-input seals, native states, rejecting controls,
supervisor results and retained logs. `RECOVERY.md` describes decoding and
reproduction. Binary modules remain at
`/home/user/maelstrom-errno-api-canonical-native-oct25/ops/` on the assigned box;
the compressed source bundle also remains there and under the local owned ops.

Box `bx_k38z8byn` is left powered on and API-responsive; the final Boat info
reports **state `idle`, health `ok`**, with no stop record. Coordinator owns snapshot and shutdown:
execution cutoff 2026-10-26 01:05 UTC, handback 01:10, shutdown checkpoint 01:20,
expiry 01:39:12 UTC. This worker reaped its processes and hands back ownership;
no stop/delete/resume or successor worker is launched.
