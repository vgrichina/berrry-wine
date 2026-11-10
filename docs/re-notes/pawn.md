# Pawn 3

A chess program. `--app=pawn`, exe `binaries/wep32-community/Pawn/Pawn.exe`.
Renders its board through Direct3D 9 and reads the mouse through DirectInput 7.

## Running it

```bash
node test/run.js --app=pawn --no-build --headless-gl --screen=1024x768 \
  --max-batches=9000 --max-seconds=90 --quiet-api --no-close --png=/tmp/pawn.png
```

For the GPU backend, `--headless-gl` supplies the GL provider: plain headless has no GPU window, so
`CreateDevice` fails with "D3D9 requires a GPU window" and the guest traps
shortly afterwards at `0x0041c100`.
The software backend instead uses `--d3d9-renderer=software` and needs no GL
provider. Always use `--png-canvas` to inspect the composited window.

## October 30 original software move

Run `20261030T2238Z-pawn-software-move` loaded module
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`
(compiled source revision not independently established). All six original
Pawn input files were hashed. The registered original executable accepted the
scripted e2–e4 drag and replied e7–e5; the inspected composited desktop shows
both moved pawns and the engine's yellow origin/destination outlines.
The software D3D9 run exited 0 after 20,000 batches, 55,363 API calls and
1.880 seconds. This is bounded CLI software gameplay evidence, not a new
browser/WebGL run or a complete chess-game test.

The window is 350,100 and the board is its 352x352 client area, so a square is
44px and the centre of (file, rank) is screen `(350 + 44*file + 22, 123 +
44*rank + 22)`. **It moves on a drag, not on two clicks** — a press and release
at the same point selects nothing, which is why the first two attempts at
driving a move registered API calls and changed no pixels. A move needs
`mousemove` to the from-square, `mousedown`, one or two `mousemove` steps
toward the to-square, then `mouseup`.

Pawn outlines the engine's own last move in yellow on both squares. Those
pixels exist only after a legal move *and* a reply, so counting them is a
one-predicate check that the whole round trip works;
`test/test-pawn-directinput7-gameplay.js` uses exactly that.

## October 30 headless GL provider blocker

Run `20261030T2247Z-pawn-gl-move` used the same pinned module and original
inputs as the software move above, requesting `--headless-gl` for 9,000
batches. The optional native `@node-3d/webgl` and `@node-3d/glfw` dependencies
were unavailable. The log explicitly reports unavailable WebGL, then a guest
NULL call at batch 1,576; execution stopped after 1,812 batches. The process
nevertheless returned **0**, so exit status alone is not a valid gameplay
oracle. The inspected composited image shows the initial chess position,
without a completed move or reply. This is an environment-blocked GL attempt,
not GL rendering acceptance. A fresh browser WebGL run remains needed; the
successful software move does not fill that gap.

## October 30 browser move and reply

Run `20261030T2250Z-pawn-browser-move` bypassed the missing CLI provider with
Chrome 151 and ANGLE SwiftShader, selecting WebGL in the ordinary browser UI.
A trusted native mouse drag accepted e2–e4; the inspected `final.png` shows
black's e7–e5 reply and yellow origin/destination outlines in the composited
window. The child GPU frame sequence advanced from 2 to 25. All six original
Pawn files remained hash-identical; the actually served Pawn payloads were
checked too. The loaded module was the same `7e8d3194…` as above; compiled
source revision remains unknown. Runtime inspection reported threads enabled,
despite the driver's attempted disabled preference. The exact backend object
and software-enable export were not captured, so this is not a hardware-GPU
claim or full-game acceptance. The owned browser, servers and profile were
closed/removed. A startup port collision and an accidental read-only capture
request to SimGolf's control port were recorded on the board; the successful
Pawn attempt used dynamically assigned ports.

## "This program requires DirectX 9 or later!"

This message is a lie, and it cost a session to work that out. It is not the
D3D9 check talking.

The D3D9 probe is three `GetAdapterModeCount` calls whose results are summed
(EAX=3, ESI=3, EDI=3, sum 9) and it **passes** — we have had D3D9 since the
`09ad`/`09ae` work, and `$handle_LoadLibraryA`'s fall-through returns
`$image_base` for any `.dll` not in `$STATIC_SYS_DLL_NAMES`, so Pawn's dynamic
`LoadLibrary("d3d9.dll")` succeeds and `GetProcAddress` resolves by name
through the API hash table. Static import tables show nothing here; the load is
dynamic.

What actually failed was DirectInput. `IID_IDirectInputDevice7A`
(`57D7C6BC-2356-11D3-8E9D-00C04F6844AE`) is the **only** device IID in the
binary, so there is no fallback path to take when `CreateDeviceEx` refuses it —
Pawn puts up its one catch-all message and quits. Fixed in 81f71c7c by giving
devices a real v7 face: the 27 v2 slots plus `EnumEffectsInFile` and
`WriteEffectToFile`, both returning `DIERR_UNSUPPORTED`, which is the truth for
a keyboard and a mouse.

Aliasing v2 under the v7 IID would have been wrong rather than merely
incomplete: slots 27/28 would land on whatever interface's thunks follow ours
in `$DX_VTBL_REGISTRY`.

## The board that was only ever in the surface

Pawn does not draw its board onto a window DC at all. It calls
`IDirect3DSurface9::GetDC` on the D3D9 **back buffer**, draws 64 `StretchBlt`s
plus the coordinate text into that, `ReleaseDC`s and `Present`s. So a
`--png` capture, which prefers a DX surface over the composited desktop, showed
a perfect chessboard for a long time while the window's client area was empty
grey. `--png-canvas` (or `--dump-backcanvas`) is the honest oracle here, and
`test/test-pawn-directinput7-gameplay.js` now uses it.

The reason the frame never arrived is that **the device window is a child**:

```
CreateWindowExA(class="STATIC", WS_CHILD|WS_VISIBLE, 0,0, 1024x768, parent=0x10002) = 0x10003
CreateDevice(hFocusWindow=0x10003, Windowed=TRUE)
```

so a screen-sized child sits inside a 352x353 client, and the presentation
target is that child. Two separate paths then dropped the frame — Pawn takes
the first one in the browser and under `--headless-gl`:

1. **GPU present (`lib/d3d9-host.js`, opcode `0x30002`).** It parks the
   presented canvas on the window record as `_dxFrameLayer`. `repaint()` and
   `composeCanonicalScreenToMemory()` composite a *child's* canvas and layer
   only when `_usesOwnWindowSurface(child)` holds, and that wants
   `_canonicalOwnSurface`, which only `attachWindowSurface` ever set. Nothing
   ever drew the layer. Fixed by marking a child device window as owning its
   surface at the present.
2. **CPU present (`$dx_present`, `src/09a8-handlers-directx.wat`).** Its
   windowed branch passes the client's **screen** origin as the blit **source**
   origin, which is right for a windowed DirectDraw primary (display-sized,
   Blt'd in screen coordinates through the clipper) and wrong for a D3D9 back
   buffer, which starts at the client's top-left. Pawn's board at (0,0) was
   sampled from (354,142) — black. `$d3d9_present_client_relative` (in
   `09ad`) now says which of the two a present is, and a child target always
   takes the blit path, since attaching a surface to a child is invisible.

## The D3D9 software backend cannot run it (2026-09-20)

`--headless-gl` is what the "Running it" command uses, and that is the **GPU**
D3D9 backend. On the software one Pawn gets a device and then dies:

```
node test/run.js --app=pawn --no-build --d3d9-renderer=software \
  --screen=1024x768 --max-batches=9000 --max-seconds=120 --no-close
