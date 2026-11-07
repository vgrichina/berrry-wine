# GL CPU texture allocation repair, 2026-11-07

GL texture images now use reclaimable, affine heap backing through the existing
surface storage allocator and its `0x400` ownership flag. They previously used
the fixed 63 MiB DIB arena, sharing its capacity with display bitmaps. This is a
WAT storage/lifetime repair: CPU images and frontend uploads remain required,
guest texture settings are unchanged, and genuine allocation failures still
report `GL_OUT_OF_MEMORY`.

Evidence: `scratch/runs/20261107-graphics-texture-allocation/` (ignored). The
starting main SHA is in `source-commit.txt`; `tested-head.txt`,
`relevant-source.patch`, `new-test.patch`, `new-note.patch`, and
`new-lib-wininit-boot.patch` preserve the tested source identity, including the
preexisting untracked bootstrap input. Git is the source archive. No source
tree or media archive was made. The tested standard build is retained as
`wine-assembly.wasm`, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

## Demonstrated cause and retained-history limits

The previous original is documented in
[graphics-texture-world-20261107.md](graphics-texture-world-20261107.md): image
call 3550 first latched error 1285, only 3549 images reached the frontend, and
model names 725/754 and HUD names 835..843 had no defined levels. Its auxiliary
guest argument arrays are invalid and remain excluded. The dimensions/name of
the first failed request are still unknown; this task did not run the original
again to recover them.

The retained **frontend** scalar upload metadata is valid. Its 3549 successful
image definitions contain 487 names and one level redefinition. Extracting
name, level, internal format, width, height and border, then uploading synthetic
pixels through the normal guest API, reproduces the allocation load without
copying game media. `retained-upload-metadata.json` holds only those scalars.
`retained-references.json` records the original compressed metadata's path,
size/hash and the existing media-closure reference. No artwork equivalence is
claimed for synthetic pixels.

The local harness uses the complete production WAT closure, actual DLL loading
and thunk resolution, guest stdcall dispatch, texture validation/canonicalization,
`gl_2d_store`, surface allocation, command stream, and `OpenGLHostBridge` frontend.
Test-only exports read allocator occupancy and create controlled record pressure;
they do not replace allocation or upload functions. The backend is software,
Node v24.18.1; the threaded copy regression also uses the actual render Worker.

| Local case | Old storage | Fixed storage |
| --- | --- | --- |
| Retained 3549 uploads, before deleting them | 15508 DIB pages, 3548 live DX records | 1 DIB page, 3548 live DX records |
| Retained CPU pixel bytes billed | 54441268 | 54441268 |
| 288 simultaneous 256x256 RGBA images (72 MiB) | Fails at image 252: error 1285, 251 frontend uploads, 16065 DIB pages, 251 DX records | All 288 upload and every byte reads back correctly; only the original display DIB page remains |

The DIB arena has 16128 pages; at the synthetic failure only 63 are free, while
the next image needs 64. The DX table has 16384 slots and just 251 live records.
Thus the reproduced failure is specifically DIB backing exhaustion, not COM
record exhaustion or a lost frontend image. The retained prefix alone uses
15507 texture pages in the old allocator, leaving little capacity for actual
640x480 drawable backing and subsequent textures. That explains the observed
original failure mechanism, but the exact original call-3550 allocation request
and contemporaneous nontexture occupancy were not captured. The local failure
ordinal 252 is a synthetic capacity test, not a replacement measurement of the
original ordinal.

## Implementation and lifetime

`d3d9_create_surface` now delegates allocation and unpublished-object rollback
to `dx_surface_storage_alloc/free`, which already implement heap-owned affine
surface storage for DirectDraw system-memory textures. GL 1D, canonical 2D and
the legacy software image helper select `0x404` (offscreen plus heap ownership).
Ordinary D3D surfaces continue to select DIB backing. The allocator rejects a
nonaffine heap span rather than exposing a misleading linear pixel pointer.

