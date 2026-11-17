# Four original DXSDK samples, software and WebGL — 17 November 2026

Seven of eight distinct original app/backend cases have personally reviewed moving 3D scenes and observed executor ownership. Software Tunnel remains UNKNOWN after its first capture refusal. Software Flip3DTL has reviewed rotating geometry but incomplete enclosing process waits. This is not an eight-case lifecycle pass.

Evidence: `scratch/runs/20261117-dxsdk-four-examples-paired-rendering/result.json`.

| Original | Software | WebGL |
| --- | --- | --- |
| `dx_boids` | Colored birds and perspective terrain move. Actual software GPS executor. | Colored birds and perspective terrain move. Actual WebGL GPS executor. |
| `dx_flip3dtl` | Windows 95 textured cube rotates; actual software draw/readback execution. Enclosing native/watchdog waits UNKNOWN. | Windows 95 textured cube rotates; actual WebGL draw/readback execution. |
| `dx_tunnel` | UNKNOWN: no complete capture; immutable capture rejected the windowed transparent-desktop output. | Gray textured receding tunnel, changing rings and yellow/black signs; actual WebGL GPS executor. |
| `dx_twist` | Rounded textured object changes orientation and deformation; actual software GPS executor. | Textured object changes orientation, silhouette and visible end face; actual WebGL GPS executor. |

The whole-page screenshots retain the complete ordinary application windows; natural geometry meeting the edge of its own viewport is not a cropped host capture. Two selected observations per successful original establish visible natural motion. Native FPS overlays are not measurements accepted by this report.

## Exact graph and executor observations

All originals use the ordinary `lib/apps.js` registration and Threads launch on Git `70a680b54bf1f4f62243f6218314cb45610a1bd2`, including root `a0b14b544` generated DXSDK model-size corrections. Source is served from Git into memory, excluding shared WIP. The same 1,503 source pins match across all eight cases. The 41 unique registered input/media paths are hashed before and after without copies or modifications. All 1,608 successful HTTP response hashes agree with the served graph. All 24 debugger-observed page/guest/render Worker modules match retained WASM SHA-256 `cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0` (2,408,426 bytes). The module is compiled once from that graph and reused.

Actual owning guest endpoint 1 and render endpoint 1 use API `d3dim-gps`; the passive executor wrapper records successful execution on the actual render Worker, rather than inferring a backend from a selector or the sample's HAL label. Boids, Tunnel and Twist use natural PRESENTs. Flip3DTL uses completed DRAW_UP/READBACK cycles and CPU publication, so zero PRESENTs does not mean no rendering. Its observed WebGL executor draw/readback counts, the full cube images and matched producer/Worker identities establish that route. No old replay path was restored.

| Case | Actual completed executor observations, early → later | Changed sampled pixels |
| --- | --- | --- |
| `dx_boids-software` | GpuStreamSoftware draws 18358 → 30820 | 2689 |
| `dx_boids-webgl` | GpuStreamWebGL draws 11189 → 28743 | 3014 |
| `dx_flip3dtl-software` | GpuStreamSoftware draws 978 → 1668 | 45177 |
| `dx_flip3dtl-webgl` | GpuStreamWebGL draws 1776 → 2658 | 48864 |
| `dx_tunnel-webgl` | GpuStreamWebGL draws 961 → 3301 | 83526 |
| `dx_twist-software` | GpuStreamSoftware draws 375 → 923 | 21391 |
| `dx_twist-webgl` | GpuStreamWebGL draws 4450 → 10018 | 22540 |

Pixel differences are between retained observations, not same-clock software/WebGL parity. For Boids/Flip3DTL these diagnostics compare the complete immutable source; for windowed Tunnel/Twist they compare the complete whole-page image. Visual review identifies object/terrain motion independently of changing text. The sampled WebGL PRESENT executor contexts identify Chrome WebGL1 / ANGLE / Mesa Intel UHD620; Flip3DTL has no sampled PRESENT context record and no separate physical-GPU claim. Chrome is 151.0.7922.108.

## Capture boundary and preparation corrections

