# glReadPixels scalar and PACK contract — 2026-11-02

No scalar-conversion or packing defect was demonstrated for the tested RGBA8
software surfaces. One error-code defect was demonstrated and repaired:
`GL_BITMAP` with a component format returned `GL_INVALID_OPERATION` (`0x502`)
instead of `GL_INVALID_ENUM` (`0x500`). The production change only adds this
validation before the existing unsupported-index/depth checks.

The static analysis preceded shared edits and execution. Primary source:
[OpenGL 1.1 specification, 4 March 1997](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
§§2.1, 2.5, 3.6.3 and 4.3.2; tables 3.6, 4.5 and 4.7.

For a final clamped component `f`, the table's conversions are:

| Destination | Real-valued conversion |
| --- | --- |
| Unsigned n-bit integer | `(2^n − 1) f` |
| Signed n-bit integer | `((2^n − 1) f − 1) / 2` |
| FLOAT | `f` in the client's floating representation |

The signed formula differs from multiplying by the positive signed maximum.
This difference alone is insufficient evidence of an output defect here.
For `f=k/255`, the specified signed result is integral for odd `k` and a
half-integer for even `k`. The existing implementation selects an adjacent
integer in each half-integer case. Table 4.7 does not prescribe a tie direction;
the test accepts either adjacent integer there. Black is near zero, not the
most negative signed integer. White reaches the positive maximum.

The independent fixtures use these results, derived before runtime:

| Source byte k | 0 | 51 | 85 | 128 | 170 | 204 | 255 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UNSIGNED_BYTE | 0 | 51 | 85 | 128 | 170 | 204 | 255 |
| BYTE, before integer rounding | −0.5 | 25 | 42 | 63.5 | 84.5 | 101.5 | 127 |
| UNSIGNED_SHORT | 0 | 13107 | 21845 | 32896 | 43690 | 52428 | 65535 |
| SHORT, before integer rounding | −0.5 | 6553 | 10922 | 16447.5 | 21844.5 | 26213.5 | 32767 |
| UNSIGNED_INT | 0 | 858993459 | 1431655765 | 2155905152 | 2863311530 | 3435973836 | 4294967295 |
| INT, before integer rounding | −0.5 | 429496729 | 715827882 | 1077952575.5 | 1431655764.5 | 1717986917.5 | 2147483647 |
| FLOAT, binary32 bits | 00000000 | 3e4ccccd | 3eaaaaab | 3f008081 | 3f2aaaab | 3f4ccccd | 3f800000 |

PACK placement uses component count `C`, scalar size `S`, row pixels `L`
(`ROW_LENGTH` or requested width), and alignment `A`. The byte stride is
`CSL` when `S >= A`, otherwise `A ceil(CSL/A)`. The initial offset is
`SKIP_ROWS*stride + SKIP_PIXELS*CS`. Byte swapping reverses each scalar's
bytes; it preserves component order. LSB_FIRST concerns bitmap bits and has
no scalar effect. Invalid enums/sizes and calls inside Begin/End preserve
the destination. BITMAP requires an index format.

`test/test-opengl-readpixels-scalars.js` resolves real opengl32 thunks using
WAT LoadLibrary/GetProcAddress and dispatches them through `win32_dispatch`.
It checks stdcall cleanup, preserved registers and argument-stack bytes.
Both direct native software rendering and the queued native renderer plus
software consumer execute the same cases. A fenced native point and its raw
surface pixel establish that the queued raster path actually ran.

Coverage includes all seven scalar types; black, middle fractions and white;
swap on/off; alignments 1/2/4/8; default and explicit row length; two distinct
rows; skipped rows/pixels; unaligned destination; component order; individual
channels, RGB/RGBA, luminance and BGR/BGRA. Literal expected row offsets avoid
copying production stride calculations. All 1,024 destination bytes are
checked, including prefix, skipped regions, row padding and suffix guards.
PACK_LSB_FIRST and unrelated UNPACK state are isolation controls. Wrong-endian
interpretation and a deliberately changed prefix guard must each fail the
oracle. Invalid formats/types, DOUBLE, negative/zero sizes, COLOR_INDEX,
Begin/End, and bitmap-format errors also check untouched output.

Evidence is ignored under `scratch/runs/20261102-gl-readpixels-scalar-contract/`.
The final test passes 1,258 assertions and two negative controls per route.
With the committed pre-repair bridge from `71fb8fb279369abfff4c4e5ad64c143921ae0240`
loaded in memory, the identical final test passes its 1,250 scalar/PACK/control
checks on both routes, then fails on `GL_BITMAP + GL_RED`: actual 1282,
expected 1280. `old-exact-final-{direct,queued}.log` retain these failures;
`scalars-final-{direct,queued}.log` retain repaired passes. Earlier point-control
fixture failures are retained separately: its observed native row was corrected,
and queued raw inspection gained an explicit fence. They were not conversion
failures.

Existing drawable/color-buffer tests pass directly and queued, alongside color
mask, unpack alignment, client attributes, command stream, WAT encoder/worker,
WebGL drawable recorder and WGL availability regressions. The full locked build
passes. No browser, boat, original game, download or optimization was used.
This establishes the bounded RGBA8 software contract; it does not qualify
other framebuffer precisions, pixel-transfer operations, depth/stencil readback
or new hardware rendering.

Both required predecessor terminal results, completion events, exact final
AUTHOR RELEASE statements and helper absence were verified before claims and
execution: GTA `b0ec7da81`, then WebGL drawables `71fb8fb27`; all 354 recorded
helpers were independently absent. Box ID/state/expiry: N/A; coordinator
lifecycle unchanged. No further scalar or PACK implementation change is
warranted by this evidence.
