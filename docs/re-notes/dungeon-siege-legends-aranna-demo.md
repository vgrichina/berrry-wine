# Dungeon Siege: Legends of Aranna demo

Original local media: `test/binaries/win98-games-a-d/DungeonSiegelegendsofaranna_demo-D3D.exe`,
260378624 bytes, SHA256
`e3923f18d3ec9bf52ffe556821dbaa2078e985087c7bf4b171a36b9883b851cf`.

The original CAB starts at byte 554420, spans 259810461 bytes, and contains
28 entries in three folders, totaling 281799760 extracted bytes. Its SHA256 is
`db04e097e3ca436bbf95d1cc8742adf778e02e88dabd20aa4e41ae86592be2be`.
7-Zip 23.01 integrity testing and extraction passed; each extracted size and
SHA256 is retained in the extraction receipt. This is extraction, not Windows
installation. The case-distinct `SETUPENU.DLL` and `SetupENU.dll` were both
preserved; their contents are identical. The Windows VFS mounts one alias.

`DSLOA.exe` is 3874869 bytes, SHA256
`fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
Its original native import is `Mss32.dll`; other imports use emulator APIs.
The first browser probe mounts all 27 case-normalized companion entries eagerly.
This is a startup diagnostic, not a final required/lazy/background load policy.

## First browser checkpoint, 2026-10-10

Evidence: `scratch/runs/20261010T1504Z-aranna-startup`. The bundle contains
the capture/extraction controllers, original-media receipts, screenshots,
request/console logs, source hashes and clean process termination receipt.
Test box: `bx_hx8msa33`, Chrome 151, default WebGL and guest Worker, 1000x800.
WASM base `72e9d1834`, JS fixes `d9255b1d4` and `087b18311`; module SHA256
`41a566963bdfd90f65d8e684267d9a44526c8de7b337510f84e10afe58f111c3`.
This is not a test of every later main commit.

The unchanged executable reaches the titled end-user licence dialog. The
RichEdit text area visibly exposes font-table entries instead of readable
licence text. Investigate generic RTF destination/group handling; do not remove
the original document or synthesize agreement. No input was sent, and Accept
was not pressed. Fix the rendering issue before presenting a readable decision
to the user. Browser closed with exit 0 at 15:07:32Z and no page errors.

Gameplay, controls, audio and FPS remain unqualified. Installed files currently
exist only on the test box at `/home/user/aranna-game-20261010`; there is no
local corpus registration or dashboard launch-ready claim. The next actionable
new-game lane was refilled with the Deus Ex: Invisible War demo.

## Licence text rendering fixed

Two generic RichEdit defects caused the unreadable dialog. Nested starred
destinations (`panose`/`falt` inside `fonttbl`) replaced the outer skip depth;
closing a child exposed the rest of the font table. Preserve the outermost
ignored destination instead. Separately, callback streaming silently stopped
at 65535 raw bytes. This document's list-table metadata alone reaches byte
101580; the visible agreement begins after byte 107000. Grow the temporary
stream buffer until callback EOF/error, reporting allocation failure rather
than silently truncating. Discard a failing callback's buffer and retain its
error code, following the
[EDITSTREAMCALLBACK contract](https://learn.microsoft.com/en-us/windows/win32/api/richedit/nc-richedit-editstreamcallback).

`test/test-richedit-stream-callback.js` now uses a real guest callback that
honours each requested chunk length. Negative controls reproduce both nested
destination leaks, the 65535-byte cutoff, and error-buffer leakage. The final
candidate passes all ten checks and the full build gates on base `70bd1502e`.

Reviewed browser evidence: `scratch/runs/20261010T1523Z-aranna-rtf-complete`,
original media and the same viewport/default Worker route. The actual agreement
heading and opening paragraphs are visible; no input or acceptance was sent.
Tested module SHA256:
`686c0140dcee5cc345a23a9815d79f84910bf455b8e39a9e307416fcdd45b677`.
The intermediate `20261010T1517Z-aranna-rtf-fixed` run deliberately remains as
evidence that repairing group skipping alone left the truncated body blank.
This fixes text visibility, not complete RichEdit formatting or game compatibility.
The new-game task remains held for a user licence decision.