Each mip level still owns a surface. Redefinition allocates before mutation,
fences queued consumers, and releases the prior level. Zero-sized definitions
release old storage. Deletion and last-context destruction flow through the
existing surface Release path, which reads the ownership flag and calls
`heap_free`; COM allocation failure frees the unpublished backing through the
same helper. No image eviction, skipped successful upload, error clearing, or
frontend pixel substitution was added.

The documented API permits image definitions/redefinitions and per-level
storage; deleting a name discards its contents and resets a bound name to zero.
See Microsoft's [glTexImage2D](https://learn.microsoft.com/en-us/windows/win32/opengl/glteximage2d)
and [glDeleteTextures](https://learn.microsoft.com/en-us/windows/win32/opengl/gldeletetextures)
references. Real insufficient memory still requires an error; after OOM the
specification permits undefined GL state, so preserving the prior level is an
implementation guarantee tested here, not a stronger claimed GL requirement.
See [glGetError](https://learn.microsoft.com/en-us/windows/win32/opengl/glgeterror).
The specifications do not require allocating CPU texture mirrors in a fixed
display-bitmap arena. Total emulator memory and DX record capacity remain finite.

## Validation and recovery

All of the following passed; logs are in this run:

- `node test/test-opengl-texture-allocation.js` (initial after-fix capacity/lifetime run).
- `GL_ALLOCATION_HISTORY=scratch/runs/20261107-graphics-texture-allocation/retained-upload-metadata.json node test/test-opengl-texture-allocation.js`
  (final regression, retained prefix, 72 MiB readback, repeated redefinition,
  subimage, zero-sized image, deletion, and last-context mip teardown).
- Controlled full DX record table: five actual allocation attempts report
  `0x505`, forward no upload, preserve usable prior storage, and reuse the
  unpublished heap allocation without advancing direct or sparse heap cursors.
- `node test/test-opengl-texture-copy-readback.js`, also with `--worker`.
- `node test/test-opengl-one-dimensional-textures.js`.
- `node test/test-d3dim-texture-release-arena.js`.
- `node test/test-d3d9-color-surfaces.js`.
- `flock /tmp/wine-build.lock bash tools/build.sh` (full mandatory build).

Failing-before control is reproducible without a source checkout or copied tree:

```sh
GL_ALLOCATION_BASELINE_SHA=$(cat scratch/runs/20261107-graphics-texture-allocation/source-commit.txt) \
GL_ALLOCATION_HISTORY=scratch/runs/20261107-graphics-texture-allocation/retained-upload-metadata.json \
node test/test-opengl-texture-allocation.js
```

This restores only the three changed WAT fragments from Git in the compiler's
in-memory source closure. It exits 1 at image 252 with the old DIB allocator;
the fixed version exits 0. `before-final.log`, `before-history.log`, and
`after-history.log` retain the opposing results. Initial fixture setup failures
were corrected before the final baseline control; they are not causal evidence.

## Original followthrough

No box was assigned, allocated, resumed or stopped in this task. The prior
`bx_s3dcvnbt` is archived, current expiry null, retention unknown; lifecycle
ownership remains with the coordinator. `/home` remained above 2 GB free.

The next authorized worker should pin the published runtime and native closure,
retain the bounded allocation/page/record observer, then use the same registered
root and unchanged settings. Concrete production launch command after those
checks (not executed here):

```sh
node test/run.js --app=hexen2_demo --no-build --control-stdin \
  --max-seconds=600 --batch-size=50000 --quiet-api --quiet-blocks \
  --trace-from=1000000000 --trace-to=15000 --headless-gl --threads
```

Use the retained reviewed sequence: five Enter pulses of 150 ms, inspect the
composited first-person view, then one Up pulse of 1000 ms, each with independent
release armed before DOWN. Capture actual model/HUD definitions, upload counts,
composited artwork and remaining black world regions. The existing malformed
guest-stack observer must be corrected before any API-argument claim. The
present fix is locally tested emulator storage repair; restored original
artwork and broad-world correctness remain unverified until that followthrough.
