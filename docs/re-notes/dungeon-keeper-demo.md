# Dungeon Keeper demo

## Package and installation

The local Windows demo comes from the Windows 98 A-D archive recorded in
`sources.md`. Its own readme tells the user to run `SETUP.BAT`; that batch file
runs `KDDATA.EXE -d` to create the playable files. The registered app now uses
only that installer output under `installed/`, not the separately unpacked
`Rozbaleny/` copy.

`tools/install-dungeon-keeper-demo.js` runs the original DOS PKSFX executable
inside ToyVM, exports the files the guest creates, validates the payload, and
generates the browser manifest. It does not use a host archive extractor.
The measured result is 166 files and 19,754,866 bytes; the manifest contains
the 165 companion files mounted beside the launch executable.

Pinned SHA-256 values:

- `KDDATA.EXE`: `f121c2f77583e35a258617308f609aefbd73ca249974e3cdbac7520c4cdda92a`
- installed `KEEPER95.EXE`: `4d3cd6a7866520f360288b08440e0f20379b4b39216a9576c388e42fcdf72c84`
- installed `MSS32.DLL`: `fe46a580452a42796461cf98a66f79c65ef8494e0977d4665ac7a81305ee9644`
- installed `LEVELS/MAP00001.DAT`: `57f068b16b43b42e268bcf03794a966debb1bf0524f6a4ce2d1f875cb60c7fa9`
- installed `SOUND/SOUND.DAT`: `13e17c1ea44edb6b9bb5894e6c314ae2bc138fe6d864bf1d91aa972b3c4d7e8e`

Run the original installer with:

```bash
node tools/install-dungeon-keeper-demo.js
```

## Distribution status

The bundled readme calls this a promotional demonstration, forbids selling or
renting it, and says copying requires Electronic Arts' prior written consent.
"Playable demo" describes what the package is; it is not a redistribution
license. The package and generated install tree therefore remain local and
gitignored. `sources.md` links the preserved original distribution so a user
can obtain it independently; Wine-Assembly does not publish the demo files.

## Gameplay route

`test/test-dungeon-keeper-gameplay.js` launches the registered app through the
headless CLI in frozen stdio-control mode. It dismisses the legal/logo screens,
waits for the main menu pixels, moves the software cursor with small relative
DirectInput deltas, and clicks Start New Game without moving the host cursor.
It then follows the portal transition into the live Eversmile dungeon and
checks the in-game tutorial panel appears while the process remains healthy.

The test uses `run.js --max-seconds` as its only process guard. It performs no
performance measurement. Screenshots are written to
`build/dungeon-keeper-gameplay/`.

Run explicitly with:

```bash
node test/test-dungeon-keeper-gameplay.js
```

## Activation gate: black screen after the Bullfrog logo (fixed 2026-09-28)

The game runs its window on its own thread (T1, entry `0x4d6c10`) and creates
the main window `WS_VISIBLE`, so USER's implicit-show chain (the CACA0001
continuation in `src/09b-dispatch.wat`) delivers the first
`WM_ACTIVATEAPP`, not the later explicit `ShowWindow` calls. The wndproc's
`WM_ACTIVATEAPP` case at `0x4d6a01` does:

```
cmp [esp+0x1c], 0          ; wParam: being activated?
jz  skip
call GetForegroundWindow   ; 0x4d6a08
cmp eax, [esp+0x14]        ; == our hwnd?
jnz skip
mov [edi+0x1c], 1          ; app-active flag
```

If the answer is not its own HWND the app never marks itself active. It then
shows the legal/logo screens and the Bullfrog vortex, but never reaches the
menu. The main thread stays in the palette-fade and `timeGetTime` pacing loops
around `0x4433a0`/`0x4d1910` and at `0x47ac51`/`0x4bbb88`. Every probe after
batch ~150 is a flat black 3.8 KB PNG, and `--no-uop`/`--no-x87-fusion` change
nothing.

First bad commit (bisected on box 3 with the gameplay test's menu gate):
`aba07804 fix(user): track accepted foreground independently of z-order`. Before it,
the host's `foreground_window` answered the topmost visible top-level window.
Since then it returns only a window passed to `host_activate_window`. The
explicit first-`ShowWindow` chain (`09a5-handlers-window.wat`) makes that call,
but the `WS_VISIBLE` implicit-show chain set `$active_hwnd` without it. So
`GetForegroundWindow` fell back to the desktop (`0x10000`). Fix: the
implicit-show chain now calls `$host_activate_window(main_hwnd)` right where it
sets `$active_hwnd`. `test/test-created-dialog-main-promotion.js` checks the call.

Debug recipe for this class of bug:
`--trace-host=activate_window,foreground_window` (no `activate_window` line at
all while `foreground_window() => 0` repeats is the symptom), and
`--trace-at=0x4d6a01` (ESI = 0x1c confirms the message).

## Page cursor never moved: semaphore starvation (fixed 2026-10-10)

In the browser the menu rendered but the game's own cursor (an imp, kept at
`0x761378`/`0x76137c`) never moved, and the menu idled into the credits; the
CLI route was unaffected. The 2026-10-03 headful run saw the same thing.

The game has no DirectInput. Its window thread handles `WM_MOUSEMOVE` at
`0x4d6a63` -> `0x4d2110` -> `0x4d2020`, which (flag `0x51b674` set) turns each
position into a delta from the last one (`0x762b70`) and recentres with
`SetCursorPos` near the `GetClipCursor` edges. The delta is committed by
`0x4d0220` -> `0x4d0440` (clamped to the box at `0x761360`), but only after
`0x4d7600` takes lock `0xE0003` with `WaitForSingleObject(h, 5)`; on failure
the move is dropped.

`0xE0003` is a semaphore the render thread waits on and releases around every
frame. In the cooperative scheduler a parked waiter was only re-polled later,
so the render thread, which waits again in the same slice, took every released
unit back: a page capture counted 3,832 render-thread acquires and 3,881 polls
by the window thread, none of which found the unit free. The fix
(`lib/thread-manager.js` `_grantParkedWaiters`) gives a released unit straight
to a worker parked in a plain single wait, as Windows does.
`test/test-semaphore-release-grant.js` covers it.

A 5 ms wait can still time out while the render thread is mid-frame, so a
single absolute mouse jump may be dropped; continuous motion (a real mouse
under Pointer Lock) gets through. The page route therefore steers: read the
cursor from guest memory, send small `handleRelativeMouseMove(dx, dy,
{guestCounts: true})` steps to Start New Game (guest ~250,126), then press and
release at the renderer's current point. Debug recipe: page snippets reading
`sharedRenderer.wasm.exports.guest_read32(0x761378)`, and a `--before-launch`
wrap of `ThreadManager.prototype.waitSingle` counting results per thread.
