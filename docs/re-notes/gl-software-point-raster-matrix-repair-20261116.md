# Software GL point raster contract and primitive matrix

Run: `scratch/runs/20261116-gl-software-point-raster-matrix-repair/`.
Status: point failure independently reproduced and repaired in uncommitted WIP;
publication is blocked by additional actual failures on the merged base.

## Diagnosis before intervention

The retained eight-file recovery patch has SHA-256
`9217e0e1d1ee7a23eded5fb629c8cadd682f055628a66f5df9b3fae8d9afa358`.
All seven unchanged inherited paths matched their predecessor pins at admission.
The merged GL state retained precisely the inherited shade-mask hunk on its new
base. Sims and GTA2 final releases, artifact hashes, direct waits with both EOFs,
current PID/group/session absence, both locks and free disk were personally
verified before claiming existing source or executing a helper/build/runtime.
Relevant source is recoverable from exact Git SHAs and binary patches; foreign
WIP is not adopted. No source tree, WASM, media or capture archive is retained.

The independent reference uses system EGL/OpenGL, receives draw parameters only,
rejects expected-pixel fields, and reads the complete drawable. Its actual
llvmpipe frame lights only (0,7) for (-0.875,-0.875,0) in an 8×8 drawable.
The original direct WAT and actual browser software frame instead light (1,7).
Both load the same module SHA
`07c020860c6e7d500c06b99ba1053d52c23478c22a7f60f64fcb0eba941b879b`.
The browser produced six successive clear colours at the required sample and
failed its pixel assertion, without permanent UNKNOWN. Complete pixel witnesses,
module hashes and the two changed browser pixels are in
`baseline-three-witness.json`; the selected full screenshot is
`baseline-browser.failure.png`.

The cause is the point path's reuse of rounded line/polygon screen coordinates.
`gl_sw_coord` rounds window 0.5 to 1. That coordinate does not describe the pixel
covered by an aliased size-one point. The old square offset also mishandles odd
and even widths and top-down Y indexing.

## Independent contract and driver limits

[OpenGL 2.1](https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf), sections
2.11.1, 2.12 and 3.3.1, supplies the contract. For rounded positive width `n`,
`bias = n % 2 ? 0 : 0.5`; the square's bottom-up origin is
`floor(window + bias) - floor(n/2)` on each axis. Its top-down first row is
`drawableHeight - (bottom + n)`. Homogeneous clipping tests the point center
before enlargement. The viewport maps coordinates; drawable bounds and scissor
limit writes. Scissor translation follows conversion using the full target
height. An explicitly zero-size viewport remains distinct from the default.

The 41 literal complete-frame expectations were authored before intervention.
Their case block remains byte-identical to the preserved v6 patch, verified by
`unchanged-literal-contract.json`. A separate formula checks those literals and
two negative controls reject displacement and extra fragments. Runtime checks
compare every pixel and exact black/white RGBA, retained state and GL errors.
Coverage includes half-pixel neighbors, integer/negative positions, clip planes,
positive/zero/negative W, small positive W, viewport offsets and zero dimensions,
rejected negative dimensions, odd/even/fractional sizes, rejected nonpositive
sizes, scissor and enlarged squares crossing viewport/drawable boundaries.

The native drivers are independent witnesses, not an interchangeable specification.
llvmpipe matches 34/41 literal frames; its four just-outside side-plane points
spill into the drawable, zero-size viewports draw nothing, and an enlarged point
is cropped to the viewport. A second system softpipe reference matches 30/41;
its different integer/edge/width behavior is retained too. Exact differences and
renderer/version identities are in `native-driver-contract-differences.json`.
None of the 41 literals was changed to fit either driver. The reported failure
is independently unambiguous in both references. A separate 64×64 llvmpipe
reference proves the old integer point (10,20) belongs at top-down (10,43).

## Implementation and fixture contracts

The clean raster path now computes point coverage from unrounded homogeneous
coordinates while retaining the existing shared line/polygon projection. It
clips point centers against side and user planes, permits positive projective W
without an arbitrary 0.0001 cutoff, and preserves explicitly zero-size viewports.
The shared positive point/line width validator now reports GL_INVALID_VALUE
before observers or transport can alter retained state. Point-only legacy test
rows were corrected after independent native proof; line, polygon, indexed and
private-context error oracles remain intact.

The inherited GL_LIGHTING_BIT-only shade restore and yielding nested watchdog
startup remain. The startup deadline is still the original absolute 3000 ms,
with terminal/deadline checks before readiness and real stop acknowledgement.

