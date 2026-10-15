# Darkstone demo 1.0

## Package and installation

The local package comes from the Windows 98 A-D archive recorded in
`sources.md`. Its original `Setup.exe` is an InstallShield bootstrap, not the
game executable. `tools/install-darkstone-demo.js` runs that bootstrap inside
Wine-Assembly, captures the `_INS5576._MP` child it emits, and then drives the
guest installer through Welcome, destination selection, program-folder
selection, file copy, and Setup Complete.

The installer must see the package recursively: `dvoices1.mtf` is under the
source `data/` directory. Mounting only top-level files correctly produces
InstallShield move-data error `-113`; the installer tool uses `**/*` and checks
the complete payload instead. The host copies files only after the guest
installer has written them.

Pinned SHA-256 values:

- original `Setup.exe`: `a6d2f8b9173fd43f03aabff0b8cc3fadbd0b15224bcbe5f562a32158a297b502`
- emitted `_INS5576._MP`: `c9d2bee521bc3d8037b164c9468b145646fc556a6969acf83f5556e4b295fc79`
- installed `darkstonedemo.exe`: `b43db5e1b835eb1e93688a1f3f1d9c814517be6fc8110c7fb6e024d467ee721b`
- installed `ddata.mtf`: `0e9f56d01af4738e09dcdd9a7de21ff9e683468259465553e1edb0ebe3a66850`
- installed `dmusic.mtf`: `eec342ef67fb2440cd705eafaf4411eccd67d3aa888db7097aa0f551d39d99e0`
- installed `dvoices1.mtf`: `bd01d2b6dda05b792c22371ab5cba1e36fb316fe0d81401a49fe9169beecee9e`

The resulting `installed/` tree contains 14 files and 33,471,003 bytes before
manifest generation. The app and generated manifest now use only that tree.
Run the authentic installer with:

```bash
node tools/install-darkstone-demo.js
```

## Distribution status

The installed readme calls the package `DARKSTONE Demo 1.0`, describes its
reduced music and voice assets, and lists Windows 95 or 98 as supported. It
does not contain an explicit grant to redistribute the package. The original
installer and its generated playable tree therefore remain local and
gitignored. `sources.md` links the preserved original distribution so it can be
obtained independently; Wine-Assembly does not publish these game files.

## Gameplay route

`test/test-darkstone-gameplay.js` launches the registered app through one
headless CLI process with cooperative scheduling, frozen stdio control, and the
CLI's own `--max-seconds` guard. It skips the logo, selects New Game and One
Player, creates a warrior named `CODEX`, and moves the new champion into the
first party slot. The slot assertion is scoped to the portrait region so a
card merely following the cursor cannot pass.

Demo 1.0 enters Town directly after party confirmation; unlike the retail
manual's route, it does not display a difficulty menu. The test waits through
the forest loading animation. Its live-town check requires the blue mana HUD
that is absent from the loader, then holds the right-arrow key and requires a
substantial pixel change from camera rotation. This is a functional acceptance
test, not a performance benchmark. Screenshots default to the system temporary
directory.

Run explicitly with:

```bash
node test/test-darkstone-gameplay.js
```

### Retained gameplay recovery, October 7

Before assigning a new-game run, a read-only audit recovered all ten existing
captures from `/tmp/wine-assembly-darkstone-gameplay/`, with file mtimes on
October 6 from 06:31:23 to 06:31:46 UTC. They are copied and SHA-256 indexed in
`scratch/runs/20261007-darkstone-retained-gameplay-audit/`. The reviewer
`codex:darkstone-refill-worker` personally inspected `08-town-before-input.png`
and `09-town-after-input.png`: both show Town, the champion and full HUD;
the road, trees and gate rotate substantially between them, consistent with
the ordinary Right camera-input route documented above. This is historical
controlled gameplay, so Darkstone is excluded from a never-qualified new-game
refill. No game was rerun during recovery.

The original invocation, execution start/end, source/module hashes and exact
renderer were not recovered. The result records these as unknown, retains
file mtimes separately and timestamps the recovery itself. It does not
qualify the current module or establish gameplay FPS. The later October 6
browser results only reached the main menu and do not replace this evidence.

## `--stuck-after` kills the asset load, and it looks like an emulator bug

### Fresh browser menu checkpoint, October 15

