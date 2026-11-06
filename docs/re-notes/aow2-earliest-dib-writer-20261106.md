# AoW II: creation captured, earliest producer detail lost

2026-11-06, worker `aow2-earliest-dib-writer0545`.
Run: `scratch/runs/20261106-aow2-earliest-dib-writer/` (ignored evidence).

Black terrain remains. No emulator divergence was demonstrated, so no emulator,
guest, input, or media implementation was changed. This run establishes the
terrain surface's creation descriptor, successful return, backing identity and
observer-local generation. It does **not** establish the intended first drawing
contribution: a host collection failure lost the detailed CPU events at terrain
startup. That is the first remaining evidence failure, rather than evidence of
missing geometry.

## Gates and tested identities

The exact ordered FINAL releases were Aranna0500, Conan0510, then KKnD0535.
Independent checks after all three found 221 absent PIDs, 20 refused ports,
14 absent profiles, four free locks, no heavy process, and sufficient disk.
`release-gate.json` fixes the active window at 06:38:19–07:23:19 UTC.
Preparation before this gate stayed inside this run. No boxes or subworkers
were assigned or used.

Tested source SHA: `6c48fd87416794f12059e8fc9290ae784c760c92` on main.
The 301-file relevant source manifest was identical before controls, before the
original and after it; relevant binary diffs and separate new-file patches
record concurrent uncommitted source, without a source archive. The untracked
`lib/wininit-boot.js` patch is recorded as shared-tree context, not this worker's
change. See `*-source.json`, `*-relevant.binarydiff`, and `*.new.patch`.

Both shipped modules remained byte-identical through the locked full build:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| `wine-assembly.wasm` | 2178481 | `41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f` |
| `wine-assembly.compat.wasm` | 2181127 | `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a` |

The original HTTP response was the standard module above, status 200, with
matching retained response bytes. Controls used both modules. Actual source
responses and local diagnostic transformations are hashed in
`http-served.jsonl`, `controls-http-served.jsonl`, `served-transforms.jsonl`,
`responses.json` and `producer-controls.json`. These record served identities;
they are not an independent CDP extraction of instantiated WASM bytecode.
`identity-guard.json` verifies source, module and six runtime helper hashes.

The 1,064 existing AoW fixture paths, sizes and hashes matched before and after;
no media was copied. The executable is
`test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted/AoW2.exe`,
SHA-256 `a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`,
preferred image base `0x400000`. Full path/hash lists are `fixtures-before.json`
and `fixtures-after.json`.

## Passive observation and controls

Only run-local JS was added. `surface-observer.js` consumes existing API entry,
API exit and `dx_trace` hooks, preserving original hook arguments, receiver and
return. It reads current RegionMap fields and the existing pure JS guest-pointer
translator, including sparse mappings. It adds no guest calls, setters, uploads,
fences or readbacks. Creation scans are bounded to four MB; retained API details,
births and points have explicit quotas. Generation is a local counter of observed
allocation events, not a newly invented guest field. API completion records
unchanged dispatch EIP, no yield and the known stdcall stack adjustment.

Current source symbols were located by name, including
`$handle_IDirectDraw_CreateSurface` in `src/09a8-handlers-directx.wat:2637`,
`$handle_IDirectDrawSurface_BltFast` at 5960, `GetDC` at 6644 and `Lock` at 6841.
The existing raw prepacking trace is at 14463. Native fields come from the
generated RegionMap rather than an old note's movable addresses. The observer
can retain the first raw Device3/7 primitive source bytes at dispatch entry,
before FVF packing, without inferring stride, coverage or an intended texel.

`flock /tmp/wine-build.lock bash tools/build.sh` passed. `focused.sh` passed the
run-local observer controls plus existing draw-trace, GPU batching, GPU points,
fallback-counter and worker-parity tests.

The final public COM controls passed all four standard/compat × disabled/armed
cases in actual owning CPU/GPU Workers: 27 draws each, identical GPU pixels and
counters, 159 CPU and 57 GPU events when armed, no observer errors/drops. Every
recorded hook's before/after architectural state was unchanged; architectural
entry/exit records also matched across armed/disabled cases. This included
nonzero GPRs, unresolved lazy flags, live x87, the complete FPU/XMM files, and
eight MMX getter values. Genuine public VirtualAlloc supplied a sparse stack,
cross-page DDSD and sparse output. Public creation checked normal return, backing,
generation and zero initialization; other controls checked a known raw RGB565
write through Lock/Unlock, production GDI GetDC/SetPixel/ReleaseDC, Blt, upload,
covering draw and Clear. See `producer-controls.json` and helper hashes there.

Two earlier **generated fixture failures** are retained: the fixture initially
lacked production `gdi_surface_create` imports; next it changed an API selector
without updating that thunk's API-name string. Both fixture issues were corrected
before the passing controls. No emulator implementation was changed to make
these pass. `attempt1-*`, `attempt2-*` and their command logs preserve the failures.

## What the sole original establishes

One original ran 06:43:21–06:55:07 UTC, after the controls and another independent
resource cleanup. Chrome 151.0.7922.108, local port 45305, debugger 46441,
cross-origin isolated, main CPU Worker slot 0 with child Workers, legacy WebGL
render endpoint 1. The observed renderer was Intel ANGLE Mesa UHD620; requested
SwiftShader command-line flags do not justify calling this a SwiftShader run.

`boundary-findings.json` is the corrected concise analysis. The earlier
`boundary-analysis.json` remains available but its `naturalReadbacks` filter
incorrectly searches for `natural-readback` instead of actual `target-readback`;
use the corrected findings for that field.

