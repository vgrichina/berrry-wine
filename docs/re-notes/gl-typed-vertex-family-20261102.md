# GL1.1 typed vertex family — 2026-11-02

The fourteen independently observed missing exports are `glVertex2iv`,
`glVertex2s`, `glVertex2sv`, `glVertex3dv`, `glVertex3i`, `glVertex3iv`,
`glVertex3s`, `glVertex3sv`, `glVertex4d`, `glVertex4dv`, `glVertex4i`,
`glVertex4iv`, `glVertex4s`, and `glVertex4sv`.

The native adapter reads all components through checked guest memory before
allocation or mutation. Short scalars consume DWORD argument slots and interpret
their signed low 16 bits; vectors use packed 16-bit elements. GLint converts
numerically to f32, without color/normal normalization. GLdouble demotes once at
the existing packed-f32 vertex boundary. Two-dimensional calls supply z=0,w=1;
three-dimensional calls supply w=1; four-dimensional calls preserve w, including
negative and zero values. A pointer word and any element can cross nonaffine
sparse pages. Wrapping frames, missing pages and incomplete sources trap before
EAX, ESP, primitive state or display-list records change.

An invocation-owned canonical `glVertex4f` stack enters opcode118. The existing
native encoder/list/state path owns Begin behavior, packed current color,
normal and both texture units, homogeneous positions, primitive assembly and
list capture by value. No new stream opcode or JS rendering path is needed.
Generated dispatch and the actual static/WGL resolution predicates share the
fourteen-name adapter map. API IDs and physical stdcall argument counts stay
fixed. The availability test keeps its independently observed missing set and
adds these names to the implemented set.

`test/test-opengl-typed-vertex-family.js` resolves real GetProcAddress and WGL
thunks, invokes production stdcall dispatch, checks literal signed endpoints,
intermediate values, f64 rounding, z/w defaults, all packed attributes, register
and source canaries, nonaffine sparse stack/vector/pointer words, atomic faults,
both list modes, nested lists and primitive boundaries. Direct and queued routes
use the production renderer/readback. Literal 8x8 pixel expectations follow
independent math: position w=1|3 makes s=u/(3-2u), so s=.5 at u=.75 and the
red|blue row is `RRRRRRBB`. Homogeneous scaling by2 gives `RRRRBBBB`.
The clipped scenes use w=2 and z=-3|1 (near) or 3|-1 (far). Signed clip
distances -1|3 cut at u=.25. Constant red gives the strict clipped coverage
`KKRRRRRR`. Texture interpolation and clipping have separate literal masks:
the existing clipped scanline rasterizer quantizes interpolated UVs by row.
Every 2D/3D family also draws the literal all-green default quad.
Incomplete triangles cannot combine across Begin/End; a mixed typed triangle
has an explicitly written pixel mask: readback row r covers
[1+floor(r/2),8-ceil(r/2)) after nearest-integer edge rounding.

Validation results, exact source/module hashes, old-source rejection, compiled
conversion/default/w/list mutations, boat ID/expiry and cleanup are recorded in
`scratch/runs/20261102-gl-typed-vertex-family/` (gitignored).

The exact-source boat run passed 45 commands: 179 checks per route with 118
matching observations, old-source rejection on both routes, eleven compiled
semantic mutation rejections, 27 focused regression invocations, two generated
file checks, and `flock /tmp/wine-build.lock bash tools/build.sh`. The native
adapter did not change during pixel fixture calibration; diagnostic logs retain
the rejected clipped-UV and initial triangle-mask expectations. Final masks are
strict full-frame RGBA comparisons with canaries, without pixel tolerances.
