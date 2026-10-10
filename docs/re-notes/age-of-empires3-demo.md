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
