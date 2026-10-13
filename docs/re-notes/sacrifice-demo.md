# Sacrifice demo — original source preflight (2026-10-13)

Task: NEW-GAME-SACRIFICE-20261013. Source-only; no runtime, gameplay, screenshot, audio or FPS claim.

## Original source and exclusion

Downloaded [the archived Shiny/Interplay 2000 demo](https://archive.org/details/Sacrifice_201404)
from `https://archive.org/download/Sacrifice_201404/Sacrifice.exe`.
The 95,195,047-byte download has SHA-256
`79b8dfa18dd8663abb74dc669d9c6505d4f302603eb2bde3a8d4f11a529a13b2`.
Its MD5 `c0d9d1ef97ecff71dffb7098bb14d0b3` and size match
[ModDB's original sacdemo.exe listing](https://www.moddb.com/games/sacrifice/downloads/sacrifice-demo).
No retail payload, wrapper patch or modified guest was used.

At preparation time Sacrifice was absent from the live public
`https://wine-assembly.berrry.app/lib/apps.js` (SHA-256
`1fbeefb255b5d4d8d28d0554bbcb06000f28cd125b1c78e1912cd7a081c41611`),
main's app registry, candidate manifest, tasks and prior investigation notes.
Preparation tree: `bx_yqnspudj:/home/user/sacrifice-source-work`, base
`d31cf3b784c18dc2647b21a72c7777a800e96f9f`.

## Payload and launch prerequisites

`7z x` extracts the outer MSZip CAB at file offset 168534; `unshield x`
extracts the original InstallShield data1.cab/data2.cab payload.
The game component `Program_Executable_Files` contains 115 files,
101,431,554 bytes, including the original executable, seven DLLs, cache,
demo data and maps. No installer or game was executed.

Remote source: `/home/user/sacrifice-fixture/sacdemo.exe`.
Original installer: `/home/user/sacrifice-fixture/installer/Disk1/Setup.exe`.
Game root: `/home/user/sacrifice-fixture/payload/Program_Executable_Files`.

`Sacrifice.exe` is an 831,488-byte PE32 i386 Windows GUI program, linker 6.0,
image base 0x400000, entry RVA 0xb20cc, timestamp 2000-11-20 19:26:36 UTC.
SHA-256: `79c4754998031e2d0ee0de008c8958507d475b4debe77aa4c746bfac522f8fc8`.
Imports include share.dll, game3d.dll, DINPUT, MSVCRT and normal Win32 APIs.
Original 3d_d3d.dll imports DDRAW; game3d.dll uses SMACKW32; sound.dll uses
Mss32 and SMACKW32. The original share.dll names registry key
`Software\\Shiny Entertainment\\Sacrifice Demo`; values required for startup
are not yet established. Do not invent registry values.

Readme minimums are Windows 95/98/2000, 64 MB RAM, DirectX 7.0a and an
8 MB Direct3D adapter. Original tutorial maps tu01/tu02/tu03 exist.
Readme controls are W/S or up/down to move, A/D or left/right to turn.
Ordinary Tutorial UI is the intended first controlled gameplay route.

## Bounded next step

After the coordinator grants the runtime resource, pin the current reviewed
canonical wasm and dependencies in this isolated tree, verify their hashes,
then attempt an original startup for at most 90 seconds (external guard 120s).
The extracted-original route mounts Sacrifice.exe plus every original companion
file with `--vfs-include=**/*`; it must not replace DLLs, patch the executable,
fabricate installation state or auto-answer a license dialog. Capture and review
the first startup screen before selecting Tutorial or adding control inputs.
If extraction omitted required installer state, investigate the original installer
instead of guessing it. Any encountered acceptance prompt remains unanswered.

The bundled Readme contains a general product license and restrictive
redistribution language. No license was accepted and no public distribution
is authorized by this investigation.

Evidence on the remote tree:
`scratch/runs/20261013T2055Z-sacrifice-source/` contains
archive metadata, original public-app snapshot, extraction logs, PE headers,
all 115 file hashes, import inventory and preparation.json. No result.json is
published because the title has no corpus registration or actual runtime run yet.
