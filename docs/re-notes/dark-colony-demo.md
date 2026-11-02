# Dark Colony (magazine demo)

SSI/Gametek's May 1997 magazine demo v0.2 in
`test/binaries/win98-games-a-d/DarkColony-MagDemo-SW/`: `dc.exe` runs unpacked
from that directory with ~970 data files (ANIMATE/, AVI/, INTRO/, map sets).
Registry id `dark_colony_demo` (localhost-only), manifest written by
`tools/gen-win98-games-a-d-manifests.js`. `README.TXT` lists the controls.

Imports GDI32, USER32, KERNEL32, DINPUT, DSOUND, WINMM, DDRAW, WSOCK32,
AVIFIL32, MSVFW32, DPLAYX. DirectDraw 640x480x8 exclusive. No emulator change
was needed to reach play.

The exe is truncated: the last section declares raw data past EOF.
`tools/xrefs.js` crashed on it until it clamped its scan to the file length.

## Route (headless, `--batch-size=20000`, default 200 ms/batch clock)

The menus are software-drawn and slow: at the default 1000-block batch one
menu frame is ~250 batches. Use `--batch-size=20000`. Every screen assembles
itself with an animation first and ignores clicks until it is done, so the
gaps below are not slack.

| batch | action / screen |
|---|---|
| 1500, 2500 | Esc, Esc: skip the intro video |
| ~3000 | main menu (DC logo flies in, credits type out) |
| 9000 | relmousemove 213,325; di-mousedown/up: NEW CAMPAIGN |
| ~29000 | campaign setup, Human vs Grey ("Type in a name for your leader") |
| 30000 | relmousemove +275,+36; click: START CAMPAIGN (empty name is fine) |
| ~44000 | briefing "Secret of Terra Tyrren" |
| 45000 / 60000 | relmousemove +10,+97, click at 60000: TO BATTLE |
| ~61500 | Mars map, human base, "Good luck lieutenant!" |
| 63000 | relmousemove +48,-286; click: select Trooper ($350) in the sidebar |
| 66000 | `keydown:32` (Space = build): a Trooper walks out of the base ramp |
| 72000-74000 | `keydown:39` held: map scrolls right, a Grey warrior comes into view |

Left idle the mission is lost by about batch 100000 (Defeat debriefing).

Evidence: `scratch/runs/20261006T014500Z-dark-colony-demo-build-scroll/`.

## Input

- The mouse is DirectInput **relative**: `GetDeviceState` on the mouse each
  frame. `0x43bd90` adds lX/lY into `0x4f8e80/84`, clamps to 639x479 and
  publishes the cursor at `0x4b4434/38`. Button 0 drives the press/release
  call at `0x43bf49`. The cursor starts at **(0,0)**, not the centre. So drive
  it with `relmousemove` deltas measured from (0,0), plus
  `di-mousedown`/`di-mouseup`. An absolute `mousedown` does nothing.
- The cursor is a software sprite on every screen (menus included): the
  frame routine `0x420708` BltFasts the back buffer `[0x467edc]` into the
  flip surface `[0x467ed8]`, then BltFasts cursor frame `[0x4b43b0 + i*4]`
  at `0x4b4434/38` with DDBLTFAST_SRCCOLORKEY, then Flips. The 28 frames come
  from `CURSOR\CURSOR%d.BMP` through a DDLoadBitmap-style loader (`0x43b3e0`):
  `LoadImageA(module, "cursor/cursor%d.bmp", IMAGE_BITMAP, ..., LR_CREATEDIBSECTION)`
  first, `LR_LOADFROMFILE` only if that is NULL. "No cursor" (2026-10-06) was
  our LoadImageA answering a missing *resource* with a blank 32x32 stand-in:
  the file fallback never ran and every frame was empty (`--dx-surfaces`:
  32x32 `nonZero=0`). Fixed: a missing resource is NULL /
  ERROR_RESOURCE_NAME_NOT_FOUND; the frames are now 31x31/33x27 with pixels.
- A leftward `relmousemove` from the host's initial (0,0) point is dropped in
  `renderer-input.js` (`handleMouseMove` returns when the absolute point maps
  outside the canvas, before queuing the DI delta). Harmless here, because the
  game clamps at 0 too, but it bites any game whose own cursor does not start
  at the host's.
- Keys: the pump at `0x4214ec` peeks only WM_KEYFIRST..WM_KEYLAST, and
  `0x421e2c` acts on WM_KEYDOWN/WM_KEYUP and ignores WM_CHAR. Space builds,
  arrows scroll, F2.. select unit classes (see README.TXT).

## Open / not investigated

- The sidebar BUILD button shows "Push to build" on hover but a click built
  nothing in three tries; Space works.
- Typing a leader name showed no text, and only the first WM_KEYDOWN was
  seen at `check_input`. The name is optional, so the route skips it.
- Audio and FPS not evaluated. The bounded browser route below was evaluated.

## Native browser campaign, build and movement (2026-11-02)

