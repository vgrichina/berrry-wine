# Drakan original: COMCTL32 initialization blocker, 2026-11-14

The single fresh registered `drakan_demo` launch **exited before the original
entry point and beta warning**. Real COMCTL32.DLL initialization requested
`commctrl.dll!Cctl1632_ThunkData16`; the current NE service reported
**`Missing NE image COMMCTRL`**. There was no warning to review or dismiss,
no input, no screenshot, no D3DIM drawing, and no gameplay or ordinary Quit.
The historical routes remain hints; this run supplies no renewed gameplay proof.

Evidence: `scratch/runs/20261114-drakan-original-gameplay/`, with `result.json`
as its index. No production source or media was changed. The requested playable
level, movement/attack consequence and ordinary Quit remain unproved. Full27
also remains unproved.

## Exact original and source

Fresh preflight reread all **64 existing paths**: executable, manifest and its
62 entries. Every size/SHA256 matched the November 13 recorded closure. All
62 manifest `vfsPath` mappings and sizes were checked against the registered
working directory `c:\program files\psygnosis\drakan demo`; the executable guest
path and the **92-byte Settings100** seed were unchanged. Postflight again
confirmed all 64 hashes and the complete registration unchanged.

`drakan.exe` is 516,096 bytes, SHA256
`29ddccec4b073aaeeb998f0ce83d581ccf3e6a3e28791844f4434d661febecbe`;
`dragon.rfl` is 1,605,632 bytes, SHA256
`b0ede61e43571f9ecead5e7637c585e1e3523ba70d7fd325ec39e99381807b1e`.
The settings hash remains
`207f1bdaccfd50d9e739ec3c812a09806eb119af4638351155548e4f7e290f43`.
The game-media manifest is complete; it does not supply the missing host
system-DLL companion.

The runtime used main **`a79e3b23f664bf3315d2eb725c2bdfb358a6d5f4`** plus the
preserved shared WIP recorded in `source.patch` and `new-runtime.patch`.
`source-pins.json` records 317 providers and module SHA256
**`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`**,
2,200,970 bytes. Postflight found zero provider drift and the same module hash.
Foreign D3DIM, host, NE and thread changes were preserved and not committed by
this worker. Git plus patches are the source recovery mechanism; no source
archive or copied game media was made.

## Actual startup failure

The ordinary CLI launch used `--app=drakan_demo --no-build --no-threads
--headless-gl --d3dim-gpu --real-ticks --control=8455 --max-seconds=600` and
the pinned standard module. It did not override the registry, guest paths,
configuration, clock, seed, maps, AI or executable bytes.

`native.stdout.log` reports original PE entry **0x461935** loaded, then real
COMCTL32 at **0x587000**, DllMain **0x5a11cd**. Initialization traps at
**EIP 0x5b35d2**, ESP **0x74fffcc**, halt 3 / yield 18. The retained exception
identifies ThunkConnect32 request operation 5 and this actual contract:

| Field | Current original observation |
| --- | --- |
| layout / late binding | LS01 / LB01 |
| checksum | 0x1e9a |
| Data32 | 0x5ef2ec |
| companion / export | commctrl.dll / Cctl1632_ThunkData16 |
| PE module / reason | comctl32.dll / process attach (1) |
| QT / FT offsets | 36 / 68 |

`lib/ne-guest-bridge.js` calls `prepareNeSources` through the ordinary DLL
resolver. `lib/ne-sources.js` rejects the missing companion with guest error 2;
`lib/dll-loader.js` consequently rejects the unfinished initializer. The normal
search includes the process VFS, `test/binaries/dlls`, the executable directory
and its `dlls`/`plugins` subdirectories. No COMMCTRL.DLL was found among existing
`test/binaries` files, and it is absent from the 64-path game closure.

The selected COMCTL32 is the existing 577,808-byte
`test/binaries/dlls/comctl32.dll`, SHA256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
This is the same generic prerequisite independently described in
[the current COMCTL32 thunk note](neverhood-comctl-thunk-observation-20261114.md),
now actually observed on registered Drakan at its own relocation.

Supplying a companion alone is insufficient: the current
`inspectThunkCompanion` explicitly rejects LS relay publication after bounded
header inspection. Completing this path requires the real companion, a native
connection owner tied to PE generation, a retained companion reference,
validated relocated target table, QT/FT relays and notification/detach lifetime.
No such repair was made or claimed here. A TRUE stub, another COMCTL32,
configuration change or warning shortcut would not establish that behavior.
The task's preserved foreign NE WIP was not replaced to get past this boundary.

The native GL package loaded and the display check found one display. This
proves provider availability only. No D3DIM device, owning render context,
completed draw or presentation was established, and no physical GPU claim is
made. The passive executor/exports observer was prepared and tested but never
produced a qualified original drawing sample before this failure.

## Checks, fixed deadline and terminal state

The new manual controller passed four checks, including an actual independent
UP subprocess, its terminal wait and postrelease batch progress against a
transport control. The passive observer control verified exact single
forwarding of arguments, return value and exception, and attribution to actual
exports/executor. Current CLI guarded-input checks passed, including stale
owner/queue/device refusal, independent release and normal terminal cleanup.
The actual LS01/LB01 contract classification test and a focused missing-companion
resolver test also passed. These controls are not original gameplay results.

An earlier focused-test request expired **in its 180-second heavy-lock queue**,
exit 124 with an empty log; it never executed a test. After the coordinator's
source-ready boundary, the current focused CLI checks executed and passed.
Own premerge full build passed under both locks with zero source drift; the
coordinator then completed the current merged module's locked full build and
presentation/lifecycle checks before source-ready. Current module identity was
repinned, rather than reusing the premerge module.

Heavy runtime/build turns used `/tmp/wine-heavy-runtime.lock`, with builds also
using `/tmp/wine-build.lock`. The original watchdog process **3373707** armed
before guest process **3373708**, with immutable deadline
**2026-11-14T11:53:57.754Z** (600 seconds). The guest started at
**11:43:57.780Z** and exited **1** at **11:43:58.201Z**. Its supervisor actually
waited and drained stdout and stderr through EOF. The independent watchdog
exited 0 without firing; the supervising runtime and outer supervisor have
actual exit-zero waits and EOF records. Their zero exits describe supervision,
not guest success. No runtime extension, restart or input replay occurred.
The heavy lock was released; all four recorded lifecycle PIDs are absent.
There is no ordinary Quit claim for this preentry failure.

All 162 reused offline native-package files matched before launch. Their Q3
owner subsequently cleaned its package installation after the runs; postflight
records all 162 paths missing, not an unchanged-package claim. The retained
Q3 package/lock files and `npm ci --offline --prefix
scratch/runs/20261114-quake3-bsp-loading-cause/native-deps --no-audit --no-fund`
recipe provide recovery; this worker downloaded or copied no media or native
packages. Disk remained comfortably above 1.5 GB; postflight free space was
13,899,460,608 bytes.

Box **NONE / NOT_CREATED**, expiry **null**, stop receipt **not applicable**.
No public deployment, remote box, other worker, synthetic frame, frame series,
forced presentation or guest-state edit was used. Next is the generic native
COMCTL32 companion/LS connection repair, followed by a separately authorized
fresh original warning-to-gameplay run; this terminal run is not replayable.
