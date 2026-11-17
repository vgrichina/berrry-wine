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

The single authorized original ran with the published host/renderer JavaScript
served from Git in memory and the locked-build module pinned by SHA-256. It
loaded all 36 configured files and created `ConanDemo`; selected wholeimages
remained black while the native completed-slice sequence advanced to 8221.
No game input was sent and no first-failure snapshot fired. The cause of this
startup boundary is unknown. Free disk fell to 693,399,552 bytes, below the
owner's 1,500,000,000-byte floor, so the session was closed normally. Chrome
and the driver exited 0, both pipe EOFs were recorded, and the disposable
profile was removed. A pending capture completed before that close; it did
not time out. There was no original retry.

Public native software raster tests confirm that finite collapsed SOLID
triangle lists, strips and fans with lighting disabled change zero color
pixels. A noncollapsed triangle and a collapsed point draw still change
pixels. These tests use `Present` and `LockRect` readback. They do not settle
lit singular-normal behavior or prove a safe optimization with depth,
stencil, queries, malformed inputs and resource lifetimes. A generated native
x86 browser control passed those same five fenced pixel checks on the WebGL
executor (SwiftShader); its title changed to `NATIVE RASTER PASS` only after
all checks. Chrome and its driver exited normally with actual waits/EOFs.
An initial generated fixture overlapped an import descriptor with its status
string and failed PE loading; correcting its own data addresses made the
software and browser controls pass. This was a test-input error.

Current Conan topology/count, fill, shader/blend/tween/point state, matrices,
clip/viewport and source/lifetime generation at its first failing draw remain
missing. No raster correction or post-fix original is justified by this run.
Player movement, a second visible gameplay response and native Quit remain
unverified. The next investigation needs that current boundary and its
identity, rather than assumptions from the historical draw.

The earlier CPU first-store observer remains disabled and rejected; its cost
benchmark was not repeated. Historical triangle-list/WORLD evidence does not
establish the missing fill, blend or shader state. No singular suppression or
degenerate draw optimization has been introduced.

Evidence: `scratch/runs/20261117-conan-current-draw-state-raster-semantics-gameplay/`.
Its final `result.json` records exact source/module/media identity, selected
wholeimages, observer limitations, actual waits and current gameplay outcome.
