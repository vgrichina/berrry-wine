# Native D3D9 COM software pixels, 2026-11-01

At main `a1c43c412f2406bb58081ad4fa654b36b2973af3`, the existing
`timeout 120s node test/test-d3d9-software-bridge.js` passed in **18.422 seconds**.
Evidence is in `scratch/runs/20261101-d3d9-com-software-pixels/`.
The test exercises real D3D9 COM methods through the shared command queue and
native WAT software renderer to canonical Present pixel assertions. Its output
reports programmable/fixed/mixed stages, independent constants and rebinding,
XYZ/POSITIONT, strips/fans, alpha tests/defaults/reference snapshots, blending
and directional lighting state. This complements the direct Device lighting
fixture; no new test or implementation was needed.

The retained before/after inventory of 273 lib/src/test/host paths matched.
These hashes are a scoped inventory, not an exhaustive compiler-read trace or
an assertion about every repository input. Free disk before/after was
2,070,155,264 / 2,070,110,208 bytes; intermediate disk history was not measured.
The timeout command returned zero and the test process is terminal. No game,
browser, DOM, WebGL, remote box, or public deployment was involved.
This proves the existing fixture assertions, not Windows game gameplay, GPU
coverage, all historical 27 applications, FPS, audio, or crash freedom.
