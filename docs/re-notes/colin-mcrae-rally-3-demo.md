# Colin McRae Rally 3 demo

## Original assets and launch

Investigated 2026-10-10. Installer: `ColinMcRay-Rally3-pcdemo-D3D.exe`,
126663356 bytes, SHA-256
`d1dff3e9e718859c6a127b7efcbd85189198ff823f504db2470dbdeacd183ec0`.
Extracted original `Rally_3PC.exe` SHA-256:
`50ac9d5efbadd8b9d593ac229e82711a0742f6b2dd4eaac58a1d573cd981408c`.
The fixture has 333 original files. Audio assets are in `Data/Sounds`
(plural); do not mistake `Data/Sound` being absent for missing assets.

Temporary-box fixture and registry: `/home/user/cmr3-game-20261010/`.
The launch controller is `scratch/cmr3-demo-20261010/rgb565-original.js`.
Use the original executable, VFS tree, saved registry, software D3D9 with
programmable support, and a bounded run. No input was required to reproduce
the startup stop; no approval or license dialog was answered.

## Graphics progress

The original requests fullscreen R5G6B5 display/backbuffer format 23.
The RGB565 candidate supplies packed guest storage, correct row pitches,
per-write destination quantization, and format-aware upload/readback,
Present and Reset. Direct and worker paths were tested. Multisampling and
565 StretchRect/conversion remain unsupported.

`scratch/runs/20261010T1010Z-cmr3-rgb565-tests` records the canonical build,
focused regressions and isolated native precision tests. The existing
PS1.4 fixture in `test-d3d9-software-backend.js` fails on unchanged main too;
this is not a full-suite pass. A later correction preserves historical
nonsoftware render-target widening used by Black & White 2, while software
keeps real 565 storage. That fallback is not exact WebGL 565 precision;
its final rebuild/retest is separate from the 1010 evidence.

## Current startup blocker: DirectSound notifications

Reviewed run `scratch/runs/20261010T1012Z-cmr3-rgb565-original` uses candidate
WASM `8c23deecf4c26f982044591cff64b634105bca6835f7e85ea198b00699f35a5d`.
CreateDevice succeeds and SetGammaRamp receives device `0x08140028`.
The game reads `Data/Sounds/dsstdfx.bin` and
`Data/Sounds/frontend/frontend.big`, then calls through a NULL sound interface.
The screenshot is black. Exit code zero does not mean successful startup;
there is no gameplay qualification.

Original addresses:

- `0x517795`: buffer QueryInterface, IID at `0x54257c`.
- IID bytes `830721b0cd89d011af0800a0c925cd16` identify
  `B0210783-89CD-11D0-AF08-00A0C925CD16` (IDirectSoundNotify).
- `0x5177cf`: call through returned interface vtable slot 3, count 1 and
  notification array `0x074ff870`; return address `0x5177d2`.
- Current `dsbuf_iid_kind_wa` recognizes IUnknown, Buffer, 3DBuffer and
  3DListener, but not Notify. The notification method is absent from api_table.

Implement actual event delivery, not a dummy interface or success stub.
Notifications must wake waiting threads without requiring the guest to poll
GetCurrentPosition. Existing host voice cursors wrap modulo buffer length;
comparing only successive wrapped values loses whole laps. Account for loop
refresh, seek, frequency changes, natural end, explicit Stop and release.

Microsoft's [interface contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418244(v=vs.85))
requires CTRLPOSITIONNOTIFY for secondary buffers. The
[method contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418245(v=vs.85))
replaces the notification array while stopped and signals offsets or the stop
sentinel. Preserve COM identity, copied-array lifetime and failure atomicity.
The existing audio-completion pump and `set_event` path are integration points;
browser AudioWorklet and worker delivery need explicit tests.
