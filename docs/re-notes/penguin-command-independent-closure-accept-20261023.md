# Penguin Command original static closure: independent acceptance, 2026-10-23

**ACCEPT scoped static dependency and launch closure.** No substantive defect found
in producer `e83f93fd941f105fa9bc6424346b0e610d36a4bf`, branch
`task/penguin-command-retained-closure-complete-oct23`. This accepts an offline
launch recipe and provider inventory; it does not qualify execution or gameplay.
Worker `01a16a1f-a98b-7171-b2ab-cf4b84eabe8d` owns only this new report and adjacent
`penguin-command-independent-closure-accept-20261023/` evidence on private branch
`task/penguin-command-independent-closure-accept-oct23`, based on that producer.

The producer report and adjacent manifests, `verify.py`, `launch.sh`, original
README and actual retained images were reviewed read-only. The coordinator's
accepted 17 seals were not rerun as a substitute for semantic acceptance.
`verify.py` would write its verification receipt in the donor directory, so it
was read, not executed. This review uses independent `struct` PE parsing and
small host helper checks. No downloads, extraction, builds, WebAssembly APIs,
guest execution, box access, integration, source or shared-index changes occurred.

Independent `review.py` reads DOS e_lfanew, PE signature, machine, optional-header
magic, data directories, raw-backed section RVA mappings, import descriptors,
32-bit thunk names/ordinal flags, export name/ordinal/function tables and forwarder
ranges. `independent-pe.json` retains these actual fields and complete symbols.
It finds **8 original i386 PE32 images**, plus the standing CRT, **682 imported
symbol edges and zero ordinal imports**. The edge multiset independently matches
the producer's manifest. Every required native symbol has a nonzero original
provider export; none requires a forwarder. Provider identity uses the actual
filename, which `lib/dll-loader.js:nameMatches` supports even where internal
export DLL names differ (the SDL/libSDL convention).

The six bundled DLLs are SDL, SDL_image, SDL_mixer, jpeg, libpng12-0 and zlib1.
The seventh native provider is the standing msvcrt.dll, 278581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
Its imports are included in the 682 edges and its exports satisfy the CRT names;
API-table absence for a native CRT export is not a missing provider. Required
system DLLs are KERNEL32, USER32, GDI32, ADVAPI32 and WINMM. Inventory comparison
preserves exactly **WINMM.waveOutGetErrorTextA and WINMM.midiStreamStop** as
unexecuted risks. Other API-table names likewise do not prove implementation or ABI.

`SDL_image.dll` itself contains nine JPEG and sixteen PNG zero-terminated lookup
candidates. The evidence records each original file offset and corresponding
provider export RVA/ordinal. All 25 resolve. JPEG/PNG dynamic availability is
checked separately from ordinary imports: omitting JPEG can leave the static
import walk intact. Strings plus exports do not establish executed LoadLibrary/
GetProcAddress order, loader success, calling convention, structure layouts or
decoder correctness. The report's candidate wording is appropriate. No speculative
TIFF/Vorbis/SMPEG dependency or new support claim is added.

Rejecting controls remove each of the seven providers, remove zlib's `inflate`
export, and substitute zlib's export table for JPEG's. The combined import and
codec-candidate oracle rejects all nine. The first version of this review's
omission test used imports alone and correctly demonstrated that removing JPEG
does not reject ordinary imports; the test was corrected to cover dynamic
candidates before acceptance. This is a test-oracle refinement, not a donor defect.

The direct original EXE is 107008 bytes, SHA-256
`14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`,
entry RVA 0x1290. Its bytes match the same member of the read-only donor ZIP.
The separate 32768-byte windowed EXE contains `penguin-command --windowed` and
imports CreateProcessA; the direct EXE does not import CreateProcessA. Directly
passing documented flags avoids that wrapper's child-process requirement.
Original README-win32.txt documents mouse aiming, A/S/D firing, fullscreen default,
`--windowed`, `--nosound`, executable-directory CWD, and beside-EXE settings/scores.
The original EXE also contains the flags and `penguin-command.dat` string.

