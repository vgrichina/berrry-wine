# Neverhood original DSETUP6E thunk contract (2026-11-13)

**Original SETUP/DSETUP6E.DLL supplies selector 1 → EXECUTEINF at NE segment 2:1792 and selector 2 → DSETUPINSTALLDEVICEDRIVER at 2:12fe.** Its ThunkData16 export is data at **6:002e**, ordinal 1. These are actual member entries and relocated table targets. They are not a proposed replacement for the Win9x thunk engine. **NO_NATIVE_RESULT; installation, first room and gameplay remain OPEN.**

This continues the [DSETUPE attach/setup trace](neverhood-original-dsetupe-attach-setup-path-20261113.md) and [DSETUP wrapper trace](neverhood-original-dsetup-export-path-20261113.md). Evidence and reproducible static helpers: `scratch/runs/20261113-neverhood-dsetup6e-2460/`. Production stayed read-only; incoming WIP was preserved. No original instructions were executed or patched and no result was supplied.

## Custody and address convention

Verified **51 sealed2320 and 57 sealed2220 artifact hashes** before relying on their PE-side evidence. Exactly one request recovered original ISO bytes **650399744–650444847**, total **651438080**, from <https://archive.org/download/neverhood_202508/Neverhood.iso>. Parsing followed admission of HTTP **206**, exact `Content-Range: bytes 650399744-650444847/651438080`, declared/actual length **45104**, identity/absent Content-Encoding, and full SHA-256 **`a3feb8e3a947d8c6b6c594b80b5c0db0c5bd26968f3d749c27781cb60d6c7d7d`**. `fetch.py`, `http.json` and `member.json` preserve recipe and receipt. No duplicate DIRECTX copy, other media dependency, full ISO or media under `/home` was recovered.

The supervised2320 lifecycle was reused: a separate parent starts the recovery child and enters **Popen.wait(timeout=1200)**; HTTP has a 30-second timeout. A short-deadline control actually killed/reaped a sleeping child, exit **-9**. Recovery child **1847237** subsequently exited **0**, board watcher **1847238** exited **-15**, and the supervisor's exec session returned **0**. Its `finally` removed `/dev/shm/neverhood-dsetup6e-2460.dll`; `stop-receipt.json` records removal and `deadline_fired=false`. These are observed exits, not a claim that an unobserved background watchdog persisted. Every selected window was compared with the admitted whole member before stop. **20 windows totaling 5116 bytes** remain, including header/entry/name tables, relocation records and selected code/data. The whole DLL is not retained.

NE header is at file **0x80**, flags **0x8301**, automatic data segment **6**, heap/stack sizes zero, initial **CS:IP 1:0054**, SS:SP zero. Segment numbers below are module-local NE indices, **not assigned runtime x86 selector values**. File mappings are 1→0x280, 2→0x18e0, 3→0x3600, 4→0x3680, 5→0x4200, 6→0x43c0. Segment6 raw/minimum allocation is **25112** bytes. Every far pointer needs its actual relocated selector; raw `ffff`, chain links and zero selector placeholders in objdump output are not executable target addresses.

Imports name **KERNEL, USER, SETUPX, VER, LZEXPAND** and use ordinals. These are binding obligations, not proof that every import is exercised. No dependency module was fetched. `ne.json` records entries and relocation chains; `windows.json` retains bounded original bytes and hashes. `ne.py` decodes bundles, names, segments and relocation chains without loading/executing a guest.

## NE startup and connection are distinct boundaries

The header starts **1:0054**, not exported DLLENTRYPOINT. Startup saves DI/DS/CX/BX/SI into data6:0042–004a. With CX nonzero, **1:007b** calls KERNEL ordinal4 (LocalInit); zero result takes the exit. With this header's zero heap it skips that conditional call. It then calls KERNEL ordinal23 at **1:0088**, ordinal3 (GetVersion) at **1:008d**, performs a DOS-version path through INT21 AH=30 or KERNEL ordinal102 according to the imported flags, and calls local CRT helpers **1:02ec/03f4**. Their complete CRT closure remains outside this trace.

