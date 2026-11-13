# NFS3 original demo driving controls, 2026-11-13

The original demo supports **Up = accelerate, Down = brake, Left/Right =
steer, Space = handbrake, A/Z = shift up/down, R = reset** as keyboard
defaults. Escape has historical race-to-Pause evidence; the shipped Pause menu
associates Continue with Escape. **Current player bindings and transmission
mode remain unobserved. Enter is not established here as Continue.**

This was a static, read-only investigation coordinated with NFS2350 through
`messageboard.txt`; its helpers and run directory were untouched. No gameplay
acceptance follows. Evidence: `scratch/runs/20261113-nfs3-controls-static-0840/`.
Inspected source HEAD: `cea2b8cb67cc5408426c63e8c4a4fffe132e5473` on main.
The original EXE SHA-256 is
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.

## Documented examples and executable defaults

The shipped `game/Setup/english/readme.txt` (English Final Demo revision 1,
September 1, 1998) uses Up acceleration, Left turning and H horn in its
**KEYBOARD PROBLEMS** example. **ARROW KEYS AND THE NUMERIC KEYPAD** explicitly
equates Up/8, Down/2, Right/6 and Left/4. It describes configurable controller
assignments, but provides no full default-key chart or transmission default.
No separate manual was found in the existing 135-file corpus or the narrowly
listed demo directory; this is the demo, not evidence for retail defaults.

The following remaining defaults come from the original executable, rather
than a host control overlay. Original VA `0x48f720` copies 13 dwords from
`0x48ef10`; `0x48f090` installs that table into `0x6fb20c` for the ordinary
non-split mode. `0x4314e0` decodes the scan from bits 8–15 of a type-4 keyboard
binding. The original controller-screen switch at `0x43ca85`, through table
`0x43c5d8`, assigns a text ID to each binding slot and displays that slot's
binding at `0x43c9d3..e8`. IDs resolve through `fedata/Text/text.ENG`.
`inspection.json` retains every slot, raw binding, text ID and switch target;
`static-disassembly.txt` retains the bounded original disassembly.

| Action | Default key | Original slot / binding | Authority |
| --- | --- | --- | --- |
| Accelerate | Up / keypad 8 | 2 / `0x00004804` | README example + executable |
| Brake | Down / keypad 2 | 3 / `0x00005004` | Executable; README equivalence |
| Steer left | Left / keypad 4 | 1 / `0x00004b04` | README example + executable |
| Steer right | Right / keypad 6 | 0 / `0x00004d04` | Executable; README equivalence |
| Handbrake | Space | 4 / `0x20003904` | Executable label ID 74 |
| Shift up | A | 5 / `0x41001e04` | Executable label ID 75 |
| Shift down | Z | 6 / `0x5a002c04` | Executable label ID 76 |
| Reset | R | 10 / `0x52001304` | Executable label ID 81 |

Other decoded defaults are C camera view, H horn/siren, B look behind,
S spike strip and L lights. A menu label/default binding does not establish
availability in this demo's selected race mode. **R means Reset, not a proven
reverse-gear command.** Reverse selection and the effects of shifting while
automatic remain unestablished; do not invent those actions.

## Automatic transmission and current saved state

Static evidence supports an **automatic initialization inference**, not an
observed current setting. `0x472144` sets ECX=1; the initialization routine
writes that value to `0x6fb2d4` at `0x472226` and `0x6fb340` at `0x472246`.
The intervening `0x4387e0`/`0x4396a0` callees preserve ECX. Session comparison
code `0x499161..16f` compares `0x6fb2d4` with a record's transmission byte at
`0x79d605 + recordOffset`. The same record byte selects displayed text at
`0x499c64..80`: nonzero selects ID 225, **Automatic**; zero selects ID 226,
**Manual**. This supports automatic as initialized intent. It does not prove
the value survives loading or describes the currently controlled car.

The existing `fedata/config/PLATCFG.DAT` is exactly four bytes,
`00 00 c0 3f` (also IEEE little-endian float 1.5); its semantic role was not
decoded. It cannot be presented as a keyboard or transmission settings dump.
The preserved native chooser export, SHA-256
`e532c367bf58953a0d629ae0f3e5df93b8239daab0f713c1d8945e2dd92f087d`,
contains eight game values concerning installation/rendering, including
`Thrash Driver=d3d` and `D3D Device=0`; none records bindings or transmission.
`lib/apps.js` keeps that chooser selection for `nfs3_chosen_renderer`, while
`nfs3_demo` seeds Glide. Its shared touch overlay supplies arrow gas/brake,
Space, Escape and Enter, but is not original control documentation.

Actual bindings may differ: `0x48efb0` selects `0x6fb240` for mode 1 and
`0x6fb20c` otherwise; `0x48dcd0` installs the selected assignments and
`0x6fb4c4` can swap steering assignments. Exact missing evidence is a fresh
native Controls screen/current selected table and current player's transmission
setting, plus input-caused behavior. The 135-file media set contains no
identified saved player-control profile. No guest/config writes were made.

## Pause, Continue and the first reviewed action

Original `fedata/Menus/pause.mnu` enables Continue in the demo and defines
`codelink=PSE_CONTINUE escape`; its Controls item opens `pscntl1`.
This is static support for Escape as a Continue shortcut while that menu is
active, not proof of a fresh successful resume. A native Continue click on a
freshly reviewed button is the clearest first resume action; do not reuse
historical screen coordinates or assume Enter's behavior.

The retained 1815 `recovered/software/pause-quit.png` was visually reviewed
again and rehashed:
`428c2623bbcab58a2e9798e8c21eefeaf618988d99c4bf61c6941a6c4bb0adc7`.
It shows **Single Race - Paused**, Continue/Restart/Quit and Controls.
Its input receipt records Escape DOWN; the associated release/review receipts
were rehashed. This agrees with the
[prior Pause review](nfs3-native-pause-reviewed-driving-0020-20261112.md),
but proves neither current Pause stability nor current resume/driving.

For NFS2350's next authorized runtime, review fresh Pause/Controls and confirm
Up remains Accelerate, then return to the freshly reviewed Pause screen.
Click its visible Continue button once and review the live road/player state.
The recommended first driving action is **Up only (host VK 38 / `0x26`,
original scan `0x48`) for one short finite hold**, e.g. 250 ms with the existing
independent release armed first; release, then use a separately balanced
Escape (VK 27) and review Pause and the resulting position/speed. Duration is
a proposed initial probe, not an established simulation interval or gameplay
success criterion. Inspect actual consequences before selecting steering or
gear input. Unknown current transmission is a reason to inspect, not to send A,
Z, R or Enter speculatively if the car does not move.

`inspect.py` passed all 13 original slot/label assertions, original menu/config
byte checks, and all 135 media SHA-256 comparisons against NFS2350's frozen
manifest. `inspection.json` records full source hashes and exact Git identity;
patches retain relevant uncommitted hunks and owned new files. No emulator,
fixture, browser, build, download or box was used. Box ID **NONE**, state
**NOT_CREATED**, expiry null, stop receipt N/A; no runtime watchdog was needed.
