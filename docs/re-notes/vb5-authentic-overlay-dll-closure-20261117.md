# Installed VB5 DLL closure

The installed executable lives in an opaque UUID blob. Its original guest
identity is `c:\program files\vb5cce\vb5cce.exe`; searching its host blob
directory for `VBA5.DLL` cannot discover the installed companion. The previous
installed invocation failed before UI at ordinal 8, despite the authentic DLL
being present in the persisted overlay.

The CLI now finishes base mounts, overlay hydration, cwd and registry restoration
before static DLL discovery and any PE DLL initializer. Both static and late
lookup resolve guest paths through the hydrated VFS. Explicit guest paths do
not fall back to unrelated same-basename host files. Installed modules retain
their actual guest paths instead of acquiring root/system file aliases.
Hydration errors refuse startup before DLL discovery.

`test/test-installed-dll-closure.cjs` uses original VBA5 and OLEAUT32 bytes from
the authenticated installation, referenced by their existing paths and hashes.
An authored x86 client occupies an opaque blob and uses the same CLI launch
arguments as the installed executable. Main and actual CPU Worker cases cover
static ordinal and named imports, late loads, dependency initialization order,
wrong paths before/after mapping, broken hydration and a declared DLL whiteout.
The original VBA5 `EbGetVersion` body writes all four version outputs; no
runtime ordinal result is synthesized. Read-only discovery of the actual
installed EXE finds VBA5 and OLEAUT32. OLE32's missing-file warning is recorded
separately and does not predict a later runtime fault.

Evidence: `scratch/runs/20261117-vb5-authentic-overlay-dll-closure-ide-sample/`.
The final result records the published graph, module, native qualification,
installed invocation and its actual outcome. Earlier closed endpoints remain
closed. The repair does not reinstall or change original installation bytes,
registry contents, configuration or sample arguments.
