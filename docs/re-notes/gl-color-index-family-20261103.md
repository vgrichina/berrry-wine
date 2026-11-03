# GL 1.1 color-index family — 2026-11-03

Input: published `91da9cb835472cbe074bd5d997a95863b6689435`.
Evidence: `scratch/runs/20261103-gl-color-index-family/` (ignored).

Implements `glClearIndex`, `glIndexMask`, `glIndexPointer`, and
`glIndexd/dv/f/fv/i/iv/s/sv/ub/ubv`. The primary reference is the
[OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 2.7–2.8 (current attributes and arrays), 2.12 (raster position),
4.2.2–4.2.3 (write masks and clear values), 5.3–5.4 (feedback and lists),
and chapter 6 (query conversions and attribute groups).

The frontend stores a separate single-precision current index, initialized to
one. Signed short/int and unsigned-byte arguments convert directly to floating
point without normalization. Double arguments convert to the implementation's
current-attribute precision; scalar doubles consume two x86 stack words.
Vector values are read before display-list capture. Guest readers preserve
unaligned values and nonaffine page boundaries. No index is converted into
an RGBA color.

Clear index (initial zero) and the full unsigned write mask (initial all ones)
are context state. All supported drawables are RGBA, with zero index bitplanes;
index masking and clear-index values do not affect RGBA raster operations.
This adds no indexed drawable, palette, layer-plane or font implementation.

IndexPointer accepts exactly unsigned byte, short, int, float and double, as
specified in GL1.1 table 2.4. Negative stride and unsupported types preserve
the old definition and raise the appropriate error. Pointer definition/query
never dereferences the array. Enabled arrays are consumed by ArrayElement,
DrawArrays and DrawElements; list compilation captures their scalar values.
InterleavedArrays disables the index array. Client vertex-array attributes
save its enable, type, stride and guest pointer independently of pixel store.

All four numeric Get variants query current/clear index, write mask, array
type/stride/enable and index bit count; GetPointerv returns the original guest
pointer. Integer queries use ordinary numeric conversion for indices and
preserve unsigned mask bits. RasterPos captures the current raster index.
CURRENT_BIT saves current and raster index; COLOR_BUFFER_BIT saves clear index
and write mask. Context switches/deletion and list sharing keep state private;
wglCopyContext copies only the selected server groups, excluding client arrays.
RGBA feedback continues to emit RGBA colors and selection uses ordinary depth
and name records.

Static validation passes: manifest and balanced fragments, typed operand
checks for the new WAT helpers, generated dispatch consistency, handler ESP,
test tier coverage, JavaScript syntax and whitespace. These checks do not
establish runtime behavior. The focused tests exercise public static/dynamic
resolved stdcall thunks with stack and register canaries, every legal scalar
and array format, unaligned/nonaffine input, rejected pointer formats/stride,
attribute groups, lists, sharing/copy, selection/feedback, and independent RGBA
pixels. A lost-current-index mutation must be rejected. Runtime validation
also requires the actual queued Worker and real WebGL1/2 pixel controls.

Runtime started only after Alice98780's explicit 21:44:59Z release, on fresh
TTL3600 boat `bx_2eage4ak`, expiry `2026-11-03T22:46:55.013Z`. This worker owns
its delegated normal shutdown after full local recovery and a verified snapshot.
The first locked full build passed. Focused direct and actual queued Worker
routes passed; the Worker queued two RGBA draws with zero fallbacks. Both native
captures passed actual Chrome WebGL1 and WebGL2 replay, with white triangle
centers, black outside controls and no GL errors. Native and WebGL2 images were
also inspected. The negative mutation failed at `typed scalar d`, observing
zero instead of `-17.625`, as required.

The focused instrumentation module SHA256 is
`b6e79698d41258e7f0f6c1f15df249c989f35c42b651a908bf4eac198afe851c`
(2,139,565 bytes); direct and Worker used identical bytes. All 24 regression
cases passed: selection/feedback and evaluators (native/Worker/WebGL), export
availability, display lists, attribute stacks, context copy and edge flags
(native/Worker/WebGL), shared textures (native/WebGL), drawable color buffers,
drawable WebGL integration, lighting, interleaved arrays and server-state
native/Worker routes. The local regression CLI wrapper exited 143; the existing
remote runner continued, and command history confirms its successful exit
(`cmd_bhhpp0kqzvao`), with no duplicate suite launched.

After the build and tests, 5,849 exact staged input files were hash-verified,
with no mismatches. Built modules:

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Canonical | 2,139,154 | `df6f8da3bc808cfe0ee4e5c74367c123d6526ca7e5f2c0059df9b48a84d0dc15` |
| Compatibility | 2,141,767 | `c4fdc3791c4fabc0a188f20d518cd62cac66ca64d5537ba4807decf87c349909` |

The ignored evidence directory retains exact source/change seals, test logs,
captures, mutation failure, publication record, both complete modules and a
fullSHA recovery manifest. `RECOVERY.md` describes restoration and reproduction;
`recovery-download.json` records local archive/payload verification. Final
snapshot and actual stop state are recorded by the lifecycle receipts there.

Original pinned MDK2 gameplay remains **unverified**. The prior inventory contains 16
unsupported names; these 13 belong to this family, leaving the three layer/font
names outside this task. Root owns TODO/STATUS/corpus updates.
