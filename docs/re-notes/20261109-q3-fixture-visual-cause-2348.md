# Q3 fixture blur matches its intended 8×8 rendering

The retained image matches the generated fixture geometry and default smoothed
publication. No causal production defect was demonstrated. Production code,
shared providers and review guards remain unchanged. No box was allocated and
no fixture input or original arena gameplay was attempted.

Evidence: `scratch/runs/20261109-q3-fixture-visual-cause-2348/`.
The exact starting Git commit is in `git-base.txt`; the small owned patch is
`owned.patch`. Git remains the source archive. Historical sources/media are
referenced by existing paths and authenticated hashes, without source archives.

The separately model-inspected original is
`scratch/runs/20261109-q3-readiness-wire-cause-2335/fixture-startup.png`:
9,633 bytes, SHA-256
`69ebb61ccc6f16cd1c1f44c6d29bbe9b91f99189ca8b1ebba753647a80b275e2`.
Its dimensions are 945×889. The white page surrounds a 320×200 black/red canvas
at image coordinates [8,8) through [328,208). The image contains the expected
coarse red triangular silhouette, with blurred boundaries between large steps.
It remains the image previously refused for continuation; this investigation
does not publish a review gate or reverse that stop.

The exact current generated fixture consumer was composed through
`q3-current-foreign-closure-v1.cjs`, including startup and physical-input
integration. Its fixture-source SHA-256 is
`ebaaa700cc0145e7df997600aafdb4c553c660dc90df1777be3c1dbfbd335384`.
Executing that fixture function with controlled WASM/Worker services records
its actual public x86 thunk calls: the client/window and GL viewport are 8×8;
GL_TRIANGLES receives (-1,-1,0), (1,-1,0), (0,1,0), in solid red over black.
`glFinish`, `SwapBuffers`, bridge drain and a Worker slice follow. The independent
pixel-center coverage calculation produces these top-down source rows:

```text
00000000
00011000
00011000
00111100
00111100
01111110
01111110
11111111
```

The fixture creates `screen` with 320×200 backing dimensions, no CSS size or
transform, and draws the published source layer with
`drawImage(layer.canvas,0,0,320,200)`. It does not disable default canvas image
smoothing. The actual host bridge `_presentFrame` sets the source canvas to the
frame dimensions, replaces its pixels, publishes the layer onto the owning
window, then calls the fixture callback. Controls execute that unchanged host
publication method and verify an 8×8 source, exact target canvas identity,
320×200 destination, and smoothing enabled. Wrong HWND, wrong frame token and
a same-looking replacement window each prevent publication.

Independent bilinear reconstruction enlarges each source pixel by 40 horizontally
and 25 vertically. Of all 64,000 canvas pixels, 63,976 match exactly and 24 differ
by one red-channel value. Every green/blue value is zero and every alpha is 255.
All 776,105 pixels outside the canvas are opaque white. This is quantitative
evidence for expected low-resolution steps and smoothing, rather than a blur
attributed to failed publication or a different screenshot target. Negative
controls reject inverted triangle rows, a corrupted green channel and a shifted
canvas boundary. Native computed CSS, devicePixelRatio and intermediate layer
pixels were not separately retained: DPR=1 is consistent with these pixels,
not an independently observed native value. There is no forced scale/viewport
command on this fixture route; it captures the page rather than a canvas clip.

Native provenance was independently reread and SHA/size verified against the
previous settled inventory. `native-provenance.json` preserves the small selected
records plus original artifact paths/hashes. Readiness producer records keep the
same render target, context, HWND 65537 and endpoint 1 while draws, presented and
writeSeq advance from 1 to 2 and vertices from 3 to 6. Capture request 100 uses
page target `864D14FBC3193C9B07B1102BB14A732C` and session
`DB4E2E0B64496DB11854531A4BE0D26E`; consumer delivery matches that session.
The capture receipt links the PNG hash to unchanged page-canvas, guest and render
identity tokens and the selected CPU/render module SHA
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
These counters are publication observations, not intermediate source pixels.

`tools/q3-fixture-visual.test.cjs` also compiles and executes the actual composed
bound capture consumer, with controlled observation/CDP services. It verifies
one page-session PNG screenshot with unchanged options, returned PNG bytes/hash
and canvas identity, then independently rejects canvas replacement during
capture. No input is emitted. These controls do not execute a native GPU or
replace the separate model review. The existing service's seven review and
eight native-wire revocation controls also pass; no guards were relaxed.
The locked build passes (see `build.log` and `build-wait.json`).

The first concrete blocker is the earlier fixture presentation refusal combined
with the absence of a demonstrated rendering defect supporting a corrected
fixture. The pixels are accounted for by intentional 8×8 geometry and smoothing.
Increasing its resolution or changing its display filter would change that
fixture contract; neither is a demonstrated repair. Therefore the conditional
corrected-fixture allocation prerequisite is false. Missing native computed
DPR/CSS and intermediate frame pixels remain explicit limits, not reasons to
repeat live timeout work. A future task would need an explicitly specified
visually reviewable fixture contract and qualification before gameplay.
Request 347 was not reinvestigated. No movement, fire or alive-arena claim.

No runtime was created: box ID/state/expiry/watchdog/stop receipt are all N/A.
The prior archived box was left untouched. This single task ends after publishing
the tested controls and this finding, and releasing all owned paths.