The retained quiet profile mounts all **83 PNG/JPG graphics** under `data/gfx/`,
including title.jpg; PNG-only loses graphics. Eight WAV/S3M sound assets are
optional for the documented no-sound profile. SDL_mixer remains a required native
DLL even with no sound, since import resolution still needs it. Actual no-sound
branch reachability, including avoidance of the two WINMM gaps, remains untested.
`penguin-command.dat` is initially absent. CWD `C:\` beside the EXE is essential:
the host VirtualFS can create/write that relative filename there, but an existing
wrong CWD changes its path and would also break relative graphics lookup.

`harness.js` never imports run.js. It evaluates only the exact getArg/getArgs
excerpt, and imports host-only process-boot, VFS inclusion and VirtualFS helpers.
It checks 83 actual mounted graphic paths, seven explicit native seeds bypassing
registry eligibility, loaded DLL file aliases, argument staging through a tiny
mock export callback, and a host VFS create/write. Its graph check deliberately
isolates seed admission; PE dependency correctness comes from review.py.
Missing-glob, absolute POSIX/Windows include and nonexistent-CWD controls reject;
PNG-only and existing-wrong-CWD controls show concrete omissions/path changes.
No guest argv or CRT startup was executed. Source review also follows run.js
EXTRA_ARGS into setExtraCmdline before stageAndLoadPe, then the WAT command-line/
CRT argv builder's whitespace tokenization. The 20-character argument payload is
below the setter's 200-byte limit.

One concrete launch recipe follows. **Do not run under this static allocation.**
The coordinator must assign a qualified prebuilt module, runtime budget and box,
and an admitted empty evidence directory. These host paths refer to existing local
retention; transfer with the original recovery recipe if running elsewhere.

```sh
HARNESS_ROOT=/home/user/wine-assembly
PENGUIN_DATA=/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11
PENGUIN_CRT=/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll
: "${QUALIFIED_WASM:?coordinator-qualified prebuilt module}"
: "${RUN_DIR:?admitted empty runtime evidence directory}"
unset WINE_RUN_EXTRA_ARGS
node "$HARNESS_ROOT/test/run.js" --no-build --wasm="$QUALIFIED_WASM" \
  --exe="$PENGUIN_DATA/penguin-command.exe" \
  --exe-guest-path='C:\penguin-command.exe' --cwd='C:\' \
  --args='--windowed --nosound' \
  --dlls="$PENGUIN_CRT,$PENGUIN_DATA/SDL.dll,$PENGUIN_DATA/zlib1.dll,$PENGUIN_DATA/libpng12-0.dll,$PENGUIN_DATA/jpeg.dll,$PENGUIN_DATA/SDL_image.dll,$PENGUIN_DATA/SDL_mixer.dll" \
  --vfs-include='data/gfx/*.png' --vfs-include='data/gfx/*.jpg' \
  --quiet-api --no-close --max-seconds=60 --max-batches=200000 \
  --control-stdin --png="$RUN_DIR/exit.png" \
  --save-vfs="$RUN_DIR/vfs" --save-vfs-suffix=.dat
```

This uses the actual run.js explicit `--dlls` branch: comma-split native files,
then mountLoadedDllFiles/loadDlls. It intentionally supplies the complete seven
providers because that branch bypasses recursive graph discovery. The producer's
seven repeated `--dll-seed` flags are also valid: absolute paths survive appAsset,
seeds bypass isLoadableDll and mount the same providers. Repeated graphics flags
are supported; the helper also supports comma-separated values. Quoting preserves
the guest argument string. The producer launch.sh passes `sh -n`. Mounted asset
paths become C:\data\gfx\..., EXE identity is C:\penguin-command.exe, and CWD is
applied after mounts. Writable VFS, rather than the host donor directory, holds
future configuration writes. Saving VFS on host termination does not prove the
game's ordinary save/exit path.

Remaining original runtime acceptance is concrete: reach and inspect title/menu;
select the observed Normal Game entry using ordinary input; mouse aim at two
positions and press/release A/S/D to fire ordinary cannons; capture enemy movement,
player missile trajectory/explosion, changing score and wave progression across
meaningfully separated frames. Preserve actual first faults, API/EIP traces and
module identity. Check SDL video/event/timer behavior, native CRT startup, dynamic
JPEG/PNG decoding and no-sound reachability. Test ordinary exit/relaunch persistence
if claiming saved configuration/scores. No screenshot or gameplay claim is made here.

Admission precedes checkout and task-dependent inspection: **59027400 / 67108864
bytes**, including all observed SQLite WAL/SHM **25472968**, future external/session
logs 16 MiB, and reserve 8388608 inside the cap; projected free **4565897272** exceeds
2982150144. Standing donors/tools are separately measured; private Git uses explicit
read-only object alternates and a focused checkout, not concealed copies/links.
Python subprocesses have a 60-second wall guard; output streams count before
forwarding with an initial conservative 70000-byte charge and 524288-byte aggregate
cap. Node used oldspace256, CPU60/wall60 and measured MemAvailable 3483504640.
All new files stay below 24 MiB. `admission.json`, `final-allocation.json`,
`harness-results.json`, source identities and `seals.json` retain exact evidence.
Two early attempted reads used nonexistent README-win32/lib/vfs names; corrected
paths were located without acquisition. No admission/output/resource guard rejected.

The donor ZIP SHA is `4399b52a1f8fec2501737a53ab42def6d5faebde37c0de5efc1295ab495caf34`.
ZIP and extracted originals remain ignored, local-only retained inputs: the producer
report's sealed recovery instructions remain authoritative; this task adds no copies
or recovery execution. Current remote main was reconciled read-only as
`7f7358c160ae7185fc38f9a15447a6d20c00f97e`; no duplicate Claude/POSITIONT/RichEdit work.
No assigned box: ID/state/expiry N/A. Coordinator-supplied stopped snapshots of
bx_dskdnj43 at 18:42:19.911 UTC and bx_qv9vszay at 18:41:40.457 UTC were preserved
without polling. The SSH403 and Shadow Man128MiB hold remain unchanged. Coordinator
retains all future lifecycle ownership. Publication SHA and verified remote branch
are recorded append-only on the messageboard and in external publication.json.
