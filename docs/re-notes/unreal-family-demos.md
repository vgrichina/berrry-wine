# Unreal-family demo installers

Status: verified locally on 2026-09-13. These are proprietary demos and remain
`localOnly` candidate-corpus fixtures. No host Wine was used.

## Sources

| Candidate | Archive.org item | File | Size | SHA-1 |
| --- | --- | --- | ---: | --- |
| Unreal Special Edition | `unreal-special-edition.-7z` | `Unreal Special Edition.7z` | 128,609,961 | `f3f25896a51cbf37dcdb94833198b86f394d8853` |
| Unreal Tournament | `unreal-tournament-demo-version-348` | `UTDEMO348.EXE` | 55,647,232 | `faf2c18852a1a53c59db490e044e0d3e100e8fed` |
| Unreal Tournament 2003 | `UT2K3Demo` | `UT2003Demo2206.exe` | 148,976,640 | `372a8b712cb7f2b1539af72430923d290a67e701` |
| Unreal Tournament 2004 | `UnrealTournament2004Demo` | `Ut2004-NewDemo.exe` | 296,049,152 | `5e224a3de711da9085cddd9929499789690043c7` |
| Unreal Tournament 3 | `setuput3demo` | `setuput3demo.exe` | 777,027,962 | `86d4bad740d0c25438a65c48939ee6dcfc88bb02` |

The host archive reader only unwraps the outer 7-Zip/WinZip container. Candidate
preparation then executes the original setup program inside Wine Assembly,
exports the VFS it wrote, and boots the installed game. This distinction is
enforced by `tools/install-unreal-demo.js`.

## Installer and launch results

| Candidate | Authentic setup result | Installed payload | Installed-game result |
| --- | --- | ---: | --- |
| Unreal Special Edition | InstallShield bootstrap launched `_INS*.MP`; license and destination flow completed | 191 MB, `System/Unreal.exe` SHA-256 `5fbc5853a8669a802446ac12e102351053bc6a5ce9f554b03483eb634269f408` | Software launch loads `SoftDrv`, opens `WindowsViewport0`, initializes the game engine/player, and renders the playable intro |
| Unreal Tournament 348 | Unreal `System/Setup.exe` completed | 104 MB, `System/UnrealTournament.exe` | `--app=ut348_demo`: first-run wizard, UWindow menu, DM-Morpheus practice match on SoftDrv with walk + mouse-look (see "UT 348 route" below) |
| UT2003 2206 | Unreal `System/Setup.exe` completed with the shipped `MSVCR70.dll` | 344 MB, `System/UT2003.exe` SHA-256 `97e027dc9765f048beacfa461bc93c71ba1831cd3e8dff0cd7d71c1b478f88a2` | The D3D8 wrapper renders textured first-person Antalus gameplay; an authentic dedicated server and direct-connect client exchange the native protocol over `vln/1` |
| UT2004 new demo | Unreal `System/Setup.exe` completed with the shipped `MSVCR71.dll` | 525 MB, `System/UT2004.exe` SHA-256 `2a95e2fa8c22ae94eb1c361fdb49ea8ec44c5e2a93faa00831308c01e951db8d` | Uses the same pre-renderer D3D8 probe; further post-probe launch diagnosis remains |

Seeding the bundled Visual C++ runtimes matters. Without `MSVCR70.dll`, the
UT2003 setup appears to require unimplemented CRT imports beginning with
`wcschr`; with its own runtime loaded, setup completes without any new emulator
API. The same rule applies to UT2004 and `MSVCR71.dll`.

## OpenGL and software-renderer attempts

UT2003 and UT2004 both ship `OpenGLDrv.dll`. Their installed and default INIs
were changed locally to `OpenGLDrv.OpenGLRenderDevice`, fullscreen was disabled,
and the browser launch used `-opengl -window` with a real WebGL context through
SwiftShader. This still does not bypass D3D8: both main executables import and
call `Direct3DCreate8` during startup hardware detection, before either render
driver is loaded.

`Direct3DCreate8` now returns a deliberately narrow, non-rendering
`IDirect3D8` capability object. It preserves the complete 16-slot factory ABI,
implements COM lifetime, one adapter, one display mode, identifier and caps
queries, and deliberately returns `D3DERR_NOTAVAILABLE` from format/device
creation checks. An authentic UT2003 run successfully called
`GetDeviceCaps`, `CheckDeviceFormat`, `GetAdapterIdentifier`, and `Release`, so
the old missing/null-factory branch is gone. It still throws later, before
`OpenGLDrv` loads; this does not establish that an `IDirect3DDevice8` is needed.

Unreal Special Edition does not ship `OpenGLDrv.dll`; it has `SoftDrv.dll`,
`GlideDrv.dll`, and `SglDrv.dll`. Its former startup exception was an encoded
resource-submenu mismatch in `DeleteMenu`. With resource-menu deletion and
compaction implemented, a five-minute authentic software-renderer run loaded
`SoftDrv.dll`, opened `WindowsViewport0`, logged `Game engine initialized`, and
sustained the render loop. Its gray viewport was a separate USER delivery bug:
the viewport is a secondary top-level window, but `ShowWindow` only queued an
initial `WM_SIZE` for children. Extending first-show sizing to non-main
top-level windows made WinDrv allocate its 514x386x32 DIB and produced 159
successful `BitBlt` frames in a 65-second authentic run. The captured intro is
rendered and prompts `PRESS ESC TO BEGIN`. A subsequent controlled run traversed
Game -> New Game -> Easy -> player setup, entered the first-person level with
HUD active, and produced distinct before/after movement frames, so interactive
gameplay is verified rather than inferred from the intro.

The initial capability facade has since grown into a deliberately bounded D3D8
translation layer over the D3D9 backend. It preserves the exact 97-slot device
and 19-slot texture ABIs, translates D3D8 presentation parameters, textures,
vertex/index buffers and fixed-function declarations, retains D3D8's
`BaseVertexIndex` from `SetIndices` for indexed draws, and adapts the implicit
swap-chain argument of `GetBackBuffer`. Unsupported methods remain explicit
failures rather than silent successes.

An authentic `-d3d -window -nosound` run now reaches textured first-person
gameplay on DM-Antalus. The no-sound flag isolates graphics from the separate
missing Vorbis `ov_open` import. `test/test-ut2003-vlan-candidate.js` runs the
game's own non-rendering dedicated-server mode beside a direct-connect client.
It verifies native UDP in both directions over `vln/1`, waits for D3D device
creation before taking a PNG, rejects the loading screen and spectator join
prompt, and rejects the flat-pale weapon signature that exposed the rendering
bug.

