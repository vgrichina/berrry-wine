# Boids GPU/GDI publication ownership, 2026-11-17

Diagnostic only: no production repair or sustained original motion is claimed.
The incoming GPU retirement/compositor changes do not resolve the authored
ownership witness. The same sequence reproduces on reconciled, published main
`9025b309fa5b68ee5f48cd07cc6fb3fbae03fdc4`, with native module SHA-256
`33ef36c2de1c86ca1302b5659f02bb48f1794dfc4e20945821251198f04cb03e`.
Evidence is `scratch/runs/20261117-boids-gpu-gdi-publication-owner/result.json`.

The new PE extends the retained Device2 RGB16/D16 indexed-draw fixture. Real
clocks alternate GPU blue, GDI red, GPU black and GDI green every two seconds.
A second variant paints through an actual registered guest WndProc,
InvalidateRect, PeekMessage/DispatchMessage and BeginPaint/EndPaint. It never
uses UpdateWindow or forces a host flush, repaint, idle, guest step, input or
pause change. Original EXE bytes are not modified and no original is launched.

At completed ordinary publication the observer records exact window/instance,
canonical presentation identity/version, GDI and GPU write sequences, selected
layer identity, bitmap closure and the actual complete source pixels. Write
call stacks distinguish guest GDI uploads from DirectDraw signature polling.
The full-pixel oracle compares every one of 307,200 source pixels with literal
blue/black rectangles, solid red/green, and white-clear references. It explicitly
distinguishes the retained half-pixel raster convention from the incoming
integer convention; the upstream subpixel change is not called an ownership
failure. The two selected complete captures also pass all 1,185,280 output
pixels, including scaling and letterboxing. They show white, not a repaired
scene. Pixel agreement alone does not establish that the right writer won.

Two natural divergences are now joined within the same completed composition:

* In `reconciled-sequence`, publication 8 selects GPU blue at layer write 3
  while the window's canonical presentation version 3 contains solid red at
  GDI write 4. The accepted GPU layer reports non-stale. The WM_PAINT variant
  independently reproduces this at publication 10: red version 4/write 7,
  older blue GPU write 6, same window 65537/process 1000/instance. All source
  pixels match blue rather than the later authored red write.
* In `incoming-causal`, publication 10 shows a completely white DIB layer at
  write 8 after an accepted blue GPU frame at write 7. No intervening GDI
  upload replaced that frame: GDI remains write 1. The write-8 stack is
  `_presentDxSurfaceToMainWindow` → `presentIfChanged` →
  `_presentBestDxOffscreen` → `WineAssembly._presentDxIfDirty`. Reconciled main
  and its WM_PAINT variant retain the same white/old-blue DIB fallback outcomes
  between valid blue/black GPU frames. These are actual composed pixels, not
  an inference from draw counters or opaque frame receipts.

The next production boundary is the exact relationship between a GPU-owned
DirectDraw primary's DIB and window-DC GDI writes. In `lib/host-imports.js`,
`_presentBestDxOffscreen` checks the legacy parked-slot export, then signature
polls a primary DIB even when GPU-stream Flip owns its current pixels. In
`src/09abg-d3dim-gps.wat`, Flip swaps the DIB identities and presents the GPU
target; the fallback needs authoritative ownership for that exact surface and
allocation lifetime, including CPU materialization and real later CPU writes.
Separately, `lib/renderer.js::_overlayFrameLayer` does not retire/merge a D3DIM
GPU layer on a later window-GDI upload; its D3DIM stale closure tracks the CPU
DirectDraw present sequence rather than that GDI write. A blanket sequence test
or blanket suppression of DIB fallback would not prove partial-GDI composition,
retained CPU Lock writes, same-address reuse or source retirement correct.
No such partial fix was installed.

The original's earlier changing opaque GPU frames remain valid evidence from
the Device2 localization run. These authored divergences do not prove which
writer supplied its retained Paused screenshots. The optional passive-original
diagnostic and conditional repaired-original run remain unconsumed in this
task; no missing fact required spending them to establish this boundary.

All five authored browser runs used the actual guest Worker/renderWorker
WebGL1 route and reported ANGLE/Intel Mesa, despite the requested launch flags.
They completed normal browser shutdown, actual supervisor/watchdog waits of
zero and no remaining owned runtime processes. Nine native capture-owner
refusal controls pass per run. They do not constitute the requested future
repair's complete native same-address/source-mismatch/context-loss suite.
The focused observer/oracle tests, 23 capture/decoder regressions, lit-alpha
regression and Node doorbell same-address retirement test pass. The last is
notification-lifetime coverage only. The canonical flock build passes with an
explicit subprocess wait; its shared-tree module differs from the immutable
Git-only native module because foreign overlays remain uncommitted. The earlier
build log completed, but its tool wait returned 143 and is not the qualifying
build. A mistyped alpha-test path failed before the correct test passed.

No box, worker, source archive or public deployment was created. Source recovery
uses exact Git commits, binary diffs, new-file patches and observer suffixes;
media is referenced by existing path and SHA-256. Selected images and all actual
waits are retained. Publication details and remaining limitations are recorded
in result.json. The worker releases its owned diagnostic files after publication.