Run `20261015-darkstone-software-menu` captured and reviewed the ordinary main
menu on an explicitly older admitted source snapshot: controller commit
`eb5a9559fbb4209823cd0473e5dc5bb6c4d7b3bb`, production-equivalent to the
verified IW `6c22121e` build, canonical module
`04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
This does not test the later GetParent/main changes.

The owning page's actual `wine._wasmModule` object hashes to that module
(1,803,941 bytes), independently matching the served HTTP and disk bytes.
All 15 installed fixture paths matched locally and over HTTP before launch
and remained unchanged afterward. Chrome 151.0.7922.108 ran headless with
SwiftShader enabled, isolated guest Workers and the software backend request.

At 16:35:22.622 and 16:35:25.031 UTC the completed main-Worker slice sequence
advanced 4691 → 4804 and replay commands advanced 774343 → 821142, with zero
reported fallbacks and zero GL triangles. These are replay/presentation
counters, **not software raster-draw consumption evidence**. Backend remains
unknown. A child Worker also exists, and the collector does not attest its
render ownership. The console retains missing `ole32.dll`/`comctl32.dll`
built-in fallback messages; no crash was reported.

The reviewed screenshot shows New Game, Load a Game, Configuration, Credits
and Exit Game. Console resize is **640×480**: do not blindly reuse the older
800×600 route coordinates. Before another click, capture the live canvas
dimensions and map the visible menu target. No menu click, party creation,
Town arrival, control, combat, audio or FPS was tested in this checkpoint.

The outer controller `247615` finished normally at 16:35:25.152 UTC.
Independent postflight at 16:35:49.700 verified no active runtime processes,
unchanged source/dependency/browser/fixture inventories and preserved
937/a948/04ede/0dbf/e26a modules. Earlier staging-only attempts stopped before
the browser on an absent sparse-checkout app document and an inaccessible
unrelated Chrome extensions directory. No permissions were changed; the
successful preflight records sparse omissions and pins regular Chrome files.

Recovery bundle in the shared checkout:
`scratch/runs/20261015-darkstone-software-menu/evidence.tar.gz`, 1,532,791 bytes,
SHA-256 `984d1aa01ce7720bf8ee3f54e39618e0c52c97f039df9f11c86e584ea697d3f4`.
The screenshot is `darkstone-menu-evidence-3/capture/menu.png` inside it,
478,739 bytes, SHA-256
`7bc3eb8915e4f09dbf609f717e41fa075b51eb262c50700e7fc7355d12fbf8b5`.
The archive contains the exact executed outer controller, invocation,
pre/post inventories, fixture hashes, console and slice logs. Extract into the
same run directory to recover the relative paths. Darkstone has no candidate
entry in the current candidate-corpus manifest, so this remains investigation
evidence rather than assigning another application's dashboard candidate ID.
See `docs/darkstone-backend-checkpoint-20261015.md` for the staged recipe.

Driving this app by hand with a plain `test/run.js` command line ends at
**batch 1183** with no error line, no crash dump and no unimplemented API —
the process simply stops. That is not the guest. It is `run.js`'s own
`--stuck-after`, which defaults to **10** (`test/run.js:773`): after ten
batches that retire no new EIP the harness decides the run is wedged and ends
it.

The loop it trips on is legitimate. `0x004e7b2b` is the demo's asset-load
loop reading `ddata.mtf`, and a load that reads 33 MB out of one archive
spends a long time in one tight block by design. Nothing is wrong, so there
is no diagnostic to find; the run just disappears.

The fix is one flag:

```
--stuck-after=1000000
```

With it the demo runs straight through the logo, New Game, One Player,
warrior creation and the forest loading animation into **Town**, with the
full HUD — portrait, health and mana orbs, potion belt and minimap — on a
champion standing on the forest road. Verified on the remote bench box under
`--d3d9-renderer=software --d3d9-programmable`.

Reach for this reading whenever a bounded run of *any* asset-heavy app ends
early and silently: the absence of an error is the tell, because every real
failure path in the emulator prints something.

## The host's per-object GetTickCount loop and the clock-spin detector (2026-10-10)

After "Create a session", the host's main thread stamps every object with
GetTickCount and makes no other API call in between, with only 5-8 blocks
between reads (w4). The clock-spin detector took that for a busy-wait and
parked once per object, leaving the host on the white Session menu for minutes.
a7e5f4f75 makes a read count only when the callee-saved registers match the
previous read in that context, so a per-object loop no longer qualifies.
Host-only A/B, same build (run `20261010T1720Z-clock-spin-regs-check-boat`):
`--spin-regs-check=15` gives 0 parks and Town as HOST; `=0` gives 1213 parks
and the frozen Session menu. The two-seat test no longer needs
`--no-spin-park` for this.

## Multiplayer over the virtual LAN (2026-10-10, w4)

`test/test-darkstone-vlan-gameplay.js` (heavy, boat) plays two seats to the
Town together. Menu route (800x600 coordinates): New Game (400,260) ->
Multiplayer (400,374) -> create a champion as in single player -> OK
(425,570) -> Available Services: TCP/IP (400,374) -> Session: Create a
session (400,324) / Join a session (400,424). Join asks "Enter IP address, or
Name of Host": click the field (400,372), type with keydown + di-keydown +
**keypress** per character ('.' is VK 190; the champion-name field works
without keypress, this one does not), OK (400,420), then **double-click** the
session in the list (400,330); a single click only highlights it.

DirectPlay: `CoCreateInstance` of an `IDirectPlayLobby2` (only for
`GetConnectionSettings`, i.e. "not lobbied") and of `IDirectPlay3`, used as
`IDirectPlay4` when available (flag `[0x52aa64]`). The game's wrapper object
lives at `0x8a9f00`: `+0x6704` is-host, `+0x6708` "session lost, stop
sending", `+0x670c` own DPID, `+0x6710/+0x6714` the player event and a quit
event, `+0x6718` the receive thread, `+0x6720` joined/in-world, `+0x6724`
CreatePlayer succeeded, `+0x673c/+0x6744` received message count/bytes.
Thread `0x40bb70` waits on the two events and runs the receive loop
`0x40c010` (`Receive(DPRECEIVE_ALL)`; sender 0 -> system handler `0x40cee0`,
else app handler `0x40d390`, a jump table on the first byte, types
0x65-0x7f at `0x40d878`). Every send goes through `0x40cb60` (size per type
from the table at `0x40ce68`), which calls `GetMessageQueue(SEND)` and then
`SendEx` with **GUARANTEED|ASYNC|NOSENDCOMPLETEMSG (0x601)**; it treats only
`DPERR_CONNECTIONLOST` (0x88770168, logs "SESSIONLOST", sets `+0x6708`) and
`DPERR_BUSY` (retry x5) specially. Before 47aafe16e our SendEx refused ASYNC
and nothing ever left either seat.

Join protocol: the guest, inside its `EnumPlayers` callback, resets the event
at `[0x647ee0]`, sends type 0x6c (8 bytes) and waits `WaitForSingleObject(10 s)`
up to three times at `0x416e4b` (timing out tears the session down via
`0x40bf10`). The host's 0x6c handler `0x40d980` either pings 0x7f every second
(host not yet in the world, `+0x6720` clear) or, normally, announces a block
transfer with 0x6d (16 B: block count, size; guest handler `0x411850`) and
sends the world in 0x6f blocks (536 B, guest handler `0x411940`, "receiving
%d/%d..."), each acked by the guest with 0x6e (12 B). After the last block the
guest sends 0x7e and `0x40e1a0` sets `+0x6720` and signals `[0x647ee0]`. The
demo's town took 5 blocks. Headless this is slow but correct: run.js pumps a
seat that is not blocked on the wire only every 64 batches, one block round
trip per pump, so the test waits 800 batches after joining.

## 2026-10-15 fresh paired backend evidence

The original installed demo reached Town through ordinary character creation on both software and WebGL using a fresh normal build at source `fadaff08a` (module SHA256 `9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e`). Actual before/idle/held-ArrowRight PNGs establish camera control in both arms. Owning main endpoint 1 has advancing completed native software draw calls in software and advancing actual WebGL submissions in WebGL. Observed WebGL error/fallback counters are zero, but `declinedClears=1` remains explicit. Child renderer ownership, locomotion/combat/audio/FPS and original-27 membership are not qualified. See `docs/darkstone-backend-checkpoint-20261015.md` for exact landmark counters, independent cleanup and the full recovered archive SHA256 `25252b50372c11589f30439d0a13ab39b09576b5844c1855721c26a429c2aa8f`. Earlier c7e/04ede screenshot-only evidence remains backend-unknown.

2026-10-15 locomotion follow-up: the no-rebuild WebGL capture on paired module 9b57583c showed two ordinary left-click road targets changing character position relative to Town gate/tree landmarks, with a following camera and stable intervening idle. No camera key was used. Main endpoint draws advanced with zero observed errors/fallback sites/direct or fallback software completions; declinedClears remained 1. The session later hit its input-queue deadline (exit 1), so the additional final-idle screenshot is absent; both independent cleanup/preservation checks passed. Full qualified result and archive SHA56acbc258d810f764e91edcc0644e45816d4ebd668f53b8f7174e1c6f2476087 are in `docs/darkstone-backend-checkpoint-20261015.md`. This is movement evidence, not an overall successful terminal run, FPS/audio/combat qualification, or original-27 membership.
