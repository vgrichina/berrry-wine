# Age of Empires (1997 shareware demo)

`lib/apps.js` id **`aoe1`**, exe `test/binaries/shareware/aoe/aoe_ex/Empires.exe`
(1,607,680 bytes, `imageBase` 0x400000). All VAs below are **original** VAs —
what `tools/disasm_fn.js` prints for the file on disk.

## Status: reaches the main menu

```sh
node test/run.js --app=aoe1 --quiet-api --max-batches=60000 --max-seconds=90 \
  --no-close --png=/tmp/aoe1.png
```

Measured 2026-09-20 on `main`: 60000 batches in 16.5s, 225,722 API calls, and
the capture is the full animated title screen with Single Player / Multiplayer /
Help / Scenario Builder / Exit. Two runs at 30000 batches produced a
byte-identical PNG, so the route is deterministic and usable as an A/B oracle.
`test/test-aoe-menu.js` drives it further, to gameplay and the in-game menu.

## "Could not initialize graphics system" — solved, do not re-investigate

That message box is **not** a DirectDraw problem, and chasing it through the
DirectDraw handlers is a dead end that has now cost two sessions. It was root
caused and fixed in **501e4133** (2026-09-19), pinned by
`test/test-virtual-free-mapped-view.js`.

The cause: AoE memory-maps its `.drs` archives and its allocator hands
**unaligned interior pointers into those views** to a "decommit these bytes"
helper, which calls `VirtualFree(ptr, size, MEM_DECOMMIT)`. On Windows a view is
released with `UnmapViewOfFile` and `VirtualFree` on one fails with
`ERROR_INVALID_ADDRESS` without touching a byte. Here it reached
`$virtual_map_decommit_zero`, which zeroed the interface shapes straight out of
the mapped `Interfac.drs`; the shape count then read 0 and the game blamed the
video card. Measured example from that dig: `0x7de5d197` size `0x183e`, inside
the guest `0x7d1b0000` view.

**The misleading trail.** Every address a trace shows just before the bail sits
in this allocator, and none of them is what it looks like:

| VA | What it actually is |
|---|---|
| `0x0046e810` | file-mapping wrapper — `CreateFileMappingA` at `+0x83` (ret `0x46e893`), `MapViewOfFile` at `+0xbb` (ret `0x46e8cb`) |
| `0x0046e69e`, `0x0046e7a0` | neighbouring allocator helpers. A trace hit here reads as "registry", it is the archive mapper |
| `0x0046ebb0` | arena/view list walk: for each node, `[esi]` vs `ebp` over a `0xc`-byte stride, `0` on miss. Only caller is `0x0046ecdf` |
| `0x0046ef00` | the decommit wrapper: `VirtualFree(ecx, eax, MEM_DECOMMIT)` through `[0x7735c0]`. Two callers, `0x00499ac9` and `0x00499af2` |
| `0x00499820` | the allocator body that owns both those calls — the "guest code at `0x00499a13`" a failing trace reports |

So a report of the form "registry op at `0x46e7f3`, guest code at `0x499a13` and
`0x46ec22`, then `LoadStringA` → `MessageBoxA`" is describing the *fixed* bug,
not a new one. Re-check the emulator build before digging.

