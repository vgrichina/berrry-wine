# Native16 roof-edge regression cause (2026-11-11)

The retained `65535 != 0` in
`scratch/runs/20261110-mw3-native16-loaded-poll-repair-0040/edge-baseline.log`
is a fixture defect, not evidence of a native16 rasterizer regression.
Its `edge-baseline.cjs` substituted exactly
`e18abd22148cbd9fc02d033ef64a59ea27c6674f:lib/d3dim-gpu.js`.
The original edge test was an untracked file, not part of that Git revision.
Its exact original contents are recoverable from `original-edge.patch` in
`scratch/runs/20261111-native16-roof-edge-raster-cause-0310/`.

## Causal replay

The original hand-built descriptor initialized only words 0–33. Texture-stage
selectors at words 41–44 remained zero: both color arguments were DIFFUSE,
and both alpha arguments were DIFFUSE. The adapter's compatibility lowering
of the zero operation values selects MODULATE. White diffuse multiplied by
white diffuse produces white with alpha one, regardless of the uploaded
black/transparent texture. The draw succeeds and the target stays `0xffff`.
This is consistent with the supplied state, not the test's intended state.

Fresh local replays retained the same failing rows on exact e18 and main
2c9d134a37e75e702f2ce1dffdf45a4e3a91659d. Changing **only words 41 and 43 to
TEXTURE (2)** makes exact e18 pass: rows at x=1 become
`[0,65535,65535,65535,65535,65535,65535,65535]`. No vertex, filter, blend,
quantization, shader or rasterization change is needed. The large opaque
native16 optimization is ineligible for this two-triangle blended draw.
No renderer source was changed for this repair.

## Contract and exact geometry

Microsoft's [rasterization rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/rasterization-rules)
place legacy pixel centers at integers and use top-left ownership. For the
square with vertices (0,0), (4,0), (4,4), (0,4), the covered integer samples
are x,y in {0,1,2,3}. The right/bottom samples at 4 are excluded. Translation
by (2,2) produces samples {2,3,4,5}; the test checks all 64 target pixels.
Both diagonals partition the same square and must blend a shared-edge sample
once. These bounded axis-aligned tests do not establish exact coverage for
arbitrary subpixel/sliver triangles.

With authored U=(x+.5)/4, V=(y+.5)/4, integer samples land at texel centers.
[Point sampling](https://learn.microsoft.com/en-us/windows/win32/direct3d9/nearest-point-sampling)
selects row y of the four-row texture. A wrongly included bottom sample
would have V=1.125, wrap to row zero, and paint the roof below its tile.
The new test explicitly selects point filtering and wrapping via public API.

[MODULATE](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop)
multiplies the selected arguments. The repaired fixture sets TEXTURE and
DIFFUSE for both color and alpha via SetTextureStageState7, and verifies
GetTextureStageState7. [SRCALPHA/INVSRCALPHA](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dblend)
apply the source alpha and its complement to all four channels. The expected
RGBA is S*As + D*(1-As), with a white destination. Transparent rows preserve
the destination; opaque black row zero replaces it. Colored roof alpha
85/170 discriminates absent selectors and double blending.

Native16 storage uses the declared masks and existing high-component-bit
contract, independently encoded in the test; expansion uses bit replication.
The oracle requires floor/ceil byte rounding to produce the same native
pixel. It does not claim a universal historical hardware quantization rule.
The retained DX6.1 primary-topic reference remains
`scratch/runs/run20261105-legacy-alpha16-target/primary-contract.json`
(CHM SHA256 ade41d4cac0d000629ef5035827f4c6439dd360bc619b6832b33c53f27379c32).
Its Microsoft-authored pixel-mask and blend topics agree with these equations;
original distribution authenticity is unestablished. X8R8G8B8's unused high
byte is retained as evidence and excluded from component equality.

## Regression

`test/test-d3dim-gpu-edge-web.js` now uses ordinary x86 COM factories,
Surface7 creation/Lock/Unlock, Device7 state and DrawPrimitive7, through the
compiled production modules and existing real Worker harness. There are no
fake exports, fabricated descriptors or guest game edits. Both shipped modules,
software/direct WebGL/owning render Worker, and R5G6B5, X1R5G5B5, A1R5G5B5,
A4R4G4B4 and X8R8G8B8 are checked. Each route runs 12 tile cases: alpha
0/85/170/255, both diagonals, and an offset tile. All native16 stored words
and decoded RGBA components must agree exactly across routes and modules.
A public diffuse-only negative control must reach a successful draw and fail
the independent pixel oracle.

Evidence, source patches, primary-source links, exact module hashes, subprocess
waits and separate stream EOF observations are retained in the assigned 0310
run. This is a renderer semantic regression, not a new original-game result.

The existing native16 suites passed 96 full/bounded snapshots and 128 snapshots
against exact e18 (WebGL1/2, four native formats, ordered/grouped streams and
real GL errors). Bounded readback, Device7 Load/defaults, depthless drawing,
fallback counters and texture wrapping also passed. The unchanged broader
`test-d3dim-surface-fence.js` fails at its replacement assertion: its private
SetSurfaceDesc fixture zeroes the descriptor including dwSize. The handler
rejects that input before fencing. A retained in-memory diagnostic setting
dwSize to the native interface's required size passes the entire test, with
the expected old-backing fence and successful replacement. The handler and
test are unchanged between e18 and this task. That separate fixture remains
unmodified and is not counted as a passing unmodified test.
