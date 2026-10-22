# Age of Empires III trial

## Original media inventory (2026-10-10)

- Local source: `test/binaries/win98-games-a-d/Age-of-empire-3trial-Win98-SW.exe`
- Bytes: 383598224
- SHA-256: `4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad`
- PE32 x86 GUI executable; initial bootstrap contains InstallShield strings.
- No entry in the inspected public `DESKTOP_APPS` list or prior qualification in the task/re-note index. This is not a release or redistribution decision.

Original bytes are staged on temporary boat `bx_hx8msa33` with verified SHA-256. No installed game path has been established. No installer approval, gameplay, audio or FPS result is claimed.

Task: `NEW-GAME-AOE3-DEMO-20261010`; owner root Codex, one worker with serialized runtime resources.

Boat staging completed with matching SHA-256. 7-Zip recognizes PE sections and a383337416-byte `[0]` overlay, not a ready installed tree. Version resources identify Microsoft Game Studios, Age of Empires III Trial and an InstallShield11.0 setup launcher (2005-04-14). Next capture original bootstrap extraction/child launch without accepting installer dialogs.

## Bootstrap observation (2026-10-10)

Original bootstrap starts at `0x0041e77c`, creates the InstallShield Wizard, and reports OS checking, Windows Installer configuration, then extraction of `instmsia.exe` and `Age of Empires III Trial.msi`. At 04:03:58Z controller332371/guest332378 was still running; guard04:07:20Z. This is extraction progress, not proof of complete MSI or gameplay. Output remains `/home/user/aoe3-bootstrap-20261010` on the boat; inspect terminal cleanup and captured files before launching a child.

## Original launch (04:12Z)

Bootstrap completed04:04:06Z. Captured MSI375136768 bytes yields Data1.cab174 files/569072090 bytes. Host msiextract reconstructed /home/user/aoe3-installed-20261010/Age of Empires III on bx_hx8msa33, without installer approvals. Original age3.exe SHA2565d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256.

Explicit seeds of original rockalldll.dll, granny2.dll and deformerdll.dll resolve the initial FAST_HEAP import trap; binkw32 auto-loads. Known msvcrt and Explorer98 shlwapi fixtures were staged; native shlwapi resolves PathIsRelativeW. This is launch dependency configuration, not a new emulator API fix.

Current stop is an empty MessageBoxW, return0x486c17. Both UTF16 text buffers begin with NUL. The original data/StringTable.xml (UTF16,2404654 bytes) opens successfully; only the optional .xmb lookup misses. Do not label this missing XML. No-uop reproduces the modal, so that tier is not required for the failure. No button answered. Next trace string-table parsing and error construction before0x486c17. Evidence scratch/runs/20261010T0410Z-new-games-bootstrap-diagnostics, bounded excerpts and original run identities; full logs remain on boat.

## MSXML startup resolved to EULA (04:32Z)

Correction to the interim board/STATUS claim: XP did not originally finish MSXML initialization. The full log reported64 exhausted resumes inside the null heap walk; counting neighboring successful DLL lines was misleading. Both tiers reproduce. A read-only initializer probe found an early GetProcAddress(InterlockedExchangeAdd) failure. The API was absent from the table. Adding its atomic add operation with prior-value return permits MSXML heap initialization. Startup probe confirms a nonzero function pointer and subsequent real heap allocation.

MSXML then requests C:\msxml4r.dll through LoadLibraryExA; the original resource-only DLL was missing from the pre-initialization VFS. Seed it from the MSI System:System directory alongside native MSXML4, plus the native dependency configuration and XP profile above. With that assembly the original game reaches its EULA. No Accept/Decline button was answered. Evidence scratch/runs/20261010T0430Z-aoe3-eula (reviewed); this is a held approval boundary, not gameplay.

Validation: canonical build passes; test-wat-locks --interlocked-only10/10, including two real OS workers, old-value return, signed wrap and sparse/unaligned boundaries. Full suite19/20 twice: its unlocked negative control loses no updates on this host. The parent source/test reproduces that same control failure18/19; no new failure. Evidence scratch/runs/20261010T0432Z-interlocked-exchange-add.

## Dynamic OLEAUT32 ordinal repair candidate (2026-10-22)

Accepted diagnostic commit `07037a8a2eb82c4a86cd3ee64a098f3e98173e0a` records the executed MSXML4 delay lookup `GetProcAddress(0x400000, 8)` returning NULL, followed by native `RaiseException(0xc06d007f)` and actual parseURL failure return. The requested module was OLEAUT32; its LoadLibrary result aliased the EXE, so the handle lost the module identity needed for ordinal lookup.

Against remote main `63d563df7a2b901d222a311ceaf55a0823a22261`, append OLEAUT32 to the existing static-module identity list and add host ordinal 8 → VariantInit. Wine's pinned `oleaut32.spec` establishes the ordinal; the existing WAT static resolver and VariantInit handler already implement it. No handler/API numbering changes. The actual repaired dynamic path uses the WAT ordinal resolver before host fallback.

The full-module Calc-fixture regression reproduces the baseline EXE alias/NULL and verifies the candidate's distinct handle, returned thunk, actual VariantInit execution through the guest run loop, VT_EMPTY/union clearing without release, adjacent storage, saved return address and ESP. Unknown ordinals and unrelated DLL/EXE aliases remain unresolved. This fixture uses its own image base `0x1000000`; it is not an original-game retest.

