# Quake III GPU drain causal trace, 2026-11-20

Evidence: `scratch/runs/20261120-quake3-native-gpu-drain-input-stall-causal-repair/result.json`.
Incomplete: no product defect or repair established; gameplay and ordinary Quit
remain unproved. Two instrumented originals ran locally, with no input. A separate
setup failure ended before launching the guest. No Wine, worker fleet or remote box.

The actual guest/render bytecode readbacks match retained module
`128b4c19ffd10351ba94075efa9bb2ecc33f71b57f423a1132887760d6f22285`.
Pass-through observers write only a separate bounded SAB (256 events per worker
plus counters); served JS changes and actual source readbacks are retained.
An actual software Executor executed endpoint 1, GL ring 134006592. The page's
WebGL selector does not identify this executor.

The first diagnostic sampled the early logo, not the main menu. Its bounded ring
retained all 236 render events and 148 guest events. Seven DRAW_UP records took
505.090–656.145 ms each, advancing 21 triangles total. Two guest SYNC waits lasted
1466.655 and 1382.265 ms. The final draw in each wait returned, followed by
read_pos/done_seq publication, followed by guest wait return within 0.3 ms.
Native check_input calls resumed after each wait. read_pos moved 4776→5752 and
done_seq 32→55 over the sampled interval; error_code stayed zero, consumer
returned from BUSY|1 to 1. This interval shows genuine software computation
and successful ACKs, not a missed wake or retired generation. It does not
establish what caused the preceding run's main-menu three-second stale interval.

Function indices must include `protectClosure` from
`tools/protected-writer-entries.js`, which inserts export wrappers. Scanning
combined.wat alone gives wrong names. Parsing the exact pinned closure with that
transform yielded all 16,983 definitions; all actual function export indices
matched the resulting declarations. No module was rebuilt. Matching hot functions:

- 9269: `$d3d_software_step`, `src/09ah-d3d-software.wat`.
- 9200: `$d3d_shader_vm_component`, `src/09ag-d3d-shader-vm.wat`.
- 9167: `$d3d_shader_vm_source_row`, same shader VM source.
- 9205: `$d3d_shader_vm_run`; 9192: `$d3d_shader_vm_alu_fast`.

The synchronous software path is `GpuStreamSoftware.Executor._draw` →
`Device.draw` in `lib/d3d9-software-backend.js`, which loops `step` until the
draw completes. `GpuStream.drain` publishes read_pos/done_seq after execute
returns. `GuestRpc` waits directly on the ring; no native input callback runs
inside that wait. This ordering is consistent with the measured early trace.
No ACK bypass, input polling during a blocked API, or speculative optimization
is justified by this evidence. No remedy was tested.

The second diagnostic reached a personally reviewed whole main-menu frame.
Before its manually released three-second trace started, the independent disk
boundary observed 1,494,421,504 free bytes on /home and permanently closed the
scope. The local trace command was written after closure and never transmitted;
no further endpoint request or replay occurred. All three scopes have actual
parent close/EOF receipts, non-leaking supervisor receipts, and removed profiles,
private display sockets/auth files. The run result records the final PID checks.
The next diagnostic needs a newly authorized scope with sustainable disk space;
it should use the same bounded observers at the reviewed menu interval.

## Bounded software critical-path experiment

Evidence: `scratch/runs/20261120-quake3-software-shader-critical-path-repair/`.
No production repair accepted. A fresh actual software original retained the
first 51 GPU records, all input blobs, seven DRAW_UP timings (482.760–523.345 ms),
and the exact pixel IR and VM packets. These are the early logo, personally
reviewed as a whole browser frame, not the main menu. Each draw advances three
triangles. The 26-packet pixel program repeatedly executes MOV/MIN/MAX/MUL/ADD
and samples through handler51; most source modifiers are zero. Existing lazy
operand gathering and destination-mask pruning are already present.

Tested remedy: after source_row completes its load or relative gather, return
the vector immediately when the low-byte source modifier is zero. This leaves
all addressing, nonzero modifiers, shaders and fences intact. The protected
closure has 304 function imports (305 total imports including memory), so the
target code body is definition8863 / function9167. The unmodified rebuild's
16,983 function bodies match actual128b byte for byte; only a 35-byte custom
section differs. An additional test module replaces only body9167 in actual128b,
retaining every other section and function body.

Seven-draw replays execute the captured real command stream through the native
software executor. All color-surface and depth-surface hashes agree after each
draw, with identical nontiming executor state. The explicit TurboFan pairs favor
the candidate (exact-body pairs: 1425.789 versus 1510.756 ms and 1399.407 versus
1636.347 ms). Default-tier pairs do not: 1114.701 versus 1036.744 ms and 1496.455
versus 1476.071 ms. These are local, noisy process timings, not a demonstrated
improvement in the original browser. Disassembly was inspected for both x64
V8 15.7.57 TurboFan and SpiderMonkey C158 Ion: the zero path bypasses the modifier
chain; V8 body size remains 1472 bytes, Ion grows 591 to 604 bytes. Node replay
uses V8 13.6, a different engine version; neither capture proves the browser's
actual compilation tier. No ARM64 or remote measurement was performed.

The existing shader VM suite passed 331 cases, including modifier, special-value,
relative-address and cancellation cases; busy-doorbell and retirement controls
passed. The literal locked build passed with the experimental source present.
Its fresh native candidate diagnostic then hit UNKNOWN Runtime.evaluate timeout
before the workload/provenance export completed. That scope permanently closed;
no later endpoint request, retry or manual input followed. All supervised trees
joined with leaked:false and private profiles/displays were removed. This failed
comparison is not evidence of a shader fault or a speedup. The source experiment
was removed; the rejected patch, modules, native disassembly, exact inputs and
recovery helpers remain in the run. Gameplay and ordinary Quit remain unproved.

