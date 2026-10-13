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

## Original startup result (2026-10-13 21:07 UTC)

The original demo reaches a reviewed 640x480 main menu with Single Player,
Multiplayer, Load Game, Options and Quit. No acceptance prompt appeared.
This is startup evidence, **not gameplay qualification**.

The first bare route failed before startup because mounted companion files do
not seed app-local PE DLL loading. This was harness setup, not an established
game incompatibility. The corrected route declares each of the seven original
DLLs with repeatable `--dll-seed=ABSOLUTE_PATH`, mounts `--vfs-include=**/*`
and supplies the existing system MSVCRT dependency from the original WA demo
fixture (SHA-256 `df9f2aab7f7119f214c5d743d961fde4bf324f19011fbbb7e9cf666856fba0ba`).
No game file or registry entry was modified.

Tested source 1ab99c63 on d31cf3b78, canonical wasm
`ba6f25ea2d467b3fba00110d83575d48ac1aeb8794a474052190998067723259`,
Node v24.18.1, cooperative headless threads, default clock.
Corrected process 99702 / 99712 / 99713 ended with exit 0 at
2026-10-13T21:08:56.539Z after its 90-second guard; all were verified absent.
The earlier 98786 / 98805 setup attempt also terminated.

Evidence:
`scratch/runs/20261013T2106Z-sacrifice-original-startup/` (setup failure),
`scratch/runs/20261013T2106Z-sacrifice-original-startup-dll-seeds/`
(corrected route, screenshot, command/identity/terminal receipts and all source
file hashes). Both were retrieved to the coordinator with SHA-256 verification.
Reviewed screenshot SHA-256:
`89b12934b574e8416a821f11987812eaf15480d1a995b455e01a88d7bd61f98c`.

Next granted run should capture the current menu, click Single Player near
(320,252), review the resulting screen, then enter Tutorial through ordinary
input. The source-only command-queue driver
`scratch/sacrifice-next-control.js` in the isolated remote tree bounds that run
to 270 seconds internally / 300 externally. It is prepared but has not run.
Stop if a license prompt appears. Capture world before and after W/up movement;
menu navigation alone does not establish control.

## Tutorial selector and next causal test (2026-10-13 21:21 UTC)

Ordinary Single Player input opens the Tutorial 1/2/3 selector. A separate
ordinary mousemove visibly places the game's cursor at Tutorial 1.
Click at (240,211), a held down/up pair, and Enter leave the selector visible;
the later snapshot still reports main/focus 0x10001 with a visible 640x480
Sacrifice window. No world, acceptance prompt, error or crash appeared.
Do not infer an input or file-loading root cause from this observation.

The first continuation driver's ordinary-command whitelist omitted mousemove;
its initial Tutorial click left the game's drawn pointer at the old position.
This harness limitation was corrected in a fresh run with no guest or emulator
patch. The corrected driver sent mousemove at batch17250, click21793,
mousedown28316, mouseup30365, and Enter35733. The pointer correction alone did
not make the Tutorial start.

Both routes exited0 after ordinary control-channel quit.
107794/107804 ended21:21:24.938;110658/110668 ended21:23:30.966;
all four were verified absent21:23:40.621 before releasing the runtime.
Evidence retrieved to the coordinator:
`scratch/runs/20261013T2119Z-sacrifice-tutorial/` (13 artifacts) and
`scratch/runs/20261013T2121Z-sacrifice-tutorial-pointer/` (16 artifacts),
including reviewed menu/selector captures, exact control events, commands,
source/module identity and terminal receipts. All 29 artifact hashes verified.
These remain startup evidence; gameplay and ordinary world control are unqualified.

Static analysis now provides a narrow next diagnostic. All addresses below are
the original fixed-base Sacrifice.exe's guest VAs:

- RegisterClassA setup at0x40b296 assigns wndproc0x40af60. WM_LBUTTONDOWN
  reaches0x40b18e, tests byte[0x4cdf28]&4, and calls0x406260(this0x4cdf30,mask1).
  The corresponding up path0x40b1c6 calls0x4062a0(mask1) under the same gate.
- The original menu dispatcher recognizes fourCC tu01..tu03 at0x40e8ee
  through0x40e900 and enters0x40e93f. It calls0x4997f0 with the string Tutorial.
- That lookup clears global pointer0x4ce288 and calls0x494ab0, which selects
  the Tutorial name through0x494d50. At0x40e980 the caller skips map selection
  if the pointer is NULL; otherwise it calls0x4950c0 and then0x4978f0.
- Tutorial enumeration at0x495c10 supplies the original maps/tutorial path to
  0x494c20; its FindFirstFileA call is0x494c59 and FindNextFileA is0x494c98.

The source-only plan and disassembly are in
`scratch/runs/20261013T2124Z-sacrifice-selector-source/`.
Its syntax-checked diagnostic-driver.js prepares a160-second ordinary route
with trace-input, named file API tracing, and passive counters at0x40b18e,
0x406260,0x40e93f,0x4997f0,0x494c20,0x4950c0,0x4978f0.
Bracket the reviewed Tutorial click with hit-counts and read-only dumps of
0x4cdf28/0x4ce288. This distinguishes arrival at the original Tutorial handler
from subsequent mapset discovery. Existing sampled EIP logs cannot establish
that either branch was reached or missed. No diagnostic run, state write,
registry fabrication, or emulator repair is authorized by these static findings;
the next run requires the coordinator's runtime grant.
