# Texture framebuffer copies and image readback

The five mandatory MDK2 texture exports now use actual selected framebuffer
pixels and actual bound texture level storage. `glPixelTransferf/i` supply the
necessary server transfer state. Original MDK2 replay was not run.

The contract follows the primary [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 3.6 (pixel storage/transfer), 3.8 (textures), 4.3 (framebuffer reads),
5.4 (display lists), and 6.1 (GetTexImage, including table 6.1). In particular,
GetTexImage uses the return-component expansion rather than sampler expansion,
applies pack state, and does not apply pixel transfer. Copies apply transfer
before internal component selection. Supplied borders are stored texels;
subimage offsets may address them. Out-of-framebuffer source pixels remain
undefined and have no expected-value oracle.

Native 1D storage is preserved. Object-owned 2D level records supply uploads,
subimages, copies, level queries, readback, and software sampling. Render
workers receive draw-time copies of texture descriptors; mutation/deletion
fences pending readers. The WebGL frontend retains the same pixels that it
uploads, including explicit border and mipmap backing data.

Display lists own unpacked client input, retain float components until
execution-time transfer, and read the framebuffer at execution. GetTexImage
is immediate. Transfer and ReadBuffer restore under GL_PIXEL_MODE_BIT;
pack/unpack restore under GL_CLIENT_PIXEL_STORE_BIT.

Validation: dynamically resolved guest stdcall direct and queued fixtures;
independent literal image and rendered-pixel oracles; WebGL 1/2 rendering;
nonuniform front/back copies, offsets, levels, formats, scalar types, pack and
unpack layouts, transfer, borders, list ownership/timing, isolation, sparse
pages, exact output widths, and atomic errors. Saved old source and semantic
mutations cover source selection, current storage, destination offsets,
transfer, packing, list ownership, ReadBuffer, and worker snapshots. Evidence,
source hashes and recovery instructions live in
`scratch/runs/20261102-gl-texture-copy-readback/` (not Git).