Run `scratch/runs/20261102-dark-colony-native-browser/` demonstrates ordinary
campaign entry, a newly built Trooper, and selection/commanded movement of that
unit in **one original browser invocation**. This is separate from the CLI
build/scroll history above. No guest patch, injected state, renderer override,
download or public promotion was used; no production code changed.

`APPS.dark_colony_demo` exists, is absent from `DESKTOP_APPS`, and appears only
in `LOCAL_CANDIDATE_APPS`. Before launch, all 971 manifest entries matched their
sizes; SHA-256 identities cover 973 unique files / 89,340,274 bytes including
the EXE and manifest. Manifest SHA-256:
`a64d57ec5780efe390fd1e38fc512f64b0f7e0d0c5da301ed5ec268c25785d32`.
`original-inputs.json` retains every file hash, including `dc.exe`.

Asghan25107 then GL62044 actually exited 0 with result/final files, completed
turns, exact `AUTHOR RELEASE` lines and absent helpers before lane entry.
Post-GL source head was `2e141167fa74109b4bd5653c0dea73087049d2d6`;
all 1,264 accepted build inputs matched GL's final locked build. Module:
2,069,384 bytes, SHA-256
`6d9563ff4a1c089c9d0ac4153748411990dc3c92f3a50e2509bbe9ffaaca30a7`.
The explicit immutable transfer verified all 3,838 file byte buffers before
and after extraction, including `src/api_table.json`. Prepared controllers
passed Node syntax / Python compilation checks. All 966 served-file records
matched pinned SHA-256 identities.

The visible route was intro → balanced Escape → New Campaign → Human/Grey
setup → Start Campaign (empty name) → “Secret of Terra Tyrren” briefing →
To Battle. Captures, rather than historical batch timings, governed inputs.
Browser automatic relative input required a balanced acquisition click first:
unlocked mouse motion was withheld, leaving the guest cursor at `(0,0)`.
After Pointer Lock, native relative motion visibly hovered New Campaign and
the ordinary menu clicks worked. The initial pointer concern was not an
established guest/runtime blocker. A diagnostic Puppeteer connection mistakenly
used its default viewport, resizing the page from 1024×768 to 800×600;
gameplay captures use 800×600. This controller mistake is retained in
`monitoring-limit.json`; subsequent diagnostic connections used
`defaultViewport:null`. The original was not relaunched.

At the human base, native left click selected the sidebar **Trooper ($350)**.
Reviewed full-page and canvas pairs `15-build-before`,
`16-build-space-held`, `16-build-space-released`, and
`16-build-space-settled` show a clear ramp beforehand, the unit emerging, then
standing below the ramp after balanced Space. The lower-right counter is a
clock, not a resource-debit measurement. `19-select-new-trooper` shows the
selected new unit and the sidebar's S/M/A/W commands. Balanced M followed by
native relative motion and left click commanded open terrain to its left.
The reviewed pairs `21-move-before`, `22-move-command-held`,
`22-move-command-released`, `22-move-command-settled`, plus
`23-neutral-confirmation`, show the unit leaving the ramp and crossing toward
the target while the base/terrain remain fixed. Settled means input released
and consumed; the unit was still travelling in that capture. The later neutral
capture shows further progress. No arrow-key camera scroll was used.

All 74 recorded native events were trusted; all ten press/release pairs
balanced. Space was actually held 1,714 ms and the movement click 1,246 ms,
including screenshot overhead despite their 120 ms requests. Released captures
retain keyup/mouseup in the input queue; settled and later neutral captures
have empty queues and zero mouse buttons. Full-page/canvas screenshots are
sequential, so their animation frames can differ. All 105 PNGs passed chunk
CRC checks. No mission-completion, sustained-stability, audio or FPS claim.

Controller, Chrome and supervisor exited 0; natural guest exit is unknown
because the controller closed the running game after evidence capture.
Optional `stdole2.tlb` returned 404 without blocking the exercised route.
All 202 evidence files were retrieved and SHA-verified before explicitly
delegated shutdown of **only** `bx_qsn43x59`: STOPPED
`2026-11-02T16:46:01.747Z`, original expiry
`2026-11-02T17:33:47.862Z`. Remote Chrome/controller/crashpad/profile helpers
were absent before shutdown. Archive SHA-256:
`2c0ebe6cd4e0f91af4404eb5b9a63ee8fb081dc4a6cd929e56ee3c5d0d796278`.

**Monitoring limitation:** the initial local background disk guard/tail exited
early, discovered during closeout. All observed owner free-space samples were
above 2 GB, but continuous owner-disk monitoring during gameplay is unproven.
The boat's own disk polling is not evidence for owner `/home`. Foreground
monitoring resumed for retrieval/closeout. Thus gameplay is demonstrated, but
this run does not establish full compliance with the continuous disk condition.
Do not replay the unchanged original to repair this evidence gap. Recovery
identity, controllers, actual exits, exact predecessor releases, capture review,
retrieval manifest and cleanup are retained in `RECOVERY.txt`, `result.json`,
`evidence-check.json`, `monitoring-limit.json` and the retrieved archive.
