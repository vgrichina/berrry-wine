# Empty-client GL crash sweep: primary-rule prerequisite unresolved

This assignment stopped before new calls or assertions. No new empty-client
coverage, production crash, repair, passing regression, or D3D27/game result is
claimed. `test/test-opengl-empty-client-boundary.js` was not created. The
blocking input is exact primary GL text establishing the selected empty-call
error and state rules, required by the assignment before numeric assertions.
The assignment also requires an offline run; no primary document was fetched.

Evidence is in `scratch/runs/20261104-gl-empty-client-boundary-crash/`.
`input-references.json` records the exact Git SHA, relevant existing files,
both available shipping module paths/full SHA-256/size, and the existing
`calc.exe` bootstrap path/full SHA-256/size. These are references, not tested
module identities: neither module was instantiated by this assignment.
`relevant.diff` retains relevant uncommitted hunks; `owned-note.patch` retains
this new note. There are no source snapshots, media copies, or module copies.

## What was inspected

Read `CLAUDE.md`, the owner workflow, the messageboard and
[`gl-native-encoder-crash-sweep-20261101.md`](gl-native-encoder-crash-sweep-20261101.md).
Inspected existing client-array, client-attrib, sparse-page, bitmap,
bitmap-target, raster-pixel, readpixels, one-dimensional-texture and native
public-query tests, plus the current GL producer/bitmap code and public
execution exports. This was read-only inspection, not execution acceptance.

The earlier sweep explicitly distinguished its transformed modules from
shipping binaries. `test-opengl-sparse-page-arrays.js` appends test exports and
calls `gl_wat_encoder_call`; it covers **mapped nonempty** sparse inputs and
snapshot lifetime. The public-query family resolves actual procedures but
uses appended `probe_*` exports and invokes `$win32_dispatch` directly.
Neither route alone establishes this assignment's unmodified-shipping-module
x86 public-entrypoint requirement.

Existing cases that must not be counted as new work:

- `test-opengl-bitmap.js` already exercises a 0-by-0 NULL bitmap with raster
  movement. The raster-position family also uses empty NULL bitmaps.
- `test-opengl-one-dimensional-textures.js` already issues a zero-width
  TexImage1D with `0xffffffff`, checks its level and draws the incomplete image.
- The encoder sweep includes incomplete primitive counts, including zero,
  with its existing reference encoder and instrumented module.

## Missing authority and candidate coverage

Existing project notes cite the
[OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf).
Those citations are not retained primary text for this task's expected values.
The locally located `scratch/runs/20261102-gl-typed-normal-resume/glNormal.xml`
is a retained primary page, but its normal-conversion contract cannot authorize
empty draw/pixel/texture behavior.

Filesystem searches for GL specifications, GL PDF/text files, relevant
refpage XML/HTML, and GL-named documentation located no usable primary text
for the candidate calls. `authority-search.json` records the search scope and
findings. This is a bounded search result; it does not establish the absence
of a document inside every retained archive. Existing archives were preserved.
No network, SDK download, or archive extraction was performed.

The following are **proposed inputs**, not validated or executed cases. Exact
primary rules must first establish each call's permitted dimensions/count,
error conditions, retained state and any required raster-position movement.

| Candidate | Distinction from inspected existing cases | Primary rule still needed |
| --- | --- | --- |
| DrawArrays, count 0, nonzero first | Enabled vertex/normal/color/two-unit texture arrays all point to inaccessible guest pages | Which array elements are consumed and which current attributes remain defined |
| DrawElements, count 0, each legal index type | Both index pointer and enabled array pointers inaccessible | Zero index consumption, accepted type/count and defined current state |
| Bitmap 0-by-N and N-by-0 | Non-NULL inaccessible pointer, valid raster position and nonzero movement | No-data behavior and exact raster-position update |
| DrawPixels 0-by-N and N-by-0 | Inaccessible source with valid format/type/unpack fields | No-data behavior, errors and raster-state effects |
| ReadPixels 0-by-N and N-by-0 | Inaccessible destination with valid pack state/read buffer | No writes and accepted error behavior |
| TexSubImage2D 0-by-N and N-by-0 | Predefined image, valid offsets/bounds/unpack state, inaccessible source | Empty update bounds and unchanged image content |

TexImage1D's existing zero-width case should not be duplicated. TexImage2D
empty image definition must not be treated as an unchanged-image subupdate;
its level-definition rules need separate authority. A nonempty inaccessible
pointer is never a conformance oracle. An invalid mode/type, undefined image,
bad offset, invalid buffer selection, or Begin/End misuse must not be hidden
behind an empty count/area.

## Concrete execution route once the prerequisite is supplied

Use both existing `build/wine-assembly.wasm` and
`build/wine-assembly.compat.wasm`, without adding exports. The existing
legacy rendered/native fixtures demonstrate loading retained `calc.exe`,
executing a short allocated x86 caller through `call_func`/`run`, and checking
bounded EIP completion and stdcall ESP. Public LoadLibrary/GetProcAddress
resolution can then supply actual GL thunks. Register, caller-stack, source
and output guards must surround every call. Existing
`test_virtual_map_commit` and `guest_to_wasm` exports provide sparse mapping
without a source transform; interleaved pages must be demonstrably nonadjacent.

Each selected boundary needs a mapped nonempty positive control before it,
an inaccessible page with verified mapping status, defined error/state checks,
and a distinct subsequent valid nonempty draw/readback. Keep distinct queued
payloads and mutate their mapped source after capture, so stale payload reuse
cannot match both results. Exercise the native encoder **and actual native
decoder**, and distinguish guest thunk/producer failures from host replay and
decoder failures. A separately compiled wrong eager-read control is useful
only if the observation actually detects its read; a harmless sentinel read
or an ignored packed record is not discrimination.

No production file was claimed or changed. No build was needed for this
documentation-only outcome; no focused GL test or locked full build was run.
Documentation whitespace and patch recovery were checked. Next: provide a
retained primary document covering at least one bounded subset above, then
implement and execute that subset before asserting a repair is warranted.

Box ID/state/expiry: N/A. No Chrome, game, boat, SSH box, API, deployment,
subworker, heavy-runtime claim or lifecycle action occurred. The coordinator
owns future runtime/shutdown. This single assignment is released and stops.
