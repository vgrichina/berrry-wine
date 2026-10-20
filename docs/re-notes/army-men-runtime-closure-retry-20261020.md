# Army Men runtime closure follow-up: CPU DLL blocker

Coordinator-authorized follow-up to `620c56be42ced91642c67b3602cb7929535ec3e0`.
One original-demo execution on `bx_6czhvg6m`, 2026-10-20 12:15 UTC.
The two previously demonstrated dependency failures are repaired. **Actual
Boot Camp paired-scroll acceptance remains unmet:** startup calls a null
`wincpuid` procedure pointer before reaching the menu. No renderer or ordinal
patch, second guest launch, main integration, or worker launch occurred.

## Dependency repair and preflight

Reused `/home/user/icm-fullvm`, retaining its canonical source/module:

- Source `8f6dcc71c7d3685e764da945e6c379ecca30fa49`, all 6,415 staged Git blobs
  independently reverified after provisioning.
- WASM SHA-256 `6642ceea29e035531819fafe795f949ad0d343460fa73af5d23ee3b2f2a968e2`.
- Original EXE SHA-256
  `dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c`;
  all 168 prior staged assets and original registry reverified.
- Node v24.18.1; approximately 49 GB free remotely.

Installed `pngjs` **7.0.0** from the exact repository lockfile URL. Verified
the archive against its lockfile SHA-512 integrity before extraction. It has
no package dependencies. No package/lock or production source edits.
The npm archive encodes directories without execute permission (`0666`);
plain tar extraction initially failed on its own newly created `lib` directory.
The initial error/receipt is preserved. Restored that user-owned directory's
traversal mode and extracted the same verified archive with
`--no-overwrite-dir`. No access policy or privilege change was involved.
Constructed the real raster canvas and `Win98Renderer`, then encoded a PNG.

Copied these exact historical support DLLs into the documented initial PE
discovery location `/home/user/icm-fullvm/test/binaries/dlls/`:

| File | SHA-256 |
| --- | --- |
| comctl32.dll | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4` |
| ole32.dll | `bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d` |
| mfc42.dll | `73b4b8b26b9632d67fd0d5f631326cfe54fb0d00959423eb616adfb8001b0717` |
| msvcrt.dll | `befb0220cffdb1a440ab6b7b94638ea659a5e44cba615186eb8464dec1675e5e` |

Source was the retained original
`/home/user/army-men-local-stage-v14-20261019/runtime/test/binaries/dlls/`;
each byte matched the prior scroll-entry `pins.json`. No DLL redownload or
local binary duplicate. An in-memory archive transferred the four files;
remote archive and extracted bytes were verified.

The unchanged `resolveDllGraph` and `detectRequiredDlls`, using the runner's
discovery directory order, resolved five PEs (the four above plus the
app-local original `smackw32.dll`) with zero missing dependencies. This checks
the static import graph, **not future names passed to LoadLibraryA**.
The actual run confirms all five PEs loaded, their DllMain calls returned 1,
and the EXE/MFC imports were patched. The prior MFC42 ordinal trap and
renderer-unavailable message are absent.

## One execution and exact next blocker

Used the unchanged reviewed observer preload, cooperative threads,
200,000-block batches, a 750-batch/90-second bound, and prior ordinary
click/Numpad6 schedule. Exact arguments are in `recovered/launch.json`.
The runner exited 0 after 750 batches, but that exit code is **not success**:

- At batch 9 it logged `[eip-zero] guest called through NULL`.
- `dbg_prev_eip=0x004584c8`, EAX=0, stack return address `0x004584cf`;
  final main EIP remains zero.
- The five guest screenshots are identical black 640×480 images.
  `bootcamp.png` is only the scheduled filename; visual review confirms it
  does not depict Boot Camp.
- `paired.json`: `accepted:false`, zero records, pinned owner, zero observer
  errors, zero pending depth. No HRESULT or pre/post scroll samples exist.

Static disassembly and strings from the exact original EXE identify the
failing sequence:

```text
458493  push "cpuinf32.dll"
458498  call [66d840]             ; LoadLibraryA
45849e  mov ebx,eax
4584a0  test ebx,ebx             ; nonzero branch reaches lookup
4584ba  push "wincpuid"
4584bf  mov esi,[66d83c]         ; GetProcAddress
4584c5  push ebx
4584c6  call esi
4584c8  mov [5f5380],eax
4584cd  call eax                ; NULL, return address 4584cf
4584d2  push "cpunormspeed"     ; later lookup, not reached here
```

The 168-file staging manifest omitted `windows/system/cpuinf32.dll` and
`cpuinfo.dll`, both present in the historical original installed VFS. The
current LoadLibraryA implementation's absent bare-DLL fallback can return the
EXE image base; the saved stack contains `0x00400000` in the preceding
module-argument position. This is consistent with a synthetic nonzero module
handle followed by a failed `GetProcAddress`, rather than a missing MFC
ordinal or terrain-copy failure. No new API trace was run; this attribution
combines the saved null-call state, original instructions, static loader
source, and manifest absence.

Retained original bytes were read-only hash-verified locally:

| Original VFS file | Bytes | SHA-256 |
| --- | ---: | --- |
| windows/system/cpuinf32.dll | 19968 | `5e7f97ecbb834822a9913124f181c1e82ffbda6a7c13f2deb1f963c09383f31e` |
| windows/system/cpuinfo.dll | 7680 | `9049c886ec2496e67dcf1c0b10e42a0a44f1ff29f203e7b60e54375c9802602c` |

Both originals export `wincpuid` and `cpunormspeed`; `cpuinf32.dll` statically
imports KERNEL32/ADVAPI32, while `cpuinfo.dll` additionally imports MSVCRT.
Their PE reports and original pins are retained. The precise next prerequisite
is restoring the original dynamically loaded CPU DLL closure under the VFS
system path used by `findVfsDllBytes`, then verifying those named exports.
`cpuinfo.dll` is retained historical companion evidence; this run directly
demonstrates only the `cpuinf32.dll` lookup. No claim is made that these two
files exhaust all later dynamic dependencies.

Per the bounded task, **no additional provisioning or execution followed
this new blocker**. Terrain stripe causality remains unknown.

## Evidence, recovery, and release

Self-contained new evidence:
`scratch/runs/20261020-army-runtime-closure-retry/`.
It includes provisioning/controller JS, dependency-resolution receipt, source
and asset verification, initial extraction failure, recovered run logs,
screenshots, observer report, static PE diagnosis, archive and hash inventory.
The recovered archive and all 23 listed artifacts were hash-verified.
`verify-evidence.js` replays the important evidence assertions without a guest.
No candidate ID exists in the local corpus manifest for this game, so this
investigation uses `receipt.json`, not a dashboard record for another game.

Remote evidence is `/home/user/army-closure-evidence` and
`/home/user/army-closure-evidence.tar.gz`. Prior Army and ICM evidence was
preserved. Only the report is committed on the isolated task branch; ignored
evidence is retained separately. No local build or full checkout was created.
Runtime lease released at 12:16:46 UTC on the append-only messageboard; box
left running for coordinator-owned queued work. No gameplay or stripe-fix
claim is made.
