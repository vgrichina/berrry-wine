# Original Penguin Command quiet execution, 2026-10-24

**Original main menu verified; ordinary gameplay remains unverified.** The one
authorized execution rendered the Penguin Command title and Normal Game / Arcade
Game menu. The runner reached the unchanged 200,000-batch ceiling in **7.739 s**
and exited before interactive menu selection arrived. This is an execution-budget
blocker, not an observed guest trap, import failure, missing asset or WINMM fault.
No second execution was attempted.

Worker `01a16bb7-f360-7983-9acd-68ff4d0ea847` owns this report and adjacent
`penguin-command-quiet-original-gameplay-20261024/` evidence on
`task/penguin-command-quiet-original-gameplay-oct24`, based on main
`f42083c61a18d56fd739d3cd702c4d67d36784b7`. There are no production changes.
Root tracked files/index/refs and standing donors were left untouched.

The prior immutable payload at `/tmp/penguin-retained-codec-oct24` on
`bx_9nngcsvf` was reused in place. The only launch-flag correction was the
matching runner's supported `--quiet-blocks`; `--quiet-api`, the 524,288-byte
output guard, all guest limits and the full historical module were retained.
The supervisor and all new outputs use `/tmp/penguin-quiet-gameplay-oct24`.
`run/command.json` is the actual complete argv, identity, start time, PID and
resource limits; `launch.json` binds API command `cmd_cye6lsvhjkz1`.

## Observed result and stopping condition

The original EXE initialized all seven DLL providers successfully and created
the titled SDL window. At 2 seconds the supervisor submitted snapshot and PNG
commands. Both succeeded at batch 30,376. `run/startup.png` was visually
inspected: the original title artwork, Hiscores, Normal Game and Arcade Game
are visible. The 640×480 host capture clips the right edge of the 648×488
window at (20,20); this is not a full-client-area rendering claim.

The terminal log records 461,565 API calls, 200,000 batches, 538,296 retired MMX
instructions and a final PNG, with no observed trap or unimplemented API.
`run/exit.png` was also inspected. `run/input-events.json` contains only the two
actual startup controls. A later click at (420,360) targeting Normal Game and
game-start PNG request were appended to the new inbox after the runner had
already exited. They are retained in `input.ndjson` as **unsent attempts**.
The attempted collection of game-start.png failed because that file was never
produced. No delivered click, aiming, A/S/D press/release, projectile, enemy,
score, wave or gameplay response is claimed.

`run/terminal.json` records natural exit 0 after 8.097439 supervisor seconds,
TERM=false, KILL=false, no reaped extra children and remainingGroup=false.
Natural exit is not gameplay acceptance. The first actual execution limit
ended this run; the assignment prohibited another attempt. A future assignment
could deliver ordinary menu input promptly within the existing batch allowance;
this report does not authorize or perform that follow-up.

## Exact retained inputs

This tests historical source **b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a** from
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`, not current
main. The full 1,879,746-byte module SHA-256 is
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.
The 685,960-byte runner SHA-256 is
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
The real 107,008-byte original EXE SHA-256 is
`14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`.
Standing MSVCRT SHA-256 is
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.

`retained-payload-manifest.json` binds all corrected **287 files / 15,719,953
bytes**, including all seven DLLs, 83 graphics, exact source/data/fonts, full
module, region-layout-hash helper and 23 retained pngjs 7.0.0 files. Prior
preflight/standing receipts are preserved alongside the fresh admission. The
already-passing exact codec roundtrip, rasterCanvas dependency resolution,
region ABI fingerprint `9a3bc9149d58209c` and retained hashes were reused,
not represented as newly repeated independent acceptance. Actual instantiation,
DLL initialization and the original menu executed in this run. No optional
skia/headlessGL route was selected. No audit, archive acquisition, restaging,
source compilation, default build or module substitution occurred.

Ignored recovery inputs remain at the original retained closure path:
`/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11`;
standing CRT is `/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll` and
codec is `/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs`.
The previous published recovery report is commit
`c6001984808981b314e264f534d615250f1aab55`, at
`docs/re-notes/penguin-command-retained-codec-gameplay-20261024.md`.
Its full recovery scripts and exact hashes remain unchanged and readable.
Do not replay either supervisor over retained output directories.

## Resources, retention and lifecycle

Fresh measured consolidated admission passed at **49,219,613 / 67,108,864
bytes**. It charged both retained hosts' outputs, this checkout/Git, prior
external launcher/session files, positive SQLite growth, future logs/evidence/
session growth, <=1 MiB transport and the 8 MiB reserve. The previous task's
charges and receipts were retained; no budget reset or hidden payload copy
was used. Installed executables and immutable standing inputs are identified
separately in the inherited standing receipt. Final measured accounting is in
`resource-final.json`; both hosts retain the 2,982,150,144-byte free-space floor.

The supervisor checks native MemAvailable >=2,684,354,560 immediately before
launch and uses one fixed 512 MiB shared arena, oldspace512 MiB, CPU/wall90 s,
guest60 s and max200000 batches. No concurrent Node guest/worker ran on this
box. Quiet output stayed far below the unchanged 524,288-byte guard. All
retained files are below24 MiB. Compact collection uses <=4096 compressed bytes
per API data slice; no payload archive or local runtime duplication was made.

Box **bx_9nngcsvf** remains running, last API state/health in `box-state.json`,
expiry **2026-10-24T02:47:54.557Z**, coordinator shutdown checkpoint **02:37 UTC**.
`remote-final.json` confirms no remaining Node process and retains actual
detached-process log sizes. The coordinator owns shutdown/snapshot; no stop,
delete, resume or expiry extension occurred. The board watcher is stopped at
handback. No workers, Claude, public service, installation or main integration
were invoked. Evidence, validation and seals are written before `results.json`.
There is no Penguin corpus candidate, so the investigation stays with this note
and is not attached to another game's dashboard card.
