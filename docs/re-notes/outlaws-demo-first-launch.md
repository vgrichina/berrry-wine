# Outlaws original first-launch handoff

Owner `/root/outlaws_original_startup`, task
`NEW-GAME-OUTLAWS-DEMO-20261015`. Source preparation only; runtime awaits an
explicit coordinator grant after Army Men acquisition releases the sole box.

`outlaws-demo-launch-manifest.json` maps all 31 verified original records to
30 Windows names. The identical `wdirnop.com` duplicate is recorded separately
and preserved in the original package; the VFS mounts `WDIRNOP.COM` once.
This nonpublic manifest is not a public app registration. Original README
requires extraction followed by `C:\OUTDEMO\oldemo.exe`, empty arguments,
cwd `C:\OUTDEMO`. No registry import, replacement DLL, config patch, installer
answer, or guest input is included.

The controller accepts `ROOT PAYLOAD NEW_OUTPUT`. The proposed payload is
`/home/user/outlaws-original-acquisition-20261015/payload-js-verified` and
proposed donor ROOT is `/home/user/jedi-knight-checkout` on `bx_9ef2wdsw`.
Neither donor suitability nor current runtime state has been checked in this
lane. The controller must first physically verify every compiler/source pin
and canonical module SHA-256 `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
The pins identify the exact main reference commit; this does not claim the
donor's historical host JavaScript equals current main. Every tracked physical
host file is hashed separately, and the index listing and HEAD are retained.
A mismatch blocks execution rather than causing a rebuild or donor mutation.

The run uses the existing headless CLI, full-frame PNGs every ten seconds,
snapshots, complete stdout/stderr, explicit 120-second guest guard and
150-second final process-group kill watchdog. Snapshot/PNG/host quit commands
are observations and shutdown, not guest menu answers. Licence/crash text
triggers immediate capture and host quit; screenshots still require human
review because image-only licence text may not appear in logs. No initial
input means such a prompt cannot be answered accidentally. The fresh output
directory contains an exact copied VFS, controller, source/module/fixture
identity, command, terminal result and postflight hashes/process inventory.
The coordinator must independently inspect active processes before declaring
the exclusive slot released. Preserve failures and inspect full-frame images
before any further ordinary action.

`--no-threads` selects cooperative guest-thread scheduling, not the real Worker
thread backend; this is explicitly a headless cooperative startup probe.
It cannot establish browser or real-thread runtime compatibility. Process
inventory records command names only, and postflight rejects survivors in
the owned process group without collecting unrelated command arguments.

This source does not establish startup, menus or gameplay. After the first
observed boundary, select the next ordinary action from actual output. A
licence choice requires the user's decision; a crash requires its actual API
or fault diagnosis. Later gameplay proof needs idle, held/released Up and
Left/Right, visible attributable motion and full-frame screenshots. WASD is
not the documented default. Audio/FPS/combat remain separate unknowns.

Before execution: obtain explicit slot grant, inspect previous owner terminal
and clean postflight, take independent process inventory, then verify matching
source/module and all originals. No local build/VM/browser is permitted for
this lane. Recover compact receipts and screenshots into shared
`scratch/runs/20261015-outlaws-original-startup`; retain the remote original
fixtures and full copied VFS separately. Follow `ops/README.md` for dashboard
metadata, and do not attach evidence to an unrelated candidate if Outlaws has
not yet been added to the candidate corpus.

## Observed original startup failure, 2026-10-15

Coordinator granted the sole runtime slot after Army Men's explicit release.
Independent preflight at 14:17:38.933Z read Army Men's 14:15:59.849Z clean
postflight, found no active runtime, and physically matched all 142 compile
pins and canonical module `937466db…`. The frozen controller was commit
`61cf2cd835a1c1ee4977aebe73d074e51549f1de`, SHA-256
`7718d1f8c030bdc504b543028eed63f24a3551d87cdfef830a4af179af6371d1`.

Boat controller PID 153370 started 14:18:15.309Z; child PID/process group
153383 loaded the original PE entry `0x004f10d0` and reported working
directory `c:\outdemo`. It immediately hit the real fail-fast boundary:

```text
=== UNIMPLEMENTED API: OemKeyScan ===
EIP: 0x0043a8bb  ESP: 0x074ff9f4  EBP: 0x00000100
[0x074ff9f4] = 0x0043a8f1  <- return address
[0x074ff9f8] = 0x00000000  <- argument
*** CRASH at batch 0: unreachable
```

The original caller loads ESI from IAT `0x005da450`, starts a 256-entry
loop (`EBP=0x100`), pushes its index at `0x0043a8ee`, calls ESI at
`0x0043a8ef`, and would consume EAX at `0x0043a8f1`. This is the first
observed failure, not proof that later startup APIs work. `git grep` found no
existing `OemKeyScan` implementation or API-table entry in the pinned source.
The next step is a real keyboard-translation API implementation and focused
tests, followed by a fresh matching module and separately granted original
startup run. Do not substitute a silent-success handler or change guest bytes.

Child exit 1 was recorded at 14:18:15.992Z, controller API exit 1 at
14:18:16.181Z. Crash-text monitoring issued only host capture/quit commands;
there were no guest inputs. The failure preceded PNG capture, so **no
screenshot exists**. No menu, licence prompt, gameplay, audio or controls
were reached. No retry followed this unexpected failure.

The donor's Git HEAD was `03641536b256ec78527fee514ea2dfa4c31639e4`; this
is metadata, not its tested tree identity. Its historical indexed checkout
and all **6,527 physical tracked files** are recorded in `run/identity.json`
and `run/source-before.json`. Compiler closure matches reference
`32a28da07a355a2797efb8643d2fd8d7fa87ee1d`; host JavaScript is explicitly
the physically hashed historical donor, not claimed equal to current main.

Independent postflight at 14:19:27.170Z rehashed all 6,527 host source files,
all 31 original payload records, immutable package and module unchanged.
Command-name-only process inventory found no active runtime or owned
controller/child process group. The slot was released to the coordinator.

Evidence is recovered at shared
`scratch/runs/20261015-outlaws-original-startup/`: `run/output.log`,
`run/{identity,source-before,launch,child,terminal,stop-reason,postflight}.json`,
`run/controller.js`, `independent-postflight.json`, frozen manifests and API
receipts. Archive `evidence.tar.gz` is **578,651 bytes**, SHA-256
`241f8911ad2071909fcdeb368d9ff91bb98f76e950744d6abf6314ccc01285dc`,
verified after download. The identical remote archive and full copied VFS
remain at `/home/user/outlaws-original-startup-20261015`; original acquisition
payloads remain untouched in their separate directory. No dashboard
`result.json` was published because this lane has no corpus registration;
these notes preserve the startup failure without misattributing evidence.

Source checks passed: syntax, whitespace, complete manifest accounting and
missing/tampered original rejection. The runtime failed as documented.
