# LBreakout2 2.5.1 original Win32 package

Source-only preparation, 2026-10-18. No game, installer, build or browser was
executed. No gameplay or compatibility claim follows from this inventory.
The title has no public desktop entry or recorded qualification in integration
HEAD `5081b1cb9` (apps, TODOS, re-notes and shared messageboard checked).

## Recovery and originals

Official listing: <https://sourceforge.net/projects/lgames/files/lbreakout2/2.5/>
(dated September 25, 2004). Download:
<https://downloads.sourceforge.net/project/lgames/lbreakout2/2.5/lbreakout2-2.5.1-win32.zip>

- ZIP: 3,322,804 bytes, SHA256
  `a152c0867abf9bc39563db932ebcd0797ed3e35d20f21c2dca2a81e321313675`.
- Expanded: 230 files, 5,606,025 bytes. ZIP paths checked for traversal before
  extraction. No installer is present or needed for this archive layout.
- Retained evidence root:
  `/home/user/wine-assembly/scratch/runs/20261018-lbreakout2-source`.
- Original executable:
  `original/lbreakout2/client/lbreakout2.exe`, SHA256
  `cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244`.
- `source-manifest.json` pins every file; `archive-listing.json` retains ZIP
  paths/sizes; `pe-closure.json` and individual `.pe.txt` files retain static
  PE observations. All eight executable/DLL files are `pei-i386`.

Recover by downloading the exact ZIP into a fresh evidence directory, checking
the ZIP hash, and extracting unchanged paths. Do not merge into existing game
data. Keep acquisition plus extraction below 50 MB and preserve at least 2 GiB
free with a 64 MiB early-stop margin. Read `lbreakout2/README` and `COPYING`;
the archive includes GNU GPL version 2. This is source/license inspection, not
an installer acceptance or public distribution decision.

## Static launch closure

The client directory contains 220 files, including `gfx`, `gui_theme`, `levels`
and `sounds`. Preserve all paths relative to that directory. Original bundled
DLLs: `SDL.dll`, `SDL_mixer.dll`, `SDL_net.dll`, `libpng.dll`, `zlib.dll`.

The client EXE imports SDL, SDL_mixer, SDL_net, KERNEL32 and MSVCRT. SDL imports
WINMM/KERNEL32/USER32/GDI32/MSVCRT; mixer imports SDL/MSVCRT/KERNEL32/WINMM;
net imports WSOCK32/SDL/MSVCRT/KERNEL32. libpng imports zlib/MSVCRT and zlib
imports MSVCRT. libpng/zlib are bundled but are not direct EXE imports; retain
them without claiming the executable necessarily loads them dynamically.

MSVCRT is **absent from the original ZIP**, despite README's packaging recipe
mentioning it. Authentic shared runtime is available at
`/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll`, 278,581 bytes, SHA256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`;
it imports KERNEL32 only. Seed that exact existing runtime explicitly alongside
the five original DLLs. No other non-system imported DLL is missing for the
client's static closure. This does not assert all system API implementations
are supported or all runtime-selected resources are known. Server launch is
outside this task (its directory lacks SDL.dll and MSVCRT).

## Next bounded observation

Root grants the serialized runtime slot and pins current source/prebuilt module
before execution. Prepare the ordinary direct-EXE route with the client directory
as VFS root/current directory, all 220 client files, five explicit original DLL
seeds and authentic MSVCRT. No command-line game switches are needed by the
README's Win32 route; do not invent settings or overwrite original files.

First observation should be passive, no input: internal 60-second limit,
85-second external hard deadline, 8 MiB log cap, admission above 2 GiB + 128 MiB,
owned-process stop at 2 GiB + 64 MiB. Use `--no-build`, an explicit canonical
`--wasm` path, `--real-ticks`, and a fresh run directory. Verify all fixture and
source hashes before/after, inspect actual screenshot/log, record actual exits
and independently check owned PIDs absent. Publish honest result metadata last.
Any runtime failure remains a new observed boundary, not proof of a missing API
based solely on this static inventory. Ordinary menu/control planning follows
only after reviewed launch evidence; no server/network execution is proposed.

## Passive original launch, 2026-10-18

Run `20261018-lbreakout2-passive-startup` reached the original 640x480 main menu.
`sample-0.png` and `final.png` were personally reviewed: Local Game, Quick Help,
Controls and the highscore panel are visible. No input was sent. No missing
file/API boundary appeared in the retained log; this establishes startup only.
Next ordinary action is Local Game after a separate runtime grant, with Controls
or Quick Help inspected before asserting bindings or player movement.

Actual start HEAD `bcb523527031cc8d29e3e96181f24c448a39b719` differs from approved
`848fbb3d0` only by root coordination updates. Exact module SHA256:
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`.
The direct route explicitly mounted all 220 client files under `C:\LBREAKOUT`,
set that cwd and seeded all five original DLLs plus authentic CRT. It used
cooperative CLI with real elapsed ticks; no build/browser/server ran.

