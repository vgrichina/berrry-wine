# Integer fog, light-model, light and material setters (2026-11-02)

Adds `glFogiv`, `glLightModelf`, `glLightModeliv`, `glLighti`, `glLightiv` and `glMaterialiv` through resolved guest stdcall exports. Adapters lower to existing float command IDs; existing float entry points share validation, state and display-list handling.

The [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf), sections 2.13 and 3.9 and tables 2.6–2.8, defines the conversions and ranges. Only signed integer color parameters use `(2*c+1)/(2^32-1)`; positions, directions, attenuation, spot properties, indexes, shininess and fog reals use numeric conversion. Boolean model parameters test nonzero. Fog color clamps after conversion. Position and direction transformations occur when commands execute.

Native lighting and queued snapshots retain spotlight, attenuation, local viewer and separate back materials. Canonical host replay uses exact pname arities and matching shader uniforms. Malformed guest frames and vectors trap before state or command changes; invalid enums, ranges and Begin/End usage produce GL errors. Display lists own converted values and defer execution-time transforms.

Validation: 57 commands pass, including 301 matching observations per resolved direct/queued route, two compiled old-source rejections, fourteen compiled semantic mutation rejections, 36 regression invocations, both generated checks and locked `tools/build.sh`. An incorrect integer-query literal was corrected by exact rational derivation; the software observer was repaired to decode two-sided canonical arguments independently of the matrix observer, then the entire suite reran successfully. Availability removes exactly these six names (105 → 99).

Evidence: `scratch/runs/20261102-gl-integer-light-material-fog/`, including source hashes, logs, original-source controls and recovery instructions. No original MDK2 replay or gameplay claim.
