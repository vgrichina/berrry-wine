# CMR3 native registry preparation

Current resumed sequence: use the **fresh-build controller** described at the
end of this document. The pre-pause `5f43d41f` / `d463bdae` reuse plan is
historical and does not qualify current main `e86bf1640`.

Source-only recipe: `tools/cmr3-register-native.js`. No guest, build, remote
command or registration was executed during preparation. Runtime ownership
must be granted by the root coordinator; Kkrieger's menu diagnostic is next.

The recipe uses the nine historical registrations (including both QASF runs),
explicit native msvcrt/MSDMO/WMASF dependencies and builtin OLE. It requires a
clean isolated checkout with no common DLLs (`test/binaries/dlls` may contain
only its tracked regular `SOURCES.md` documentation). The runner's
dynamic lookup searches that directory before the executable directory even
with `--dlls`; the fresh registration VFS contains only the authenticated
12 DLL/AX files and regsvr32. No shared directory is renamed or modified.

The Outcast DIRECTX registration executable is 30,720 bytes, SHA256
`ea8bb5cb31357ee2866e0fce651a29694cb286be9b5e2f96508a92b5f4b3dfeb`.
Local bytes were reverified at the path in the native recovery plan. Static
`objdump -d` shows `GetProcAddress` result stored at `[esp+0x10]`, indirect
call at `0x40133d`, and HRESULT test at `0x401341`; negative HRESULT sets
exit 5. The `.data` string at `0x406040` is `DllRegisterServer`. The existing
runner `--trace-at=0x401341` observes registers without modifying guest data.
Acceptance requires exactly one observed EAX zero, exactly one guest Exit
zero and no trap/NULL/timeout diagnostic. The target DLL must leave its native
InprocServer32 entry, except WMVCORE, whose actual export writes an embedded
profile file instead (see static review below). Host exit zero alone fails. Unexpected successful nonzero
HRESULT also stops for review. Partial exports remain diagnostic evidence.
An absent return trace is an inconclusive acceptance failure; it does not
diagnose a defect in the native DLL. Review the bounded log before attributing
the failure to registration or changing guest behavior.

Each step preserves argv, merged stdout/stderr, host status/signal/error,
registry export and assessment. Limits are 20,000 batches / 45 guest seconds,
55 host seconds with SIGKILL, nine sequential steps, 570 seconds internal
admission budget, and a required 600-second outer timeout. No threads/child
process flags are enabled. The output is exclusive and never overwritten.
The capacity gate reserves 512MiB above the 2GiB floor. The original 302-file
and native12 inventories are checked before and after; success is written
only after postflight. The registry is **newly generated**, compared with
the missing original SHA but never called recovered unless byte-identical.
Only the two historical C: game root values are seeded; COM keys come from
the original native registration code.

After an explicit runtime grant, prepare an isolated checkout of the reviewed
commit on `bx_erf37bxf`, transfer the authenticated registration executable,
and obtain a canonical build there (or transfer a byte-verified canonical
module built from that exact source). Record canonical build evidence and
the source/module hashes. Do not use a module from a different source tree.
Create `/home/user/cmr3-registry-config-20261015.json` outside the checkout:

```json
{
  "checkout": "/home/user/cmr3-registry-checkout-20261015",
  "output": "/home/user/cmr3-registry-run-20261015",
  "nativeRoot": "/home/user/cmr3-native-recovery-r3-20261015/native",
  "gameRoot": "/home/user/cmr3-recovery-20261015/assembly/game",
  "regsvr32": "/home/user/cmr3-registry-input-20261015/regsvr32.exe",
  "commit": "REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT",
  "moduleSha256": "REPLACE_WITH_CANONICAL_MODULE_SHA256",
  "gameInventorySha256": "0c09b40c8eadaf148a0a7285be61a1c3e78d090649b41464f4a5e2192f0940b4"
}
```

The game inventory hash was independently read from the retained local
`scratch/runs/20261015-cmr3-original-recovery/assembly/game-inventory.json`;
remote input must match it. The twelve native pins remain in
`docs/cmr3-historical-receipts-20261015.json`, with acquisition provenance in
the native recovery plan/result. The only unknown pin is the future canonical
module; the placeholders deliberately fail closed.

Exact registration command after those prerequisites and grant:

