# WGL shared objects — 2026-11-02

`wglShareLists` now joins a reference-counted object namespace across actual
native rendering-context handles, including contexts created or used by distinct
Wasm producer instances over the same process memory. It is no longer a lookup
miss. The shared objects for this implementation's desktop OpenGL 1.1 contract
are display lists and named one- and two-dimensional texture objects. Texture
zero, bindings, matrices, current attributes, enables, errors and attribute
stacks remain context state.

## Contract and implementation

Read before implementation:

- [Microsoft wglShareLists](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglsharelists): one shared list-index/definition space, texture objects included since OpenGL 1.1, stable sharing membership and lifetime through the final sharing context, compatible implementation/pixel format, BOOL and GetLastError failure reporting.
- [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf), texture objects and attribute state: reserved names, immutable texture dimensionality, independent default objects, object parameters/images and pushed texture state.
- [GLX 1.3 specification](https://registry.khronos.org/OpenGL/specs/gl/glx1.3.pdf), sections 2.4–2.5: shared named objects, atomic list publication/deletion and retained bound texture objects. This supplies OpenGL sharing semantics; the entry point and error interface remain WGL.
- [Microsoft wglMakeCurrent](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglmakecurrent) and [wglDeleteContext](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wgldeletecontext): single-thread current ownership, failed make-current releases the caller, another thread's current context cannot be deleted.

Native context, list, texture and saved-state registries are process-wide; current
state remains producer-local. A reentrant native call lock serializes namespace
operations, list compilation publishes at EndList, and a pending compilation
keeps its name rather than a potentially freed shared slot. Named-object changes
publish their production transport records before the native call lock releases.
Host frontends share object identity/maps and the name reservation cursor, rather
than copying a dictionary. A mutation flushes pending host draws using the group.

Deletion removes a shared name immediately and unbinds only the calling context.
Other bindings and pushed texture attributes retain the deleted generation;
rebinding a reused integer name selects the new generation. Retired storage is
collected after the final reference disappears. Named driver resources belong
to the group, so deleting the creator's backend facade cannot destroy them.
Deleting the final context frees the remaining namespace and texture storage.

Sharing is idempotent within an existing group. Invalid handles fail with
ERROR_INVALID_HANDLE (6); a destination with existing namespace contents or
established membership in another group fails with ERROR_INVALID_PARAMETER (87).
Host incompatibility also fails with 87. Another thread's current context fails
make-current/delete with ERROR_BUSY (170). These are this implementation's
explicit Win32 error choices; Microsoft does not prescribe every exact code.
Failures leave both namespaces intact and do not consume a pending GL error.
The existing renderer exposes one pixel-format implementation; mixing different
host backend implementations is rejected.

## Evidence and recovery

Evidence is ignored at `scratch/runs/20261102-gl-shared-context-objects/`.
The ordered Oni71461 then Braveheart56012 release gate was verified against actual
terminal completion, result/final, exact AUTHOR RELEASE and scoped helper absence
before main was refreshed or any shared source/build/browser/boat work began.
Foreign tracked and untracked work was preserved.

The unchanged old source resolves `wglShareLists` to zero and fails the actual
resolved-call control. Candidate runs kept production availability gated and
used a test-only lookup override. Availability advanced only after real native,
queued/software and WebGL1/2 behavior and five semantic mutation controls passed.
Final production tests use no lookup override. Tests exercise actual stdcall
thunks, independent and shared contexts, lists and both texture dimensions,
redefinition/subimages/parameters, default objects, name deletion/reuse, saved
binding lifetime, context destruction, separate producers and context migration.
Browser results contain literal RGBA arrays from actual WebGL1 and WebGL2
contexts using installed Chrome/ANGLE SwiftShader. No hardware GPU or original
MDK2 gameplay result is claimed. Separate native producers are interleaved
deterministically; this is not a concurrent-producer stress benchmark.

Final acceptance: all 15 commands in `remote/final-checks.json` pass, including
the locked full build and real browser native-stream lifecycle regression. The
shared-object runs pass 20 direct cases, 20 real queued cases without fallback,
and 40 literal WebGL1/2 pixel comparisons. The production module is 2,076,982
bytes, SHA-256 `a99910fa56a94123b10ab00ffc67b82d500af5c92efe02d0c6265b71b8ec524e`.
The native test module adds only inspection/dispatch exports and is separately
hashed in its logs. All five final mutation controls use production lookup.

The semantic mutations independently remove native image retention, producer
state isolation, mutation publication, shared host name-map identity and group
ownership of driver textures. Each must fail its specific pixel/lifetime
assertion. The first copied-map control had an overly late expected assertion;
its actual earlier shared-1D pixel failure was retained and the expected failure
was corrected before the passing control suite.

Heavy work ran only on owned finite-TTL boat `bx_h6zrtbz8`, created
2026-11-02T20:19:56.960Z, original expiry 2026-11-02T22:19:56.973Z. Exact source
was streamed directly, without a local archive; each file was SHA-verified.
`stream-inputs.json.gz`, `sync.jsonl`, and final source hashes identify the input.
The streamed build tree has no .git, so its API-table gate checks indices
without a HEAD comparison; local git comparison separately confirms
`src/api_table.json` is unchanged. Disk sampling and guarded bounded
transfers/retrievals enforce /home free space
above 2,000,000,000 bytes. Admission failures and intermediate compile/fixture
failures remain evidence; they are not acceptance results.

Recovery: use the committed source on main with the existing vendored compiler,
installed Node and Chrome, repository node_modules and render-harness font
fixtures. In a fresh finite-TTL test boat stream/hash the source, dependencies
and those fixtures using the retained `stream-source.py`, `remote.py` and
`sync-fonts.py` recipes, adjusting only the newly recorded box ID/expiry. Run:

```
node test/test-wgl-shared-objects.js
node test/test-wgl-shared-objects.js --worker
node test/test-wgl-shared-objects-web.js
node test/test-wgl-proc-availability.js
flock /tmp/wine-build.lock bash tools/build.sh
```

`final-checks.py` lists the full focused regression set and final build command;
`negative-controls.py` defines the meaningful mutations. Final logs, literal
pixels, source/module hashes and verified retrieval records live in the run,
along with the explicit boat shutdown and STOPPED/helper-absence evidence.
No ignored module or run artifact is committed. Existing broader GL limitations
remain: this change does not add later GL object families or unsupported APIs,
and cross-thread applications must synchronize in-flight rendering before
modifying objects, as required by OpenGL. Named-object publication adds transport
flushes; no gameplay performance claim is made.
