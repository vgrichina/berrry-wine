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
