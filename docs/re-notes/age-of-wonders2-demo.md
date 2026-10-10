# Age of Wonders II beta demo

Original local package, separate from the already-qualified Age of Wonders I
beta demo. October 8 scoped registry, run-result and re-note search found no
earlier qualification for this second title. This investigation establishes
main-menu rendering only; player-controlled gameplay remains unqualified.

## Original media and preparation

`test/binaries/win98-games-a-d/Age of Wonders2 demo-SW.exe`:
101,537,511 bytes, SHA-256
`1244f0114965d011d1e28b97e207db15c902d124ebb25af8a6c97748beb73dc0`.
The collection's existing provenance is in `test/binaries/SOURCES.md`.
No alternative edition or additional download was used.

This executable contains a normal ZIP catalog: 1,104 entries, 1,063 files,
197,002,538 uncompressed bytes. `tools/extract-age-of-wonders2-demo.js` checks
the original identity, catalog totals, names/collisions, each ZIP CRC and the
game hash, and refuses an existing output or crossing the 2 GiB disk floor.
The remote copy was named `/tmp/aow2-original.exe`; the transfer receipt binds
that temporary name to the original package above.

The output is **extracted**, not an asserted installed state:
`Age of Wonders2 demo-SW/extracted/`. All files remain byte-identical. The
package's `aow2Log.txt` is a developer's old Windows 2000/Radeon log, not our
runtime evidence. The original `aow2Setup.exe` remains in the payload but was
not executed; no settings or Windows registry state were fabricated.

`AoW2.exe`: 5,748,736 bytes, SHA-256
`a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`.
PE string FileVersion/Product fixed version: **0.92.0.1837** (fixed file
version 0.92.1.0; string ProductVersion 1.0.0.0). Configuration executable SHA:
`bcb06f08e6e5d4e0b41a93b9d77de107e72494a382ebf46ad65bc6f95ab52bbc`.

Registered local-only app: `age_of_wonders2_demo`, guest executable
`c:\aow2demo\AoW2.exe`, working directory `c:\aow2demo`. Explicit imported
Borland packages: `vcl50.bpl`, `vclx50.bpl`, `Ml42ND50.bpl`. The generated
manifest contains 1,059 companion files with sizes and lazy loading. Reproduce:

```sh
node tools/extract-age-of-wonders2-demo.js
node tools/gen-win98-games-a-d-manifests.js --only=age_of_wonders2_demo
node tools/gen-win98-games-a-d-manifests.js --only=age_of_wonders2_demo --check
```

The full durable local tree's 1,063 hashes were compared with the remote
extraction receipt. No proprietary payload is committed or publicly deployed.

## Generic startup repair

First ordinary registered browser launch trapped on **SysReAllocStringLen**
at runtime EIP `0x00abc57c`, before the menu. Baseline loaded module SHA-256:
`d8d4096f957ed51cecab589b5a1ec7bf402336f13959ce0710faf2f7d3c68960`.

