# Q3 arena indirect-call trap repair — 2026-11-17

Evidence: `scratch/runs/20261117-quake3-arena-indirect-call-trap-repair/` (ignored). The final `result.json` records runtime generations, native checks, selected whole images and lifecycle receipts. No old endpoint was queried or replayed.

## Actual target and trap

The PE slot `0x007bde6c` is initialized from `GetProcAddress("glEnd")` (lookup string `0x004c4ca8`, store `0x0044d9df`); it is not glEndList. Static writer/reset/log-wrapper analysis is retained. The predecessor stopped at `0x004629e8`, but its catch retained only the exception message, so its exact WASM stack cannot be recovered offline.

The one authorized diagnostic original used published `e7c13db296e380130bc6b9771cf3f55970f5c42f` / module `f40fc54c5b0f1d4bd505364049e091c0092cab27eac0dcb644e8623d2344875b`. A failure-only catch observer passed native memory/register/error-identity and negative controls before launch; it introduced no guest slices or lifetime calls. A names-only build has byte-identical noncustom sections to the retained module.

After ordinary menus reached actual Q3DM1, Mouse1 was physically released and host DOWN/UP were dequeued. The original trapped at `0x00462996`, another glEnd call in the same routine. The observer read both the indirect slot and raw import slot as `0x07504d50`; the thunk's API id `2908` is glEnd. The saved WASM stack is `glg_fail -> glg_cpu_prim -> glg_tri -> gl_sw_emit -> gl_period_polygon -> gl_sw_triangle -> gl_sw_draw -> gl_sw_consume_selected -> gl_sw_consume -> gl_packed_finish`. Disassembly at `0x118a4d` identifies the depth-lost call to `glg_fail(20)`, rather than the adjacent stencil guard. The fallback reason was not observed and remains UNKNOWN. Mouse1 timing alone does not establish which API/state caused the fallback.

## Repair and controls

GPU-to-CPU fallback retained colour but marked GPU-owned depth lost. A subsequent depth-tested CPU primitive correctly trapped rather than use stale depth. No later published GL change already repaired this path.

The repair adds `CAP_DEPTH_READBACK` and exact, bounded D16 depth-target READBACK to the software GPS executor. WAT copies acknowledged top-down bands into its CPU depth surface before a fallback primitive tests depth. The lost-depth flag changes only after all bands complete. The existing lost-depth guard remains for consumers without that capability and for D24S8; stencil guards remain intact. No stub, trap bypass, guessed instruction fix, renderer substitution or guard removal is involved.

A native OpenGL scene reproduces unreachable before the change and completes afterward. Focused tests compare GPU-depth/CPU-fallback occlusion and subsequent CPU writes against the all-software picture, test missing-capability rejection, native D16 readback subrect/padding/bounds/kind/format rejection and all 65536 D16 values through native normalized-f32 storage. Existing native D16 rounds while the older GL CPU rasterizer truncates some depth ties; controls use separated depths and do not claim to repair that pre-existing difference.

Final build, publication and affected-original results are recorded in the final evidence result.

## Published change and affected original

Repair commit `337b6205ca38badd68d308f16660e9f80db04ce6` passed the canonical locked build and five focused suites (`test-gl-gps-frames`, `test-gpu-stream-software`, `test-gl-gps-caps`, `test-gl-gps-front-1d`, `test-gl-gps-threads`); strict pull/push both returned zero. The affected original served only that immutable published Git generation, compiled to `4d8036772e86804cfcfa0d41082e9b3a0c6cc8989e44b6686415857bcfd8ef47`. CDP bytecode readbacks on page, guest and renderer matched. Actual endpoint 1 was the software GPS executor.

The affected run reached the visible main menu after ordinary Escape. The next Single Player click became terminal `UNKNOWN_OR_REFUSED_NO_REPLAY`: its DOWN CDP ACK took approximately 887 ms, exceeding the immutable 200 ms hold bound. The independent service still observed physical UP (state zero). Its witness contained Escape dequeue, not native consumption of the refused mouse gesture. No subsequent runtime query, input, replay or replacement original was made. This is an input-timing blocker, not evidence of a new guest trap or proof of arena repair in the affected original.

Ordinary movement, Mouse1 firing, enemy-caused damage/kill and native menu Quit remain UNPROVED. The diagnostic's 124 health is excess-health decay, not enemy damage; its Mouse1 physical UP/dequeue and subsequent native trap do not prove fire. The fresh affected original did not reach the arena. Next work must qualify bounded input delivery under real software-renderer load before any newly authorized affected attempt, retaining ownership/freshness/release/UNKNOWN guards.

Both newly launched local browsers closed normally with close ACK and drained streams. Affected driver/supervisor/outer helper and watchdog have actual wait plus both-EOF receipts; its custodian also completed normally. The diagnostic has driver/watchdog waits and EOF, but its original outer helper wait is UNKNOWN (missing receipt/tool exit 143), not inferred from process absence. Both profiles and task PIDs are absent. No box was created: id null, state NOT_CREATED, expiry null, stop receipt N/A. No service deployment, media/config/save/clock changes, archives or foreign cleanup occurred.
