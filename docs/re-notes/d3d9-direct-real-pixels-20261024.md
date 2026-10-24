# D3D9 direct real WebGL pixels, 2026-10-24

One accepted browser invocation completed successfully at 09:14:35 UTC. Candidate passes all 56 checks. Both historical regressions and the rectangle mutation are rejected by real readPixels observations.

| Variant | Passed | Failed | Pixels observed | Mismatched pixels |
|---|---:|---:|---:|---:|
| candidate | 56 | 0 | 3200 | 0 |
| producer historical Device | 55 | 1 | 3200 | 64 |
| intermediate historical GPU | 50 | 6 | 3200 | 384 |
| reject-rectangles mutation | 49 | 7 | 3200 | 363 |

Each variant includes 50 pixel checks and six additional checks. Full numeric checks, first mismatched RGBA coordinates, source hashes, browser identity, PNGs and sealed manifest are in [the evidence directory](d3d9-direct-real-pixels-20261024-evidence/numeric-outcomes.json). All 40 tiny PNGs were inspected with the image tool. Candidate shows clipped color/depth/stencil regions, green default-one and stencil-52 observations, and blue quarter-depth rejects. Producer default-one stays blue; intermediate named depth cases become green and implicit stencil-52 becomes blue; rectangle mutation fills entire regions. Numeric evidence determines acceptance.

Executed exactly once:

```sh
python3 /tmp/d3d9-oracle-fixes-independent-integrate-oct24/repo/tools/test-d3d9-clear-real-browser.py /tmp/d3d9px25/run /tmp/d3d9px25/accounting.json
```

Accepted standing source HEAD is `0e927b73b64b29931f83d1e9ed77282c5b1bf731`. No harness checkout or source modification preceded execution. Fixture SHA256 `d16a5ea580ae07c9ecb93c6b1a96c611fbf1b1fc2281648fad8f9853e0c880bf`; CDP `02b46f68aec14728cf48b7649ed6fcd01c28f15085ccf7aafc7bc9d354fe3e17`; supervisor `0ba39ab43709b4da749f92dc2250494976d37b9825db71b2f4f7fb2f531de54e` (unchanged coordinator-accepted bindings). Runtime source hashes are retained per variant. Producer Device comes from `ffe822a9d50ad79439330609915eb84475acd2bc:lib/d3d9-backend.js`, SHA256 `9ffb72da84b68d2b44879142f79651a9bbd3167ccc42cbddacf94add172a62d1`; intermediate GPU from `77180c76b312efe465ad91e60286d40330d77d0d:lib/gpu-backend.js`, SHA256 `5b02eb42dd21e02f0dc01bea589a121456e28fcf1dbcf42b5a647efa5181d1dd`. Producer fails wrapper-default-one-after-quarter; intermediate fails six fresh/retained named-depth and implicit-stencil observations. Rectangle mutation fails seven clipping/retention/empty-region checks. No offline acceptance rerun or speculative fix.

Chrome 151.0.7922.108, Node v24.18.1, real WebGL2 reports ANGLE Intel Mesa UHD Graphics 620 (KBL GT2), OpenGL 4.6 Mesa 23.2.1. Scope is production Device/GPU allocation and descriptor clear calls with direct GLSL observation. This does not qualify guest/COM/full-module/gameplay behavior or broader hardware support.

Admission passed: MemAvailable 3299536896 >= 2684354560; projected task bytes 43024384 <= 67108864 including retained prior allocation/history, positive SQLite growth, 12 MiB browser projection, 16 MiB future and 8 MiB reserve. Free before was 3707076608. Browser elapsed 2.952 seconds, aggregate CPU 1.911436 seconds, peak owned 9211975 bytes; exit 0 and descendantsRemaining empty. No --no-sandbox flag, install, copied tools or sandbox bypass. Renderer security samples are empty: per-renderer NoNewPrivs/Seccomp was not observed and is not claimed verified. Accepted supervisor handled TERM/reaping; own board watcher was terminated and reaped with exit 143. Original Chrome profile/run artifacts remain under `/tmp/d3d9px25/run`; portable PNGs and receipts are committed here. Prior capture charge 1125240 and all original histories/receipts remain retained; cumulative capture allowance is 2173816. Final resource/capture measurements accompany this note.

Publication uses a fresh noncone sparse Git repository with read-only alternates and exact parent `6968d343c11c5855a2ce7f315fb378c5904ced5f`. Initial alternates omitted that parent's own object directory; adding the exact prior owned Git object store resolved the missing object without donor changes. Git warning stderr remains separately retained, never hashed as blob bytes. Root tracked files/index/refs and all standing donors were unchanged; only append-only messageboard updates were made. No guest/mount argv or box is assigned: box ID/state/expiry N/A. Coordinator retains lifecycle ownership and serial integration; no main merge or public deployment.