...
[API] IDirect3DSurface9_GetDC
[1658] EIP=0x075030d8 EAX=0x8876086c ...
[API] IDirect3DSurface9_GetDC
[eip-zero] guest called through NULL at batch 1764
  dbg_prev_eip=0x0041c100
```

`CreateDevice`, `GetBackBuffer`, `Clear` and the first `Present` all succeed;
the **second** `IDirect3DSurface9::GetDC` on the back buffer returns
`D3DERR_INVALIDCALL` (`EAX=0x8876086c`), Pawn calls through the NULL HDC and
traps at `0x0041c100`. The composited window is left as caption + menu over an
empty grey client. `--d3d9-programmable` makes no difference. Since the board
is drawn entirely inside that `GetDC`, this one call gates the whole app on the
software backend. Captures: `build/d3d-backend-coverage/pawn-{gpu,software}-canvas.png`;
context in [docs/d3d-backend-coverage.md](../d3d-backend-coverage.md).

**Fixed 2026-09-22 — the GetDC was never the cause.** One line earlier the log
says `[sync] ABANDONED wndproc hwnd=0x00010002 msg=0x00000005 ... after 64
rounds (yield_reason=16)`. Pawn's first `Present` is issued from the `WM_SIZE`
that its own `SetWindowPos` sends, and `$wnd_send_message` runs that window
procedure in a recursive `$run`. A software `Present` always parks (it waits on
a 60 Hz display boundary even without the worker), and a recursive run has no
way back to the JS event loop that completes it, so the procedure was abandoned
mid-call. The GetDC failures and the NULL call are fallout from that.
`lib/d3d9-host.js` now pipelines a software `Present` made inside a synchronous
send without waiting (`_insideSyncSend`/`_detachPresent`). The next top-level
`Present` publishes it. **Read the `[sync] ABANDONED` line before the first error.**

## Status

Playable on both D3D9 backends: GPU (`--headless-gl`) and
`--d3d9-renderer=software`. Drags a pawn two ranks, the engine replies, and the
board is in the window. `test/test-pawn-directinput7-gameplay.js` runs both
arms; `PAWN_BACKEND=software|webgl` picks one. The software arm needs 20000
batches, because at 9000 the reply is still animating.

## November 10 browser software move after native retirement repair

Run `20261110-pawn-retirement-fixed-move-reply-1342` verified the actual
software browser route in Chrome 151.0.7922.108. Source revision was
`8e87f84b3e553d4385fbd6040767b9cee0fa0a36`, with the inherited untracked
Wininit input retained as a patch. The guest and owning render Worker's CDP
bytecode both hashed to
`e587a07b7cbb9410fd52ec374c71f6c87a81e9f4bbd7404c3c64c7bb77253edd`.
The closure differs from the accepted `20261110-pawn-final-frame-reply-1318`
run only in published native custody repair `a815540593f9b3d5fb4982dfbe5f156f510812c8`.
It includes D3D9 final-frame repair `35ecfae6c`; no additional runtime repair
was needed.

Ten real Chrome startup/interface controls passed before the single original.
The actual guest's GetDC returned HRESULT 0 and HDC 2097156, and factory,
callback, TLS and global initialization completed. The owning neutral software
endpoint identified device 136454184, generation 1, adapter present and no
failure. After an ordinary title-bar drag exposed the full starting board,
the unchanged live-state guard passed and one ordinary e2–e4 drag was sent.
Personally reviewed `retrieved/software/moved.png` shows the white move;
`review/software/reply.png` shows the completed c7–c5 reply with yellow c7/c5
outlines. The reply PNG SHA-256 is
`8a82ce338345d697612806ec05fe73841d50494027d9b1728d3b6529a67de9ec`.
No logical-board substitution, extra Present, forced repaint, guard bypass
or original retry was used.

The original supervisor waited 0, reaping all 334 owned tasks with command
EOF and empty lineage/resume/ptrace/gate obligations. Chrome exited 0 and its
profile was removed. All 96 remote evidence paths passed SHA/size verification
and an independent reread before delegated normal shutdown of `bx_e7xhdvmm`;
stop `stop_33c41c322dbaa08d` completed without force or error. The independent
deadline watchdog also waited 0 with both output EOFs.

Five observer tests, the final-frame Present regression, the real x86 COM to
production render-Worker regression, and the locked build passed. This is
bounded software-browser move/reply evidence. Custody used the accepted tmpfs
route with unchanged deadlines; this run establishes neither a disk-latency
repair, the prior original's inferred exit_group syscall, a new WebGL result,
nor full-game acceptance. Evidence is in the named run directory; source
recovery uses Git plus recorded patches, without source or media archives.
