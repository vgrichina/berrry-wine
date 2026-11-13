# Neverhood original DSETUP export and attach path (2026-11-13)

Original **SETUP/DSETUP.DLL!DirectXSetupA** is ordinal **5**, RVA **0x11e0**. On its ordinary Win9x route it forwards **(HWND, ANSI source directory, DWORD flags)** to **DSETUPE.DLL!iDirectXSetup**, resolved during DLL process attach. This moves the first unresolved original-code dependency inside the loader callback, before SETUP95's eventual export call. Neither the existing unsuffixed `DirectXSetup` handler nor a DLL attach return of TRUE proves installation. **NO_NATIVE_RESULT; original installation, first room and gameplay remain OPEN.**

This continues [the original Install command trace](neverhood-original-install-command-path-20261113.md). Evidence is `scratch/runs/20261113-neverhood-dsetup-2220/`. Production is read-only; incoming WIP was preserved. No original instructions were executed, patched or substituted, no registry was mutated, and no menu answer was supplied.

## Custody and address conventions

All **73 prior2140 artifact seals** were verified before reuse. One recovery requested only ISO bytes **650375168–650399743**, total image length **651438080**, from <https://archive.org/download/neverhood_202508/Neverhood.iso>. Admission required HTTP **206**, exact `Content-Range: bytes 650375168-650399743/651438080`, declared and actual lengths **24576**, identity encoding and full member SHA-256 **`7327040443ec90228b4fbd9f424b32528aff61d49c772a3d7ad16fc76aa3f14a`**. `http.json`, `member.json` and `fetch.py` retain the receipt and exact recovery recipe. The duplicate `SETUP/DIRECTX/DSETUP.DLL` has the same manifest length/hash and was not fetched.

The member existed only at a unique `/dev/shm` path. A separate **1200-second deadline watchdog** wrote its armed receipt before recovery. **Lifecycle limitation:** final checks found its PID and the board watcher PID already absent, with no deadline-fired or cooperative-stop receipt; continued independent watchdog operation is unproved. The cause of early termination is unknown. The HTTP request itself had a 30-second timeout. After comparing every retained window directly to the admitted member, the RAM file was explicitly removed; `ram-removed.json` records the full hash and removal. No full ISO, second member or media under `/home` was staged. Only **20 bounded windows totaling 3240 bytes** remain in `windows.json`, each with exact bytes, file mapping and SHA-256. Parsed metadata and string values are not a retained DLL. No additional dependency was recovered.

All DLL addresses below are preferred VAs at image base **0x10000000**; relocate by actual base minus that value. SETUP95 addresses retain its **0x400000** base. The DLL is PE32 i386 with entry RVA **0x2010**, five sections, no TLS directory and no delay-import directory. `.data` has raw size **0x1000**, virtual size **0x21a8**; the globals at `0x1000605c/6060/6068/606c/7198/71a4` initially lie in its zero-filled tail. They must then retain original mutations through nested loading and callbacks.

## Caller and exports