The coordinator's published G1/G2 merge changed two older fixture assumptions.
An actual first full browser run proved GL_RED_BITS completes natively (0.72 ms,
no backend packet), so fixtures now assert immediate native output and no query
packet. Real glReadPixels retains its delayed backend-output barrier. The
physical Worker fixture also verifies G2's separate geometry flush, staging
pointer and four returned bytes before the next guest instruction, preserving
its delayed blocking and reuse checks. WebGL's original 14 leased batches,
zero copies, FIFO, two credits, retirement and partial-fault assertions remain.

## Actual remaining failures

The fresh full encoder command fails before comparing WAT bytes. Its legacy
contextless texture-query fixture expects a host query to write 0.25, but the
reference imports the published G1 barrier set, which no longer forwards that
query. The caller buffer remains -1. The published WAT contract also explicitly
consumes contextless texture queries without forwarding or writing. This exact
failure is retained for both source views in `incompatible-query-contract.json`.
The full encoder assertion, private-context/error oracles and query wire contract
were not weakened or changed to force a pass. An independent-reference migration
for the merged G1/G2 semantics remains necessary for full encoder qualification.

Both source views' browser matrices exercised all 26 cases using the original sequence up
to its first failure and fresh selected-case endpoints for the remaining cases.
Twenty-four pass. Software mode 6, scenario 16, fails only in its three flat
frames: sample (0,7) is red rather than white. A separate system EGL/OpenGL
colored-fan reference, receiving no expected pixels, reads all 64 RGBA pixels
and independently confirms white. `independent-fan-blocker.json` retains this
proof. Software mode 10, scenario 24, also fails: the left boundary sample and
(0,7) retain all six clear colors, while the top edge is white. A separate
independent native edge-flag quad reads all 64 pixels in smooth and flat modes:
both required left samples and the top sample are white; the suppressed right
edge and absent diagonal are clear. Its edge-flag oracle remains unchanged.
These are actual pixel assertions, not UNKNOWN.
The triangle and line raster paths remain unchanged; a point-only coordinate
repair cannot qualify these distinct raster contracts. No unchanged failed
endpoint is retried and no assertion is suppressed.

`--primitive-mode=N` selects one primitive on both backends for a fresh diagnostic
run. It retains every original assertion, records its narrower scope and requires
both selected scenarios to finish; failure remains a nonzero exit. It does not
turn the interrupted 26-case run into a pass.

Detailed fresh shared and HEAD-plus-whole-owned results and remaining failures
are recorded in the run's final `result.json`. Historical predecessor passes do
not qualify this base. All implementation WIP remains uncommitted while required
checks fail; the inherited eight-file patch and final recovery patch/pins retain
the complete owned change without adopting foreign edits.

Fresh qualification passed the physical delayed Worker, 15 other inherited
focused commands, native public normal/compatibility (664 calls and 36
observations per module per view), all 41 point frames on both modules in both
views, the unchanged line/polygon/projective/texture/user-clip and bitmap-storage
controls, seven physical Node watchdog controls and eight browser watchdog
controls per view. The ten separately selectable encoder sections also all
passed: primitive, state, arrays, pressure, context, isolation, hardening,
errors, boundary and pool. This does not bypass the failed full encoder command.

An additional published native-state probe reaches a different stale assertion
at `test/test-opengl-getdoublev-native-state.js:235`: it requires
`wglGetProcAddress("glMap1d") == 0`, but the current published API/dispatch now
provides the evaluator and returns a nonzero thunk. Both direct source views
retain that exact failure. Its queued variant was not run after the direct
failure; no pass is inferred. Neither that test nor the API contract was altered.
No original games, input, hardware, gameplay/FPS/audio or full-27 coverage is
claimed. Native reference renderers are llvmpipe/softpipe; browser WebGL is
explicitly ANGLE_SWIFTSHADER. No Codex workers or boxes are created.

Follow-up: [fan, edge and query contract repair](gl-fan-edge-query-contract-repair-20261116.md)
preserves this historical blocker record and its exact recovery patch. Its
scoped migration now passes the full encoder command and replaces the stale
unsupported evaluator assertion with actual public thunk/state/canary checks.
The independent native full-pixel fan/edge witnesses and twelve frozen cases
also pass in normal and compat modules. See that note and its run result for
the final shared/HEAD qualification and publication status. Both final views
now pass all 40 required commands, including the full encoder, actual delayed
Worker, all 26 fresh browser cases, point41 normal/compat, native-frozen fan/edge
frames and all seven Node/eight browser startup controls. Historical failures
and native-driver differences above remain retained, not reclassified as passes.
