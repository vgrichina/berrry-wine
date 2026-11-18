# Original UT GOTY media and preparation, 2026-11-18

Evidence: `scratch/runs/20261118-ut-goty-original-range-media-startup/`.
This task did not launch the original installer or game. Reviewed native
preparation did not pass, so there is no GOTY startup, reporter reproduction,
3D gameplay, movement, firing, or ordinary Quit claim. The earlier UT348 scope
in `issue30-worker-traps-ut-gears-20261118.md` remains closed.

## Authentic disc recovered

The owner-authorized OldUnreal installer source identifies
`https://archive.org/download/ut-goty/UT_GOTY_CD1.iso`.
The recovered disc is exactly 649633792 bytes, SHA256
`e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`.
The **whole-disc hash is now independently verified**. This supersedes only
the earlier report's whole-hash-not-verified limitation, not its runtime limits.

Initially a complete download would breach the 1.5 GB actual-free-space floor.
Metadata and selected originals were therefore read with exact HTTP206 ranges,
rejecting HTTP200, inconsistent Content-Range and wrong body lengths. After
other workers independently freed space, actual free space was 2449268736 bytes.
The complete disc was recovered into one unique file using 78 verified ranges;
the lowest observed free space during acquisition was 1629384704 bytes.
`recover-disc.cjs` and `disc-recovery.json` record the recovery recipe, every
range's bytes/hash, final redirected URL and ETag. No alternate media copy,
sparse fake ISO or missing-asset zeros were used.

Production `parseIsoAsync` identifies Joliet, label UT_GOTY_CD1, creation stamp
2000100615145800, 2048-byte sectors and 821 file records. `disc-tree.json`
retains the long names, lengths, offsets, flags and metadata. In particular
`System/UnrealTournament.exe` is at offset 349849600, length 241664, matching
the separately recovered original EXE's SHA256
`93846d6b4838bac06a2c4f9691dcc746e51a1c369008f83daab904cec9961e64`.
The owner's four selected runtime originals were preserved unchanged.

The untouched installation Manifest.ini says version 432. Its mandatory Maps
group expands compressed `.unr.uz` files into `.unr`; 81 compressed maps are
present. Autorun opens setup.exe. This is installation media, not an installed
game directory that can honestly be launched with missing map files. No demo
assets, configuration changes, registered FirstRun overrides or forced renderer
were substituted.

## Existing import and child inheritance

`lib/media-import.js` analyzes a byte provider and creates the ordinary imported
app entry. ISO/Joliet names are provided by `lib/iso9660.js`. Read-only media
remains on D; the ordinary import mirrors the selected executable directory
onto C and preloads its actual INI files. The browser shell's existing VFS
snapshot carries entries, read-only drives and mount metadata to a self child.
The native route uses `lib/readonly-media-context.js` to pin the actual local
disc and reopen/hash-verify it for a child, with writable state separately
exported by `test/run.js`. No original run was used to discover these paths.

The production HTTP byte provider allows a whole-response fallback. Recovery
instead used strict range-only requests; it did not quietly download HTTP200.
The recovered local ISO can use the existing read-only native mount directly.
Original startup would still require the ordinary installer and reviewed wizard.

## Authored controls and concrete preparation blocker

The small authored PE verifies D's CD-ROM identity and a real INI on the
read-only authored disc. Its ordinary MessageBox asks for Enter, then
ShellExecute launches the same executable with the exact first-run renderer
test argument form, `testrendev=SoftDrv.SoftwareRenderDevice log=Detected.log`.
The child repeats the media check and writes a marker that the parent checks.
This is a control fixture, not a modification to the game or renderer choice.

In `native-control`, the complete dialog was personally reviewed. Enter was
consumed by the native modal invocation and independent physical UP was ACKed;
both parent and child exited 0 and actual waits/both EOF were retained. However,
the DOWN ACK arrived after the chosen 100 ms pulse expired. The finite input
helper correctly closed that scope. This is **not** a passing guarded-input
control and was never replayed or used to justify original input.

`native-control-ready` was stopped by its own independent disk-floor watchdog
after shared disk growth reached 1483636736 free bytes. Its old scratch retainer
died on supervisor TERM before retaining the real native child's wait. Outer
wait/EOF and containment evidence exist; missing native-wait evidence is explicit.

`tools/ut-goty-native-scope.cjs` corrects that retention flaw: the retainer
forwards TERM/INT/HUP and remains alive until its actual child closes both pipes.
It preserves fixed 900-second supervision, independent 920-second/disk watch,
180-second Quit reserve and the existing native reviewed-context guard policy.
Caller policy overrides are rejected. Focused tests cover ordinary exit with
stdout/stderr sentinels, supervisor TERM with the actual child's SIGTERM wait
and both EOFs, and policy-override rejection. This changes preparation custody,
not interpreter or game behavior.

In the subsequent authored `native-control-positive`, two personally reviewed
whole captures showed only the teal desktop although the native snapshot
identified the live visible dialog and focused OK control. No bind, DOWN or UP
was sent. The scope was explicitly cancelled; native and outer actual waits and
both EOFs were retained. Its underlying display cause is **UNKNOWN**. The first
control's tested module was not separately pinned, so these captures cannot
establish a causal runtime regression between identical module identities.
There was no further request to this closed control. Browser preparation and
original installation were not attempted after this failed native readiness.

This is a concrete preparation blocker, not evidence that GOTY itself fails.
The original attempt allowance was unused. No renderer/INI/registry bypass or
blind wizard gesture was used to conceal it. No box was created: box ID, expiry
and stop receipt are null; state is NOT_CREATED.