Sealed SETUP95 bytes establish **LoadLibraryA at 0x407bb1**, **GetProcAddress("DirectXSetupA") at 0x407bdc**, and **`call edi` (`ff d7`) at 0x407c30**. Its arguments are the progress HWND, source `setup\` directory and resource-7500 flags **0x10000a3f** (installed-state processing can OR **0x80**). The raw result goes to setup field **+0x114**, then the launcher restores CWD and frees DSETUP. The existing unchecked export lookup remains a caller defect, not a successful failure handler.

The exact export address/name/ordinal tables are retained at RVA **0x4140–0x4287**. None of the nine entries is a forwarder:

| Ordinal | Name | RVA |
| --- | --- | --- |
| 1 | DirectXDeviceDriverSetupA | 0x1260 |
| 2 | DirectXDeviceDriverSetupW | 0x12c0 |
| 3 | DirectXRegisterApplicationA | 0x12d0 |
| 4 | DirectXRegisterApplicationW | 0x1520 |
| 5 | DirectXSetupA | 0x11e0 |
| 6 | DirectXSetupIsJapan | 0x17d0 |
| 7 | DirectXSetupIsJapanNec | 0x17f0 |
| 8 | DirectXSetupW | 0x1250 |
| 9 | DllMain | 0x1080 |

There is **no unsuffixed DirectXSetup, DirectXSetupGetVersion or DirectXSetupSetCallback export** in this member. Names/comments describing other DSETUP versions are not this DLL's ABI. The uncalled driver/application registration exports are inventoried, not followed as part of SETUP95's call. `DirectXSetupW` here returns **-9** directly with `ret 0x0c`; it is not an ANSI implementation alias.

## Loader callback precedes DirectXSetupA

The loader must enter **0x10002010**, not exported **DllMain 0x10001080**. Both use the three-DWORD DLL callback ABI and `ret 0x0c`, but the PE entry performs CRT work first. Its optional callback pointer **0x100071a4** is initially zero; conditional calls through it at **0x10002045/20d1** are CRT callback plumbing, not a DirectX installation callback.

| Checked edge or operation | Original obligation |
| --- | --- |
| 0x10002078 → 0x10001ec0 | CRT attach must return nonzero before application DllMain at 0x10002090 → 0x10001080. Failure cleanup is present; entry returns the accumulated BOOL. |
| 0x10001ecd → IAT GetVersion | Earliest ordinary attach API in this retained route; optional kernel32 `IsTNT` lookup also occurs before CRT initialization. GetVersion is not GetVersionExA. |
| 0x10001f1f → 0x10002420 → HeapCreate at 0x10002429 | Private CRT heap request `(0, 0x1000, 0)`; real handle/allocation lifetime is required. |
| 0x10001f59 → 0x10002250 | InitializeCriticalSection for four original locks, TlsAlloc, zeroed CRT allocation of **0x74** bytes, TlsSetValue and GetCurrentThreadId. TlsAlloc=-1 or failed allocation/set prevents successful CRT attach. |
| 0x10001f6c/1f77 | GetCommandLineA and environment-block helper; later helpers cover CRT file/codepage/environment state. Those larger helper bodies are outside this retained window closure, not assumed successful. |
| 0x10001fa2 → 0x10002120 → 0x10002230 | Null-checked initializer walkers. Data at 0x1000500c points to **0x100034d0**; termination table at 0x10005018 points to **0x100035a0**. No installation callback supplied by SETUP95. |
| 0x10002090 → 0x10001080 | Application DllMain stores hModule at **0x10006068**, then reason 1 calls classifier **0x10001140** at **0x100010bd**. |

The classifier constructs a **0x94-byte OSVERSIONINFOA**, calls GetVersionExA at **0x10001153**, and does not check its BOOL. Its local classification is:

| OS fields read from original API output | Class at 0x1000606c |
| --- | --- |
| platform 1, exactly major 4/minor 0 and low build WORD < 950 | 4 |
| other platform-1 values | 1 |
| platform 0 | 5 |
| platform 2, major < 4 | 3 |
| platform 2, major >= 4, queried DirectX InstalledVersion >= 3 | 6 |
| platform 2, major >= 4, queried DirectX InstalledVersion < 3 | 8 |
| other platform | 2 |

The NT query **0x100011b9 → 0x10001e00** uses LoadStringA resources **3100/3101**, `HKLM\SOFTWARE\Microsoft\DirectX`, value **InstalledVersion**, through RegOpenKeyExA/RegQueryValueExA/RegCloseKey. It initializes the returned DWORD to zero and uses key access **0xF003F**. This is **not a service-pack check**. Incorrect or missing output/error behavior can change the selected branch. SETUP95's own earlier resource OS gate rejects the ordinary NT route; a local zero on that route is not permission to select it.

For classes **2, 3, 6, 8**, DllMain leaves the sibling handle zero. Other classes call **0x100017d0**: GetSystemDefaultLCID exactly **0x411** selects literal **DSETUPJ.DLL**, otherwise literal **DSETUPE.DLL**. LoadLibraryA occurs at **0x100010e9** or **0x100010f6**, using a **bare basename**, not a constructed sibling path. SETUP95 has already changed CWD to source `setup`; actual loader search remains significant. The nested load must run its own dependencies and entry callbacks before returning.

If the handle is nonzero, **GetProcAddress at 0x10001115** resolves **`iDirectXSetup`** into **0x10006060**, and the call at **0x10001127** resolves **`iDirectXDeviceDriverSetup`** into **0x1000605c**. DllMain does not reject either missing export. It returns **TRUE even when the sibling failed to load or either pointer is zero**. Reason 0 frees a nonzero sibling through FreeLibrary at **0x100010ae**, then CRT detach follows; reasons 2/3 are distinct thread notifications. These BOOLs are loader results, not DirectX installation results.

## Exact setup call, return, UI and registry boundary

**DirectXSetupA 0x100011e0** tests class 1 and the stored `iDirectXSetup` pointer. For class 1 with a nonzero pointer, it forwards all three original arguments at **0x1000122c** through **`call [0x10006060]`**. Its own **`ret 0x0c` at 0x10001249** proves stdcall cleanup for the original SETUP95 caller; the delegated call has no caller-side argument cleanup and therefore also requires a callee-cleaned three-DWORD ABI. The sibling's actual implementation and ABI bytes remain uninspected.

The signed delegated result is saved in **ESI**. If **flags & 0x0a27 != 0** and result is **nonnegative**, call **0x10001240 → 0x10001ae0** performs wrapper component-registration work. Original flags **0x10000a3f** satisfy that mask. The registration helper's BOOL is ignored; EAX is restored from ESI afterward. Thus a nonnegative return does not prove even the wrapper's registry writes completed. Neither return zero nor return one should be injected.

That helper uses **StringFromGUID2** on original GUID **`{44BBA855-CC51-11CF-AAFA-00AA00B6015C}`**, WideCharToMultiByte and LoadStringA **3000–3002**. It creates `HKLM\SOFTWARE\Microsoft\Active Setup\Installed Components\{GUID}`, writes the default REG_SZ **Microsoft DirectX**, obtains this DLL's filename, and calls **0x10001d50** to read its file version via GetFileVersionInfoSizeA/GetFileVersionInfoA/VerQueryValueA(`"\\"`). It queries and conditionally updates an **8-byte REG_BINARY Version** value using the original comparisons. LocalAlloc/LocalFree, cdecl wsprintfA cleanup, output pointers, version buffers and registry error paths all matter. This bounded helper is not the uncalled DirectXRegisterApplication export and does not prove driver/INF installation.

For non-class-1 or a missing setup pointer, **0x100011f5/1215 → 0x10001960** receives HWND and flags, with source path discarded. Its exact jump table gives these local results:

| Class | Raw signed result | Original message resource |
| --- | --- | --- |
| 2 | -11 | 1005; absent from this DLL's string table |
| 3 | -1 | 1001, DirectX currently does not work on Windows NT |
| 4 | -1 | 1002, DirectX requires the final version of Windows 95 |
| 5 | -1 | 1003, DirectX requires Windows 95 |
| 6 | 0 | no message |
| 7 | -9 | no message; not produced by the retained classifier |
| 8 | -13 | no message |
| outside 2–8, including class 1 with missing pointer | -9 | no message |

The error helper **0x10001a00** saves/restores SetErrorMode and suppresses its message when prior **SEM_FAILCRITICALERRORS bit 1** is set. Otherwise it loads title **1000**, text from the requested resource, and calls **MessageBoxIndirectA at 0x10001acd**, using a **40-byte MSGBOXPARAMSA**, **MB_ICONHAND 0x10**, and zero help context/callback/language fields. These are synchronous original error-dialog boundaries; no chosen answer or observed dialog is claimed. Resource 1005's absence does not prove what text a failed LoadStringA leaves in the original uninitialized buffer.

No local fallback generates **1 or -12**. Those can only be established on the delegated route (or other code outside this closure). Prior2140's caller accepts raw **0/1/-12** in the record executor, sets restart-required for **1**, and interprets **-12** as cancellation later. This wrapper trace does not establish any of those delegated outcomes. The current outer wrapper exports no installation callback setter, forwards no callback argument, and supplies no DirectX callback in these bytes. Callbacks inside DSETUPE/J, their possible dialogs, INF/driver decisions, 16-bit thunks and additional dependencies remain unknown.

## Primitive and child boundaries against actual source

The import table has **68 entries** from **KERNEL32, USER32, ADVAPI32, VERSION and ole32**. `handler-inventory.json` finds named handlers for all 68 in current actual source; this is an inventory, not execution or behavioral coverage. No static CreateProcess, WinExec, ShellExecute or child wait import exists. The bounded called closure contains no demonstrated child launch; **absence here cannot rule out a child inside the unrecovered sibling**. The separate later SETUP95 Play/CreateProcess boundary remains as recorded in prior2140.

The earliest concrete primitive obligations are PE relocation/import binding and the exact DLL callback frame, then GetVersion, module/export lookup, CRT heap/critical sections/TLS, and the original OS/locale outputs. `lib/dll-loader.js` builds `(hModule, reason, reserved)` and checks return/stack completion; `src/08b-dll-loader.wat` resolves real named exports. Existing GetVersion/GetVersionExA handlers use `$winver`; HeapCreate allocates a private handle; TLS handlers reserve indices and store thread values. Those source bodies do not prove the original CRT initialization sequence completed. No first failing runtime primitive has been measured.

`lib/dll-registry.js` registers **dsetup.dll** as app-local PE. DSETUPE/J are absent from that set, but **this alone does not prevent dynamic loading**: actual `lib/host-imports.js` file lookup checks VFS current-directory resolution and available DLL files; LoadLibraryA can yield for such a file. Eight pure actual-source checks cover the registry and the extracted lookup closure, including original-file presence, missing/wrong sibling, rejection of a synthetic static-module entry, available-file discovery and the unsuffixed handler. Synthetic lookup records are test inputs, not mounted media or guest state. Loaded-module GetProcAddress returns an exact export match or NULL; there is no evidence that `DirectXSetup` can satisfy `DirectXSetupA`.

The first unresolved original-code edge for ordinary non-Japanese Win9x is therefore **DllMain → LoadLibraryA("DSETUPE.DLL") → its entry/dependencies → GetProcAddress("iDirectXSetup")**, followed by the call through **0x10006060**. Prior manifest identifies **SETUP/DSETUPE.DLL**, length **46080**, offset **650446848**, end **650492927**, SHA-256 **`bdb0ec0953570355b9d6995f8c70e067bd314911090acf32fbe9883f33875945`**. Its DIRECTX duplicate has the same length/hash. These are identity facts only; **no recovery is authorized or performed here**. Japanese selection names DSETUPJ.DLL, whose manifest entry exists under SETUP/DIRECTX; availability/search under the caller's source `setup` directory is a separate unresolved condition. DSETUP6E is a manifest sibling, not a demonstrated direct dependency of this wrapper.

The existing **`src/09a8-handlers-directx.wat` unsuffixed DirectXSetup handler unconditionally returns zero**. Its name, comments and result cannot replace this export, nested sibling initialization, real return, error UI or conditional registry work. No production edit is proposed.

## Verification and handoff

**154 live static checks**, **134 post-removal static checks**, and **8 pure actual-source checks** pass. They bind **44 rel32 edges plus 11 selected IAT edges**, exact export ordinals, caller `ff d7`, argument cleanup, conditional mask, fallback targets, NT registry names, imports and original windows. **Eight negative controls** reject HTTP status/range/length/hash/encoding changes, a changed entry-call displacement, wrong stdcall cleanup and changed fallback-table target. They run the same validation gates as the positive inputs; none executes original code.

`git-start.txt`, `identity.json`, source/input pins, `relevant.patch`, `owned-doc.patch` and `new-helpers.patch` preserve exact Git identity and relevant incoming/owned hunks. Git remains the source archive; no source-tree snapshot or archive was made. Patch reverse checks, per-window hashes and `SHA256SUMS` seal the evidence. Only this new note is committed; docs diffcheck and strict main pull/push are used. Full build/runtime checks are excluded by this static-only task.

Next work requires separate authorization to recover and statically trace the exact DSETUPE member above. Later original installation requires authorized full media/runtime and observed original decisions/results. Native installation, first frame, first room and gameplay remain **OPEN; NO_NATIVE_RESULT**. No CPU engine/Machine/guest/VM/WASM/native/browser/game/full build, box, worker, reserve/capacity or general cleanup work occurred. Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**. Own watchdog and board watcher PIDs are absent at final checks, with the lifecycle limitation above recorded in `stop-receipt.json`; ownership is released after docs-only publication and this single-task worker stops.