**1:00e3 → 1:02c0 → 2:00a4** is the actual startup-to-LibMain chain, proven by internal selector relocations. The last function stores the instance WORD from BP+0x0e at **data6:6212**, returns AX=1 and **retf 0x0a**. This local return alone neither connects the thunks nor installs DirectX. WEP ordinal3 is **2:00b4**, AX=1, `retf 2`.

Exported **DLLENTRYPOINT ordinal2 at 2:00ba** is a separate notification function with **retf 0x10**. It loads its automatic DS through a segment6 relocation, then pushes, in instruction order:

1. CS:0040 → `dsetup6e.dll`;
2. CS:0034 → `dsetupe.dll`;
3. WORD [BP+0x10] (instance);
4. DWORD [BP+0x12] (notification reason).

The far call **2:00d2 → 3:0010** is fixed by an internal segment3 relocation. The helper pops the far return offset/selector, pushes **segment6:002e** (ThunkData16), **segment3:0026** (`thk3216_ThunkData32`), its CS WORD, restores the far return pair, and far-jumps at **3:0021** through **KERNEL ordinal651**. Thus immediately before that jump, relative to SP, the stack contains return IP/CS at +0/+2, helper CS at +4, name32 offset/selector at +6/+8, data16 offset/selector at +0x0a/+0x0c, reason DWORD at +0x0e, instance WORD at +0x12, and the two earlier DLL-name pointers at +0x14/+0x18. These byte-level pushes establish a **24-byte API argument area**, independent of a generic thunk recipe. The notification function normalizes the unsigned returned AX to BOOL using `cmp ax,1; sbb ax,ax; inc ax` at **2:00d7**.

The original relocation proves **KERNEL!#651**, not its name or implementation bytes. Wine's [kernel export specification](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/krnl386.exe16/krnl386.exe16.spec) labels that ordinal **ThunkConnect16**, with a seven-argument signature consistent with those widths. This is external naming corroboration, not a recovered Microsoft implementation or evidence that Wine behavior ran here. Likewise, exact exported resident name **THK3216_THUNKDATA16** is uppercase while the sealed PE requests mixed-case `thk3216_ThunkData16`; actual NE name matching/case normalization belongs to the connection contract, not an established lookup failure.

On the PE side, sealed2320 proves ThunkConnect32 receives `(ThunkData32, "thk3216_ThunkData16", "dsetup6e.dll", "dsetupe.dll", hModule, reason)`. Its table at PE VA **0x10009578** begins `LS01`; this NE's **6:002e** also begins `LS01`. Data16's far pointer at **6:0036** relocates to **3:0000**. The original four-entry far-pointer table is:

| Selector byte from PE stub | NE target | Export |
| --- | --- | --- |
| 0 | 2:1292 | CHECKVMCPDVERSION, ordinal6 |
| 1 | 2:1792 | EXECUTEINF, ordinal7 |
| 2 | 2:12fe | DSETUPINSTALLDEVICEDRIVER, ordinal4 |
| 3 | 2:126e | DSETUPISNEC, ordinal5 |

Each selector halfword in this table belongs to an original relocation chain targeting segment2. The PE byte selector is an **index**, distinct from that relocated selector. Only indices1/2 are demonstrated calls on the prior setup closure. The table proves their target association; it does not prove which connection algorithm generates or patches the PE indirect dispatch pointer, or how it switches stacks/modes, acquires locks, allocates aliases, or handles failure/unload. Those remain obligations of the unrecovered kernel machinery. No speculative cross-mode rewrite is proposed.

## Selector1: INF execution, six-byte frame, signed AX

