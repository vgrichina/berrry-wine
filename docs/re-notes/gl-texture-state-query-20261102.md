# MDK2 texture environment and integer parameter queries (2026-11-02)

`glTexEnvfv`, `glTexEnviv`, `glGetTexEnvfv`, `glGetTexEnviv` and
`glGetTexParameteriv` use native context state. Environment mode and color
belong to the active texture unit; parameters belong to the bound 1D or 2D
object, including each context's default objects. Names become objects on
binding. Queries and name lookup do not create named objects.

The primary reference is [OpenGL 1.1](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 3.8, 3.8.3–5, tables 3.9–11, chapter 5, and chapter 6. Supported
environment modes are MODULATE, DECAL, REPLACE and BLEND. Environment and
border colors clamp to [0,1]. Signed integer colors use `(2c+1)/(2^32-1)`;
integer color queries use the inverse normalized conversion. Priority is
ordinary numeric state, clamped to [0,1], and integer queries round it.
All core minification/magnification/wrap pnames and defaults are supported.
RESIDENT is queryable and true: this implementation makes no residency
working-set distinction. Proxy targets have no object properties. Border
width and image-level properties remain separate level-query pnames.

The existing scalar environment and scalar/vector floating parameter routes
feed the same state. Complete guest frames and vector spans are checked
before access, including nonadjacent sparse pages. Illegal target, pname,
value and executed Begin/End calls leave state and query outputs unchanged.
Lists own setter input snapshots; queries execute immediately and are never
recorded. TEXTURE_BIT restores environment, bindings and bound parameters.

Native rasterization and the WebGL frontend apply the GL1.1 environment
tables, including BLEND color and format-specific alpha retention. Queued
draws carry environment values in their snapshot.

Validation: 437 literal checks and 367 identical observations on each dynamically
resolved guest stdcall direct/queued route; full 8×8 frame checks cover all
environment modes, base-format alpha rules and queued snapshots. Two compiled
saved-source controls and twelve semantic mutations fail on intended assertions.
WebGL 1/2 environment and existing border pixels pass using installed Chrome
through a test-only CDP transport (no package download). Lighting, raster,
texgen, float parameter, query, list, sparse-page, byte-encoder, availability
and generated-file regressions pass, as does locked `tools/build.sh`: 63 command
outcomes total. Availability removes exactly these five misses, 89 → 84.

Evidence: `scratch/runs/20261102-gl-texture-state-query/` (ignored); the runner,
source snapshot hashes, literal results, mutation logs, pixels and recovery
recipe are retained there. Original MDK2 replay remains gated on every mandatory
export being genuine; no replay or gameplay claim is made.
