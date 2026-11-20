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
