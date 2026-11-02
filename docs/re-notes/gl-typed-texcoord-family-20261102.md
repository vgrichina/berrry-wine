# GL1.1 typed texture-coordinate families — 2026-11-02

The independent MDK2 unsupported list contained 25 genuinely missing texture-coordinate exports: all eight `glTexCoord1*`, `glTexCoord2iv/2s/2sv`, all eight `glTexCoord3*`, and `glTexCoord4d/4dv/4i/4iv/4s/4sv`.

The native adapter loads scalar arguments from actual guest ESP, including two physical words per binary64 argument. Short scalar arguments occupy four-byte stack slots; short vectors are tightly packed. Guest-page translation covers each split scalar, vector and vector-pointer slot. Checked full spans reject missing translations or unsigned wrap before current state, list recording, allocation, EAX or ESP can change.

Signed short and integer inputs convert numerically, without color/normal normalization. Float inputs preserve their bits, and doubles demote once to the existing packed-f32 encoder boundary. Dimensional defaults are `(s,0,0,1)`, `(s,t,0,1)`, `(s,t,r,1)`, `(s,t,r,q)`. The adapter snapshots four floats into invocation-owned storage and calls canonical opcode 120 (`glTexCoord4f`), then frees the storage. This reuses texture unit zero, context, current-attrib, Begin, display-list and projective renderer behavior, with no command-stream or JS bridge additions.

Current-coordinate attrib restoration is gated by `GL_CURRENT_BIT` for all four components on both units. Array assembly marks its private save record with that bit instead of treating the primitive mode as an attribute mask. Unrelated user attribute masks preserve coordinate changes. The predecessor normal gate is preserved.

The established `2f/2fv/2i/2d/2dv` and `4f/4fv` paths retain their dispatch and opcodes. API IDs, hashes, conventions and physical stack counts remain stable. Only the 25 implemented names leave the independently literal unsupported list; unrelated missing controls remain unavailable.

`test/test-opengl-typed-texcoord-family.js` uses real LoadLibrary/GetProcAddress/WGL resolution and stdcall dispatch in direct and queued modes. It checks literal four-component current state and canaries, signed endpoints and intermediates, rounding and f64 limits, actual non-affine sparse stack/vector/pointer slots, atomic invalid inputs, context deletion/restoration, attrib masks, every family inside Begin, compile and compile-and-execute value capture, and nested lists. The pixel oracle is independently literal: an 8x8 quad with `s=3x,q=1+2x` crosses the red/blue texture boundary at x=1/4 (`RRBBBBBB`); dimensional q=1 gives `RRRRBBBB`. Separate cases route r through the texture matrix, check all 1D and 3D setters, and replay projective lists.

Validation passed on exact-source finite-TTL boat `bx_9e7wnypn` (original expiry `2026-11-02T07:54:16.951Z`): 41 commands, including 297 checks in each direct/queued route, both old-source rejection routes, nine compiled semantic mutations, 25 regression variants, both generation checks, and `flock /tmp/wine-build.lock bash tools/build.sh`. The mutations independently reject wrong signed conversion, normalization, binary64 conversion, stack stride, dimensional defaults, component loss, attrib restoration, list timing and projective division. Availability reports 142 remaining misses, down from 167 after the normal-family predecessor. All 52 evidence members were retrieved and SHA-verified before delegated shutdown.

Validation evidence is retained in `scratch/runs/20261102-gl-typed-texcoord-family/`. Final results, source hashes, mutation failures, predecessor releases, finite-TTL boat lifecycle, evidence retrieval and publication are recorded there. No original MDK2 replay or gameplay claim.

Contract reference: [Khronos glTexCoord](https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/glTexCoord.xml).