Child 2260640 and controller 2260630 exited 0 after 60.201 seconds; independent
process/group inspection found neither alive. All 3192 physical runtime/CRT pins
and all 230 original payload hashes passed independent postflight. Minimum free
disk was 2,835,402,752 bytes; log 26,188 bytes; no resource guard fired. Preserve
the initial preflight refusal in the prep directory: pinning all tracked files
included concurrent TODOS edits, so root approved narrowing pins to runtime
inputs before any child was launched. No runtime source was changed.

`review.json` was written last in the run directory. There is no corpus candidate
entry yet, so this is investigation evidence, not an unrelated dashboard result.
Runtime is released. Gameplay, audio, FPS and public deployment remain unclaimed.

### Ordinary gameplay preparation (no new runtime grant)

`scratch/runs/20261018-lbreakout2-gameplay-prep` contains the bounded controller,
atomic request publisher, input bridge, source-only tests and `PLAN.json`.
Refresh all pins before execution. The passive route's real elapsed ticks,
cooperative mode and exact original mounts/DLLs remain; the changes are ordinary
renderer inputs and 180-second guest / 185-second soft / 210-second hard limits.
Input admission ends at 175 seconds. Existing disk/log guards remain.

The original README does not establish default bindings. Inspect the actual
Controls and Quick Help screens using visible menu items before making binding
claims. Passive menu positions suggest Controls near (180,340) and Local Game
near (180,272), but each action must cite a freshly reviewed local screenshot
hash. Inspect the resulting Local Game setup before selecting visible Start.
Compare an actual paddle against fixed bricks before/after left/right pointer
movement and after an idle interval, then release the ball only by the binding
shown in the original UI. README troubleshooting explicitly warns simultaneous
paddle movement and ball release/fire may lose events; separate these actions.

Keyboard and mouse holds receive independent host-timer releases, including
shutdown, without waiting for screenshots. Only one hold may be active. Six
pure-JS normal/early-close cases verify mouse down/up, key down/up and ordinary
mouse movement; stale screenshot hashes reject. No runtime source is changed,
no game input has yet been sent, and no paddle/ball gameplay is claimed.

## Registered first-level route, 2026-10-18

`20261018-lbreakout2-registered-gameplay` used `--app=lbreakout2_251` after the
dedicated verifier confirmed all 220 original client files, 219 exact companion
mappings and authentic CRT. Registry cwd/guest executable/empty args and six
seed paths were independently checked against the passive route. Source HEAD
`886e1f279`, same exact `a4a4bc6a` module; real ticks and cooperative mode.

Ordinary arrow navigation and Enter opened Quick Help, Controls, Local Game,
then Start Original Set. Reviewed `controls-settled.png` shows Left/Right arrows,
Y Left Fire, Space Right Fire, X Paddle Turbo, C Ball Turbo, Backspace Return.
Escape returned from help and controls. Initial pointer move/held-click attempts
did not visibly activate Controls; keyboard menu navigation did work.

`level-start.png` and `final.png` show **Late At Night (1/25)**, fixed bricks,
paddle and attached ball. The level screenshot arrived at the 175-second input
cutoff, after menu/help inspection consumed the window. No paddle movement or
ball release was attempted. This is a real level launch, **not player-control
qualification**. Audio/FPS also remain unqualified.

Child 2273779 and controller 2273766 exited 0 after 180.210 seconds; independent
PID/group inspection found no survivors. All 3413 runtime/fixture/CRT pins and
230 original hashes passed postflight. Minimum disk 2,610,061,312 bytes; log
62,752 bytes; no guard fired. The dashboard result is `unknown` for the pending
control criterion, with exact route/artifact hashes retained. Runtime released.

Next fresh grant can use the now observed short route: on fresh main menu Down
selects Local Game, Enter opens its submenu, first Down selects Resume Last Game,
second Down selects Start Original Set, Enter launches. Review each transition;
then compare Left/Right held paddle positions against fixed bricks and idle,
followed by separate Space fire only after reviewing the actual level. Preserve
the same input cutoff and resource limits; do not extend an expired run.
