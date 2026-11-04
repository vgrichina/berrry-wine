# Deus Ex: aligned preparation loses Small0 before jump

The farther Z96 wood remains **unreached**. Fresh ordinary Load restores the
immutable count14 exactly, but the backward preparation crosses Small0's support
boundary and settles on the lower Z32 wood. The grounded guard therefore stops
traversal **before any onward jump**. A native count15/time01:18:46 checkpoint
was exported, recovered and decoded before closing Chrome. Its fresh reload is
untested; it is a lower-wood checkpoint, not progress toward the target.

Evidence: `scratch/runs/20261104-deusex-small0-aligned-jump/`. Input note:
`deusex-small0-native-speed-20261104.md`, commit
`f51127a822420205d3ec08b63e0bd042f485ac0c`. No production changes or rebuild.

## Preflight and immutable inputs

Retained `bx_2t2b9xah` was verified healthy, APIstate idle/RUNNING, with expiry
2026-11-04T03:02:57.823Z and coordinator shutdown ownership, then acknowledged
on the board before execution. No allocation, resume, stop or delete occurred.
All Chrome/game execution was on that box.

The installed CLI is `boat`; the first `boat-dev` lookup failed before use and
is preserved in `first-preflight-failure.json`. All451 inherited runtime inputs
matched their pins. The historical runtime is
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus the authoritative nine-file
patch `scratch/runs/20261104-deusex-supported-stack/historical-source.patch`,
SHA256 `9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
Actual tested canonical module SHA256:
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
(1,898,260 bytes), recovered locally. **Historical second module ABSENT**;
no substitution. Chrome151.0.7922.108 used the original SoftDrv/default
guestWorker and three original guest workers.

Before Chrome, driver/capture, observer, movement-reader and exporter JS syntax
passed; actual puppeteer resolved, Chrome executable existed, and a mocked
export connection wrote two byte-exact files with verified hashes. Mock outputs
are explicitly under `export-preflight/`, separate from the real native save.
The real exporter completed before cleanup. Recovery initially raced the quit
receipt and found no cleanup.json; the failure was preserved, a bounded cleanup
acknowledgement wait added, and recovery then succeeded.

The original input remains at
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`:
saveinfo SHA256 `4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6`,
Training SHA256 `ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730`.
Both original files and their manifest remain unchanged. The native resave used
the same guest save0001 paths in the disposable runtime VFS; the recovered
count15 pair is kept separately in this run. Existing media paths/hashes are
referenced by the inherited provision manifest; no media copies or source
archives were made. Exact checkout SHA and relevant binary diff are retained.

## Geometry and observed failure

The original decoded map/BSP reference is
`scratch/runs/20261031T1134Z-deusex-grounded/map-bsp.json.gz`, SHA256
`4a7c95d97d44d9c85839805f7bce5028e0c4d6ba7e6f582e2f1a95dd440448d0`.
Read-only nearby faces are extracted into `original-nearby-bsp.json`.
Target Brush1765/node8270 has topZ96, X7024–7088,Y−1872–−1808.
Tall Brush1733 has front node8301 atY−1792, east node8305 atX7024,
and topZ160. These establish nearby geometry, not the identity of the previous
run's collision face.

Inspected03 shows count14/time01:17:23. Ordinary Enter restores unique
JCDentonMale0 at `(7026.704590,-1707.887939,109.602844)`, yaw250640,
Physics1, height43, zero velocity, native BaseSmall0. Reflection reconfirms
GroundSpeed320, AirControl0.05, healthy legs, standing and AlwaysRun.

Ordinary Z30ms, released, changes yaw to249105 while preserving location.
The resulting direction is approximately `(0.315229,-0.949016)`. Projected
from the loaded position, the centerline crosses Y−1772 atX7048.0003
(4 units east of tall wood's radius20-expanded X7044 boundary), and the
target's near Y−1808 edge atX7059.9582. This is a candidate alignment only;
it does not establish a safe run-up or successful flight.

Ordinary Down250ms, released and settled, instead travels48.5985 horizontal
units and loses support. Small0's native center is
`(6985.179199,-1700.615601,49.350189)`, radius22.5. First sampled Physics2
is at `(7013.819336,-1669.086304,109.602844)`, horizontal center distance
42.5952, beyond player20 + crate22.5. The13 falling samples have no positive
Vz. The player settles at
`(7011.389648,-1661.765625,79.800003)`, Physics1/BaseLevelInfo0, velocity0.
FeetZ36.8 and the original Brush1741/node8353 topZ32 polygon identify the
lower wood, with the usual4.8 support gap. Inspected11 and13 show that result.
The two held inputs were trusted and balanced: Z32ms and Down252ms measured
at the browser, so an unbalanced key is not the explanation. No Space or
forward-run input was issued. No retry, reload or further traversal followed.

## Recovery and handoff

Ordinary Escape → Save Game → selected new row → Enter produced count15,
saveTime4726 (01:18:46). The real exported package decodes to the exact final
Location, Rotation249105, Physics1 and BaseLevelInfo0 above. Actual pair:

| File | SHA256 |
| --- | --- |
| saveinfo.dxs | `e6972066ee15fa3ca83661bb30baec9588c870ddc81fdefadf712bedcf7b4ee2` |
| 00_training.dxs | `991378076fca886175a9f4f6f6d7a562fa399e8454c18ca3555ecb10239e0ee4` |

The pair and manifest are read-only under this run's
`recovered/native-save-export/`. Nine sequential requests completed and
acknowledged, maximum7 steps;22 trusted events are balanced. Runtime pins
are unchanged. All67 unique remote evidence files and the actual canonical
module were recovered and hash-verified. Browser segment was177.503seconds.
Cleanup completed02:40:15.603Z; driver24811 and Chrome24819 are absent,
port8123 closed, held keys empty. Recovery finished before02:56Z.

Box handoff is RUNNING/APIidle, healthy, expiry03:02:57.823Z,
shutdownOwner=coordinator. No FPS, guest-exit, full-game completion or fresh
count15 reload claim. The resume condition for a separately assigned task is
a safer grounded preparation from immutable count14, with measured support
margin before attempting the still-unperformed onward jump. This worker stops.
