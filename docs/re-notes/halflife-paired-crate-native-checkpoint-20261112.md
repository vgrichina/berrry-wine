# Uplink crate/checkpoint attempt — 2026-11-12

The requested new paired crate-bay consequence and qualified earned checkpoint
were **not achieved**. Two SoftwareGL attempts reached living gameplay and the
scientist/upper-room route at health100/armour0. The first displayed native
“Saved” and a native UPLINK load entry, but neither a complete exported save set
nor normal Load followed by fresh movement was qualified. The second stopped on
a stale-frame admission refusal before its next input. No WebGL case was started
in this task. Save is therefore **not established as disabled or unsupported**.

Prior accepted paired living-world and WebGL elevator/LOADING/distinct crate-bay
evidence remains in [the earlier note](halflife-current-paired-onward-20261112.md).
It is not new progress from these attempts.

## Frozen inputs and controls

Evidence directories are
`scratch/runs/20261112-halflife-paired-crate-native-checkpoint-1320/` and
`scratch/runs/20261112-halflife-paired-crate-native-checkpoint-1320-attempt2/`.
The source commits were respectively
`31e2939645796955257563f75c9f67d41b49cc8a` and
`00aea67f31e9f15544b2c2e5e6ac4e4a449f99c6` (also recorded in each
`source-commit.txt`). Relevant tracked binary diffs,
new relevant source patches, staged manifests and run-helper patches preserve
the actual uncommitted closure. Git remains the source archive; no source-tree
or media archive was made.

Actual guest and owning renderer module remained
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Original `hldemo.exe` is737280 bytes, SHA256
`e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`.
Original `pak0.pak` is79150544 bytes, SHA256
`c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`.
Both use ordinary New game → Easy because no qualified complete earned export
was available. Renderer DLLs use ordinary mounts, without permanent EXE roots.
No guest health, armour, position, AI, resource or clock writes, forced events,
or guest code/media/config patches were used.

Native video menus selected OpenGL / Default /640×480. Despite the inherited
output directory name `webgl`, actual GL endpoint1 was SoftwareGL, with owning
bridge `software:true`, HWND65564 and live renderer identity. A separate legacy
endpoint was excluded. All22 postbinding fields remained strict; no rebind or
weakened guard was used. Acknowledged input alone is not a movement consequence.
Full individually reviewed frames show corridor movement, stairs, the living
scientist/guard room, and descent back to the lower floor.

## Exact blockers

Attempt1 reached the elevator area, used native Escape → Save/load → Save game,
displayed “Saved”, moved, then selected the UPLINK entry in native Load game.
It reached the ordinary “Loading a game will exit any current game” confirmation.
Before confirming, my separate read-only export helper incorrectly accessed
`wine.vfs` instead of the actual host seam `wine._helpCtx.vfs`. The command exited1
with a TypeError, signalnull and oomKilledfalse. Retained command observation
made the chain terminal; no native confirmation or input replay followed. This
is a helper error, not a demonstrated emulator fault. The UI observations do not
qualify a checkpoint, and old floor bytes were not substituted.

Attempt2 corrected and tested that read-only seam before browser startup,
including the emitted export action, complete-file-set/hash checks and negative
fixtures. It did not reach Save. Its last reviewed full frame,
`s40-elevatorturn`, was captured at13:43:02.545Z. After context compaction,
`s41-turn-right` was refused at13:45:04.831Z: **122286ms exceeds the120000ms
fresh-frame limit**. `bound-input.cjs` threw `STALE_SCENE_BEFORE_DISPATCH` before
dispatch; the catch closed the chain and the browser recorded
`first-failure.json`, `terminal-error.json` and `transport-closed.json`.
No subsequent native effects or replay occurred. This is a control/procedure
blocker, not evidence of an unsupported elevator, Save, or renderer crash.
No speculative emulator repair was attempted; the earlier unknown SIGKILL
remains unexplained.

## Tests, recovery and lifetime

Before attempt2 startup:65 original media files,573 frozen staged files,
38 imports,102 planned key/wait forms,16 binding-negative cases, three
independent-release tests, retained-ACK/API1..600/no-replay envelope checks,
and the corrected native-save helper fixtures passed. The inherited caller
regression result was referenced, not rerun. No production source changed;
this publication changes documentation only, so no production build is claimed.

Unique outputs were compressed before transfer; matching reviewed originals
were reused rather than downloaded twice. All554 recovered references in
attempt1 and459 in attempt2 were hash-verified. Attempt2 hashes were checked
again locally. Actual outer/kernel custody drained completely:365/365 processes
in attempt1 and353/353 in attempt2 reaped, no remaining/unreaped members,
command log EOF/closed, and actual outer-parent waits retained. Attempt2's
terminal browser cleanup resulted in kernel exit-15, not a new unknown SIGKILL.

Both boxes had independent55-minute watchdogs armed before allocation, and
joined provisioning with frozen hashes before browser startup. Both were
normally stopped after evidence recovery:

| Box | Initial expiry | Final state / stop time | Stop receipt |
| --- | --- | --- | --- |
| `bx_gsupkp2d` |14:13:27.915Z | archived13:32:02.955Z; expiryNULL | `stop_d5b2a3460720f4f3`, completed, forcedfalse, errornull |
| `bx_zmj2vtrs` |14:28:44.421Z | archived13:46:31.706Z; expiryNULL | `stop_d95f80f12c5a60b6`, completed, forcedfalse, errornull |

Attempt1 retains actual local manager/watchdog joins. Attempt2's local manager
tool session ended143; its expected actual-parent-wait file is absent, and the
watchdog was observed reparented toPID1. The watchdog subsequently wrote its
terminal record and its PID disappeared, but **no actual manager/watchdog parent
join is claimed for attempt2**. `manager-observed-loss.json` and
`watchdog-final-observation.json` preserve this separate lifecycle gap; its cause
is unknown. Recovery used a dedicated host-only path, and normal delegated stop
was confirmed independently of the lost manager. No box remains billing idle.

## Recovery / next work

`RESULT.json`, `RECOVERY.txt`, `retrieval-verified.json`, terminal command/fault
records, source patches and final helper pins are in the attempt2 directory;
the first attempt retains its own failure and recovery records. Neither run
provides checkpoint bytes suitable for continuation. Start ordinary New game →
Easy unless a separately complete, hash-verified earned set first passes normal
Load/state/fresh movement. Capture and inspect a new full frame after any long
pause or compaction, before submitting input; do not weaken the freshness guard.
Next required game work remains paired elevator/crate onward play plus native
Save/export/normal Load/fresh movement, if supported. No broad FPS, audio,
backend parity or full27 claim follows from this bounded run.
