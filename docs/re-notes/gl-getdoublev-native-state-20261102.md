# Native glGetDoublev state retrieval — 2026-11-02

`glGetDoublev` now resolves through both opengl32.dll GetProcAddress and WGL to
real opcode 145, with two guest arguments and synchronous query transport. It
writes binary64 components at eight-byte intervals. This removes exactly one
mandatory missing export: the accepted accumulation predecessor left 176;
175 remain. The earlier matrix baseline had 178. No game was launched and no
MDK2 gameplay result is claimed.

## Contract and state ownership

The primary contract is [OpenGL 1.1 chapter 6, state tables and table 4.7](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
with Begin/End rules in chapter 2 and immediate display-list queries in chapter 5.
[Microsoft's glGetDoublev reference](https://learn.microsoft.com/en-us/windows/win32/opengl/glgetdoublev)
confirms scalar/vector counts, column-major matrices and invalid-enum/operation
errors. The implementation shares state selection with glGetFloatv and
glGetIntegerv, but has its own binary64 writer and conversion path.

Native state comes from the current context's existing matrix, current-attribute,
client-array, display-list, stencil, accumulation and software raster records.
The implemented domains include scalar enums/booleans/limits, two-component
depth range, three-component current normal, four-component color/texture
coordinates/viewport/scissor, and sixteen-component matrices. Server active
texture selects texture matrices, bindings and current coordinates; client
active texture selects client-array descriptors and enables. Context changes
restore the real retained records. Matrices and current attributes retain their
existing f32 storage precision; retrieval promotes those values to f64. Integer
names and masks convert directly to f64 without an f32 intermediate.

Host-retained clear color, clear depth, alpha reference and pack state are read
through the synchronized host query barrier, including preceding queued setters.
Clear depth preserves retained binary64 precision. Hardware answers use a finite
GL1.1 domain instead of forwarding arbitrary WebGL enums. Unknown and unsupported
query enums produce GL_INVALID_ENUM and leave output untouched. Queries during
an executed Begin produce GL_INVALID_OPERATION before writing. Queries execute
immediately during list compilation and never record an output pointer.

Software capability answers reflect the actual renderer: two fixed-function
texture units, eight lights, native stack limits, 16 depth bits, eight stencil
bits, 32 accumulation bits per component, no stereo or auxiliary buffers.
Bitmap color bits follow its actual 16/24/32-bit format; alpha exists only for
32-bit bitmaps, and bitmap drawables are single buffered. These answers do not
inherit the pixel-format descriptor's optimistic 24-bit depth claim.

Both native and host writers validate the complete destination before writing.
The native path uses guest-aware 64-bit stores, including unaligned doubles
crossing physically nonadjacent guest pages. Integer retrieval applies GL1.1
normalized-component conversion and preserves unsigned masks and texture names.
No unimplemented API or query enum is advertised to make an export count pass.

## Necessary pre-existing query fixes

The prepared inventory showed glGetFloatv's blanket sixteen-zero fallback and
glGetIntegerv's arbitrary backend delegation. Native current values, matrix mode,
viewport, client state and related retained state could therefore disagree with
queries. The new shared selector fixes the supported native domains for all
three numeric retrieval APIs. Independent legacy-only probes demonstrate the
old float viewport and integer matrix-mode failures without calling glGetDoublev.

Invalid matrix modes, texture units and negative viewport/scissor sizes formerly
reached state observers before validation. Those setters now reject invalid input
before mutation; depth range and host clear color/alpha reference are clamped.
Client-array defaults now match GL1.1 (size four, FLOAT, zero stride/pointer).
No-context encoder fixtures retain their existing host-transport seam.

The matrix test changes only its glGetDoublev unsupported expectation. Existing
availability controls remain, with the pinned mandatory count reduced to 175.
Isolated color/texture dispatch fixtures supply a query-interceptor seam and
recognize the appended opcode. The rectangle regression removes stale negatives
for already accepted glAccum/glClearAccum and checks LastError only for known
unavailable APIs; unknown names still require NULL and no thunk allocation.

## Reproduction and evidence

Evidence is kept outside git in
`scratch/runs/20261102-gl-getdoublev-implementation-resume/`.
The new `test/test-opengl-getdoublev-native-state.js` resolves actual guest ABI
thunks and verifies literal expected values, binary64 width/stride, stdcall
cleanup, saved registers, stack/output canaries, invalid enums, Begin/list rules,
context isolation, texture units, native drawing and synchronous queued state.
Direct and `--worker` use the actual queued renderer route; the latter requires
a queued draw. Sparse-page tests include a missing second page and prove that
validation prevents partial output writes.

Heavy validation uses exact uploaded source inputs on boat `bx_p4aeugbh`,
created 2026-11-02T05:20:07Z, expiry 2026-11-02T06:20:07.143Z. Input hashes,
compiled control hashes, literal values, test logs, actual process waits and
lifecycle receipts are retained in the run directory. Evidence is retrieved and
hash verified before task-owned boat shutdown. No dependency downloads occur.
The browser accumulation regression uses the existing test functions through
installed Chrome/CDP because the snapshot lacks the optional Puppeteer package.
This is a renderer regression, not a browser game test.

Validation results and the final publication hash are recorded in the run's
`result.json` and `final.txt`. The required locked build is
`flock /tmp/wine-build.lock bash tools/build.sh`; focused tests include existing
query/encoder, matrix, display-list, drawable, accumulation, array and availability
regressions. Old-source and deliberately broken width/stride/unit/mask/arity and
barrier controls must fail the independent literal oracle.

Final results: the locked build passed; all 30 existing regression variants
passed. New direct and queued ABI runs each passed 157 checks. Fourteen
old/broken-source route controls failed as required, and both independent
legacy-query gap probes failed on old source and passed on new source. Browser
accumulation passed 584 WebGL1, 588 WebGL2 and 525 actual BrowserWorker checks.
All 18 launched remote helpers were actually waited to terminal state, with no
live Node/Chrome processes left. Ninety evidence files were retrieved and their
SHA-256 hashes verified before shutdown.
