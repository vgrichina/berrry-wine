# BLOCKED_UNQUALIFIED_VERSION_SOURCE

The exact original import is **DSETUP.DLL ordinal 11 = DirectXSetupGetVersion**, not DirectXSetup. Its native contract is proven from the retained installed DLL and config executable. The dependency planner skips that native DLL because the real-PE registry does not list it. However, enabling it alone would expose existing unqualified synthesized DirectX version information through the original native reader. No production change is claimed or committed; this is the permitted evidence-backed blocker outcome.

Canonical remote main was reconciled as **89f1e9d2c67aa94d56d2319115589d07204d42e0** before selecting source. Every inspected source file in `source-pins.json` was checked against that commit's exact Git blob. Root source was historical for several relevant files; exact matching blobs came from existing read-only donors. No fetch, lazy fetch, broad checkout, original executable patch, binary download, compute access, build or guest rerun occurred.

## Authoritative original contract

`native-receipt.json` records the four installed inputs recovered by the coordinator from bx_m4xrrj5a. All four hashes and sizes were independently checked. The receipt and files total **830976 bytes** (the request's 840976-byte description is a 10000-byte arithmetic discrepancy). No original binary is committed.

Authentic DSETUP.DLL is 135680 bytes, SHA256 `5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f`, image base 0x10000000. Its export base is 1, with 15 named exports. EAT slot 10 is ordinal **11**, named **DirectXSetupGetVersion**, RVA **0x18b0**. Ordinal **5** is `DirectXSetupA` (RVA 0x2190); ordinal **8** is `DirectXSetupW`. GNU objdump output and the separate PE parser agree; no ordinal-number heuristic or external definition was used.

Original D3DConfigUtility.exe is 573440 bytes, SHA256 `850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0`. Its original import directory associates **IAT 0x409024** with **DSETUP.DLL#11**. At 0x402970 it pushes 0x40deec, then 0x40def0, and calls 0x40309c. That thunk is `jmp [0x409024]`. Return address is 0x40297f, matching the observed failure. It immediately compares `WORD [0x40def0]` with 6 and takes `jae`; it does **not** test EAX. The first pointer is the version output, the second the revision output. Reading only the low word is this original caller's behavior, not a proposed capability policy.

Native C-shaped contract inferred directly from instructions:

```c
BOOL __stdcall DirectXSetupGetVersion(DWORD *pdwVersion, DWORD *pdwRevision);
```

Both pointers are optional: the wrapper tests each before a four-byte write. It initializes an eight-byte local pair to zero, calls native helper RVA 0x1570, copies each requested output, returns EAX=1, restores locals and executes **ret 8**. Including the return address, ESP advances **12 bytes** relative to entry. Non-null invalid pointers are not validated by the wrapper and can fault. Aliased output pointers receive the revision last. No explicit SetLastError occurs in the wrapper; helper/API side effects must not be invented as a normalized error contract. Detection can leave zero outputs while BOOL remains 1. Some malformed registry parse paths can retain partially parsed fields; this is not generalized into 'all failures zero'.

`native-version.disasm.txt` retains the helper, parser and wrapper. The helper first reads HKLM `Software\Microsoft\Directx`, value `Version`, parses four decimal components and packs the first two into version and last two into revision. On missing/failed registry detection it probes the OS, then on the Win9x branch inspects **SYSTEM\DDRAW.DLL** through GetFileVersionInfoSizeA/GetFileVersionInfoA/VerQueryValueA(`"\\"`). It copies the actual VS_FIXEDFILEINFO file-version DWORDs at offsets 8 and 12. If no version is obtained from the ordinary missing-file path, the initialized pair stays zero. Its NT paths have separate OS/export-based assumptions; none are substituted for the Win98 case here.

The API returns detected metadata; **BOOL 1 does not prove DirectX is installed or a GPU/API capability is supported**. Nor does the native DLL being present supply the runtime it describes.

## Why the authentic native dependency was skipped

The exact canonical `lib/dll-registry.js` lists neither DSETUP.DLL nor DSETUP32/16 as loadable. `lib/process-boot.js:resolveDllGraph` applies `isLoadable` before `loadSpec`; a real file beside the EXE/VFS cannot influence that skipped lookup. The real canonical JS graph, run offline against original PE import bytes, confirms that **dsetup.dll is never requested**. A diagnostic callback override allowing only that additional name causes the same graph to request and select the authentic bytes. This override exists only in the evidence probe; no production allowlist was modified. Missing-file and wrong-name controls select no DSETUP image.

`src/08-pe-loader.wat` initially creates ordinal thunks. `src/08b-dll-loader.wat:resolve_import_ordinal` consults the guest system ordinal table then host fallback. Neither contains a DSETUP mapping; `src/api_table.json` has no DirectXSetupGetVersion handler. After a genuine native mapping, the existing import-patching path is the preferred way to bind the EXE to the DLL export; an API alias is unnecessary. No Wasm mapping/patching/execution is claimed by this offline planner probe.

DSETUP.DLL's static requirements are KERNEL32, USER32, ADVAPI32, WINMM, VERSION and ole32. Its version wrapper does not call DSETUP32. A separate setup path (RVA 0x1b30) dynamically loads `DSETUP32.DLL` and gets setup exports. The preserved DSETUP32 is a real PE32 with a back-import of DSETUP and thunk data exports; DSETUP16 is an NE importing KERNEL, USER, KEYBOARD, SETUPX and VER. `native-analysis.json` retains the original export/import inventories. Their presence is not evidence of SETUPX/16-bit installation support. No attempt was made to invoke setup or skip prerequisites.

## Why an allowlist-only repair is not qualified

The canonical VERSION handlers in `src/09a1-comctl-handlers.wat` recognize static DirectX module names and copy **$DX_VERSION_INFO**, regardless of an authentic module's runtime qualification. `src/01-header.wat` gives that block a fixed **4.6.3.518** file/product version, explicitly described as DirectX 6.1a. Independently, `lib/process-boot.js` synthesizes a code-free DDRAW.DLL containing the same version resource; the offline probe reads its actual resource bytes as version `0x00040006`, revision `0x00030206`. These two routes agree because they were authored to agree, not because this task established supported-runtime behavior.

Consequently, if native detection follows its missing/invalid-registry Win9x fallback, it reaches that unqualified version source and the original config's low-word comparison can pass. The actual installed registry's DirectX value is not in the small local input set, and this task did not inspect remote registry state or rerun the guest. **The exact branch and outputs of a future run remain unknown.** This is source evidence of a reachable fabrication risk, not a claim that this exact call was observed returning the synthetic version. The previous run trapped before executing native code.

The existing `handle_DirectXSetup` returns unconditional zero with three-argument cleanup and no output writes. Its existing test only asserts that return and cleanup. It does not establish an installed runtime, handle ordinal 11, or validate version/capability semantics. Reusing it would additionally advance ESP by 16 rather than 12 and leave both caller outputs unwritten. It was left unchanged because it is not this import's contract.

**Concrete prerequisite for a faithful repair:** a reviewed truthful source/policy for the supported runtime version (including unknown/unqualified state), carried through the existing registry and VERSION answers used by this authentic reader. No supported DirectX version is established by these inputs; it remains **null**. Authentic DSETUP export identity is no longer a missing prerequisite. A guessed fixed version, use of the game's minimum version, always-success replacement handler, or bare allowlist change that silently treats the fixed metadata as qualified would not meet this assignment. Changing shared version semantics without an authoritative supported-runtime basis would expand uncertainty rather than resolve it. No such change was made.

## Checks and limits

Commands, from this isolated repository:

```sh
python3 scratch/runs/20261022-shadow-man-dsetup-ordinal-support/verify.py
node scratch/runs/20261022-shadow-man-dsetup-ordinal-support/probe-loader.js
node --check scratch/runs/20261022-shadow-man-dsetup-ordinal-support/probe-loader.js
```

PASS: four native file seals; exact canonical source pins; independent export/import parsing; original callsite/IAT, optional-output instruction sequences, zero initialization, helper target, native BOOL and ret-immediate evidence. Four rejecting mutation controls cover guessed DirectXSetup identity, wrong ordinal, three-argument stdcall cleanup and wrong IAT. The real JS graph probe isolates the loadability gate, rejects missing-file/wrong-name cases, and independently detects the existing synthesized DDRAW version resource.

These are **offline source/ABI evidence checks**, not guest ABI execution/output tests, a new implementation's semantic acceptance, a full canonical compilation, or runtime/gameplay qualification. No production fragment, API table, generated table, executable, version/capability value or test tier was modified; compilation/generation gates are therefore inapplicable to this report-only commit. SHA pins confirm inspected production files remain unchanged. No new wasm was created; historical wasm f644bbb2 is not treated as the current canonical build.

Changed tracked paths are this evidence directory only (report, recovery, original table/disassembly text, JSON inventories/pins/resources, and reproducible offline probes). The coordinator retains review/build/runtime decisions. No further task or worker is scheduled.

## Resources and ownership

Admission projected **25763840 bytes** including 8 MiB reserve and the read-only native input folder, below the whole-task 67108864-byte cap. Final measured accounting and protected Git metadata seals are in `resources.json`. No binary is duplicated into this task. Source is a thin explicit checkout preserving the unrelated base tree in the index and commit; sparse missing files are never staged as deletions.

No runtime box was queried, resumed, stopped or created. Per the coordinator's append-only board receipt, **bx_m4xrrj5a was snapshot-stopped at 2026-10-22T20:31:48.291Z**, operation stop_58ff8c00e35a74e8, error null. Prior expiry was 2026-10-22T21:52:45.530Z. This is attributed coordinator evidence, not an independent lifecycle query. Ownership stays with the coordinator. One bounded task concludes with this blocker.
