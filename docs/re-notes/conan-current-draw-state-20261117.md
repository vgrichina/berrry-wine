# Conan current draw-state investigation, 2026-11-17

The first generated native browser control found an earlier integration failure:
`CreateDevice` opens a `d3d9-gps` GPU-stream endpoint, but the shared render
worker's API routing set omitted that name. Its factory threw `unknown render
API d3d9-gps` before the generated draw could run. Registering this existing
frontend with the existing generic GPU-stream adapter fixes that routing error.
No shader, matrix, raster, API validation or draw-retirement behavior changes.

The shared-worker regression opens the D3D9 endpoint, sends a command, verifies
reuse of the GPU-stream dependency closure, checks scoped failure, and closes
it. With the old routing set this regression fails with the same error as the
actual browser; with the registration it passes. The canonical locked build
passed before publication. The generated real-browser control and any
subsequent original evidence are recorded separately in the run below.

The generated native CLI control creates two actual devices and reaches decline
28 on the second device's collapsed WORLD transform. A bounded failure-only
`log_i32` reader selects that device from its native stack frame and descriptor.
SHA-256 of the entire shared memory before and after the reader agrees. This
does not prove a raster defect: allocation generation is not stored in this
snapshot, and the complete current original draw has not yet been recovered.

The earlier CPU first-store observer remains disabled and rejected; its cost
benchmark was not repeated. Historical triangle-list/WORLD evidence does not
establish the missing fill, blend or shader state. No singular suppression or
degenerate draw optimization has been introduced.

Evidence: `scratch/runs/20261117-conan-current-draw-state-raster-semantics-gameplay/`.
Its final `result.json` records exact source/module/media identity, selected
wholeimages, observer limitations, actual waits and current gameplay outcome.