The persistent creation return at CPU observer order 451, invocation 964080:

| Field | Observed value |
| --- | --- |
| Requested DDSD | 124 bytes, flags `0x1007`, width 1024, height 525, pitch 0, lpSurface 0 |
| Requested caps / pixel format | `0x6040`; RGB565, flags `0x40`, 16 bpp, masks `f800/07e0/001f` |
| Return | HRESULT 0, completed, ESP 122682432 → 122682452 exactly +20, EIP 4397449 unchanged, yield 0, return PC 4397461 |
| Output / object | pointer 165260888, returned COM object 136454664 |
| Surface | slot 65, local generation 1, type 2, flags 0, native pitch 2048, format 1 |
| Backing | native RT 131807264, native DIB 484888576 |
| Initial storage | all 1,075,200 logical bytes zero; selected point (600,300) bytes `[0,0]` |

The requested descriptor is unchanged on return. This non-alias allocation's
zero storage follows the explicit `$zero_memory` call at current
`src/09a8-handlers-directx.wat:2854`, before COM object creation. That is ordinary
allocation initialization, not proof of a failed intended drawing operation.

Cumulative successful completed results report **13 Device7 DrawPrimitive calls
targeting slot 65**, followed by one SetRenderTarget call whose entry target was
65. Their detailed entries were lost as described below. No conclusion about
their source data, packing, coverage, selected-point contribution or correctness
can be drawn from HRESULT alone. There is no retained target-65 Lock/GetDC/GDI
writer detail establishing an earlier producer; the missing batch prevents a
blanket absence claim.

On GPU endpoint 1, order 2, command sequence 1 ordinal 0, the first target upload
names exactly RT/DIB above, rows `[0,525]`, native sample `[0,0]`, changing RGBA
`[0,0,0,0]` to `[0,0,0,255]`. The natural existing readback at endpoint order 15,
sequence 8, route `legacy-fence`, writes the same DIB over `[0,116,1024,525]`
and still samples `[0,0]`. Existing CPU DX observations then name source 65 and
destination 18 at BltFast coordinates `(0,0)`, with source sample zero.
CPU observer, existing DX observer and GPU endpoint use separate sequence spaces;
these receipts do not supply an invented total cross-worker event order.

## Exact remaining failure and recovery

There are 42 retained collection segments, nine persistent birth records, 613
retained CPU events, 23,239 existing DX events and 156 GPU events. Observer errors
and reported new CPU/GPU drops are zero. **This is not complete collection:**
CPU order jumps from 311 to 808, losing **496 events, orders 312–807**. Persistent
births and cumulative call/result summaries survive that gap. Eight legacy DX
segments separately report 7,903 dropped events, including startup segments.

`faults.json` records a detached guest Worker evaluation failure. The collector
drains CPU Workers sequentially, then waits for all later Workers and GPU before
writing a segment. If a later Worker is detached, already-drained earlier CPU
rows are discarded. This run therefore did not preserve the first terrain
producer's raw API/prepacking records, even though its persistent creation and
summary counters remain. Missing detail must not become a missing-geometry claim.

Recovery requires a **fresh assigned run**, not another original here:

1. Persist each individual Worker drain immediately, with its slot and target;
   handle detached Workers independently and retain the error. Collect GPU
   independently so its failure cannot discard CPU receipts.
2. Add a focused host collector control that deliberately detaches a later
   Worker after an earlier drain and proves those earlier rows survive.
3. Re-run both module public COM armed/disabled pixel and architecture controls,
   current identity/media checks, ordered release gates and locked full build.
4. Re-resolve current symbols and capture the exact creation-to-first-upload
   lifetime, first 13 Device7 draws before packing, source textures/rectangles and
   an actual writable-pointer/raw-store interval if needed. Determine which
   intended source should affect the chosen point before proposing a repair.

No documented graphics/Win32/x86 semantic difference was established here. No
late triangle-only probe or second original was attempted.

## Reviewed play and cleanup qualifications

`reviewed-captures.json` names personally inspected images and hashes. Ordinary
balanced 180 ms mouse presses progressed Scenario → Single → Start, dismissed
the dialog, selected the party, plotted and confirmed movement. `party-base.png`
shows six selected portraits and 20/20. The coordinator independently read
`confirmed-arrival.png` as 12/20. Later `final-world.png` and the valid native
`party-counters-final.png` show five portraits, a green-5 party southeast of the
city and 10/20. This preserves evidence of commanded movement without claiming
all six units moved or explaining the changed selection. Black ground persists.

After confirmed arrival, a screenshot helper accidentally applied Puppeteer's
default 800×600 viewport. Its first two panel clips were invalid. No game input
was sent during that interval. The final helper restored the recorded 1280×813
viewport before the final valid panel and world captures. Failed helper versions,
geometry receipts and invalid captures are retained, not presented as evidence
of a game defect. No game restart occurred. No FPS or audible-output claim.

`terminal.json` records ordinary Chrome closure with exit 0 and removed profile.
The surrounding tool supervisor ended 143 without writing its final exit
receipt; the Node driver's exit code is therefore unknown. `supervisor-audit.json`
preserves that distinction and observes all recorded original PIDs absent.
Final independent PID/port/profile/lock/disk checks are in `final-cleanup.json`.
No box exists to hand back (ID/state/expiry all not applicable). The final
`artifact-hashes.json` verifies retained evidence; `result.json` is written last.