Five candidate test files pass (focused OLEAUT32, existing DirectX/DirectSound ordinals and two BSTR suites). Existing `test-getprocaddress-sparse-name.js` fails identically on baseline and candidate at “real named export resolves”, `0 !== 2105344`. Stop at that dependency; no broad repair, canonical build attempt, deployment or gameplay claim. All 373 retained original pins match. Evidence and exact hashes: `scratch/runs/20261022-aoe3-oleaut-ordinal-repair/REPORT.md`, `HANDOFF.json`, `verify.py`. The assigned box remains running under coordinator lifecycle ownership.

## Original capabilities dialog diagnosed (2026-10-22)

Exact accepted candidate `c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2`, normal canonical module SHA256 `6ac6b43475d9217ffffa98aaec3f57243de47c78c0647dcd31abef404e008678`. One bounded ordinary original startup/Accept diagnosis, unchanged runner/module/native/XML/registry; no rebuild or gameplay qualification.

Native `ConfigDetect.dll` loads at `0x01aa7000` (original base `0x10000000`). Its version helper calls `CoCreateInstance` at original `0x10007e93`, returning at runtime `0x01aaee99`: observed EAX `0x80040154` (class not registered), output pointer `0x074ff92c` contains zero. CLSID `{A65B8071-3BFE-4213-9A5B-491DA4461CA7}`, IID `{9C6B4CB0-23F8-49CC-A3ED-45A55000A6D2}`, outer NULL, CLSCTX 1. Native strings identify the DxDiag system/version route. The final guest registry has no DxDiag class registration.

That failure has a native fallback and is not sufficient alone to explain the dialog. The fallback returns S_OK but classifies DirectX as `0x00040008` (minor/version word `0x0001032a`); the final d3d9 version-info-size query returns zero. `Config_InitVideoCardInfo` tests the classified version against `0x00040009` at original `0x10007dd5`, takes the below-minimum branch, writes "ConfigDetection class not initialized", and returns zero. Direct caller return `age3.exe:0x00488b05` observed EAX zero and previous EIP `0x01aaee0b`. The EXE then constructs localized string ID 41632 (`0xa2a0`, `cStringConfigDetectionProblem`) at `0x00488b0d` and returns failure. `CheckRequirements` is resolved but is not reached on this branch. This is a concrete DirectX detection prerequisite failure before video-card initialization, not a measured GPU capability deficit.

Evidence run `scratch/runs/20261022-aoe3-system-capabilities-diagnosis/`: REPORT/HANDOFF, exact native disassembly, hashed old/new raw-log byte excerpts, screenshot, local and remote verifiers. Full new log remains on assigned runtime at `/home/user/aoe3-system-capabilities-diagnosis-oct22/guest/output.log`; recovery recipe describes integrity checks. Title `<unsupported>` remains separate. MSXML parseURL actual returns remain UNKNOWN. No repair, bypass, alternate fixture, deployment, or further input was attempted.

## Genuine native DxDiag overlay retest (2026-10-22)

The retained genuine Pirates dxdiagn.dll (1,720,320 bytes, SHA256 `50e31067ca6872ae0b7b35a65bf2a9d07c1de539b2d603a9472a48f5375c8307`) plus its actual HKCR CLSID InprocServer32 registration repairs provider creation but **does not remove the capabilities dialog**. One isolated overlay, one original startup, one ordinary EULA Accept; same accepted source/module above. The runner copy is byte-identical, the DLL is mounted through existing `--vfs-mount`, and the imported registry differs by exactly the real class key. Original 373 pins, 3420 source inputs, runner/dependency/module identities pass before and after. DirectX Version remains `4.07.00.0700` and InstalledVersion bytes remain unchanged through final export.

Actual native CoCreateInstance return at `0x01aaee99`: S_OK, `*0x074ff92c = 0x018e1ff4`. Initialize, GetRootContainer, GetChildContainer and version-property reads all return S_OK. The major VARIANT at `0x074ff934` is VT_UI4 (19), value at `0x074ff93c` is 7; the minor property returns VT_UI4, value 0. The native version helper returns S_OK with detected `0x00040007`; the caller compares that against `0x00040009` and `Config_InitVideoCardInfo` again returns zero at `age3.exe:0x00488b05`. The same readable capabilities-error body is directly inspected. This is the measured DX7 detection result; actual DX9 availability and gameplay remain unqualified.

Offline import audit found 200 named and seven ordinal imports. All seven OLEAUT32 ordinals map to existing APIs. Two named service imports (OpenServiceA, QueryServiceConfigA) lack implementations, but native disassembly guards both behind OpenSCManagerA, which this exact runtime returns as NULL. These are deferred system imports, not proved startup blockers. The preliminary audit's strict unresolved-import verdict is superseded by this guard analysis and the actual successful native initialization; no service APIs were fabricated or added. Optional SetupDiEnumDeviceInfo and GlobalMemoryStatusEx lookups return NULL, yet the native provider and version query succeed; they are not assigned as the capabilities failure.

Evidence: `scratch/runs/20261022-aoe3-native-dxdiag-retest/{REPORT.md,HANDOFF.json,RECOVERY.md,verify.py,verify-remote.py,guest/excerpts.json,guest/post-accept.png}`. Raw log stays on the same assigned box at `/home/user/aoe3-native-dxdiag-retest-oct22/guest/output.log`; SHA256 `62713189a5b947d87730d602c31763899e815ca17de86e8ff81ac9c85e648d4e`. Guest exited zero after evidence capture, PID absent, ports 8123/8124 closed; bx_h44kbrcy remains RUNNING under coordinator shutdown ownership. No further input, second startup, version/capability spoof, source/native/XML patch, build, repack, merge or deployment.