The message text itself lives in the UTF-16 string table at `0x00785666`
(length word `0x6f`, text from `0x00785668`)
("Could not initialize graphics system. Make sure that your video card and
driver are compatible with DirectDraw."), next to the sound and communications
variants — `tools/parse-rsrc.js` truncates its dump, `tools/dump_va.js
<exe> 0x00785560 640` shows the block.

## Startup API profile (`--trace-api`, current build)

Roughly, by API call index:

- **#79–#96** — four `CreateFileMappingA`/`MapViewOfFile` pairs: the `.drs`
  archives (Interfac, Graphics, Border, Terrain). All succeed.
- **#253–#259** — `DirectDrawCreate`, `SetCooperativeLevel(0x11)`,
  `SetDisplayMode(800, 600, 8)`.
- **#333** — the first `IDirectDrawSurface_Blt`. This is where the old abort
  landed ("roughly 334 API calls in"); a healthy run walks straight past it into
  `HeapFree` traffic and then font `LoadStringA`s (ids 101–130, Copperplate
  Gothic Light / Comic Sans MS / Arial — the TTFs `lib/apps.js` mounts).
- **#479 onward** — `IDirectSound_SetCooperativeLevel`, then the menu's
  `SetEntries`/`Blt`/`timeGetTime` loop.

No DirectDraw call fails anywhere in this sequence.

## Invisible in-game cursor: wrong DDERR_NOCLIPPERATTACHED (fixed 2026-10-06)

On the menus AoE uses the system arrow (`SetCursor(IDC_ARROW)`). In
gameplay it switches to a software cursor: `SetCursor(NULL)`, a NULL class
cursor, and a 64x48 colour-keyed sprite surface. Each frame it saves the
render surface under the pointer (`Blt save <- render`, at `0x44def8`), then
calls `IDirectDrawSurface::GetClipper` (`0x44df71`) and treats exactly
`DDERR_NOCLIPPERATTACHED` (0x88760238) as "no clipper". Any other failure
stores the HRESULT and returns **without drawing the cursor**. Our
`GetClipper` (and `SetClipper(NULL)` with no clipper) answered 0x887600FF,
which is DDERR_NOTFOUND (255), so the pointer never reached the render
surface. Only the WM_MOUSEMOVE path's direct `BltFast` onto the primary
showed it, and the next present erased that. The fix is the constant;
`test/test-directdraw-surface-clipper.js` now pins 0x88760238.

How it was found: `--trace-dx` over a gameplay window shows the per-frame
`save -> present -> restore` with nothing drawn between, and the code after
the save `Blt` names the HRESULT it accepts. `--dx-slot=4 --png=` captures the
primary; the default `--png` of this app is not the surface the cursor lands
on.

## LAN multiplayer over the virtual LAN (works 2026-10-06)

`test/test-aoe1-vlan-gameplay.js` (heavy, run on a boat): seat 10.0.0.1 creates
a TCP/IP game, seat 10.0.0.2 shows games, joins, and both Multiplayer Game
lobbies list Host and Guest. Evidence `scratch/runs/20261006T1525Z-aoe1-w4-vlan`.

- **Route.** Escape skips each intro video; title buttons are Single Player
  (320,198) and Multiplayer (320,248). Multiplayer Connection: name field
  (320,108), the provider list's first row "Internet TCP/IP Connection For
  DirectPlay" (320,199), OK (190,455). Multiplayer Games: Show Games (320,384),
  first game row (320,120, reads "Game (Host) (1/8)"), Join (110,455), Create
  (320,455) → Create Game dialog, Game Name (320,244), OK (240,304).
- **Hover, not position.** AoE acts on its own hover state: a click with no
  `mousemove` onto the button first lands on whatever button was last
  highlighted. A queued click that arrives during the intro is replayed on the
  title as "Single Player" — which is why the old menu scripts open the Single
  Player menu whatever coordinate they click.
- **DirectPlay surface.** `DirectPlayCreate` + QI to IDirectPlay3A (no lobby
  launch): `Open(CREATE|JOIN)`, `CreatePlayer`, `GetPlayerCaps`, `GetCaps`
  (two calls), `GetSessionDesc` (size probe then fill), `GetPlayerName`,
  `EnumSessions` (synchronous, timed), `Send`/`Receive` (12-byte lobby
  messages) and `SetPlayerData(DPSET_GUARANTEED)` of a 0x2e4-byte lobby record
  on every lobby change. **That record is the lobby**: until the provider
  carried it (dpl/1 `PLAYER_DATA`, 2026-10-06) the guest joined at the
  DirectPlay level, exchanged three messages and gave up with "Unable to join
  game."
- **Headless clock.** Both seats need `--real-ticks` (the join waits in guest
  time), and on the wall clock the intro videos run their real length — so the
  test waits for each screen in a capture rather than a batch count.

## Fast gameplay route, control response, frame counter (2026-10-10)

At `--batch-size=200000 --tick-ms-per-batch=50` the single-player campaign
reaches gameplay by batch 1520. That is 25x fewer batches than
`test-aoe-menu.js`'s 10000-block / 2000 ms route.

```
600:click:320:200   Single Player      700:click:320:190   Campaign
800:  type AOE (keydown/keypress/keyup per letter), 820: Enter
920:click:190:455   Campaign OK (Armies at War / Bronze Age Art of War)
1120:click:560:465  briefing OK        -> gameplay by 1520
1520:click:293:160  select the priest  1540:rclick:460:260  move it
```

Clicking the priest selects it (white diamond, health bar, command panel:
Egyptian Priest 25/25). A right-click on open ground walks it there. Two
`--input` runs are byte-identical. An interactive `--control --frozen` session
along the same route lands a few pixels differently, because control-mode
input is a different execution, as usual.

**Frame counter.** One rendered frame is one `IDirectDrawSurface_Blt` onto
surface `0x08011020`, returning to `0x0043bccc`. The cursor's save / present /
restore Blts (`0x44defb`, `0x44e05a`, `0x44e159`) come once per frame too. Over
batches 1540-2140 (29.85 guest-s) there are 84 of each. `--present-distinct`
says 235, because each of the 149 `IDirectDrawPalette_SetEntries` palette-cycle
updates also presents. Only 78 presents change the picture, all within the 84
frames: a palette present leaves the 8bpp bytes alone. **For AoE, do not quote
present counts as frames.**

**The headless frame rate is not the game's.** AoE busy-polls between frames:
over the run it makes 3.3M `timeGetTime`, 1.9M `GetForegroundWindow`, 1.3M
`GetCursorPos` and 1.3M `GetAsyncKeyState` calls, and 91% of batches spend
their whole budget. Raising the budget per 50 ms batch gives *fewer* frames:
84 at 200k blocks, 76 at 400k, 52 at 800k. So the 2.8 frames per guest-second
here is a property of these settings, unlike Diablo's fixed 20 Hz. A real FPS
needs a real-clock (browser) count of the `0x43bccc` Blt.
Evidence: `scratch/runs/20261010T0430Z-aoe1-control-frames`.

## Ruled out

- **VFS / `MapViewOfFile`.** Every `.drs` opens (`CreateFileA` → `h:0x700000xx`)
  and both mapping calls succeed. Any note saying "AoE VFS-blocked" or "stuck in
  MapViewOfFile" is stale (retired 2026-09-16).
- **A failing DirectDraw handler.** `CreateSurface`, `GetSurfaceDesc`, `Blt`,
  `SetClipper`, `GetCaps` and the palette calls all return success.
- **A guest acceptability check on a value we return.** The 2026-09-20 session
  looked for one on the theory that the abort was still live; it is not. The
  guest never reaches the bail on the current build.

## Related

- `docs/re-notes/aoe2-trial.md` — the sequel's trial, a separate binary.
- `test/test-aoe-menu.js`, `test/test-aoe2-span-prefix.js`,
  `test/test-virtual-free-mapped-view.js`.
