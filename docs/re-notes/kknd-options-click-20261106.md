# KKnD Options Return to Game — 2026-11-06

The single fresh registered session reached rendered gameplay, but an ordinary
left click on **Return to Game** left the Options menu visible. Input stopped at
that first failure; the settled capture 22 seconds later still shows the menu.
No emulator change is justified by this trace. Selection, commanded displacement,
a second gameplay response and the loaded mission identity remain unverified.

Evidence: `scratch/runs/20261106-kknd-options-click/`, especially
`input-boundary.json`, `return-trace.json`, `balanced-release.json`,
`game-options-game.png` and `return-settled-game.png`. Captures were personally
reviewed. The visible menu selection “The Walkover – Easy” records intent only.

## Newly established boundary

- Requested native `(320,190)` became actual `(320,189)` after presentation
  rounding, inside the reviewed Return button. Window and client origins are
  both `(0,0)` with a 640×480 client area.
- Focused game HWND `0x10001`, process 1000, belongs to thread 1 in the actual
  instantiated CPU Worker, slot 0 / endpoint 1.
- Trusted left down/up completed. The owning broker dequeued `WM_LBUTTONDOWN`
  (`wParam=1`) and `WM_LBUTTONUP` (`wParam=0`) with `lParam=0x00bd0140`.
  Host dequeue alone does not prove guest wndproc dispatch.
- Actual `GetAsyncKeyState(VK_LBUTTON)` returned `0x8001`, then `0x8000`
  while held, and `0` after release. Pinned original executable code at
  `0x427ed0` polls the high bit. Passive shared-memory reads observed its own
  current button mask at `0x475880` transition `0x11 → 0x10 → 0`, with client
  coordinates `(320,189)` stored as fixed8 at `0x475890/0x475894`.
- These 10 ms samples prove guest mouse-poll state changed; they do not prove
  which press/release edge the menu consumer used. No guest bytes were written,
  no breakpoint was installed, and no camera input or unit command was sent.

[GetAsyncKeyState](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getasynckeystate)
documents physical button state. The source concern that an active queued event
could override that state was not observed during this failed click. The next
boundary is the original menu consumer after the mouse poll; tracing it requires
a separately assigned session, without an unchanged restart or speculative fix.

## Reproduction and checks

Tested Git `186e9bc80ea4be14f5ebac6d3e8d9e7a15896600` plus retained binary diff
and new-helper patches. All 325 source/module pins were unchanged afterward.
The actual served and instantiated CPU module is
`ab1ce417568573f42448f031ab6cb4d8c7db0d33adb7727ca97b7e3a5be3a692`.
The registered app deep link, required media manifest, all 16 retained originals,
authentic DDRAW bytes and actual VFS KKND/DDRAW hashes passed their checks.
Source/module HTTP response hashes match the pinned files.

Run-only controls passed exact coordinate mapping, trusted balanced click/drag/key
edges, right-button rejection, unchanged observer calls/results and real host
required-file recovery. The original session has six complete left click pairs
and one Escape pair, with final buttons zero. The initial release validator also
counted three generated-control receipts; filtering by immutable original browser
start time fixed that evidence aggregation without changing raw logs or rerunning
any guest. No production source changed, so no new full build was needed.

The ordered GLFog → Disciples → Sparse exact FINAL releases and independent
cleanup passed before admission. Runtime window began 10:47:06Z, browser ran
10:47:39–10:49:29Z, and cleanup passed 10:49:48Z: 24 absent PIDs, four refused
ports, two absent profiles, four free locks and over 3.6 GB free disk. No boxes
were assigned (ID/state/expiry N/A). No restart or deployment occurred.