The existing Boids runner retained an undefined deleted-transport observer and a legacy software-readiness check. A small run-local adapter removes that observer, uses the current GPS bridge for readiness, and keeps the existing immutable capture driver, ownership pinning and fixed 3000 ms deadline. Source/module/media execution bytes stay pinned; passive diagnostic suffixes and both adapter versions are retained as hashes/patches. An initial authored preparation error (`assert` missing in the in-memory adapter) is corrected before any original.

The existing bounded driver controls pass. Authored native Device2 RGB16/D16 scenes pass independent literal checks over all 307,200 source pixels and 1,185,280 whole-output pixels on both software and WebGL, plus eleven native ownership/refusal controls each. These controls validate the observer/capture route, not the correctness of every original scene. No broad setup qualification or original retry occurs.

Tunnel/software's first request fails `DISPLAY_UNKNOWN failed Current display output changed or is cropped`, at the existing prohibition on nonexclusive transparent-desktop immutable capture. It has zero complete captures. Readiness and accepted producer frames do not establish a reviewed scene or backend rendering pass. Its endpoint is permanently closed; it is never queried, retried or rebound. No renderer defect follows from this capture contract refusal.

Before the three still-unlaunched windowed cases, the adapter selects the existing SDK whole-page screenshot recipe from their first request, retaining the same 3000 ms limit and the pinned identity before/after capture. It does not change desktop, media, clocks, configuration or capture guards. A native Device7 authored whole-page check completes in 681 ms with GetPixel PASS and full lifecycle receipts. The initial authored attempt correctly fails an inapplicable fullscreen-only oracle after capture; the window-specific check omits that oracle and succeeds. This is a harness preparation correction, not an immutable-capture repair. Whole-page captures are not labeled exact immutable framebuffer publications.

No original receives physical input, forced guest calls, pump, flush, repaint or clock changes. No renderer/ownership production defect is causally demonstrated. No production change, canonical repair build or repaired-original rerun is claimed.

## Shutdown and remaining work

One own runtime runs at a time, under prearmed independent 240/260-second preparation and 300/320-second runtime/watchdog bounds. Each case shuts down promptly after observation or first refusal. Browser close is host shutdown, not native guest Quit. Seven originals have actual native/watchdog waits and observed stdout/stderr EOFs, with browser close 0; Tunnel/software's native failure is 1, not a game pass. The remaining six of those seven are native 0. The first two Boids cases also have direct enclosing parent waits/EOF. Later durable wrappers retain actual command/watchdog waits, both outer EOFs and adopted-child waitpid receipts. Their command success does not hide the Tunnel/software capture failure.

During Flip3DTL/software the initial enclosing tool returns 143 before its supervisor writes native/watchdog/outer waits and EOF. The saved terminal contains two completed captures and an actual Chromium close 0. Known browser/native/supervisor PIDs are absent, the token-owned runtime scope is empty, and its orphan watchdog is cancelled only after that check; its missing wait remains UNKNOWN. Absence and a cancellation record are not substituted for waits. The sender/cause of the outer termination is unknown. The tool caller of the next durable submission also returns 143, while that detached custody completes with actual waits/EOF; those two boundaries remain distinct.

Final checks find no live token-owned runtime. No box is created: ID null, state NOT_CREATED, expiry null, stop receipt N/A. Disk remains above 1,500,000,000 bytes; no RAM gate, worker, source archive, media copy, frame archive or deployment is used. Only named selected whole screenshots, bounded logs, one module, exact Git identities and relevant patches remain.

These four IDs are named in the original Oct6 `d5b3b56cb` table, which expands to 37 candidates. Exact Sep22 27 membership is unresolved. No census is rerun and no full27 claim follows. The six-title startup matrix, Forsaken menu reports, accepted pins and old UNKNOWN records are unchanged.

The next original work requires fresh authorization for software Tunnel using the now-checked whole-page recipe. This task has spent all eight distinct original cases and stops without replay. Software Flip3DTL's missing waits cannot be repaired retrospectively. No parity, FPS, audio, native Quit or complete-scene correctness beyond the reviewed observations is claimed.
