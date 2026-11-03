# GL evaluator family, 2026-11-03

This change implements the 23 remaining evaluator exports with evaluated
geometry and pixels. It does not qualify original MDK2 gameplay; 24 names in
the observed mandatory lookup inventory remain unsupported.

Input: `a2ae4283da7db2687a6e3d853a0103f6678ed451` on shared main.
Evidence: `scratch/runs/20261103-gl-evaluator-family/`.

The primary reference is the [OpenGL 1.1 specification, 4 March
1997](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf), section 5.1,
section 5.4, section 6.1 and table 6.17. The implementation provides the required
minimum maximum order of eight, stores the original double coefficients and
domains, and evaluates tensor Bernstein polynomials in double precision.
Analytic partial derivatives, including the homogeneous quotient rule, produce
normalized automatic surface normals. Float entry points convert once on input;
the native ABI consumes each double's two x86 stack words.

All eighteen map targets have private per-context state. Grid endpoints are
selected exactly at integer zero and the specified grid division count.
Evaluation uses the highest enabled vertex and texture dimension, preserves
current attributes, and sends generated attributes through ordinary vertex
packing, lighting and texturing. Index maps retain their coefficients and
enable state; the existing drawable routes are RGBA.

Lists own copied canonical command values and control points. Evaluation reads
the executing context's current maps, grids and enables during replay. Shared
list lifetime uses the existing shared-object namespace; maps themselves remain
private. EVAL_BIT snapshots include definitions, grids and enables; ENABLE_BIT
copies only enables. Context copy preserves independent map storage.

The focused native fixture resolves actual opengl32 and wglGetProcAddress
thunks, checks stack cleanup/canaries, and has direct and queued Worker modes.
It checks polynomial values, padded/transposed strides, homogeneous coordinates,
derivatives, normal precedence, all scalar/vector forms, queries, invalid calls,
attribute/context isolation and lists. Captured production draw records feed
real WebGL1/2 tests for point/line/fill meshes, automatic-normal lighting,
evaluated color material and texture coordinates.

Static checks completed: fragment balance, include manifest, duplicate-function
ratchet, handler stack inspection and test tier membership; both new JavaScript
fixtures pass syntax checking. These checks do not establish runtime correctness.
The primary PDF was readable through the web tool; a direct curl fetch returned
HTTP 403. No PDF download or new runtime result is claimed.

Recovery: the first worker ended with a model-capacity error after its 19:39:33
static milestone. The recovery worker preserved that implementation and the
same evidence run. It added early Begin/End rejection before evaluator
attribute-frame changes, and extended the prepared fixtures to all eighteen
map targets and a full 8-by-8 homogeneous patch. These remain prepared tests
until a native execution is recorded below. Runtime ownership remains with
Alice until an explicit release; no predecessor or foreign boat is used.


The recovery worker observed Alice's explicit runtime release at 19:59:14Z and
created fresh boat `bx_bfypzcje`, TTL 3600, original expiry
`2026-11-03T21:00:10.115Z`. This task delegates its normal shutdown to this
worker after complete local recovery and SHA verification. All heavy work runs
there. The baseline is 5,839 exact Git blobs at the input revision plus nine
explicit owned source/test changes; unrelated shared-checkout WIP is excluded.

The locked full build passed. Both native software and the actual queued Worker
pass the focused suite; both log the same instrumented module SHA-256
`ea6f09ae6635e14601cfdab4eaaf5224233deb3097e260ac97b30cb0302d82cb`
(2,134,544 bytes). Worker assertions require queued submissions and zero
fallbacks. Direct and Worker production captures each pass real WebGL1 and
WebGL2 mesh, automatic-normal diffuse lighting, evaluated color-material and
four-color texture pixel assertions, with GL error zero. Inspected native PNGs
show the filled patch, its grey diffuse-light result, and the four texture
quadrants. No original executable or game encounter is part of this fixture.

Retained first failures: the build's address-literal gate recognized the numeric
EVAL_BIT|ENABLE_BIT mask as an address; composing the two named flag values
fixes it without changing the gate. The native fixture initially used an
unaligned Float64Array on a valid four-byte-aligned guest output; DataView now
reads it. One browser launch received API HTTP 500 without running. The next
browser run exposed a 4 KiB fixture memory too small for the authentic
`glGenTextures` output at guest 8389908; 16 MiB keeps that output mapped.
All polynomial, state, error and pixel assertions are retained.


All eighteen serial regression invocations pass: resolver availability, display
lists, attribute stacks, context-copy native/Worker/WebGL, edge flags
native/Worker/WebGL, shared objects native/WebGL, software and WebGL drawables,
lighting, interleaved arrays, and server state native/Worker. Existing tests and
their assertions are unchanged except the resolver inventory now partitions the
same fifty observed names into supported edge/evaluator APIs and the twenty-four
still unsupported names. A mutation replacing the polynomial result with zero
fails immediately at `cubic x: 0 != 8`; its distinct module hash and rejection log
are retained. No availability is claimed solely from lowering the missing count.

Reproduce in a fresh finite-TTL test environment with `npm ci --omit=optional`,
then `flock /tmp/wine-build.lock bash tools/build.sh`,
`node test/test-gl-evaluators.js`,
`node test/test-gl-evaluators.js --worker`, and
`node test/test-gl-evaluators-web.js`. Set `GL_EVAL_CAPTURE` on a native/Worker
run and `GL_EVAL_CASES` on the browser run to check either production capture;
`GL_EVAL_PIXELS` saves native PNGs and `GL_EVAL_MODULE_OUT` saves the exact
instrumented module. The evidence run retains complete commands, source seals,
initial failures, final logs, captures and module bytes.

Final verification checks all 5,842 staged source/test inputs against the pinned
baseline plus owned delta. The canonical module is SHA-256
`03c7ffae336b2e250ea3b1869707321192fe4bdfb2d166d2d1b578ece634388a`
(2,134,098 bytes); the compatibility module is
`b47f499f30faea08b1fee1755ce0306c2615576e4c25584e97a6dd8597fc9437`.
The final locked build passes with the repaired fixtures in place. Runtime is
Node 24.22.1 and Chrome 151.0.7922.108 using ANGLE/SwiftShader. The accepted
scope is this API family and the named regressions, not application gameplay
or a historical corpus-wide backend qualification.