Getting the textured materials working had two layers. D3D8 sampler controls
are texture-stage states 13--21 and 25, but D3D9 moved them into sampler-state
slots 1--10. Forwarding
the D3D8 numbers directly to the D3D9 texture-stage bank returned
`D3DERR_INVALIDCALL`, leaving filter and address state at defaults. Translating
those states activates the mip-atlas shaders; the native headless desktop GLSL
1.10 compiler then rejected their ESSL-only
`GL_OES_standard_derivatives : require` directive even though `dFdx`/`dFdy`
are core there. The desktop port now removes only that directive. The corrected
capture has a textured dark-metal/green assault rifle and textured terrain
rather than the former nearly uniform white weapon inside the native GL frame.

The remaining pale-rifle CLI capture was a headless presentation bug, not a
D3D8 material bug. WebGL requests an opaque default framebuffer with
`alpha:false`, but the native desktop GL context still stores fragment alpha;
the readback path passed those low alpha bytes to the software compositor and
blended otherwise-correct rifle RGB toward white. Headless readback now honors
the requested WebGL contract by forcing alpha to 255. The focused regression
draws RGB with alpha zero and verifies opaque readback, while the frozen VLAN
replay verifies the textured rifle survives composition and that held movement
changes the first-person scene.

The final acceptance was repeated from a clean worktree at commit `fecc3e2f`.
The authentic dedicated server entered DM-Antalus, the client and server
exchanged native UDP through `vln/1`, the client created its D3D viewport, Fire
transitioned it from the join prompt to an owned pawn, and the captured frame
showed the HUD plus textured weapon and terrain. Both emulator processes exited
cleanly. The committed wall-clock test proves join and rendered gameplay;
deterministic held-key movement was additionally proved with a frozen
`tools/ctl.js` replay.

A fixed-wall-time profile of the map-load window (batches 6000--12000) retired
938 million handler operations. Raw x87 instructions were 26.85% of them, with
no single block over 2.23%, so the load is broad Unreal transform/material
work rather than one stuck loop. Enabling the existing experimental x87 fold
executed 27.3 million fused regions and advanced 25,179 batches in 140 seconds
versus 20,818 without it, about 21% farther on this run. The CLI candidate uses
`--x87-fusion`; browser runs can opt in with `?x87-fold`.

SSE is now a separate per-app CPU policy rather than a global claim. The
`ut2003_demo` client and server advertise a Pentium III with CPUID EDX bit 25;
the default personality and the not-yet-exercised UT2004 entry still hide SSE.
Following the authentic UT2003 path added the instructions it actually reached:
exact `SFENCE`, `MOVNTQ`, memory `MOVLPS`, all eight `CMPPS` predicates, and
`MOVMSKPS`. Unknown SSE encodings continue to trap.

That policy also selects three MSVC/D3DDrv 64-byte MMX copy loops, including a
79-byte three-register pipelined `MOVNTQ` body at original D3DDrv VA
`0x10001100`. Each is recognized by a complete address-independent byte hash
and lowered through H419 to `memory.copy` only for proved-disjoint, page-local
mappings; overlap and split mappings retain the original instruction ordering.
The regression compares ordinary decoding with each lowering for copied bytes,
GPRs, flags, final MMX registers, overlap, page splits, and a one-byte near miss.
A clean authentic run reaches D3DDrv with no SSE decoder trap, but the shared
machine was under heavy concurrent load during the final timing run, so that
run is evidence of compatibility, not a defensible wall-time speedup measure.

The CLI software D3D backend reaches the same engine loop without an
unimplemented API but rejects its GPU draw opcode; the native/browser WebGL
backend remains the authoritative graphics verification.

## UT2004: the registered `-opengl` argument is the whole blocker

UT2004's "further post-probe launch diagnosis" above is resolved. It is not an
emulator gap at all — it is the command line `lib/apps.js` registers for
`ut2004_demo`:

```
args: '-opengl -window'
```

### How the real error was recovered

The app dies inside `MiniDumpWriteDump`, which reads as the bug and is not:
that is only UE2's crash handler, running after the engine has already decided
to die. UE2 reports through `appError`, which throws, so the message never
reaches stdout. It is in memory, though — `core.dll` exports
`?GErrorHist@@3PAGA` (ordinal 1036, original VA `0x101ad200`), a UTF-16 buffer
holding the error text. Dumping it one batch before the crash gives the real
complaint:

```
Missing symbols - aborting. History: UOpenGLRenderDevice::Init
```

**Recipe worth reusing on any UE2 title:** resolve `?GErrorHist@@3PAGA` to a
runtime VA with `core+0x101ad200`, then `--input=N:dump-mem:<va>:512` at a
batch just before the crash. `--dump=` is too late — it fires at exit, after
the handler has run.

A `GetProcAddress` census confirms it: **99 GL/WGL names resolve and 298 return
NULL**, including core GL 1.1 entry points. `OpenGLDrv` cannot initialize
against that surface, and the engine aborts rather than falling back.

### The fix, and what it reaches

Changing `ut2004_demo`'s args to

```
args: '-d3d -window -nosound'
```

routes it to the same D3D8 path UT2003 already uses, and the game reaches
**gameplay**: DM-Rankin's lit brick-and-wood interior with a bot in frame.

Applied 2026-09-22. With the D3D9 software path's point/spot lights
(`fab74ee8`), `--d3d9-renderer=software --d3d9-programmable` also draws the
Epic/Digital Extremes/Atari splash with zero refused draws (1.42M batches in
150s at `--batch-size=200000`); it had refused every lit draw before.

## UT2003 under the CLI software backend