```sh
timeout --signal=TERM --kill-after=5s 600s node /home/user/cmr3-registry-checkout-20261015/tools/cmr3-register-native.js /home/user/cmr3-registry-config-20261015.json
```

Stop on any failed step; do not continue from partial exports or invent missing
COM keys. Check outer terminal status and surviving processes before releasing
the runtime slot. Review final classes (FilterGraph, SampleGrabber, WM ASF
Reader, WMA/WMV decoders and MultiLanguage) and preserve all evidence before
any separately authorized game replay. Registry generation is not a gameplay
qualification. Synthetic acceptance/order tests and the test-manifest gate
passed; this is not an end-to-end registration result.

Root review found that the initial source checkpoint omitted the registration
tool handoff from its branch base, leaving `registry.registrationTool`
undefined. The exact reviewed `a86527eb6065aa623225fa440a0f1df07b8cfd20`
handoff is now incorporated. A source-contract regression fails on the old
checkpoint and passes with the handoff, checking the tool's presence, size,
SHA256 and historical provenance marker. All three focused tests pass.

## First bounded registration execution

Root granted the sole runtime after palette validation. Current main
`6b269258` was merged before the candidate was pushed. Fresh checkout staging
exposed tracked `test/binaries/dlls/SOURCES.md`; the gate now permits only that
regular documentation file and rejects all other entries and symlinks. Four
focused tests pass. Exact tested candidate: `6dfbff842c372d9db5cec8e1b833485d2cb312aa`.

Canonical build process 72385 passed at 10:33:22 UTC on 15 October. Module
SHA256 `d463bdae09d9a4e8926c31f0a594535331a2a85d39d494c0e281b920ce9f0fa5`
matches the independently built current main. Registration process 73364 ran
10:34:12–10:34:13 and exited 1. Devenum, quartz, qedit and QASF passed their
HRESULT/exit/native-key checks (107, 493, 658 and 671 exported entries).
WMVCORE's actual return trace at `0x401341` reports EAX zero and guest exit
zero, but it added/changed no registry entries and has no InprocServer32
value naming WMVCORE.DLL. Its snapshot is byte-identical to the QASF input.
The strict oracle stopped here; WMADMOD, WMVDMOD, repeat QASF and MLANG were
not attempted. This does not establish a defect in WMVCORE: the next review
must establish the real export's intended effects before changing acceptance.

Postflight 10:34:53 UTC found no surviving registration processes; all 6,491
tracked source hashes, module, original 302 files and native12 were unchanged.
The slot was released to root. Forty artifacts (1,649,340 bytes) were copied
and size/SHA verified under `scratch/runs/20261015-cmr3-native-registration`,
plus terminal receipts and summary. Archive SHA256:
`98d5416b457d4228ab95bf58d714dd3a28e9d8e917fd4f2024b357e854a6f92e`.
All source manifest entries independently match the local tested candidate.
Remote run and build evidence remain in `/home/user/cmr3-registry-run-20261015`
and `/home/user/cmr3-registry-build-20261015`. No game was launched, no complete
registry was produced, and no retry was made after the acceptance failure.

## WMVCORE export review and corrected per-DLL contract

Root authorized a read-only transfer of the exact original DLL for local
static analysis while Kkrieger owned runtime. No guest, build or remote
mutation occurred. The 2,058,888-byte file matches historical SHA256
`e79cace0a0c1495275b794cda6c96f0bada550cf2ce4bdf435cd59dc8f1f48d2`.
`objdump -p` identifies ImageBase `0x08530000` and ordinal 7
`DllRegisterServer`, RVA `0x76e7d`. Its runtime address in 73364 was
`0x00899000 + 0x76e7d = 0x0090fe7d`, exactly the observed GetProcAddress
result. This file exports no DllGetClassObject or DllUnregisterServer.

Local disassembly of original VAs `0x085a6e7d` through `0x085a6fde` shows:

1. GetModuleHandle for `wmvcore.dll`, then FindResource type `PRXFILE`, ID
   200. LoadResource, LockResource and SizeofResource provide its bytes.
2. GetSystemDirectory A/W through helper `0x0864716b`. The export searches
   backward for the case-insensitive seven-character `\system` suffix,
   terminates just after its leading slash, and appends `WMSysPr9.prx`
   (wide string pointed to by global `0x086c7cec`). The current Win98 directory
   helper returns `C:\WINDOWS\SYSTEM`, so the exact target is
   `C:\WINDOWS\WMSysPr9.prx`.
