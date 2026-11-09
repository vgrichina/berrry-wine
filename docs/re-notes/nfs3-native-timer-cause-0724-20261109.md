# NFS3 native timer: unchanged module passes the offline routine fixture

No production mismatch was reproduced, so no production change was made.
Evidence: `scratch/runs/20261109-nfs3-native-timer-cause-0724/`.
This is a bounded invocation of original timer instructions, **not an original
game launch or a reproduction of the historical startup environment**.

The [previous original abort](nfs3-rehearsed-consumption-20261108.md) remains
unexplained. Its prior API returns, readiness-counter history and executed
clearing branch are UNKNOWN. Its missing per-case startup manifests remain
missing. Neither attachment nor a zero clock has been established as its cause.

## Executable path and experiment

The existing `test/binaries/candidates/need-for-speed-3-demo/game/nfs3demo.exe`
(1,577,984 bytes, SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`)
contains the timer initializer at `0x48dad0`. Its original caller at `0x4f6e2e`
loads `0x562ae8` into EAX before calling it. The fixture parses that existing
PE, never runs its entrypoint, and uses a small generated caller to perform
the same load and call. The PE's initial field is zero; the initializer itself
selects its normal 100 Hz fallback. No readiness/counter field is seeded.

Both cases instantiate the same retained production CPU bytes, SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`
(2,182,452 bytes), referenced through the preceding run's `runtime-pins.json`.
Production JavaScript dependencies are hash-checked and recovered in memory
from their retained files or Git `0a38cf48438096482d059c5d8f27c048474c83b9`.
The fixture executes the retained browser-shell timer-policy assignment and
host timer-mode boot block, with the actual `nfs3_chosen_renderer` entry and an
empty query. They select `mmTimerThread=true`, `asyncMultimediaTimer=false`.
This is ordinary production configuration, not an experimental timer override.

Actual production `createHostImports` and `ThreadManager` implement thread,
event and wait behavior. The fixture uses the supported cooperative backend,
with the real default host clock and ordinary manager sleep/wait handling.
It does not reproduce Chrome's Worker backend, whole-game prehistory or the
old attachment procedure. No API success, branch, clock value, scheduler state
or guest timer state is forced. Calling the routine in this isolated context
is a deliberate fixture boundary, not evidence that the historical original
reached it with identical state.

| Observed boundary | Diagnostics off | Diagnostics on |
|---|---:|---:|
| `timeGetDevCaps`, return at `0x48db2c` | 0 | 0 |
| `CreateThread`, return at `0x4ddcde` | `0xe1001` | `0xe1001` |
| Native thread wrapper, return at `0x48db99` | 1 | 1 |
| `timeBeginPeriod(1)`, return at `0x48dbbe` | 0 | 0 |
| Readiness `0x562ae8` on return | 100 | 100 |
| Readiness counter `0x79a1a4` on return | 1 | 1 |
| Retry counter `0x55c9dc` on return | 0 | 0 |

Both cases execute the existing native callback and helper-thread machinery.
The diagnostic trace contains 74 distinct block/state observations, including
the unchanged `0x48d670` helper and `0x48d810` TimeProc. The off case has no
`log_eip` wrapper or enabled block trace; both cases sample exports at ordinary
CPU slice boundaries. This establishes matching observed timer outcomes,
not whole-game passivity, identical elapsed times or full register parity.

The measured wait reaches `0x48dc7b` with EBX's captured counter zero and the
current counter one, then takes the changed-counter path to `0x48dc9f` and
returns with readiness intact. The timeout cleanup at `0x48dc84` is not taken.
The static abort predicate at `0x4f044b` was not executed by this fixture.

## Rejected fixture evidence and limits

Earlier fixture iterations omitted the retained launcher's timer-mode boot
policy. The raw module's zero-initialized mode then supplied no independent
timer callback delivery in this isolated loop: the counter remained zero,
the native timeout called cleanup, and readiness cleared. Those logs are
retained under `no-launch-policy-*`; they are **an artificial fixture failure,
not old production FAIL evidence**. The helper thread initially waits on its
event; the later zero-EIP log follows timeout teardown and does not demonstrate
a missing initial thread argument. Direct observations confirm the real
argument is present before its first slice.

The first diagnostic preparation installed a host wrapper after instantiation,
so it captured no imported trace calls. `preflight2-*` retains that invalid
diagnostic attempt. The final wrapper is installed before instantiation.
`preflight1-*` retains a dependency-hash refusal before CPU execution. No
rejected run is promoted into original execution or a repair comparison.

The missing evidence is a historically bound record of initializer entry
state, process timer policy, API arguments/returns, thread/TimeProc progress,
counter changes and the exact clearing branch on the aborting original's
executing Worker, together with a matched observer-off original control.
The isolated passing pair cannot supply those facts. There is no justified
old FAIL/new PASS production patch and no unchanged original retry.

## Recovery and lifecycle

`base-commit.txt`, small run-input patches, `relevant-source.patch`, source/media
references and SHA/size verification retain recovery without source archives
or media/module copies. The old modules and evidence remain at their existing
paths. Logs are gzip streams from their first byte; integrity verification
fully inflates them, checking gzip CRC as well as SHA-256 and size.

Each local fixture has an independent deadline watchdog prearmed before its
CPU child. The supervisor separately waits for child exit and joins stdout
and stderr gzip writers; both final children exit 0. Cooperative WASM thread
instances end with their owning child process, including the idle timer
thread; this is bounded fixture disposal, not a claimed guest shutdown.
Watchdogs are terminated and actually waited for. No Chrome, original launch,
box, native-custody change, peer provider edit, worker or deployment occurred.
Box ID: none; state: NOT_CREATED; expiry and stop receipt: N/A.
Free space on `/home` remains above 1.5 GB. Single task stopped.
