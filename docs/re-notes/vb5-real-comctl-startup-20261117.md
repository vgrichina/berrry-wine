# VB5 COMCTL32 startup export binding

The authentic installed executable's startup helper at VA `0x498254` first
loads a DLL, then resolves an array of exports. Either a failed LoadLibrary
or a missing export produces the same "System DLL could not be loaded"
message. The COMCTL32 caller at `0x497fb8` requests eleven exports from the
table at `0x578338`. Read-only inspection of the SHA-pinned original verifies
the table; no original executable or script is modified.

The bounded public API probe on the sealed published runtime returns a real
builtin COMCTL32 module handle. Its fourth requested export,
`ImageList_SetOverlayImage`, returns NULL. The sixth, `ImageList_GetImageInfo`,
is also absent. This is an export-binding failure, not a measured missing
COMCTL32 PE dependency, failed DllMain, file-version rejection or OLE32 fault.
COMCTL32's existing builtin execution policy remains in force. Original
PE/NE family execution and authentic installed VBA5/OLEAUT32 retain their
existing routes; no different Microsoft DLL is substituted.

Both missing image-list APIs now execute native WAT implementations.
Overlay slots retain validated image indices, affect ImageList_Draw/DrawEx,
and track image removal/reset. GetImageInfo exposes borrowed live GDI bitmap
and mask planes with a 32-byte IMAGEINFO. A strip cell is materialized and
retained on demand. Each retained cell has its own bitmap pair and a rectangle
starting at (0,0); drawing reads those same planes, and list ownership releases
them. Invalid handles, indices, output buffers and overlay slots fail.

The authored x86 clients run on the production CLI main and actual CPU Worker.
They bind all eleven genuine startup exports, execute successful image-list
operations and refusals, distinguish qualified missing paths from system
aliases, and execute genuine VBA5 ordinal 8 with authentic OLEAUT32 loaded.
Pixel tests verify overlay composition and edits through the borrowed bitmap,
plus bounds, removal and object lifetimes. Existing hydration/closure refusal
tests remain active. The personal review helper uses the owner-directed
15-second game / 30-second menu freshness limits; native confirmation,
physical release and immutable capture limits remain 500/1750/3000 ms.

Evidence: `scratch/runs/20261117-vb5-real-comctl-startup-ide-sample/`.
The final result records publication, the pinned installed invocation and its
actual outcome. No IDE/sample success is implied by the authored fixtures.