3. SetFileAttributes NORMAL, CreateFile A/W through helper `0x08547e3b`
   with access `0xc0000000`, share 1, creation disposition 2 (CREATE_ALWAYS),
   attributes `0x80`, then WriteFile of the resource size and CloseHandle.
   Missing resource/module/path/file or false WriteFile yields E_FAIL.
   The export does not compare bytes-written with the requested length,
   so the external exact-file check is necessary even after S_OK.
4. No RegCreateKey/RegSetValue/COM-registration call occurs on this export's
   paths. Those imports elsewhere in WMVCORE do not establish a registration
   effect. Its lack of an own InprocServer32 entry is legitimate.

The PE resource directory identifies `PRXFILE/200/1033` at RVA `0x1a3460`,
316,640 bytes, SHA256
`95f1edbc3cb9aa70a374a61b43bd16818636b0190aa841504130bb718c39c2c7`.
It is a UTF-16 profile document beginning with `<PRX>`. Static evidence
(exact DLL, PE dump, full export/helper disassembly, extracted resource and
identity manifest) is retained under the failed run's `static-review/`.
Reproduce the export listing with `objdump -p WMVCORE.DLL` and its body with
`objdump -d --start-address=0x085a6e7d --stop-address=0x085a6fdf WMVCORE.DLL`.

Historical source evidence is consistent but weaker: retained session
`01a1373b-0a03-7af0-8752-f2ddc42f7ace`, event 3322, prints the original
`register-wmp9.js`. It chained registry snapshots and checked host status
and export existence; it did not require a WMVCORE class or preserve VFS
output. The old aggregate 677→770 key count describes the four-DLL group,
not WMVCORE's individual effect. It does not justify synthesizing keys.

