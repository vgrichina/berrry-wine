# Jedi original launcher: genuine DirectX prerequisite recovery

The two missing-file prerequisites are recoverable from the retained signed
Win98/Me DirectX 8.1 redistributable. This investigation prepares **file-only
provisioning** through the existing CLI's explicit system-path mounts. It does
not declare a complete Microsoft DirectX installation, execute a VxD, or change
the accepted game installation or registry. Current launcher runtime results
remain those in [the predecessor trace](jedi-original-directx-recovery-20261103.md)
until a separately recorded ordinary session runs.

Evidence: `scratch/runs/20261103-jedi-genuine-directx-prerequisites/`.

## Actual package and files

The retained package comes from the [DX81eng.exe mirror](https://am.net/lib/tools/Microsoft/DirectX/dx81eng.exe).
Its **12,144,784 bytes** have SHA-256
`d1762981f497a623b2f3e725c0916b96e716bd4a8845c5a4cc7f764b1a5cc5f7`.
This run rehashes the package, repeats selective CAB extraction, and reruns the
format-aware historical Authenticode verifier with output confined to its own
run. The file digest, signed-content digest, RSA signature and embedded
Microsoft Corporation → Microsoft Code Signing PCA → Microsoft Root Authority
chain signatures pass. This is legacy MD5 cryptographic evidence, without a
current trust-store, revocation or trusted-timestamp claim. The original
Crimsonland provenance inventory remains unchanged.

| Actual file | Bytes | SHA-256 |
| --- | ---: | --- |
| DSOUND.VXD | 48,170 | `92fd75ba86688d7058a449fb37242f2bfb57bc6057d92fb06d5b127212dea404` |
| DDHELP.EXE | 31,744 | `fa21dafc3c4052824861fbca1acb06b225ca51b0de93dd255aedbbce533315cf` |

Both independently extracted members match the retained loose files and the
complete 327-member package inventory. DSOUND.VXD has an LE image header.
DDHELP.EXE is an x86 PE with executable `.text` (28,672 raw bytes), ordinary
KERNEL32/GDI32/USER32/WINMM imports, and original file version 4.8.1.881.
Neither is a fabricated resource-only fixture or a filename marker.

The unmodified `directx.inf`, SHA-256
`67757e570c9a616b0cc3dfeebdb42a3aa9ef248e46bec1c337dd3ef52ca1fc51`,
selects `DirectX_System_98` in both `WIN98_INSTALL` and `WIN98SE_INSTALL`.
That section includes both filenames and uses `DefaultDestDir=11`, the
Windows system directory. These are genuine package copy destinations;
only the two requested files are proposed here. No AddReg/DelReg, component
registration or full-INF replay is implied by these two mounts.

## Supported file-provisioning route

Recover into a newly claimed ignored run directory. Reuse the retained package
at `scratch/runs/20261031T2243Z-crimsonland-authentic-dx81/DX81eng.exe`, or
fetch the exact small package URL above and require its complete size/SHA-256.
With 7-Zip, extract only the original files, then check the hashes above:

```sh
7z x -so DX81eng.exe dsound.vxd > dsound.vxd
7z x -so DX81eng.exe ddhelp.exe > ddhelp.exe
sha256sum dsound.vxd ddhelp.exe
```

Use the existing runner's supported repeatable arguments, with absolute host
paths to those verified files:

```text
--vfs-mount=/ABSOLUTE/RUN/dsound.vxd=C:\WINDOWS\SYSTEM\DSOUND.VXD
--vfs-mount=/ABSOLUTE/RUN/ddhelp.exe=C:\WINDOWS\SYSTEM\DDHELP.EXE
```

Keep the accepted original installed `Jedi.exe`, its working directory, original
28-file pin set and complete installer registry import. The predecessor's
`recover-remote.py` and the accepted `recover-layout.py`/`restore.py` recover
the original package and observed installation without rerunning setup. This
run retains all **28 pins / 39,900,850 bytes** in `original28-pins.json`;
that pin recovery is not a new local rehash of unavailable game bytes.
`registry-integrity.json` verifies equality of the predecessor's accepted
installer export and final launcher export. No Version/InstalledVersion value
is added, and DDRAW.DLL/DSOUND.DLL remain under the existing builtin policy.

`check-vfs.cjs` exercises current `VirtualFS` and `mountDirectXSystemModules`
without compiling or instantiating WASM. Before mounting, both requested files
are genuinely absent. After mounting, case-insensitive exact system-path finds
return handles and the full original file sizes/hashes; boot preserves the
unmarked authentic entries. An absent control still fails and existing
DDRAW.DLL/DSOUND.DLL entries remain byte-identical. This is a JavaScript
filesystem check, not a measured guest `FindFirstFileA` or launcher result.
The same check calls the actual `fs_find_first_file` host import using an
ArrayBuffer: it verifies `WIN32_FIND_DATAA.nFileSizeLow` for both originals and
`INVALID_HANDLE_VALUE` translation for the absent control. No WASM module is
compiled or instantiated. The DirectX registry absence/preservation regression
also passes.

## Full-installation boundary and runtime gate

The FreeSpace DirectX 7a checkpoint is genuine installer output but remains
NEEDRESTART: four DLL replacements and two deletions are queued in the original
WININIT.INI. Its unintegrated `lib/wininit-boot.js` prototype does not establish
authentic Win98 ordering/error behavior. Copying its Version entry would not
finish that installation. The separate Crimsonland full DX8.1 INF review also
measured unsupported manifest subtree deletion, unresolved DIRID28700, and
missing installer component-registration effects. Those prior measurements
are reused as limits, not relabeled as new Jedi installer failures.

This file-only route avoids claiming either full installation. It changes
ordinary file visibility using verified original bytes; it establishes no
native driver support, sound, DirectDraw capability or gameplay.

Before any runtime, source edits, build or heavy test, the owner's order is
Alice35407/thread `01a19f63-267f-7e22-a0b0-9d8ec0c4aa45`, then
GL64819/thread `01a19f76-5bc3-7b72-b8e6-a4eec3ad63f9`: actual terminal plus
exact AUTHOR RELEASE for each. `check-lane.py` records those observations.
The prepared finite-TTL boat procedure allocates no boat while that gate is
closed. Current source/module identity must be resealed after both releases;
the predecessor's `24880b0e…c4741` module is historical evidence only.