The paragraph above ("the CLI software D3D backend ... rejects its GPU draw
opcode") is narrower than it reads. With
`--d3d9-renderer=software --d3d9-programmable` on the remote bench box, UT2003
renders its full menu chain — intro logos, the NVIDIA splash, the main menu,
and `Instant Action | Select Map` complete with a **live 3D Antalus preview**
inside the map panel. PNG capture there comes off `dx slot 5 640x480`, the real
primary surface, rather than the canvas the headless-GL path reports.

Three things cost a session each and are worth writing down:

- **A `mousemove` must precede the `mousedown`.** UT2003's menus are in-engine
  widgets that track hover; a bare `mousedown` at the right coordinate is
  silently discarded, the highlight never moves, and `--trace-api` shows a
  perfectly healthy message pump. Two moves then a down/up 2000 batches apart
  is what works.
- **The game window is placed at (20,35) with a 1024x768 client**, so on a
  1024x768 desktop its bottom edge — the row holding BACK / SPECTATE / PLAY —
  falls off the screen. That is window placement, not UI scaling:
  `--screen=1100x840` shows the whole dialog. `--screen=` enlarges the desktop
  only; the viewport itself is a game-config property, set in
  `System/UT2003.ini` under `[WinDrv.WindowsClient]`
  (`WindowedViewportX/Y`, `FullscreenViewportX/Y`, `MenuViewportX/Y`).
- **Resolved 2026-09-29: PLAY works, and UT2003 reaches a DeathMatch.** The
  "dead button row" below was a measurement artifact, not an input bug. PLAY
  starts the map load at once. The load runs for about **1000 batches with no
  Present**, so every capture in that time shows the last menu frame, PLAY
  still highlighted. Two things made it look dead. The bounded runs below
  ended inside that window. And before the render-park fix (next section),
  parked batches were counted without running the guest, so a run could end
  with the guest having done almost nothing after the click. BACK was not
  retested; the same artifact is the likely explanation.

  Route (box2, current main plus the render-park fix):

  ```
  node test/run.js --app=ut2003_demo --control --frozen --max-seconds=7200 \
    --max-batches=100000000 --stuck-after=100000000 \
    --d3d9-renderer=software --d3d9-programmable --batch-size=200000 \
    --quiet-api --screen=1100x840 --trace-input --no-close
  ```

  1. Step to the main menu.
  2. Hover pair, then click INSTANT ACTION at (536,578).
  3. The window is at (20,20) with a 1032x796 frame and client origin (24,44).
     Select `dm-asbestos` by clicking (290,281).
  4. Hover (981,775) then (985,778). Then mousedown/mouseup at **PLAY
     (985,778)**, 3 batches apart. That click was batch 964/967.
  5. By batch 1007 the main thread is in the exe's buffered `FArchive` reader.
     `exe+0x5550` is the precache path (`call [eax+0x48]` with `0x7fffffff`).
     `exe+0x39c0` is its memcpy tail. The box's load average falls to ~0.1
     because there are no software-render waits. **Use that as the oracle,
     not the picture.** Check whether the snapshot EIP is in
     `0x109055xx`/`0x109039xx` and whether `ctx.renderParkStats.waits` is
     flat.
  6. At batch ~2025: DM-Asbestos with "The match is about to begin...3" and
     "Press [Fire] to join the match!".
  7. Left click in the viewport (540,400). By batch 2113: "The match has
     begun!", HUD at 100 health / 150 ammo, and the assault rifle in first
     person.

  The earlier reports, kept for the record:

  The `Instant Action | Select Map` dialog's bottom button row
  (BACK / SPECTATE / PLAY) seemed to take no input. The click that opens the
  dialog — INSTANT ACTION on the main menu at (536,578) — works every time.
  Measured, each in its own bounded run with a hover pair before the press:
  - BACK at screen y = **743, 760, 778, 790** and PLAY at y = **770, 778**:
    all leave the dialog exactly where it was. Five rows spanning 47px, so
    this is **not** a coordinate offset, and BACK failing rules out anything
    PLAY-specific such as a disabled button.
  - Double-clicking the selected map name (`dm-antalus`, (290,261)), which is
    UT2003's own start-the-match shortcut: no effect.
  - Tab x3 then Enter: no effect.

  Two traps for whoever picks this up: the map preview panel cycles through
  screenshots on its own and the map description types itself out one
  character at a time, so **every capture of this dialog has a different
  hash whether or not any input landed** — `md5` cannot be the oracle here,
  only the dialog's identity can. And the row is drawn at client y ~743 of a
  1024x768 client whose window origin is (20,35); `--trace-input` confirms
  run.js injected each event. The 2026-09-29 run routes both down and up to
  the game window (`-> child 0x10005 ... dispatched=1`, `up ... matching its
  DOWN`). Nothing was dropping them.

- **Do not quote batches/s across phases.** One UT2003 run on the box moved
  13.8k -> 61k -> 65k batches/s between its intro, menu and idle phases. A
  batch is a budget of blocks, so the unit changes meaning with the guest's
  code shape.

## "Stuck forever in the first software DrawIndexedPrimitive" (2026-09-29)

Reported for both demos: a bounded run
(`--d3d9-renderer=software --d3d9-programmable --max-batches=1500
--batch-size=200000 --trace-api=IDirect3DDevice8_DrawIndexedPrimitive,IDirect3DDevice8_Present`)
ends with EIP parked on the D3D thunk after 30 DIPs and 2 Presents, and looks
like a rasterizer that never returns. **It is not a guest or rasterizer hang.**
Ruled out by reading and by probing: the D3D8 DIP frontend (`09ac`, SetIndices
base at `state+1692`), `$d3d9_draw_buffer`'s validation (`09ae`), and the
software prepare/step tile loop (`09ah`, bbox clamped to the viewport,
non-finite vertices marked bad) all terminate.

What happens: every software draw/Present returns a negative render token,
`$d3d_render_park` sets yield 16, and the CLI main thread waits on the render
worker (`lib/d3d9-host.js`; Node has no `crossOriginIsolated`, so the CLI always
takes the async worker path). `test/run.js` checked "still parked?" once per
**batch**: `run()` was skipped, the batch was counted and the batch clock
advanced, so a `--max-batches` budget drained one event-loop turn at a time
while the guest executed nothing. A `ctl.js eval` on the parked run showed the
request `{"t":-6,"done":true,"yr":16}` completing and moving on to `-8`, and
frozen stepping walked UT2004 into its NVIDIA intro with a software-rendered 3D
character — slowly, not stuck.

Fix (`test/run.js`, `awaitMainRenderPark`): before each batch, if main is parked
on yield 16, await that request in wall time (bounded by `--max-seconds` and
stop), then run the batch. `--no-render-park-wait` restores the old loop for an
A/B. The exit summary prints `render park: main waited on N software D3D
requests (Nms wall), N batches skipped while parked`, and `ctx.renderParkStats`
exposes the same to `--control` evals. `test/test-d3d-render-park-batches.js`
drives the shape through real COM thunks (512x512 software device,
DrawPrimitiveUP + Present in one 40-batch step): 0 batches skipped with the
fix, 39 of 40 skipped with `--no-render-park-wait`.

Same UT2003 command line, same box, after the fix: **866 DIPs and 722 Presents
in 712 batches**, and the capture is the **UT2003 main menu** (dx slot 5,
1024x768). Before it was 30 DIPs and 2 Presents in 1500 batches. The run hit its
`--max-seconds=600` guard rather than its batch budget, and `render park` says
why: 362 waits, 588s of the 600 on the software worker, so about 1.6s per
parked request at 1024x768. The wall-clock ceiling is now the software
rasterizer's throughput; batch accounting no longer hides it. Use
`--max-seconds` rather than `--max-batches` for UT routes on this backend.

UT2004 with the same flags makes **no** D3D8 call in its first 1500 batches,
because it is still streaming packages in 1KB `ReadFile`s (`humanmalea.ukx` and
others) before it opens the device. Given `--max-seconds=600
--max-batches=100000000 --stuck-after=100000000`, it reaches the **UT2004 main
menu** (dx slot 5, 640x480, 845 Presents, 5195 batches). 562s of the 600 were
2518 render waits. Note that `--stuck-after=0` does **not** disable the stuck
detector: the test is `stuckCount > STUCK_AFTER`, so 0 fires on the first repeat.
Pass a huge value instead.

The browser never had this bug: `host.js` yields to the event loop rather than
spending a counted unit per check.



The fixed UT3 installer was executed directly in Wine Assembly. Its verified
first runtime blocker is:

- `UuidToStringA` at installer EIP `0x00422225` (batch 0).

Static PE import comparison against `src/api_table.json` found nine imported
names which are not implemented:

- `AdjustTokenPrivileges`
- `GetThreadContext`
- `LookupPrivilegeValueA`
- `RpcStringFreeA`
- `SetThreadContext`
- `UuidToStringA`
- `VerLanguageNameA`
- `VirtualProtectEx`
- `WriteProcessMemory`

Installer strings also name seven MSI APIs resolved dynamically, so they do not
appear in the static import table:

- `MsiCloseHandle`
- `MsiGetProductInfoA`
- `MsiGetSummaryInformationA`
- `MsiOpenDatabaseA`
- `MsiQueryProductStateA`
- `MsiSourceListEnumSourcesA`
- `MsiSummaryInfoGetPropertyA`

Only `MsiQueryProductStateW` currently exists in the API table. `UuidCreate` is
already implemented through `CoCreateGuid`. This is an analysis inventory only;
none of the UT3 gaps were implemented.

## Call-form census and the software-D3D8 draw stall (2026-09-29)

Measured with `test/run.js --edge-hist` and `tools/call-form-weighted.js`
(docs/uop-tier-design.md §15.1). Box1 ran `--d3d9-renderer=software
--d3d9-programmable --batch-size=200000 --screen=1100x840`. On that tree
(2a632d73), neither UT2003 nor UT2004 gets past the first 3D draw: the main
thread never returns from `IDirect3DDevice8_DrawIndexedPrimitive`.

- The last EAX is `0x8876086c` (D3DERR_INVALIDCALL).
- Only T1's Sleep/CriticalSection polling continues.
- The window stays grey, and `--dx-surfaces` slot 5 shows `nonZero=0`.
- UT2004 reaches this at about batch 2100-2250.
- `ut2003_demo_server` stalls the same way, after a `.PAG <- .PAX` C++ throw.

That run did not use `--headless-gl`, and box1 has no display for it. So the
earlier gameplay verification stands for its own path only.

The load phase itself is the most indirect-call-heavy code measured in the
corpus. Guest indirect transfers are 4.5-8.4% of block entries, and
vtable/reg calls are 2-6.6%. The sites are low-polymorphic:

- `core+0x10128138` and `+0x1011ae20`, both `call [eax+4]` (FArchive::Serialize), 1-3 targets.
- `UStruct::SerializeExpr` at `core+0x1011d330`: a monomorphic self-recursive
  `call [edx+0x98]`, plus the `jmp [0x1011d9f4+edx*4]` token switch (24-28 arms).

Unreal SE's Nyleve flyby on SoftDrv: under 1% guest indirect. The threaded
remainder there is SoftDrv MMX (`pxor`/`movq`/`pmulhw`/`psraw`) refused as
`head-unsupported`. `galaxy+0x105085d2 call [0x1054c260]` calls a runtime-built
mixer in heap memory (`0xc49394`).

**MMX fill fold (2026-09-29).** Unreal SE's SoftDrv has the same
`movq [r],mm; add r,8; dec c; jnz` clear loops as Deus Ex, at `0x10931ed0` and
`0x10931ff0`. The fold (docs/loop-idiom-superops-design.md §23) matches them
**zero times** in the flyby, batches 900-1800. The flyby never clears the
frame.

- Box1 runs with `--branch-clock --wall-clock-ms=1790673326000`: user CPU is
  neutral, off 28.07/28.02 s against on 28.12/28.22 s.
- Frames are md5-identical at 900/1200/1500/1790/end.

The flyby's MMX share is compute. SoftDrv loads at a runtime base of
`0x0289b000` (preferred `0x10900000`), so `softdrv+0x10924747` is the block at runtime
`0x028bf747`. The hot blocks:

- `softdrv+0x10924747` / `+0x1092475a`: palette-lookup texel, 4-5% of threaded
  entries.
- `+0x10922f2f`: bilinear lightmap fetch, 3-5%.
- `+0x1092314e` / `+0x10923614`: span setup, which loads ESP from
  `[0x109548b4]`.
- `+0x10923210` / `+0x109236d0`: 8-texel span bodies.

That is a uop-tier MMX coverage problem, not a fold.

**Covered (2026-09-29, docs/uop-tier-design.md §16).** Every head above is now
`installed` or `live` in the uop tier. Threaded block entries over batches
900..1800 went from 116.1M to 68.8M. User CPU for 1800 batches went from
28.42/28.93 s to **18.45/19.01 s (−35.1%)**, with frames md5-identical at
900/1200/1500/1790/end.
## CRT exports and the native overrides (2026-09-29, docs/crt-native-overrides.md)

UT2003 imports `msvcr70.dll` and UT2004 imports `msvcr71.dll`, both through
thin wrappers in `core.dll` at `core+0x101139xx..0x10113cxx`. Which CRT export
is hot depends on the phase:

- **UT2003, batches 420..520 of the software-D3D load** (`--batch-size=200000`):
  - `floor` is 7.9-13.5% of all block entries, 30-50K calls per 50 batches.
    The callers are `core+0x101139b0` and `core+0x10113970`. Each call runs
    `_ctrlfp` and the `_fpclass` helpers `sub_7c0363b7`, `sub_7c034d89` and
    `sub_7c0366a8`.
  - `_vsnwprintf` (`_woutput`) is 0.6-1.9%.
- **UT2003, other windows:** `rand` (`core+0x10113940`) is 3.2%, of which
  `_getptd` (`msvcr70 0x7c00137f`) is 2.3%. The wide-string compares and
  copies (`_wcsicmp` at `core+0x10113b50`, `wcslen` at `+0x10113b00`,
  `wcscpy` at `+0x10113b60`, `wcsstr` at `+0x10113b10`, `_wcsnicmp` at
  `+0x10113c00`) run at 10^4-10^5 calls in the heavier windows.
- **UT2004, 600..1100:**
  - `_wcsicmp` is 2.77%, of which `_getptd` (`msvcr71 sub_7c349636`) is 2.08%.
  - The other wide-string functions add about 2%.
  - From 1100 on, `_woutput` takes over at 2.8-14.5%, with `mbtowc` at 5.47%
    inside it.

`floor`, `wcslen`, `wcscpy`, `wcscat`, `wcsstr`, `_wcsicmp` and `_wcsnicmp` are
now native when imported from these DLLs. With them, msvcr70 falls from
11.8-14.7% to 1.4% of UT2003's block entries in 420..520. What is left is
`_vsnwprintf`, `mbtowc` and `memmove`. `rand` and `_vsnwprintf` are the
remaining candidates, and neither is done: `rand` keeps its seed in the ptd,
and `_vsnwprintf` needs a byte-exact formatter.

A run of the same build is deterministic. For UT2003 with the software
backend at 200000 blocks per batch:

- The baseline reaches its 170th software render request at batch 520.
- The candidate reaches it at batch 491, and by batch 520 it is at request 199.

UT2004 over batches 600..1100: msvcr71 drops from 16.1% to 6.9% of block
entries (docs/crt-native-overrides.md, Verdict).

## UT2004 reaches a DeathMatch (2026-09-29)

UT2004 now gets into a match: DM-Rankin, HUD at 100/100, and the clock
counting down from 20:00. It took three emulator fixes.

1. **95b1b8c9: DestroyWindow no longer quits.** UT2004's splash dialog is the
   first top-level window, so it became `$main_hwnd`. Destroying it set
   `$quit_flag` while the game kept running. Now `$main_hwnd` passes to the
   next top-level window, and WM_QUIT comes only from PostQuitMessage.
2. **906cfe27: a real `RtlUnwind`.** The old handler unlinked frames without
   calling their handlers with `EXCEPTION_UNWINDING`, so msvcr71's C++ EH
   never ran its unwind funclets. The first `.PAG <- .PAX` throw after PLAY
   left a stale FRAMEINFO chain, and `__CxxFrameHandler` looped. The
   replacement follows NT x86 semantics:
   - each frame below the target gets its handler called with
     `EXCEPTION_UNWINDING` (plus `EXIT_UNWIND` when the target is NULL), then
     is unlinked;
   - a collided unwind (disposition 3) resumes from the dispatcher context;
   - EAX returns ReturnValue.
3. **4eb870e1: a dispatcher registration node.** msvcr71's
   `_UnwindNestedFrames` (orig `0x7c359b25`) runs the code below.

   ```
   saved = FS:[0]
   RtlUnwind(pRN)
   saved->next = FS:[0]
   FS:[0] = saved
   ```

   It relies on NT's `RtlpExecuteHandlerForException` having linked its own
   node on top of FS:[0] for the duration of the handler call. Without the
   node, `saved` is the catching frame itself, and the relink made it point
   to itself: the SEH chain read `0x179fb6d8 next=0x179fb6d8` and the next
   throw walked it forever. The emulator now links a node
   `{next, handler=0xCACA003A thunk, establisher}` around each handler call:
   - the node's handler returns ExceptionCollidedUnwind and fills the
     dispatcher context on an unwind, and ContinueSearch otherwise;
   - `$seh_walk_from` and `$rtl_unwind_step` skip the node.

   `test/test-rtl-unwind-handlers.js` covers the whole relink. The dump
   helper `sehchain.js` (a `ctl.js eval` that walks FS:[0] and flags a cycle)
   is what found it.

Route (box2; flags as for UT2003 above):

1. Step the frozen run to batch 3500 for the main menu, 640x480, at client
   origin (24,44).
2. **The mouse is DirectInput-relative, so every click needs a sync.** Move
   to (24,44), step 3 batches, move to (300,300), step 3, move to the
   target, step 3, then click. The hover highlight can lag behind; the
   clicks still land.
3. Click INSTANT ACTION at (400,362). The Gametype page is up by batch 4400.
4. Click DeathMatch at (195,221). Select Map (DM-RANKIN) is up by 4550.
5. Click PLAY at (448,514) (batch ~4565). The load shows no Present:
   - captures keep the typewriter menu frame;
   - EIP samples sit in msvcr71 `_woutput` and friends at
     `0x115a..-0x115c..` (runtime base `0x11591000`);
   - eight `[C++ throw] .PAG <- .PAX` lines are logged and are harmless now.
   - Check progress with the snapshot EIP and the SEH chain, not the picture.
6. By batch 8200: DM-Rankin with "Press [Fire] to join the match!".
7. Click in the viewport (340,300). By 8600 the player has spawned, with the
   HUD, the weapon bar and the assault rifle.

## UT 348 route (2026-10-06)

`--app=ut348_demo` mounts `test/binaries/candidates/unreal-tournament-348-demo/extracted/`
through a manifest written by `node tools/gen-tree-manifest.js <root>
--exe=System/UnrealTournament.exe --flatten=System`. The game opens
`UnrealTournament.ini` relative to the exe and its packages through
`..\System`, `..\Maps` etc., so `System\` files are mounted at both
`c:\<name>` and `c:\System\<name>`. Without the mapping it dies early with
"Can't find file for package 'Engine'" (an `appThrowf`; Core's static message
buffer is at `core+0x101f65fc`, readable with `--dump` after the exit).

- `FirstRun=0` in the shipped INI opens the setup wizard. Its device probe
  (`exe+0x1090d9e0`) runs inside the WM_PAINT that `UpdateWindow(0x1000c)`
  sends synchronously. It ShellExecutes a second copy
  (`testrendev=D3DDrv.D3DRenderDevice log=Detected.log`), then polls the log
  with `GFileManager->FileSize` and `Sleep(100)` up to 100 times (a 10000 ms
  budget counted down by iteration, not by the clock), then lists the
  devices. Two emulator bugs used to stop it (fixed in dd0d6dc8):
  - `$wnd_send_message` abandoned the paint after 64 rounds, because every
    Sleep ends a round (`[sync] ABANDONED wndproc hwnd=0x0001000c msg=0xf at
    0x1090dbfe`). The wizard then sat on "Detecting 3D video devices, please
    wait..." for good.
  - In the browser the ShellExecute really starts the child. The child had no
    `dlls` seeds, so Core/Engine/Window.dll bound to stubs and it trapped on
    `?appPackage@@YAPBGXZ`, or threw an `int` that went unhandled (the
    "C++ throw .H ... UNHANDLED EXCEPTION 0xe06d7363" console the user
    reported, in both thread modes). The CLI's ShellExecute starts no child,
    so it never showed this.
  The child's log never reaches the parent (a VFS child gets a copy of the
  file map), so the wizard always settles on Software Rendering.
- Engine errors (`appErrorf` throws an `int` while guarded; every `unguard` is
  `catch(...) { appUnwindThrow(...); throw; }`) went **unhandled** until
  867f35a3: the nested rethrow dispatch overwrote the software SEH walk's
  globals, so the outer walk carried on with the rethrow's null-ThrowInfo
  record. Now they reach UT's own "Critical Error" box. Quick repro:
  `--args="DM-Morpheus -window"` (the demo's map is `DM-MorpheusDEMO`) plus
  wizard clicks gives "Failed to enter DM-Morpheus: Can't find file".
- `--args="DM-MorpheusDEMO -window"` goes from the wizard straight into a
  match. In the browser, `tools/web-input-probe.js --before-load=` can set
  `wineApps.APPS.ut348_demo.args` (evidence
  `scratch/runs/20261006T141000Z-ut348-web-cxx-throw-fixed`, both thread modes).
  With Threads on, wizard button clicks needed 61686c8e: the renderer had been
  pressing them on the idle shadow instance.
- The child mode by itself (`--args="testrendev=D3DDrv.D3DRenderDevice
  log=Detected.log"`) loads D3DDrv, tests it and exits 0 headlessly. Pass
  `--stuck-after=1000000`: its CPU-speed loop trips the stuck detector.
- Wizard buttons render without labels (Back/Next at about (223,418), Cancel at
  (401,418)). Next x3 by mouse reaches the UWindow menu.
- Once the wizard ended, its last page stayed in the renderer over the game
  window and ate every click: `$wnd_destroy_tree` never told the host about
  windows below the root. Fixed in 09c3a; covered by
  `test/test-dialog-teardown-grandchild.js`.
- In the UWindow menus the cursor moves by `relmousemove` at roughly 46% of the
  requested delta. Game > Start Practice Session opens on DM-Morpheus; Start
  (about (598,418)) loads the map; "Waiting for ready signals" until a fire
  click. VK_UP then walks and relmousemove turns the view.
- Not evaluated: audio, FPS, browser. Some frames between kills are black with
  only the HUD (death/respawn view).

Evidence: `scratch/runs/20261006T001500Z-ut348-demo-claude202b4b39-dm-morpheus`.

## Deus Ex demo on OpenGlDrv (2026-10-06, OPENGLDRV-GL11-SURFACE)

OpenGlDrv resolves the whole GL 1.1 + WGL table by name and aborts ("Missing
symbols") if one is absent; since 5f17bb07 every GL 1.1 name is an API
(unimplemented ones fail fast by name) and it binds. Select it locally by
setting `deusExRenderer` in lib/apps.js to `OpenGlDrv.OpenGLRenderDevice`
(the committed default stays SoftDrv) and run the CLI with
`--gl-renderer=software`.

- The calls it really makes beyond the old set: glMultMatrixf (GL op 109)
  and glClearDepth (op 110), both implemented. glGetString is queried for
  GL_EXTENSIONS eleven times (one per extension it probes); no glGet*v or
  glReadPixels at all.
- It then plays the 3D logo intro for 170 s with no trap (run
  `20261006T1440Z-opengldrv-deusex`, intro.png).
- **Open: Escape out of the intro crashes, on OpenGlDrv only** (SoftDrv
  with the same `--input=200000:keydown:27,200100:keyup:27` reaches the
  menu). The last GL calls are a 256x256 GL_RGBA8 upload with nine mip
  levels and two glTexParameteri, then engine+0x1030cba6 (`call
  [eax+0x28]` on the object at `[esi+4]`, a per-element loop over an
  array of 0x28-byte records) jumps to 0x410054 ("execution entered
  zeros"). That object's vtable pointer is 0x7da2f600, the same value the
  caller holds in EBX, i.e. a heap address where a vtable should be:
  most likely a use-after-free (a freed block's link word read as a
  vtable), not a GL write -- no GL call that writes guest memory runs in
  that window. Next: --watch the object's first dword
  (`--watch=0x7e2f17d0 --watch-log`, addresses deterministic) to name
  the free that recycled it, and compare HeapFree/HeapReAlloc semantics.

Correction and narrowing (same day, watchpoints): the object's vtable is
NOT overwritten -- `--watch=0x7e2f17d0 --watch-log` shows only its
construction (batches 45598-45599). engine+0x1030cb70 is a lazy loader's
Load: `this` = 0x7e2f17d0 (a two-slot vtable whose slot 0 is this very
function), `[this+4]` = the FArchive (0x7e9b46a4, vtable in Core), `[this+8]`
= the saved file position. It calls Tell (`+0x28`), Seek (`+0x34`),
serializes the array at `this+0xc` (engine 0x10303904), then Seeks back.
So the jump into zeros happens while OpenGlDrv's texture upload lazily reads
texture data out of a package: the suspect is the serialized data (a count
or size from the file) smashing the stack, i.e. a file-read difference, not
a GL call. SoftDrv may never touch that texture. Next: `--trace-fs` on the
package reads in batches 211000-211300 and a stack-guard watch on the
caller's frame (EBP 0x179ff694).

Static follow-up (same day): engine 0x10303904 -> 0x1030cc60 is
`operator<<(FArchive&, TArray<BYTE>&)` (compact-index count, Realloc, then
Serialize into the heap buffer) -- nothing there writes the stack. The
FArchive at `[this+4]` has Core's vtable 0x1017a3f8 (file 0x10c443f8 at
runtime), and its slot 10 (Tell, 0x101634b0) and slot 13 (Seek, 0x10163410)
are real functions, so the loader's two virtual calls are sound. The jump
into zeros therefore happens later, inside Seek/Serialize or after the
loader returns; the next runtime step is `--trace-at=core+0x10163410` on
the last hits before batch 211297 and a `--trace-stack-scan` at the crash.

Boat runs (2026-10-06, main 99e861e6, boat bx_n53xdjmt, fresh `npm ci`;
`deusExRenderer` = OpenGlDrv and `OpenGlDrv.dll` added to the DLL list as a
boat-local edit; `--gl-renderer=software --quiet-api --quiet-blocks
--stuck-after=0 --input=200000:keydown:27,200100:keyup:27`). Module bases in
that build: engine 0x10e82000 (orig 0x10300000), core 0x10bca000 (orig
0x10100000), opengldrv 0x120d0000.

- The crash is ESI clobbered across a call, not a bad object. It lands in
  the lazy loader's Load (engine 0x1030cb70, `this` in ESI): the first
  virtual call (`[eax+0x28]`, ULinkerLoad::Tell, core 0x101634b0) returns,
  then `mov ecx,[esi+4]` reads garbage because ESI = 0x179ff644, a stack
  address (crash regs: ESI 0x179ff644, ECX 0x7e2f1848, EDX 0x10fa97fc =
  the TLazyArray vtable, ESP 0x179ff668 = the Seek call's return slot), so
  `call [edx+0x34]` indexes past the two-slot TLazyArray vtable into zeros
  at 0x410054.
- Ruled out: the linker is not freed (`--watch=0x7e9b46a4` never fires);
  the mip records (FMipmap, 0x28 bytes, lazy DataArray at +0x10) are well
  formed (dumped at batch 211263); the micro-op tier (`--no-uop` crashes
  identically at batch 211244); an unbalanced inner call (at core
  0x101634e3, just after Tell's inner `call [eax+0x28]`, ESP = EBP-0x24
  exactly as the frame needs, every hit).
- It is not a plain race either. Batch 211244 reproduces with the same
  flags (runs 3 and 4), a dword watch on the linker (0x7e9b46a4) leaves it
  in place, but `--watch=0x179ff648` -- the slot Tell's `pop esi` reads
  back -- makes it vanish (211300 batches, no crash, no watch hit), and so
  does `--trace-api=SetFilePointer,ReadFile,...`. Main's stack (0x179ff...)
  is outside the direct guest window, so it goes through the sparse page
  translation; a watched page takes the checked write path. Lead: a stale
  translation or fast-path write on that sparse stack page, so `pop esi`
  reads a value the guest never stored there.
- Side note: guest thread 1 (start 0x109010b9) ends at EIP 0 from
  prev_eip 0x10901a29 early in the run; not yet looked at.

CORRECTION and narrowing (same day, boat bx_rdw8tsqd, main 85141552;
evidence `scratch/runs/20261006T1810Z-deusex-opengldrv-esi/key-lines.txt`):

- Main's stack is NOT on a sparse page. deusex.exe's image base is
  0x10900000, so guest 0x17900000-0x17a00000 is `$GUEST_STACK` inside the
  direct window, and the "sparse page translation" lead above is wrong. The
  translator is single-mode now (flat PTE table), so there is nothing to
  toggle either.
- The mechanism, caught with `--trace-eip-range=core+0x101634b0-core+0x101634f4
  --trace-eip-from=211275 --trace-eip-detail` (run 10, which still crashed):
  at Tell's landing after its inner `call [eax+0x28]` (core 0x101634e3)
  every normal hit has ESP 0x179ff644 and EAX = the file position; in the
  crashing call ESP is 0x179ff654 (+0x10) and EAX = 0. So the inner call
  came back as if a `ret 0x10` function returning 0 had run. Tell's
  `pop edi; pop esi` then read 16 bytes too high, and the second slot is
  `[ebp-0x10]`, where Tell's `mov [ebp-0x10],esp` saved 0x179ff644 -- that
  is the ESI. Load's next `mov ecx,[esi+4]` reads `this` back from the stack
  and calls through the two-slot TLazyArray vtable into zeros.
- The inner call's target is sound and unchanged: `[linker+0x440]` =
  0x7e9b4100 (watched in run 1), whose vtable 0x109267e4 never changes after
  construction at batch 9097 (`--watch=0x7e9b4100 --watch-log`, run 11);
  slot 10 is deusex.exe's ILT thunk 0x10901131 (`jmp 0x109063b0`), and
  0x109063b0 is a two-instruction `mov eax,[ecx+0x38]; ret`. So the emulator
  ran different code for that call than the guest bytes say.
- Ruled out inside the crash batch: a full cache clear (`cache: full
  clears M 2` already at batch 211281, the same total as a non-crashing run
  to 211300), any code write or block retirement (`--trace-code-writes
  --trace-from=211270`, crash still at 211282, nothing logged).
- Reproduction that survives probes: adding
  `--input=B:dump-mem:0x179ff600:256` for every B in 211265..211320 makes the
  crash land at batch 211282 every time, and core-range `--trace-eip-range`
  / `--decode-stats` / `--trace-code-writes` keep it there; an exe-range
  trace (0x10901100-0x10906500) or `--trace-at` does not.
- Leads: (a) the block run for the call target -- the decoder extends runs
  through `jmp` and fuses `mov esp,ebp; pop ebp; ret` into a pop run + RET
  whose RET immediate is a thread word; an imm of 0x10 would give exactly
  +0x10; and the stats show 77 decodes that "evicted a live block". (b)
  guest thread 3 ends the run with ESP 0xd9f40000 (printed as -0x260c0000),
  which is not a stack -- worth a look on its own.
- Tooling trap: `--trace-eip-range=0x00400000-0x7fffffff --trace-eip-from=211282
  --trace-eip-stream` traced from batch 0 (11 GB log, run reached only
  104,203 batches in 800 s); check `--trace-eip-from` with an explicit
  range before reusing it.

The overwrite (same day, boat bx_e35gh894, main 8c360029; evidence appended
to `scratch/runs/20261006T1810Z-deusex-opengldrv-esi/key-lines.txt`):

- The decoded code is NOT at fault. A boat-local `--input=B:dump-stream:0xGA`
  probe (two throwaway exports over `$page_cached_stream`, never committed)
  shows the threaded streams for the ILT thunk 0x10901131, the reader Tell
  0x109063b0, and core Tell's entry and landing decoded exactly as the guest
  bytes say (pop run + RET imm 0, push runs, rop loads/stores), and their
  chunk addresses do not move in batches 211270-211282.
- What changes is the vtable itself: `--watch=0x1092680c --watch-log`
  (slot 10 of the reader vtable 0x109267e4 in deusex.exe .rdata) fires at
  batch 211227, `0x10901131 -> 0xffff00ff` (a pixel value), 17 batches
  before the crash. With the slot reading 0xffff00ff the inner call goes
  into an API thunk-like target that pops 16 bytes and returns 0 -- the
  ESP+0x10 / EAX 0 seen at Tell's landing. Same overwrite with `--no-uop`.
- The watch names main at OpenGlDrv's P8->RGBA converter (opengldrv
  0x10008fde..0x10009024: `mov al,[ecx+edi]; mov ecx,[pal+eax*4];
  mov eax,[ebp-0x18]; mov [eax],ecx; add eax,4`), but that attribution is
  probably wrong: the converter's destination `[ebp-0x18]` holds plain heap
  addresses (0x7ce3d408 / e408 / f408 at the row heads of batches
  211226-211228) that NO mapping covers (`--dump-virtual-maps`: the nearest
  record is guest 0x7cdf0000..0x7ce31000; a boat-local `--input=B:g2w:`
  probe gives `test_g2w_slow` = 0xf0 sentinel for them before AND after the
  write), `--fault-null` reports none of its stores, and a value-filtered
  watch on `[ebp-0x18]` never sees 0x1092680c. A watch is only checked on
  the watching instance's own block boundaries.
- Lead: guest thread 3 (spawned at 0x17a06908 -- inside the THUNK_BASE window
  for this image base, guest 0x17a00000+ -- with ESP 0x7d0afff8) ends every
  run in msvcrt with a garbage ESP that differs run to run (0xd9f40000,
  0xa1fe0000, 0xa68a0000; printed signed). A thread whose ESP sweeps through
  guest 0x108EE000..0x188EE000 writes deusex.exe's image through the direct
  window with every push, and the cooperative interleaving would explain why
  every probe moves the crash. Next: `--trace-thread`/`--trace-sched` on T3,
  find what sets its ESP, and identify the callback behind thunk
  0x17a06908.
- Separately: the converter writing through an unmapped destination is
  itself wrong on real hardware (it would fault), so either an allocation
  path failed to record a mapping for 0x7ce3xxxx or the guest overruns its
  buffer; check after the thread lead.

Thread 3 (same day, boat bx_tdvuwpfj, main 1945acdd; boat-local probes in
lib/thread-manager.js and src/03-registers.wat, never committed):

- Thread 3 is Galaxy's audio mixer (its slices start in galaxy.dll at
  0x11f43xxx-0x11f47xxx) calling runtime-generated MMX mixing code at
  0x1224ed00-0x1224f4xx (no module covers it). That code saves ESP to a
  galaxy global (`mov [0x11f7c224], esp`), loads `mov sp,[ebp+0x20]`,
  `shl esp,0x10` and uses ESP as a fixed-point step (`add edx,esp`) and EBP
  as `sar ebp,0x10` -- so the "garbage ESP" (0x80000000, 0x72060000,
  0x1f560000, 0x40000000 at slice ends) is legitimate, and it makes no
  push/call while ESP is repurposed.
- It IS the writer. A slot guard that reads guest 0x1092680c after every
  guest-thread slice fired twice, both times in a T3 slice: 0x10901131 ->
  0xffff00ff (two 16-bit samples). Once mid-mixer (EDI 0x1227dfc8, EAX
  0x12280048, EBX 0x122820c8), once in a slice that began at the mixer's
  second path (eipBefore 0x1224f143) and ended back in galaxy.
- Not an instance mismatch: T3's `get_image_base()` = main's = 0x10900000.
  Not the uop tier (same overwrite with `--no-uop`). Not `$gs32`/`$gs64`: a
  trap on any store within 8 bytes of the slot in both never fired, so the
  store goes through an inline `g2w-fast` path, which for a direct-window
  address is a correct translation -- i.e. the guest store's own address is
  0x1092680c.
- The mixer's stores are only `movd/movq [edi|eax|ebx](+8), mmN`, with
  EDI/EAX/EBX loaded from its arguments `[ebp+8]`, `[ebp+0xc]`,
  `[ebp+0x10]`. So in the writing slice galaxy passed an output pointer of
  ~0x10926804 -- inside deusex.exe -- for one mix call. DirectSound
  Lock/Unlock is not per-call (4 calls on T3 in batches 211150-211282), so
  the pointer comes from galaxy's own buffer bookkeeping, not straight from
  our IDirectSoundBuffer_Lock.
- Next (boat): log the mixer's three output arguments at its entry
  (0x1224ed20, T3) per call in the batch before the overwrite to catch the
  call with ~0x109268xx, then trace where galaxy computes that pointer
  (its globals near 0x11f7c2xx and the table at 0x11fbd914 are the leads);
  suspects in our emulation are the inputs galaxy derives buffer positions
  from -- DirectSound play/write cursors (GetCurrentPosition), buffer sizes,
  or a 16-bit op in the mixer setup (`mov sp,[m16]`, `adc esi,ebp`).

ROOT CAUSE, and a correction to the Galaxy attribution above (same day,
boat bx_k5x5vqk5): the writer is our own software GL, not Galaxy and not the
guest.

- The thread-3 attribution was an artifact: a check after each T3 slice
  compares with the value from T3's previous slice, so anything main wrote
  in between was charged to T3. A value check in the `dispatch-next` macro
  and at `$branch_end_at`, in every instance, fired in MAIN at the landing
  of opengldrv `call [0x10014fe0]` (0x10009232 -> 0x10009238), which is
  `glTexImage2D(GL_TEXTURE_2D, level, internal, w, h, 0, GL_RGBA,
  GL_UNSIGNED_BYTE, pixels)`.
- A guard in `$gl_sw_tex_store_to` (trap when a texel's wasm destination is
  inside the direct window) logged `dib=0xF0`: the texture's surface was
  created over the NULL sentinel. `$d3d9_create_surface` takes
  `$dib_alloc`'s guest address and `$g2w`s it; the arena had 16384 pages
  (64MB) while `$g2w` maps only `$DIB_GUEST_CAPACITY` = 63MB, so once
  OpenGlDrv's texture uploads after Escape filled the arena past 63MB every
  new surface translated to 0xF0. The surface was zeroed from 0xF0 and its
  texels stored from there, through the emulator's low memory and the guest
  image at 0x12000 -- e.g. texel (3,226) of a 256x256 level is wasm
  0x3880c, deusex.exe's reader vtable slot 10, written opaque magenta
  0xffff00ff.
- Fix: `$DIB_PAGE_COUNT` = 16128 (= capacity / 4096), with
  `test/test-dib-arena-translates.js` filling the arena and checking every
  block translates (fails on 16384).
- The Galaxy mixer's repurposed ESP/EBP and thread 3's "garbage ESP" are
  legitimate. The OpenGlDrv conversion buffer at 0x7ce3xxxx that no
  mapping covered (above) is not the cause of this crash; whether it is a
  separate mapping bug is still open.

## Deus Ex demo on GlideDrv in the page (2026-10-06, DEUSEX-GLIDE-PAGE-EXIT)

GlideDrv played the 3D intro on the CLI but "exited to the desktop" in the
browser. The page actually showed Critical Error `Assertion failed: RenDev
[File:C:\Unreal\WinDrv\Src\WinViewport.cpp] [Line: 345]`, with the software
Glide backend (`?glide-renderer=software`) as well as WebGL, and its console
never logged a LoadLibrary of `glidedrv.dll`. UE1 loads the device class from
the guest's own `C:\System`; `lib/apps.js` mounted `GlideDrv.int` but not
`GlideDrv.dll`, and the CLI hid that by finding the DLL on the host disk beside
the exe. 7229c754 mounts the Glide, OpenGl, MeTaL and SGL driver DLLs beside
their `.int` files; GlideDrv then plays the intro in the page on the WebGL
Glide backend. `test/test-unreal-renderer-dll-mounts.js` checks that every
registry app mounting a `*Drv.int` mounts the DLL too. Evidence:
`scratch/runs/20261006T1815Z-deusex-glide-page-w6`.

Repro trap on a fresh clone or boat: the gitignored `test/binaries/dlls`
(msvcrt, comctl32) and `fonts/*.fon` are absent and there is no top-level
`binaries -> test/binaries` link, so the page falls back to stubs and fails for
an unrelated reason. Ship those first.

## `--app` from a fresh candidate fetch (2026-10-10, UT2004-FRESH-FETCH-MANIFEST)

`tools/fetch-candidate-corpus.js --id=<candidate>` writes
`.wine-assembly-browser.json` at the candidate root, not under `installed/`. Its
urls start `installed/...`, its vfsPaths are `c:\<path under installed>`, and it
omits the exe. Before eb349d0a7 the registry read `installed/.wine-assembly-browser.json`
and mounted the exe and its DLLs at `C:\` with cwd `C:\`, so a fresh fetch died at
batch 14 with a C++ throw. eb349d0a7 points unreal_special_demo, ut2003_demo(_server)
and ut2004_demo at the root manifest, with `exeGuestPath`/`workingDirectory` set to
`c:\system`. DLLs found beside the exe now get guest paths beside it, in both run.js and the page.

- ut2004_demo: fresh fetch + `--app`, software arm → main menu with 0 throws.
- ut2003_demo: its files load now, but the fetched `system/ut2003.ini` and
  `default.ini` select `RenderDevice=OpenGLDrv.OpenGLRenderDevice`, and `-d3d`
  does not override them. The result is an `Assertion failed: hRC` crash box
  (OpenGLRenderDevice.cpp:539). Earlier software runs used hand-made trees
  whose INIs had been edited. This is tracked as UT2003-FRESH-FETCH-OPENGL-INI.
- unreal_special_demo: the upstream archive.org 7z returned HTTP 404 on
  2026-10-10, so the fetch could not be checked.

Evidence: `scratch/runs/20261010T2335Z-ut2004-fresh-fetch-app-w5`.