The source recipe now treats only WMVCORE specially: require observed S_OK,
guest exit zero, no failure diagnostic, an unchanged imported registry, and
exactly one freshly exported `.prx` file at `windows/wmsyspr9.prx` with the
resource size/hash above. All other DLLs retain their native InprocServer32
checks. `test/run.js` invokes `saveVfsToHost` after guest execution; resident
created files are exported. `lib/vfs-export.js` strips `c:\` and converts
backslashes to host separators. The `.prx` suffix filter captures duplicates
at other paths too; no prefix filter hides them. The source tests exercise
the production exporter and reject missing/wrong/duplicate outputs.

The WMVCORE input VFS initially contains only the authenticated native files
and regsvr32, with no seeded profile. After validation, COPYFILE_EXCL copies
the actual guest-produced file into the owned staging VFS at
`registration/windows/wmsyspr9.prx`, preserving it for every subsequent
registration process. Postflight verifies that staged copy. Any eventual
game launch must explicitly mount this retained file at its Windows path
along with the new registry; the original 302-file game tree stays unchanged.
The extracted static resource is used only as a comparison identity, never
as a registration input or substitute generated output.

Six focused tests pass, including downstream DLL contract retention and
missing/wrong/duplicate file rejection. An additional offline roundtrip
through the production exporter with the authenticated extracted resource
passes (synthetic trace, not a guest result). No retry has run. Failed73364
remains an inconclusive file-effect run because it did not request VFS export;
its S_OK/exit and unchanged registry are not retroactively a complete pass.

## Resumed current-main preparation: fresh canonical build required

Main `e86bf1640aded49ece2b5d80efd2fe4e040f9b03` changes compiled WAT in
`src/10f-gdi-dc.wat` and `src/13-exports.wat`, plus host renderer/GL/RPC code.
GPU-owned window surfaces now defer readback until GDI needs canonical pixels;
the host synchronizes through opcode `0x10002`, with new ownership exports.
Registration/COM/filesystem implementations and `test/run.js` are unchanged.
Silent regsvr32 runs do not normally produce GL frames, so these changes do
not explain the previous WMVCORE file-effect oracle mismatch. Nevertheless,
the compiled source changed and the old `d463bdae` module cannot validate this
main. This review is source evidence, not a runtime regression claim.

`tools/cmr3-build-register.js` sequences a fresh canonical build and the same
nine registration steps. The standalone controller can be staged outside an
isolated checkout, so the reviewed target commit need not contain this new
controller. It verifies the exact configured commit and clean tree, records
all tracked source hashes, refuses shared/symlink build paths, and moves old
module artifacts to its own `prior-build/` evidence directory. A failed build
cannot fall back to an old artifact. The controller derives moduleSha256 from
the newly produced regular WASM file only after `tools/build.sh` exits zero
and tracked sources remain unchanged. It then writes a separate generated
registration config and invokes the existing native-registration recipe.

The updated `docs/cmr3-registry-r2-config-20261015.json` is a **controller
request**, with exact target `e86bf1640` and `moduleSha256: null`. Passing it
directly to the guest-registration recipe fails its hash gate. A supplied old
module hash also fails the fresh-build controller. The old preflight JSON is
explicitly superseded but retained as a historical receipt.

After the box is restored through authorized means and root grants the sole
runtime slot, stage the reviewed controller separately at
`/home/user/cmr3-build-register.js` and the request at
`/home/user/cmr3-registry-config-r2-20261015.json`. Checkout exactly the request's
commit in the owned isolated checkout; if main changes again, review and pin
that concrete commit before staging. Require both output directories to be
fresh. Record the staged controller/config hashes, then run:

```sh
timeout --signal=TERM --kill-after=5s 900s node /home/user/cmr3-build-register.js /home/user/cmr3-registry-config-r2-20261015.json
```

Canonical build is bounded at240s (+5s kill grace); registration at600s (+5s),
with the existing per-DLL45/55s bounds. Build/config/source/terminal evidence
is retained in `cmr3-registry-fresh-build-r2-20261015`; guest evidence remains
in the separate fresh `cmr3-registry-run-r2-20261015`. The original73364,
original/native bytes, and all old build/static evidence remain intact.
Any build or registration failure stops the sequence; no game launch is part
of this controller. Process-survivor checks and runtime release remain the
coordinator's postflight responsibility even after a timeout.

Eight focused pure-JS tests pass, including stale-pin, failed/interrupted-build,
missing/malformed/symlink-module rejection and prior native/profile tests.
Syntax, diff and1937-test manifest checks pass. No canonical build, remote
command or guest execution occurred during resumed preparation; the future
module hash is deliberately unknown until that build succeeds.

## Fresh-box handoff if the saved box remains unavailable

Target `bx_9ef2wdsw` currently belongs exclusively to the Kkrieger lane.
This plan is **unexecuted**: no transfer, acquisition, build or registration
may begin until root grants the slot after that lane's terminal/postflight.
The saved `bx_erf37bxf` remains stopped; its denied resume is not retried.
Existing recovery recipes suffice; no new recovery implementation is needed.

Local inputs reverified for transfer through scoped Boat file/exec API:

- Four original seeds in
  `/home/user/wine-assembly/scratch/cmr3-native-seeds-20261015/`:
  msvcrt.dll278581, quartz.dll994816, devenum.dll51712, l3codecx.ax83456 bytes.
  All match `docs/cmr3-historical-receipts-20261015.json` (1,408,565 bytes total).
- Original regsvr32 at the `registry.registrationTool.localPath` in the native
  recovery plan:30720 bytes/SHAea8bb5cb31357ee2866e0fce651a29694cb286be9b5e2f96508a92b5f4b3dfeb.
- No MPSetup.exe, ie60.exe, dx81.zip or original-named CMR3 installer located
  locally by expected filename; a renamed/unindexed cache is not ruled out.
  No bulk copy/download was performed. The local WMVCORE static-review copy
  is only one of twelve native files and is not a replacement for recovery.

After grant, stage reviewed source in the **owned** isolated checkout
`/home/user/cmr3-fresh-checkout`, seeds in `/home/user/cmr3-fresh-seeds`, and
regsvr32 in `/home/user/cmr3-fresh-input/regsvr32.exe`. Current concrete source
pin is `dc0611212344ef3778652f4aff5e6c407be5c895`, the Kkrieger build target;
repin after review if that lane changes it. Require curl,7z,/usr/bin/unshield
and Node. If tools are missing, install the distro packages separately under
a bounded dependency step and retain package versions/tool hashes; do not
run a Windows installer. Native recipe requires at least3GiB free (2GiB floor
plus1GiB expansion); original acquisition/assembly require2.5GiB.

Run these serially from that checkout, stopping on any nonzero status and
preserving each log and terminal receipt. The parent must exist; each named
recipe output must be new:

```sh
mkdir /home/user/cmr3-fresh-recovery
timeout --kill-after=5s 360s node tools/cmr3-source-recovery.js /home/user/cmr3-fresh-recovery/acquisition
timeout --kill-after=5s 120s node tools/cmr3-assemble-original.js /home/user/cmr3-fresh-recovery/acquisition /home/user/cmr3-fresh-recovery/assembly
timeout --kill-after=5s 600s node tools/cmr3-native-recovery.js /home/user/cmr3-fresh-recovery/native-recovery /home/user/cmr3-fresh-seeds
```

Acquisition fetches the pinned126663356-byte original installer (SHAd1dff3e9…)
and authenticates it before carving. Assembly maps333CAB records minus32
excluded resources plus originalEXE into302files. Independently compare its
`game-inventory.json` contents with `docs/cmr3-original-inventory-20261015.json`
before registration, not merely its count. Native recovery fetches the pinned
MPSetup.exe/ie60.exe/DX81 archive from the URLs in the native recovery plan,
then requires all12 exact native size/SHA matches. Downloads occur on the
fresh box only. Failed downloads/extractions remain evidence, never fixtures.
The optional native cache argument is omitted because no cache is established
on this box; use it only after verifying all three cached package pins.

Registration request uses the existing controller schema with these concrete
paths (remaining fields are unchanged from the reviewed r2 request):

```json
{
  "checkout": "/home/user/cmr3-fresh-checkout",
  "output": "/home/user/cmr3-fresh-registration",
  "controllerOutput": "/home/user/cmr3-fresh-build-registration",
  "nativeRoot": "/home/user/cmr3-fresh-recovery/native-recovery/native",
  "gameRoot": "/home/user/cmr3-fresh-recovery/assembly/game",
  "regsvr32": "/home/user/cmr3-fresh-input/regsvr32.exe",
  "commit": "dc0611212344ef3778652f4aff5e6c407be5c895",
  "moduleSha256": null,
  "gameInventorySha256": "0c09b40c8eadaf148a0a7285be61a1c3e78d090649b41464f4a5e2192f0940b4"
}
```

Save as `/home/user/cmr3-fresh-request.json`, outside the source tree. Default
fresh-build path after verified recovery:

```sh
timeout --signal=TERM --kill-after=5s 900s node tools/cmr3-build-register.js /home/user/cmr3-fresh-request.json
```

Alternatively, reuse Kkrieger's newly completed canonical module only if its
successful build receipt, actual module SHA and complete source comparison
prove equivalence to this registration checkout's WAT/compiler/build/runtime
files. The module path/hash on the new box are **not known yet**. Copy the
verified module as a regular file into this checkout's own build directory,
recheck its hash, and generate a separate registration config with that actual
moduleSha256 (remove controllerOutput). Run `timeout --signal=TERM
--kill-after=5s 600s node tools/cmr3-register-native.js CONFIG.json` against
that concrete config. Do not pass an oldd463 pin or a guessed build path/hash.

Preserve original73364 and static evidence on this host/saved box; this route
creates independent acquisition, native and registry evidence. Retain the
actual WMVCORE-generated profile and native COM exports. No game launch is
included. Check process survivors, preserve artifacts and release the slot
after terminal completion. Account for the full sequential budgets and box
TTL before starting; extend through authorized access if needed, not by
dropping identity checks or running concurrently with Kkrieger.

## Fresh-box execution completed

The handoff ran on `bx_9ef2wdsw` after Kkrieger's release. All original302
file identities and native12 identities match. The nine-step registration
process53813 completed successfully at11:53:15 UTC, with observed S_OK and
guest exit0 for every DLL and the actual WMVCORE-written profile passing its
file-effect oracle. Final native class mappings were independently inspected.
The newly generated registry is972entries/182940bytes/SHA256
`7e59a8770cf1c8d180943539247f3bd3dd5990f3e2eb1be91971250d2e9c7a54`;
it is not the missing historical184922-byte snapshot. No game was launched.

Postflight11:53:54 found no runtime survivors;6505source files, canonical
module, original game files and native DLLs were unchanged.108artifacts,
3152085bytes, were downloaded and hash-verified, including both generated PRX
copies. Bulk installer/packages/extractions remain remote. Slot releasedroot.
Full paths, module identity, terminal handles and evidence pins are recorded
in `docs/cmr3-fresh-registration-result-20261015.json`. A later game replay
must mount the genuine profile at its Windows path along with the new
registry and authenticated native DLLs. Failure73364 remains preserved.
