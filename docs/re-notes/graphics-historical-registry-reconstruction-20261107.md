# Historical graphics registry reconstruction, 2026-11-07

The original September 22 registry and scanner are recoverable from Git commit
`2d722ab3766c288d13796ed9dad3f1ceeca8f1eb`: `lib/apps.js` and
`tools/gfx-app-census.js`. Evaluating those exact sources against the current
binary files yields 28 OpenGL/Direct3D candidates among 225 registry entries.
The original commit reports 27. Historical membership therefore remains open.

Evidence and the reproducible command are in
`scratch/runs/20261107-historical-graphics-reconstruction/`: run
`node scratch/runs/20261107-historical-graphics-reconstruction/reconstruct.cjs`
from the repository root. Its JSON records both source hashes and each current
input's path, byte length and SHA-256. No guest or browser executes.

Current-file family totals are DirectDraw 87, D3DRM 10, D3DIM 9, D3D8 7,
D3D9 2 and OpenGL 8. Counts overlap. Four historical entries have missing
files: `atomic_bomberman_demo`, `quake2_demo_installer`,
`diablo2_demo_installer` and `halflife_uplink_installer`.

These are provisional candidates for locating existing evidence, with
DirectDraw omitted from the family column:

| Historical registry ID | Current-file static reach |
| --- | --- |
| generally | d3d8 |
| arcanum_demo | d3dim |
| ut2003_demo | d3d8 |
| ut2003_demo_server | d3d8 |
| ut2004_demo | d3d8 |
| icewind_dale_demo | gl |
| baldurs_gate_chapters_1_2_demo | gl |
| morrowind | d3d8 |
| simgolf_demo | gl |
| black_white_2_demo | d3d9 |
| quake2_demo | gl |
| halflife_uplink | gl |
| warcraft3_demo | d3d8, gl |
| pawn | d3d9 |
| tworld | gl |
| winamp | d3d8 |
| mcm | d3drm |
| ptct | gl |
| dx_globe | d3drm |
| dx_viewer | d3drm |
| dx_flip3dtl | d3dim |
| scr_architec | d3drm, d3dim |
| scr_fallingl | d3drm, d3dim |
| scr_geometry | d3drm, d3dim |
| scr_jazz | d3drm, d3dim |
| scr_oasaver | d3drm, d3dim |
| scr_rockroll | d3drm, d3dim |
| scr_scifi | d3drm, d3dim |

This comparison cannot identify which current file differs from the original
corpus. Recover the original census stdout or a historical binary inventory
before assigning exact historical membership. Static names also do not prove
that an application's selected runtime renderer uses that API. This result
adds no gameplay, rendering correctness, FPS, parity or crash coverage.
