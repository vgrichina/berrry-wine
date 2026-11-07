# Crimsonland: native DX81 setup requires authentic Win9x USER.EXE

Run `scratch/runs/20261107-crimsonland-authentic-installed-state/` advances the
dependency investigation through the **original DX81 installer**. Installation
does not complete: its first observed prerequisite is the language/version
resource of `C:\Windows\System\user.exe`. The emulated base system supplies a
147-byte NE placeholder without resources. Native setup logs
`GetLangCodePage(): GetFileVersionInfoSize Failed!` and ends with value **-9**
(`Internal or unsupported error`). This is an absent authentic base-system
dependency, not a demonstrated CPU, memory or VERSION implementation mismatch.

## Reused findings and recovered inputs

Read the recovery/mapping commits `0f897faee` and `02a8cbe2b`, the later
builtin-execution repair and complete INF review in [crimsonland.md](crimsonland.md),
and the [current Survival prerequisite audit](crimsonland-current-survival-20261107.md).
The settled game detector, original section selector, loader policy and INF
directive analysis were not repeated. The additive manifest's inability to
replay deletion and component registration remains a reason to use actual setup
or verified installed output, rather than a detector-only resource mount.

The three October evidence directories are absent at their recorded paths.
A filename search including ignored files under `/home/user` and `/tmp` finds
no retained DX81eng package; the separate November 7 Descent3 recovery audit
also records its absence. The retained worker event logs preserve historical
commands and outcomes, but their file-change records omit patch bodies. They
cannot restore the missing verifier, full payload inventory or replay scripts.
`recovery-input-status.json` and `recovered-prior-commands.json` retain these
observations; no predecessor directory or archive was changed.

Only after that check, fetched the exact recorded small package from
`https://am.net/lib/tools/Microsoft/DirectX/dx81eng.exe`. Its **12,144,784 bytes**
match the accepted SHA-256
`d1762981f497a623b2f3e725c0916b96e716bd4a8845c5a4cc7f764b1a5cc5f7`.
7-Zip CRC validation and extraction pass for **327 files / 26,608,972 bytes**.
`payload-pins.json` records every member. The original INF and D3D8 hashes match
the earlier published pins. The historical Authenticode conclusion is inherited
through exact package identity; its missing verifier was not reconstructed or
claimed to have run again. No alternative package or original game media was
downloaded, copied or modified.

## Actual native setup result

Used the existing shipped module, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
through ordinary cooperative `test/run.js --no-build`, the original
`payload/dxsetup.exe`, and `--vfs-include=*`. The module's relationship to current
source is not asserted as a new build. Local source commit
`c60f5c8a3e6920a29da75737bbd9847b769e9d76` and relevant binary diffs are retained.
No emulator source was changed and no build was required.

Personally reviewed `setup-initial.png` (original license dialog), then
`setup-after-license.png` (original Install button), then `setup-install.png`
(desktop after the install attempt). Bounded probes added the ordinary clicks
only after reviewing the preceding screen: license Yes at `(280,354)`, batch120;
Install at `(260,249)`, batch130. No guest memory, configuration, version,
registry or OS override was forced. Native DSETUP and DSETUP32 loaded through
the existing dynamic loader; the builtin DirectXSetup success stub is not the
installation evidence. Host process exit0 is not installation success.

The new focused API trace observes GetSystemDirectoryA returning17, then
GetFileVersionInfoSizeA returning0 at API749, with return address `0x013ad90b`.
The observed DSETUP32 base is `0x013a7000`, preferred base `0x400000`.
Original setup code `0x408aea..0x408b46` obtains the system directory, appends
its literal `\\user.exe` at `0x4024cc`, and calls GetLangCodePage at `0x4068f1`.
That helper's failed version-size call returns to original `0x40690b` and
reports the exact native log message. The caller returns -9. This setup-only
analysis identifies a newly executed prerequisite; it is not a repeat of the
game detector disassembly. Trace, both small disassemblies and the unique
`native-directx.log` remain in the run.

The registry delta is limited to native setup removing its `DXSetup=0` value
under `HKLM\SOFTWARE\Microsoft\DirectX`; `command=0` remains. No Version value
is supplied. The exported Windows tree retains synthetic D3D8 rather than the
package DLL. Its pin inventory was saved; redundant stock-file exports were
then removed, retaining the unique setup log. No completed INF copy, component
registration or authentic installed state is claimed. The game manifest and
all61 original registered paths remain byte-identical to the predecessor pins.

## Resource distinction and next prerequisite

`resource-audit.cjs` reuses the predecessor's already-passing API fixture module
`7dcb949af0f4cd99e06453aaa96143db5f3b238ed1d972bafcb75ea2e9876a03` only
after verifying all its recorded source hashes still match. It tests new
authentic input in a disposable VFS: the original D3D8 resource reads as844bytes,
with fixed version4.8.1.881 (`00040008`, `00010371`). The ordinary USER.EXE
placeholder reads as0bytes; its NE resource and resident-name table offsets
are equal, confirming no resources. There is no persistent registry import or
original game execution. This proves resource availability, not installation
or successful execution of the original game's prerequisite check.

All20 loose USER.EXE copies found under `/home/user` are the same147-byte
placeholder, including this run's temporary export. No Win98 CAB/ISO or
compressed USER.EX_ input was found by the named-file search. The DX81 package
does not contain USER.EXE. **Next supply a provenance-verified Win9x base-system
USER.EXE with its genuine version/language resource**, then continue native
DXSETUP and retain its actual installation effects. Verify support for the
original NE resource format when those genuine bytes are available; no result
for an unavailable original file is inferred here. Wider setup queue,
deletion, registration and restart requirements remain unexecuted.

Recovery: retain `DX81eng.exe` and its hash; the payload can be regenerated
with `7z x -y -oNEW_DESTINATION DX81eng.exe` and compared to `payload-pins.json`.
Use the exact commands in `RECOVERY.txt` for the bounded native setup probes
and resource fixture. Do not mount just D3D8 as a completed dependency setup,
invent USER.EXE resources, copy Version registry values or bypass detection.

No current original Crimsonland guest, browser, native gameplay input, box,
driver qualification or gameplay capture ran. D3D8 backend identity, movement,
aim and firing consequences remain unobserved. Boat ID/state/expiry are N/A;
there is no runtime ownership or shutdown handoff. `/home` remains above2GB.
The note is the sole tracked change; evidence uses Git SHAs and patches,
with no source-tree archive. `result.json` is written last.