The new handler allocates a counted UTF-16 BSTR, copies before freeing its
predecessor (including self-aliasing slices), writes the byte-length prefix
and terminator, and updates the caller's pointer only on success. NULL source
allocates uninitialized contents; NULL old BSTR is supported. Overflow is
rejected before size arithmetic; insufficient allocation leaves the old
pointer/content intact. NULL pointer-to-BSTR remains an invalid call.
The API is append-only ID 4475 and OLEAUT32 ordinal 5 in both resolvers.
Contract: [Microsoft SysReAllocStringLen documentation](https://learn.microsoft.com/windows/win32/api/oleauto/nf-oleauto-sysreallocstringlen).

`test/test-bstr-reallocation.js` drives the real resolved thunk/Win32 dispatch.
The corrected baseline harness fails with `RuntimeError: unreachable`; the
fixed harness passes aliased slices, embedded NUL/surrogate UTF-16, terminator,
NULL source/old BSTR, zero length, overflow preservation and stdcall cleanup.
The first harness attempt used a wrong import-signature filename; that failure
is retained and is not the meaningful baseline. Root subsequently requested a
valid-length actual heap-OOM case (`cch=0x3FFFFFF5` in 512 MiB). Its assertions
were added after the fixed native deadline; **the expanded test was not run**.
Do not treat overflow coverage as allocation-failure branch coverage.

Canonical build gates passed, including the API/dispatch freshness, handler
ESP, silent-stub, logical-operand and WATX/data-segment checks. Initial build
closure omitted two checked-in ToyVM bundles; they were supplied inside the
original build deadline. No optimization, silent-success stub or guest-state
patch was introduced.

## Reviewed browser findings and limit

Boat `bx_997uef9b`, Chrome 151.0.7922.108, Node v24.18.1, 512 MiB guest memory,
software renderer requested and GPU flag false. Source base
`0d781689e8782fd6d0bce43e9021c749e6a30577`, exact source/file receipts preserved.
Fixed served/loaded module:
`e4d59e88c62dd17cafaa836120e35e891cd56b497bd80190c980696adc98396c`.

1. Registered `?app=age_of_wonders2_demo&debug&no-threads&d3d-renderer=software`
   reaches a rendered splash. Main thread remains at VCL50 runtime
   `0x00ac63b4`, yield 7 (empty message wait). Three cooperative guest threads
   remain active and a timer is pending. Ordinary splash click reaches HWND
   `0x10002`; Enter/Escape events were logged with HWND 0. These inputs did
   not expose a menu. This does not establish a causal thread/timer bug.
2. Same browser navigated to the ordinary registered `&threads` route, without
   resetting its guard. Four Worker guest threads reach the visible main menu
   (Campaign, Scenario, Load Game, Replay Intro, Quit). The readme prescribes
   Scenario → Single for the included scenario, Inioch's Legacy.
3. Trusted click at viewport `(486,517)` on Scenario briefly removes buttons;
   a later reviewed capture returns to the main menu, rather than exposing
   Single or scenario setup. A separate ordinary 180 ms down/up produces a
   captured redraw. No later capture exists for that held click, so its eventual
   outcome is unknown. No gameplay scene, army selection or displacement was
   observed. Do not claim input bypass, playability or new-game credit.

Worker-route snapshots retain hidden main form HWND `0x10003` and visible child
`0x10004`, with the fullscreen/splash HWND `0x10002` as the main window. This
is a possible input/window ownership lead, **not a diagnosed cause**. The
remote closure lacked `test/binaries/tlbs/stdole2.tlb`, registered
`binaries/dlls/oleaut32.dll`, `comctl32.dll`, and dynamic `olepro32.dll`.
Built-in APIs were used; those omissions remain limitations, not proven causes
of the Scenario behavior. No alternative fixture/stub was installed to hide them.

VCL50 mapping in the cooperative capture: runtime `0x00abb000`, original image
base `0x40000000`. Thus `0x00ac63b4` corresponds to original `0x4000b3b4`;
baseline failing `0x00abc57c` corresponds to `0x4000157c`. VCLX50 maps at
`0x00dad000` from `0x402f0000`; ML42ND50 maps at `0x00ef0000` from `0x00400000`.
Worker-route bases differ; its log records thread entry points separately.

Immutable bounds declared before launch: transfer 600 s, extraction 600 s,
native build 600 s, installer 1,200 s, gameplay 1,200 s, retrieval/cleanup 180 s,
aggregate 4,800 s. Installer phase unused. Native deadline 15:04:37.274 UTC
was preserved. Browser guard 15:15:38.887 UTC was preserved across repair and
navigation; terminal cleanup completed 15:15:39.001 (114 ms closure overhead).
First browser active 41.459 s, second 680.946 s; no overlapping browsers.
Transfer 313.438 s, final 4,329,217-byte evidence retrieval/cleanup 5.486 s.
All eight owned process IDs and Chrome were absent, exact baseline listeners
restored, and 3,569 runtime source pins verified before owned prefixes/archives
were removed. Root retains boat lifecycle ownership; expiry 16:47:45.876 UTC.

Sealed self-contained captures:

- `scratch/runs/20261008T1518Z-age-of-wonders2-demo-before/`
- `scratch/runs/20261008T1518Z-age-of-wonders2-demo-after/`

Next review: run the expanded heap-OOM regression, then investigate original
Scenario input/ownership with complete declared system support and ordinary
input in a separately authorized bounded run. No further runtime in this worker
budget. Gameplay, sound, FPS, physical presentation and release are unqualified.

## 2026-10-08 sole-worker native review and menu-route continuation

The expanded actual heap-OOM BSTR regression now **passes**, including valid
`cch=0x3FFFFFF5` pointer/content preservation, on exact source `1455cc2f4`.
Sealed receipt: `scratch/runs/20261008T1546Z-age-of-wonders2-demo-native-review/`.
This completes the previously unexecuted native review; root separately reviewed
and integrated core/registration. No game rerun was used for the native stage.

A distinct bounded registered default-Worker investigation passed the canonical
build with both checked-in ToyVM bundles and served the same `e4d59e88…` module.
It did not reproduce the predecessor's reviewed menu: reviewed images show title
background without buttons, pre-input startup stack trap `0x074ffd4e`, or worker
exit. No Scenario input or gameplay was achieved. The predecessor held-click
outcome remains unknown. Including declared stdole2 and then temporarily omitting
it for a causal A/B did not establish a prerequisite; it was restored. An initial
observer SharedArrayBuffer decoding error invalidates that attempt, and capped
logs limit interpretation. No runtime fix was justified.

VCL `TThreadWindow` HWND `0x10007`, message `0x8fff`, dispatches its synchronized
method from lParam+0x20/self+0x24. Two read-only observed dispatch requests overlap
an active slice; arbitration is an unproven source lead. Investigate with a
controlled source regression and actual Worker CPU/stack capture before another
ordinary-input gameplay attempt. Browser shadow CPU getters are not reliable.
Full limitations, source identities, commands, reviewed images and cleanup:
`ops/handoffs/age-of-wonders2-menu-route-20261008.md` and sealed
`scratch/runs/20261008T1623Z-age-of-wonders2-demo-menu-route-investigation/`.
The one browser closed at its immutable 1500-second guard; evidence was retrieved
and hashed before owned-prefix cleanup. Gameplay remains unqualified.

## 2026-10-09: callback ownership fixed; Start faults in Miles stream callback

Main28a104092 prevents ordinary Worker slices from consuming a suspended
SendMessage callback's EIP-zero sentinel. Actual command evidence and a failing
control/passing real-Worker regression established that defect. Ordinary
Scenario -> Single now reaches Inioch's Legacy setup. Campaign is explicitly
unsupported by the demo. Start still fails; no player-controlled world yet.

The browser's `ExitProcess C000DE05` text was misleading: SEH termination calls
the same host exit import with access violation C0000005 OR DE00. The passive
owning-instance observer in run20261009T0229Z-age-of-wonders2-owning-fault
captured the first CPU fault before termination, with no observer errors:

- Win32 thread2, EIP C53D4000 (unmapped), ESP7EC5FF98, EBP0, ESI016C350C.
- First stack word0118900E. Runtime console pins Mss32.dll at01168000; original
  PE base21100000, so the return is original2112100E.
- Original21121008 is `call dword ptr [esi+0xe0]`; it pushes that exact return.
  This identifies the stream callback path, with field address016C35EC. The
  target follows from the instruction/stack; the complete object was not dumped.
- `_AIL_register_stream_callback@8`: original2110B6B0/runtime011736B0. Its
  internal setter211223F0 writes the supplied pointer at21122421 to `[esi+e0]`.
- Open/close/service exports are pinned in the run's `mss-export-map.json`,
  alongside the original DLL and relevant disassembly.

Next establish the registered pointer and last writer/lifetime of that object
before the indirect call. Do not suppress the callback or disable audio as a
compatibility fix. Observer reads384bytes, frame unavailable because EBP0,
one original fault then SEH termination; later null-instance file-open errors
are secondary. Browser39438 exited0 and boat bx_va3qxqm3 stopped02:36:59.165Z.
No gameplay/FPS/audio qualification. Handoff contains full source/run identities.

### Stream lifetime capture sites

Static review of the same original Mss32 SHA d0db426ebac97dc410b5130c9c74d19bc04151236df85b012823d6cb3d7fb87c:

- Open wrapper calls internal21120A40. It allocates0x114 bytes at21120A59,
  then zeroes all0x45 dwords at21120A80. Capture returned EAX at21120A5E
  and ESI after initialization; do not assume a stable stream allocation address.
- Close wrapper calls21121620. It unlinks the stream through next+104,
  coordinates service counters, releases buffers, then zeroes the complete
  object at211217C4 and passes it to the free wrapper211029D0.
- Besides the observed direct call21121008, trampoline21122430 obtains a
  stream through sample user data and tail-jumps `[eax+E0]` at21122444.
- A search for every literal+E0 store also finds sample-related code in
  211115xx–211118xx. Equal member offsets do not establish equal object types;
  these are not evidence that those stores corrupted the observed stream.

Private capture preparation: `scratch/aow2-stream-lifetime-20261009/observer.js`.
It uses existing owning-Worker block tracing across the stream routines,
records registration arguments/current callback/full0x114-byte object at
selected block entries, and preserves the real log import. Limits:300seconds,
256records and256KiB reads per Worker. It checks the known setter signature
before trusting the prior load base. Pure-JS contract verifies argument and
callback capture, unchanged memory, import forwarding and trace cleanup.
No runtime validation yet. Tracing changes dispatch/timing, and block entries
are not every instruction: missed sites and timing sensitivity must be reported.
This can distinguish registered-invalid versus later-invalid pointers or close
before use; it does not by itself identify every possible last writer.

### Actual lifetime trace: valid registration, later bulk overwrite

Run `20261009T0248Z-age-of-wonders2-stream-lifetime` reproduced ordinary
Scenario/Single/Start with the private observer. Twelve selected-site records
show stream016C350C allocated on thread1 with callback0, then registered with
0046CB08. It is closed with that valid callback, allocated again at the same
address, and registered with0046CB08 again. Thread2 subsequently reaches
callback-status/before-callback with C53D4000 in the callback field. No close
site was observed between the second registration and this invocation.

The full0x114-byte capture is decisive: corruption extends well beyond E0.
At invocation, repeated32-byte groups contain float-looking coordinate values
and repeated grayscale-looking words00727272/00737373/00777777. This suggests
vertex-buffer data, not a malformed registration argument, but the responsible
writer and allocation/backing relationship are not established. Some stream
fields are still present, possibly rewritten by service code after corruption.
Next capture writes/buffer ownership covering016C350C through016C361F; do not
assume graphics causality or patch the callback value. Check logical guest
allocation overlap and guest-to-WASM backing alias as separate hypotheses.

All46 artifacts were hashed and reread. Prepare37222 exited0, browser38193
exited0 at02:50:28.300Z; capture used original files and unchanged runtime plus
the documented diagnostic overlay. Tracing can change timing and observes
block entries only. No gameplay/FPS/audio qualification.

### Writer identified: undersized D3DFVF_LVERTEX backing

Run `20261009T0257Z-age-of-wonders2-stream-writer` adds a private bounded
watch log at block boundaries. Main-thread change from0046CB08 toC53D4000
occurs after original guest block4432A2, before4432FD. Other threads report
the same value while waiting: those are observers, not the writer.

Original4432C4 writes `[edx+8]`; captured EDX016C35E4 addresses the watched
callback016C35EC exactly. Stack locals pin destination base016C2384, returned
Lock size1180(4480), source countA0(160), destination stride32, source stride24.
The copy writes5120 bytes into a4480-byte buffer and reaches the neighboring
stream at016C350C. This is guest-address overlap, not merely similar bytes.

Caller442CAC obtains this buffer via vertex-buffer Lock. Its creation branch
442C34 requests FVF1E2, the legacy D3DFVF_LVERTEX format, which includes
D3DFVF_RESERVED1(0x20). Our `d3dim_fvf_stride` omits that reserved DWORD,
calculating28 instead of32; allocation and Lock size follow that calculation.
The primary contract is [Wine's d3dtypes.h](https://github.com/wine-mirror/wine/blob/master/include/d3dtypes.h),
whose LVERTEX definition includes XYZ, RESERVED1, DIFFUSE, SPECULAR and TEX1.

Next fix allocation stride **and** packing/unpacking offsets for the reserved
DWORD. Add a control-failing actual VB Create/Lock regression with160 vertices
and neighboring-allocation integrity, plus color/UV conversion checks. Then
rerun ordinary Start without diagnostic WAT/Worker changes. No fix tested yet.
Fifty hashes verified; original AoW2.exe and writer/caller disassembly sealed.
Prepare37471 exited0; browser38085 exited0 at02:59:15.875Z. Boat bx_2sdgzsm6
is retained for the next isolated native/build phase, expiry03:54:26.401Z;
do not start another browser concurrently or confuse retained box with live test.

### RESERVED1 fix: ordinary army movement verified

The generic FVF fix adds the reserved DWORD to storage size and skips/writes
it at the corresponding packing/unpacking offsets. The real VB Create/Lock
test fails on control (4480 versus5120 bytes) and passes with the fix for both
VB and VB7, including160-vertex uploads, neighboring-allocation integrity,
two-vertex color/UV packing, and unpack bounds. Canonical build, VB allocation
failure, ProcessVertices, v3 VB drawing and D3D7 lighting suites pass. The
ProcessVertices test now resolves dispatch IDs from api_table.json rather
than overflowing the production string pool with test-only names.

Run `20261009T0306Z-age-of-wonders2-gameplay` uses no diagnostic WAT/Worker.
Ordinary Scenario -> Single -> Start reaches the world. Dismiss Julia's panel,
select the party at the tower, click adjacent terrain to plot a path, then
click again: the army moves and movement points fall20/20 ->13/20. Reviewed
`city-click.png` and `army-moved.png` record the before/after. This qualifies
initial player-controlled gameplay, not release readiness: terrain overlaps
the lower UI and black polygons remain; FPS/audio are not measured/qualified.

All67 artifact hashes reread; module
bb9d6e9621a06efb5498e2903fc0a3185967ac76cd33fc76b96c11d714c0a387.
Browser41887 exited0 at03:10:42.630Z; boat bx_2sdgzsm6 stopped03:11:23.355Z.

## Terrain over the lower UI: fixed by viewport clipping (2026-10-10)

**Cause.** The game draws its lower UI panel into the back buffer once, then
redraws only the map viewport each frame. Each frame is BeginScene/EndScene,
followed by CPU Lock/Unlock and Blt UI updates and two BltFast presents.
Direct3D never writes outside the device viewport, but both D3DIM
rasterizers clipped only to the whole render target. The terrain mesh
therefore painted over the panel, and its off-map parts left black wedges.

**Fix.** D3DIM draws now clip to the viewport (9a438f1b9): in the software
spans and rects, and through the WebGL scissor via `d3dim_gpu_describe`
fields 34-38. With the fix, the browser shows a clean panel on both
renderers, and the army moves (13/20); see
`scratch/runs/20261010T1145-aow2-viewport-clip-fix`.

**Ruled out.** Lazy sync makes no difference with it really off
(`20261010T1045-aow2-overlap-ab`). Note that the `?no-lazy-sync` URL
parameter is not applied at load: it is parsed inside `setD3DRenderer()`,
where `q` is undefined. To turn lazy sync off, set
`window.WINE_D3DIM_LAZY_SYNC=false` before launch.

**Browser route** (`tools/web-input-probe.js --threads` on
`dev-server.js --isolate`, guest canvas pixels):

- `wait:70000`.
- Main menu at 800x600: Scenario (569,346), then Single (290,78), and wait
  20 s.
- Setup screen at 1024x768: Start (896,697), and wait 45 s for the world.
- Julia's panel: (518,473). Select the army at (515,344). Destination
  (632,388), clicked twice.

The fixture is local-only (191 MB). `boat-ship-tree.js` (in the run folder)
ships it as parallel base64 parts in about 2 minutes.

**Open, unrelated to the overlap.**

- **The CLI cannot reach the world.** In cooperative mode, Start is
  delivered as WM_LBUTTONDOWN (896,697) to 0x10002 and the game runs
  SetCapture/ReleaseCapture, but the world never loads. Main idles in the
  VCL loop while T3 cycles `TThread.Synchronize` (SendMessage CM_EXECPROC to
  TThreadWindow, vcl50 `0x4003060e`).
- **`--screen=1024x768` drops the Start click.** The input router still has
  0x10002 at 800x600 while the png is scaled.
- **`?no-threads` in the browser** does not reach the menu within 70 s.
- **Browser `--trace-api` in Threads mode** logs all-zero arguments, because
  `host.js` reads ESP from the page's instance, not the guest Worker's.
