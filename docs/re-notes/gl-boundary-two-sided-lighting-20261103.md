# Boundary polygon two-sided lighting — 2026-11-03

Input: `dec894a67309d7fd279782d04f8dc0ff6b9c1c1b`. Evidence:
`scratch/runs/20261103-gl-boundary-two-sided-lighting/` (ignored).
This is native GL API-family coverage; it does not establish historical27
completion or original-game coverage.

Intact boundary polygons exposed inconsistent face selection. Before clipping,
`gl_edge_polygon` selected the lighting face using only vertices 0, 1 and 2.
After clipping, `gl_period_polygon` selected culling and polygon mode using
`gl_edge_face_area`, which searches the fan for a nonzero triangle. A valid
convex polygon with three collinear leading vertices therefore used zero area
for lighting while retaining a visible, correctly classified boundary. The
unmodified native software and actual Worker each fail 36 lighting checks;
the cyclically rotated equivalents select the expected material. Both WebGL
versions already select the clipped polygon's face correctly.

The implementation changes only the native lighting orientation query to
`gl_edge_face_area(a, n)`. Original-vertex lighting still precedes clipping.
The record layout, outgoing edge flags, clipping, provoking-vertex selection,
exact color transport and raster lowering remain on their existing paths.
No epsilon is added to the face-area search.

## Orientation and color oracles

The orthographic fixture is a rectangle with an extra midpoint on its first
edge. Its first fan triangle has area zero; its next homogeneous determinant
is positive (0.25 with the test projection). The depth-clipped fixture lies
on `z = x/8 - 2`; near clipping leaves `8 <= x <= 24`, with nonzero visible
area and positive orientation. Reversing the order changes the sign;
changing `glFrontFace` exchanges the front/back interpretation.

The perspective fixture is considered separately. Its planar eye-space
vertices are `(-2,-.5,1)`, `(-1,-.5,0)`, `(2,-.5,-3)`, `(2,.5,-3)` and
`(-2,.5,1)`. The frustum has near 1, far 10 and symmetric unit extents, so
`X=x`, `Y=y`, `W=-z=x+1`. The first two W values are -1 and 0; dividing the
original vertices cannot determine the visible winding. The first fan
determinant is zero and the next is +4. Near clipping leaves `x >= 0`:
the visible projected polygon has corners `(0,-.5)`, `(2/3,-1/6)`,
`(2/3,1/6)`, `(0,.5)`, whose signed shoelace sum is +8/9. It is therefore
CCW, including after clipping. A triangle divided before clipping would have
a negative W product and misleading opposite sign. The existing homogeneous
area helper preserves the correct sign; the repair does not introduce a
negative-W division or a new perspective policy.

Each fixture is exercised in LINE and POINT, both windings, both front-face
settings, three lighting configurations, and two cyclic starts: 144 draws per
backend. Front emission is RGB `(64,0,0)` and back emission `(0,0,128)` in byte
units. With ambient/specular zero and normal `(.6,0,.8)`, a +Z directional
light adds green 102 only on the front; a -Z light adds green 51 only on the
back after normal reversal. The zero-light configuration isolates material
selection. Every colored pixel must match the derived RGB within one byte,
and every draw must contain visible pixels. Cyclic starts compare pixel masks
within eight fragments for endpoint roundoff, separately for each winding.
The test logs retain the actual differences and RGB histograms.

The native suite invokes resolved opengl32 API thunks with existing stdcall,
stack and register canaries. The actual Worker must queue work and report zero
fallback. Browser replay uses captured immutable native records on actual
WebGL1 and WebGL2. All preexisting edge-flag assertions remain. Whole-image
readback fences once before reading pixels, avoiding redundant per-pixel
Worker fences.

Final validation: the locked full build passes. Native software and the actual
Worker each pass all 144 new lighting draws plus every existing edge assertion;
the Worker queues 168 draws with zero fallback. Actual WebGL1 and WebGL2 each
pass 144 new lighting draws and all 22 existing pixel cases with GL error zero.
Every measured cyclic pixel-mask difference is zero, on control and candidate.
The final control restores the complete original raster file through the test
compiler mutation hook; its module hash exactly matches the original module:
`a63a0181b7d855a83ea64511416667c100c1d0f4c882a3ecd35ebd825322b239`.
It fails 12 lighting checks per fixture on each native route; WebGL remains
correct. The passing native/Worker harness module is
`31a1c09b5a90b52afe09709ce425b72c2775e291ca911a45e7151b876982c07a`.

All 21 focused regression invocations pass: WGL resolver inventory, client
arrays, WC3 interleaved arrays, stipple direct/Worker/explicit fallback/WebGL,
period server state direct/Worker/WebGL, context copy direct/Worker/WebGL,
interleaved direct/Worker/WebGL, integer-color native handlers, exact color
priority direct/Worker/WebGL, and user clip planes. The context-copy and period
browser tests use explicit captures and boat-only destination symlinks into
this run. These results come from this candidate's executions, not earlier runs.
The final source seal verifies all 5,829 runtime/build/test inputs against the
pinned commit plus the three owned code/test files. Canonical build module:
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`.

## Reproduction and lifecycle

On a separately authorized finite-TTL boat, restore the pinned input plus the
owned patch, run `npm ci --omit=optional`, then:

```
flock /tmp/wine-build.lock bash tools/build.sh
GL_EDGE_CAPTURE=cases.json node test/test-gl-edge-flag.js
node test/test-gl-edge-flag.js --worker
GL_EDGE_CASES=cases.json node test/test-gl-edge-flag-web.js
```

The evidence includes a source seal, the tested modules, control/candidate
logs, pixel captures, focused regression results and recovery instructions.
The first background build was interrupted by a 20-second command timeout;
its partial log is retained and is not counted as a pass. The final sequence
uses a synchronous bounded command. An initial expanded Worker harness also
exhausted the queue with per-pixel fences; the final control and candidate use
one fence per readback.

The fresh boat is `bx_qpcmhett`, original expiry
`2026-11-03T17:07:04.681Z` (TTL 5400 seconds). Identity, expiry and this worker's
explicitly delegated normal STOP were recorded before use in `lifecycle.json`
and the messageboard. All heavy builds, native tests and browsers run there.
Recovery must complete and every retained payload must pass SHA-256 roundtrip
verification before normal STOP; final lifecycle receipts belong in the run.