Sealed PE **0x1000478f** sets CL=1, pushes the low WORD of argument1 (HWND), maps argument2 via **SMapLS_IP_EBP_12**, pushes the returned DWORD far pointer, and calls through **[0x10004719]** at **0x100047a2**. On return `cwde` sign-extends AX, the matching unmap runs and the stub returns **ret 8**. No UTF conversion or widening is demonstrated. The actual mapping of flat pointer contents/lifetime into a valid selector:offset is still required.

At **2:1792**, Pascal push order gives **BP+6 = far INF path**, **BP+0x0a = HWND WORD**. The function loads DS, then:

| Original boundary | Exact operation |
| --- | --- |
| 2:17a5 → SETUPX!#2 | Pushes the INF far pointer and address of a local WORD at BP-4. Nonzero AX immediately returns **AX=0**, `retf 6`. |
| 2:17b6 → 2:004e | Pumps messages using the saved driver HWND global **data6:6214**, not the supplied BP+0x0a WORD. The retained pump uses USER ordinals109/108/113/114. |
| 2:17cc → SETUPX!#101 | Pushes opened INF WORD, **segment5:013a = "DefaultInstall"**, and **0x007f**. Its returned AX is not used. |
| 2:17d4 → SETUPX!#4 | Closes the opened handle. Its AX is also discarded. |
| 2:17d9–17de | Returns WORD **[BP-2]**, restores DS, **retf 6**. |

Wine's [SETUPX specification](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/setupx.dll16/setupx.dll16.spec) names #2 **IpOpen**, #101 **GenInstall**, #4 **IpClose**. The original imports themselves contain ordinal edges; those names corroborate their interpretation. **Crucially, the successful-open branch does not initialize BP-2 in this function.** The observed store target is BP-4 for the opened WORD; no recovered SETUPX body establishes whether anything writes the adjacent WORD. Therefore do not report GenInstall's result as the selector's result, assume TRUE on success, or invent deterministic zero. The PE sign-extends whatever AX is returned; the original DSETUPE registration-stage caller ignores that value anyway. No child-process launch is established by this function.

## Selector2: driver frame, dynamic SETUPX APIs and DX:AX

Sealed PE **0x10004739** sets CL=2, pushes argument1 narrowed to a WORD, maps/pushes four flat pointers (arguments2–5) using EBP+12/+16/+20/+24 helpers, then pushes four DWORDs (arguments6–9) unchanged. The NE frame is consequently:

| NE offset from BP | Original PE argument |
| --- | --- |
| +6, +0x0a, +0x0e, +0x12 | DWORD arguments9,8,7,6 respectively |
| +0x16, +0x1a, +0x1e, +0x22 | far pointers from arguments5,4,3,2 respectively |
| +0x26 | low WORD argument1, HWND |

That is **34 bytes**, matching **retf 0x22 at 2:178f**. The PE then reconstructs **EAX = (DX.low16 <<16) | AX.low16** using `shl eax,16; shrd eax,edx,16`, unmaps four pointers, and performs **ret 0x24**. It does not merely return AX or convert every nonzero result to one. The original driver caller ORs **0x80000000** into the flags before entering this thunk.

The NE stores HWND at **data6:6214**, calls **KERNEL!#95** at **2:1316** with literal **segment5:00d6 = "setupx.dll"**, and rejects handles below32. Five calls to **KERNEL!#50** then resolve literal names from segment5:

| Name | Name offset | Saved far function pointer |
| --- | --- | --- |
| CtlGetLddPath | 0x00e2 | BP-4 |
| CtlSetLddPath | 0x00f0 | BP-0x1a |
| DiGetClassDevs | 0x00fe | BP-8 |
| DiBuildCompatDrvList | 0x010e | BP-0x0c |
| DiCallClassInstaller | 0x0124 | BP-0x10 |

