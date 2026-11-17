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