The precise next test is a matching browser-tier comparison of this retained
51-record workload with complete readbacks, outside concurrent build activity.
Do not promote the shortcut from optimized-tier replay alone, weaken the input
limits, or substitute the separate WebGL presentation proof.

## SIMD quad interpolation repair, 2026-11-21

Evidence: `scratch/runs/20261121-quake3-generic-alu/`. The real retained
51-record workload runs through the existing software Executor. A default
Node/V8 CPU profile attributes 367 samples to software step and 220 to shader
component execution. Splitting the common ALU dispatch out of the large
component frame did not consistently improve timing; that experiment was
removed. The accepted change instead interpolates the 28 varyings and four
specular components across all four quad lanes with SIMD, directly into the
VM's existing vector layout. It preserves the scalar multiply/add order,
zero-mask stores, helper lanes, and per-lane direct division when the reciprocal
is nonfinite. Point sprites retain their scalar coordinate replacement path.
Shader operations, sampling, cancellation, coverage/depth, fences and input
guards are unchanged.

The final control/candidate modules were compiled from one frozen source set,
with only the software raster source changed; earlier exploratory modules
straddled foreign COM work and are excluded. Eight alternating-order process
pairs on local x64 Node24.18.1 / V8 13.6.233.17-node.50, using default automatic
tiering, reduced seven-draw totals from median1110.056ms to870.130ms. Every pair
improved (8.647–41.937%; median paired reduction22.033%). All color surfaces,
depth surfaces and nontiming executor state match after every draw in all16
runs. This is actual executor computation, not a browser input-latency or
optimized-tier benchmark claim. No ARM64 measurement was performed.

Matched V8 15.7.57 TurboFan and SpiderMonkey C158 Ion x64 disassembly shows
packed multiply/add/store loops without arithmetic helper calls. The new
helper is512/292bytes respectively; the retained sprite fallback and vector
packing increase step size24640→25920 /4931→5701bytes. V8's step frame grows
0x1d0→0x230; helper SIMD spills are on its interrupt slow path. These shells
are not the measured Node engine/tier; their code establishes structure only.

The331-case shader VM suite and focused address/call/loop/budget/temp-span,
pipeline/backend/mip/setup/clip/stream, line/point/texgen/fog tests pass. A new
generic regression compares16896 lanes bit-for-bit with scalar interpolation,
including signed zeros, subnormals, mixed reciprocal fallbacks, infinities and
signed/payload/signaling NaNs. The locked build passes; all17029 code bodies in
its shipping module match the tested candidate (custom metadata differs).
A broader QuakeII CLI worker-parity test run against the previous build failed
on zero queued worker draws; it is retained as a failed check, not candidate
validation.

One bounded90-second original Node software startup reached the personally
reviewed complete main menu, with299 presents and396974 triangles. No input was
sent. Browser responsiveness, movement/combat and ordinary Quit remain
unproved. The supervised original exited0, with leaked:false. No remote box,
Wine, Python, guard changes, or closed runtime replay was used.

## Absolute source vector load, 2026-11-21

Evidence: `scratch/runs/20261121-quake3-source-direct/`, recovering the
unpublished seven-line operand shortcut from `20261121-quake3-play-recover`.
The predecessor exited by SIGTERM with launcher status1; its closed original
and cleanup receipts were inspected without contacting its endpoint. Its
guest-worker profile has1862 samples in `waitDrained`, while the software
render worker is executing shader/raster functions. This is a rendering cost
problem, not evidence for relaxing native-input freshness requirements.

For an absolute operand whose flags word is exactly zero, the source helper
now loads the selected component vector directly. The address and swizzle
calculation are the same as row0 in the existing helper; no floating-point
operation touches the raw loaded bits. All nonzero flags retain the full row
path, including modifiers, relative gathers and extended constant remapping.
Decoder bounds, matrix row access, worker budgets and input guards are unchanged.
The matched frozen Git modules differ in exactly one code body, the source
helper. A native regression compares5483008 raw lanes across all byte swizzles,
register storage, signed zeros/subnormals/infinities, signed quiet/signaling NaN
payloads, modifiers, relative selectors and bounds. Existing shader331,
address37, loop33, call38, temp-span11 and interpolation16896-lane checks pass.
The literal locked build passes with shared foreign WIP preserved.

Six fresh alternating-order default Node24.18.1/V8 13.6.233.17-node.50 process
pairs replay the retained actual51-record/seven-draw input through the ordinary
JS software Executor. All color/depth hashes and nontiming state match after
each draw. Median paired reduction is7.987%; individual pairs range from
-0.536% to15.212%. All pairs, including the slower pair and the predecessor's
six pairs, are retained. This establishes a default executor computation gain,
not a browser latency guarantee. Matching x64 V8 15.7.57 TurboFan and
SpiderMonkey C158 Ion disassembly shows a direct vector load without the row
helper call on the common path; sizes128→192 and59→112bytes respectively.
Those shell tiers differ from measured Node automatic tiering. No ARM64 claim.

One fresh original loaded the exact candidate module, reached the personally
reviewed full main menu, and accepted Enter with a native USER consumption
receipt and independent key-UP. The next reviewed screen was Choose Level
with Q3DM1 selected. One FIGHT click also has native USER consumption and an
independent mouse-UP receipt. The subsequent capture failed with EEXIST on
`undefined.png`: the worker omitted the post-input image label. This adapter
mistake permanently closed the scope; no later endpoint request or replay
followed. Match entry, movement/firing and ordinary Quit are unproved. This
failure is not a shader regression or proof of a remaining GPU drain stall.