These names are **original bytes**, not inferred from a standard Win9x driver sequence. All five pointers must be nonzero; failure frees the module and returns **DX:AX=0** at 2:1788. The resolved **CtlGetLddPath(1, local buffer)** call is at **2:13c5**; **CtlSetLddPath(1, argument5)** at **2:13ce**. A nonnull argument5 is also copied to a global buffer. **2:140f** calls the resolved DiGetClassDevs with zero DWORD, argument2 far pointer, and local far-pointer output. Its AX must be zero and the output nonnull to enter the device-list loop; otherwise cleanup follows.

The loop follows far next pointers at record+2/+4. It tests flags, examines record fields and conditionally sets a parent window via USER ordinals268/269. The resolved **DiBuildCompatDrvList(record)** is called at **2:155b/158e**, with its result gating later work. Additional local helpers choose/copy/version/check driver/INF data. The selected wrappers **2:1202/1226/124a → 2:117e → 2:1098**, and deeper **2:0bfc**, remain unexpanded; no concrete copied file list or nested installer result is established. Version/class conditions can alter the metadata DWORDs in the stack frame. These branches cannot be collapsed into an unconditional driver install.

On the demonstrated conditional installation branch, **2:16e2** calls the resolved **DiCallClassInstaller(2, record)**. Its returned AX is **ignored**; **2:16e5** unconditionally sets local DWORD BP-0x14 to **1** after that call. This original local result therefore records that branch, not verified class-installer success. USER ordinal430 string comparisons and other conditions can avoid it. Cleanup calls **SETUPX!#305 at 2:1760**, restores the saved LDD path via the resolved setter, frees the module via KERNEL!#96, and returns **DX:AX from BP-0x14/-0x12** at 2:1779. The zero initialization is at 2:13f4. Neither zero nor one proves driver changes persisted. The prior PE caller turns a nonzero driver-helper result into dialog result1; that further interpretation does not strengthen the evidence.

## Source boundary, verification and next work

At the pinned revision plus relevant incoming diff, `src/09a7-handlers-dispatch.wat` still implements **ThunkConnect32** with only EAX=1 and ESP+=28 stores. It has no binding call, target mutation or dependency load. All ten imported SMapLS/SUnMapLS EBP names are absent from `src/api_table.json`; KERNEL ordinal651 is absent from the generated Win16 ordinal map. These are concrete source/name gaps. **They do not identify the first observed runtime failure**, since no runtime ran. Existing NE entry/data-selector helpers and generic loader support do not establish the two-sided connection, matching export lookup, relocation/import closure, stack conversion or actual 16-bit APIs composing correctly. The unsuffixed DirectXSetup handler's zero return cannot replace these originals.

Verification passed **50 contract checks**, **20 window hash checks** and, before removal, **20 live window comparisons**; offline checks repeat the contract/hash checks after removal. **14 byte/custody negative controls** reject wrong selector target, INF/driver/connection cleanup, class-installer operation, section/signature, HTTP status/range/encoding/length, full-member hash and short/long bodies. Three pure source negative controls reject altered TRUE, cleanup and hypothetical binding. Source checks also cover name gaps and five DX:AX bit-algebra vectors, with signed AX handling. These are static/pure checks, never CPU, guest, Machine, VM, WASM or native execution.

Git remains the source archive: recorded Git SHA, relevant incoming diff, owned new-file/helper patches, source pins, patch reconstruction checks and artifact hashes replace any snapshot/archive. Only this note is committed. Docs diffcheck and strict main pull/push are publication checks; no full build or runtime is authorized here.

The remaining concrete boundaries are kernel connection/alias/mode-transition implementation; actual SETUPX ordinal/API output and mutation behavior; unexpanded driver helpers and required INF/driver records; and original loader/notification execution with observed choices/returns. Any further media dependency or runtime work needs separate authorization. No fake success, skip or original patch was introduced. **NO_NATIVE_RESULT; original installation, first room and gameplay remain OPEN.** Box ID **none**, state **NOT_CREATED**, expiry **null**, box stop receipt **N/A**. No worker, box, reserve/resource work or general cleanup occurred. Release ownership after docs-only publication and stop.
