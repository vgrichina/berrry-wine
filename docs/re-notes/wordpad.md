# WordPad (Win98, `test/binaries/win98-apps/wordpad.exe`)

App id `wordpad`. MFC 4.2 app; loads at its preferred base `0x01000000`, so
runtime VA == file VA. `mfc42.dll` (from `test/binaries/dlls/`) loads at
`0x013f2000` with original base `0x5f400000`: original = runtime - 0x013f2000
+ 0x5f400000 (`--trace-api` return addresses in the `0x013f`-`0x015e` range are
MFC).

## Initial frame placement

WordPad persists its frame in
`HKCU\Software\Microsoft\Windows\CurrentVersion\Applets\Wordpad\Options`
(`FrameRect`, `Maximized`). The restored rect lives in a global,
`m_rectInitialFrame` at `0x010202c4` (16 bytes), and is written in three places:

| VA | What |
|---|---|
| `0x0100c8ca` | `PreCreateWindow`: uses the rect for `cs.x/y/cx/cy` only if width and height are > 0 |
| `0x0100cd43` | `OnSize(nType, cx, cy)`: `m_bMaximized = (nType == SIZE_MAXIMIZED)`; on `SIZE_RESTORED`, `GetWindowRect(m_hWnd, &m_rectInitialFrame)` |
| `0x0100ccec` | `ActivateFrame` (before `ShowWindow`): `GetWindowPlacement`, copy `m_rectInitialFrame` into `rcNormalPosition` **unconditionally**, `SetWindowPlacement` via MFC `CWnd::SetWindowPlacement` (`0x5f45c3a0`) |

On a fresh registry (no `FrameRect`) the only thing that fills the rect before
`ActivateFrame` is the `WM_SIZE` USER sends inside `CreateWindowEx`, after
`WM_CREATE` and also to a hidden window. When that `WM_SIZE` was deferred to
`ShowWindow`/the message pump, WordPad placed a 0x0 rect, and the min-track
clamp turned it into a 112x27 frame (desktop browser and CLI). The phone shell's
single-app maximizer hid it there. Fixed 2026-11-12 by sending `WM_SIZE` then
`WM_MOVE` from the `CACA0001` create continuation (`src/09b-dispatch.wat`,
markers `CSZE`/`CMOV`); `test/test-create-window-failure.js` asserts the order.

## Headless notes

- A CLI `--png` of WordPad shows the frame with the toolbars, ruler and edit
  area still gray at 15-25 s; the browser at the same point is fully drawn.
  Do not read the gray as a regression.
- On a slow start (phone, `--cpu=4`, or a parallel `mobile-app-sweep --jobs=4`)
  the shell's maximize could land between `SetWindowPlacement`'s show and
  WordPad's own `ShowWindow(SW_SHOWNORMAL)`, which restores it. Since
  2026-11-12 `maximizeForSingleApp` (`lib/browser-shell.js`) starts its budget
  only once a top-level window is visible, and watches for ~2 s afterwards,
  maximizing again (at most twice) if the app restores itself.
