# OpenGL boolean and pointer query prerequisites

`glGetBooleanv` and `glGetPointerv` now dispatch to genuine current-state queries.
Accepted baseline: `08f16f2f4752cb65d4979a015638b80299a2c75d`.

[OpenGL 1.1](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 2.8, 5.4 and chapter 6/table 6.6, requires zero/nonzero boolean
conversion and saved array addresses. Boolean results occupy exactly one byte;
native numeric readers and the precise host-owned state reader share existing
state, preserving accepted texture-copy/transfer behavior. Pointer results
occupy four guest bytes and never dereference the saved address. Vertex,
normal, color and both texture-coordinate arrays retain NULL, client-active
unit, context isolation and client-attribute restoration. See also
[ARB multitexture](https://registry.khronos.org/OpenGL/specs/gl/glspec121.pdf),
appendix F.2.15–F.2.16. Unsupported index/edge/selection/feedback and extension
state remain unsupported.

Queries execute immediately during list compilation, observe executed state,
and reject executed Begin/End. Full output spans are validated before writing,
including sparse pages and address wrap. No output is recorded in display lists.

Validation: direct and queued resolved guest stdcall literal oracles pass 272
checks each, including ABI/ESP, byte boundaries, matrices, binary64 tiny values,
invalid names, atomic failure, list timing and client restoration. Saved-old
source and 16 compiled semantic mutations reject intended errors. Numeric-query,
client-array/attribute, list, texture-copy/transfer, encoder and generated-dispatch
regressions and the locked full build pass. Only after those checks were these
two availability misses removed; 70 unsupported MDK2 names remain. Final
availability/build evidence is retained with tested source and module hashes in
`scratch/runs/20261102-gl-boolean-pointer-query-fresh/`.
No original MDK2 replay was performed.
