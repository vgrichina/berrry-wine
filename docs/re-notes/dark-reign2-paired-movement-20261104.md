# Dark Reign 2: paired movement prerequisite, 2026-11-04

**WebGL gameplay remains blocked at original startup: D3D7 mip sampling is
missing.** Ordinary registered Launch rejects both HAL and RGB Emulation for
“doesn't support mip mapping,” then reports “no hardware d3d devices” and
“Can't start hardware accelerated DirectX 7.0.” No mission, selection or move
command is reached on this backend. This is a first-dependency result for
GLD3D-CORPUS-27 work, not paired gameplay success or a historical membership
assignment. The corpus status notes leave the exact 27-ID set unresolved.

Evidence: `scratch/runs/20261104-dark-reign2-paired-movement/`.

## Retained software result

Reuse the accepted [November 1 ordinary selected-unit movement
result](dark-reign2-demo.md#ordinary-selected-unit-movement-order-2026-11-01),
published in `dd82ceb03`, at execution baseline
`84358006a197266af7bb1f17ebf80de605d5d736`. I inspected its
`move-before.png.gz` and `move-end.png.gz` again: the selected vehicle moves
from roughly (352,288) to (180,225), and soldiers translate across the ground;
the pipe, pillar, crates, ridge and unselected foreground soldier stay fixed.
The accepted neutral comparison and consumed Shift-M/ordinary left click
establish command attribution. There was no new software execution. This
retains evidence at that revision; it does not requalify software on today's
module or assert arrival of every selected unit.

The accepted native module was
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
its recorded companion was
`c405379ece71b0f89e4230ad4a9f0325a0b4f23abf05ef4a748671030038633e`.
`accepted-software-references.json` records existing evidence paths and full
hashes without duplicating its archives, media or source trees.

## Original WebGL attempt and first dependency

Runtime source is exactly committed main
`1188e9bf57ef35bd3363fb88b7ca0da442ce696d`, the assigned baseline. Committed
files were read with `git show` and transferred individually to a fresh runtime
staging directory; foreign WIP was excluded. No clone, worktree or source
archive was created. `runtime-pins.json` records 1,461 staged file identities;
`relevant-source.patch` is empty for tracked runtime paths at preparation.
The original 29 game/manifest pins are in `original-media-pins.json`.
The executable is the existing private fixture
`test/binaries/candidates/dark-reign2-demo/extracted/Files/dr2.exe`,
3,969,076 bytes, SHA-256
`6aa93ded56537ff9ceb6f47d0bbe2de74b5b2b83c6932d61eb98e69d797756ed`.
The guest identifies build 873, August 16, 2000. Media was provisioned at its
runtime path, never copied into evidence.

The normal page at `index.html?debug&candidates&frozen&gl-renderer=webgl`
used the actual `dark_reign2_demo` selector, WebGL renderer selector and Launch
button. Frozen stepping changes scheduling only. The first request asked for
64 batches; the guest exited after 12, producing an incomplete-step response,
not a frozen-step timeout. `browser/startup-64.png` was inspected: the page
shows the original launch and exit, with no mission. There were no game inputs.
The first observer lost the VFS during normal runtime teardown, so the exit
code alone was not used as proof of a mip rejection.

One diagnostic replay retained a read-only reference to the live VFS before
stepping, without changing guest bytes, config or renderer. Its sole request
asked for 16 batches and again completed 12 before exit. The retained
`browser-diagnostic/guest-logs.json` records both mip rejections at
`vid_enumdx:1164`, followed by the fatal startup error. Its
`startup-exited.png` was inspected as well. No retries, mission inputs,
synthetic fixture pixels or patched game state were used after this diagnosis.
Both requests stayed below 64 batches; Launch used balanced trusted mouse
press/release events. No game keys or buttons were held.

The page selected WebGL, but **no owning WebGL context was created** in either
run. The page and attached guest-worker observations establish module
compile/instantiate/send/receive identity; they do not establish a GPU draw,
GPU vendor, unit displacement or backend parity. Both original runs loaded the canonical module; its retained companion is listed
separately:

- canonical, 2,143,540 bytes:
  `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`;
- retained compatibility companion:
  `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.

The canonical bytes were recovered directly from the diagnostic observer and
match the staged module. Both module files are preserved under `modules/`;
the compatibility companion was not executed by these Chrome launches.
Every successfully served file matched its pin (176 responses per run).
HTTP 404 records are retained, including the absent optional stdole2 typelib
and DLL search alternatives. Symbol initialization also reports missing data;
the explicit device rejection, not that warning or the final exception code,
is the diagnosed graphics dependency.

## Why there is no caps-only repair

At this exact source revision,
`src/09ab-handlers-d3dim-core.wat:$d3dim_fill_device_desc7` advertises triangle
filter caps `0x030003c3` with GPU enabled. The native-only branch adds
`0x0003003c`, producing `0x030303ff` for software triangles. The original's
previously accepted enumeration analysis checks descriptor offset `0x60`
against mask `0x3c`; the GPU mask has no accepted bit.

The production GPU descriptor lowers filtering to a single linear flag;
`lib/d3dim-gpu.js` binds one image and sets `mip: 0`. Thus the missing caps
reflect missing implementation. A causal generic repair requires explicit
mip-chain metadata/upload, separate MIN/MAG/MIP lowering, bounded partial and
malformed chain handling, and actual minified/perspective rendered-pixel
regressions through the owning WebGL path before advertising these bits.
Existing software mip implementation and GL/D3D8/9 sampling do not supply the
D3D7 transport contract. That cross-layer implementation is outside this
bounded first-dependency task. No production code, caps, tests or assertions
were changed. The exact committed closure was recompiled on the leased box with
`flock /tmp/wine-build.lock node tools/build-compile-wat.js`; validation passed
and both resulting module hashes exactly reproduce the staged binaries
(`compile.log`, `recompiled-module-sha256.json`). This is compiler/module
reproduction, not the full `tools/build.sh` gate or a new regression-suite
pass. All 1,461 runtime pins still matched after execution/recompilation.

Next work is that D3D7 WebGL mip dependency, followed by the equivalent ordinary
Demo Mission 1 / Normal / select group / Shift-M / left-click movement route
and inspected before/after frames with an actual owning renderer. Software
movement evidence remains retained; paired gameplay remains open.

## Runtime handoff

Fresh box `bx_44kza28q`, TTL 3,600 seconds, expiry
`2026-11-04T02:47:04.645Z`, `shutdownOwner=coordinator`, was recorded before
use. SSH preflight returned `api_key_action_forbidden`; it was not retried and
no credentials were changed. Separately authorized API `boat exec` succeeded.
The two browser segments ran 01:49:08–01:50:46 and 01:50:46–01:51:08 UTC,
well below 25 minutes, and both Chrome processes exited zero. Helpers and
browser endpoints were closed; process checks are retained. The box is left
RUNNING/idle for coordinator recovery/snapshot/shutdown. The worker performed
no stop, delete, resume, public deployment or approval action, and did not
inspect or continue the excluded graphics diagnostic.
