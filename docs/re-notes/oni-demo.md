# Oni demo preflight

Source https://mods.oni2.net/node/335; linked
https://mods.oni2.net/system/files/Oni%20Demo.zip fetched on boat bx_3uhkes9x.
94,583,006 bytes; SHA256
9913e0f866e25bcd11571dec645be420e717092763a8f34ebe4d4ec3c47ec7e5.
7z extraction:42files,169519142 bytes, no errors.

This is explicitly a community repack, not the original installer. Its README
says it combines the original demo levels1/4 and alternate demo level2, and
ships modern OniX plus the original demo application under
Older Oni apps/Windows 98-ME/Oni.exe. For Win98 testing use that executable
and matching binkw32.dll, with GameDataFolderX copied as GameDataFolder,
per the supplied rename instruction. Preserve the source tree. The original
run_wind.bat uses Oni -noswitch. No public redistribution grant established.

Remote source: /home/user/oni-demo-preflight/extracted/. No fixture copied
to the persistent box. Next verify original PE/imports, stage the documented
legacy layout, and run bounded CLI after Turok releases runtime.
No launch, gameplay, screenshot, FPS, audio or mobile qualification yet.

## First bounded startup (16:27Z)

Original Oni.exe SHA256
d1579b3a205bdb7771ac32ebf3af61f927d352fe2e3e35128207e84a2937a12d.
Default and supplied -noswitch route both enumerate the four level DATs,
initialize sound/input/graphics/game systems, then ExitProcess(0) while
loading level0. The later eip-zero diagnostic is after that explicit exit;
do not report it as the startup cause. Exported guest startup.txt/debugger.txt
identify error1 at BFW_TM_Game.c:2529, propagated through Oni_Level.c:405
and Oni.c:936. No explanatory error text is supplied. Next map the failing
template/level load return and its file/mapping inputs; no cause proven.
Evidence: scratch/runs/20261011T1627Z-oni-startup (commands and guest logs).
The build is own branch6823f45d3/base3cf809538, not latest main GL changes.

## Filename-case lead (16:35Z)

The exact error at0x42211f is "This level is not valid" (string52b01c).
It tests level-valid byte564ad8[level]. The parser421030 splits at underscore
and period, then compares the suffix byte-for-byte with "Final" at52acc8
(4210c1..4210f7); mismatch clears the flag at421146. Actual ZIP entries are
level0_Final.dat etc., whereas traced FindFirst/CreateFile names are lowercase.
lib/filesystem.js findFirstFile enumerates normalized map keys, losing original
case. Next controlled enumeration-case probe, then general case-preservation
across mounts/create/move/copy/persistence if confirmed. No guest patch.

Controlled confirmation: run20261011T1637Z-oni-case-probe wraps only
FindFirst/Next returned names with actual names read from the extracted tree.
No EXE/data bytes change. The30000-batch replay no longer reports invalid
level; it loads resources and reaches the reviewed Bungie intro. Remaining
guest logs contain missing particle-class warnings, not the earlier error.
This is a diagnostic wrapper, not a production fix. Next preserve original
case as VFS metadata while retaining normalized lookup keys, including eager,
lazy/provider mounts, create/copy/move and serialization. Test general mixed-
case enumeration and rerun Oni without the wrapper on a fresh remote build.

## General filename fix (16:48Z)

File entries now retain their basename spelling independently of normalized
lookup keys. CLI and browser manifest mounts preserve it for eager/lazy/provider
files; create, truncate, copy, move (including case-only rename), child merge,
localStorage and overlay hydration retain the metadata. Old entries without
metadata still enumerate their normalized basename. Directory case and other
mount paths that already discard spelling are outside this change.

Fresh remote build on bx_kmxkny92 passed, as did all 15 test-vfs*.js files.
The new mixed-case regression fails against the old filesystem implementation.
Unmodified Oni/data, without the diagnostic wrapper, now reaches the reviewed
Bungie intro at 30000 batches: run20261011T1648Z-oni-case-fixed. This verifies
the startup fix, not gameplay, FPS, audio or browser/mobile compatibility.

Longer replay with Escape at 35000/65000 batches reaches a GL-initialization
error under the default CLI backend, which intentionally has no GL context.
Do not classify that modal as an emulator regression. With
`--gl-renderer=software`, the bounded run continues to 144166 batches/30s,
but the final GDI canvas capture is gray. Next inspect the GL/DirectDraw
surface or a real browser route; no menu/gameplay qualification yet.

Run20261011T1702Z-oni-surfaces removes png-canvas and dumps the DX surfaces.
The selected GL target26 and backbuffer27 are both gray640x480, so this is
not merely the GDI capture selecting the wrong surface. Census:27536triangles,
zero eye-plane drops/culls,191presents,13texture uploads,zero unsupported
textures and a clear WAT mirror trust latch. Textured asset surfaces exist.
Guest startup logs reach "launch the out-of-game UI". Next compare real
WebGL and inspect GL state/draw ordering if gray persists. This software run
uses base3cf809538 plus root fixes, not main's later projective-vertex change;
do not attribute the result to current-main WebGL without testing it.

## Browser WebGL comparison (17:22Z)

Run20261011T1719Z-oni-webgl: unchanged legacy EXE/data, tested root build plus
case fix, Chromium155 with default Threads/WebGL. Escape after20s, capture
after45s reaches a fully rendered New Game/Load Game/Options/Quit menu.
Thus the gray UI observed above is specific to the tested software GL path,
not a universal startup failure. Uses a temporary browser/server APPS entry,
recorded in browser-entry.json and browser.js; not a committed registration.
The initial server-unknown-app attempt was a harness setup failure, corrected
by registering the entry server-side and copying assets within the served root.

Ordinary browser click at465,489 opens "Press Start to begin a new game"
with Start/Cancel. This is the game's own New Game confirmation, not gameplay.
Next Start at260,493 and inspect the resulting level/loading state.

Clicking Start at260,493 after1200ms advances into loading, then traps on
**UNIMPLEMENTED API: glTexCoord4f**, captured in browser-start.log. Guest
EIP406863 is the continuation, not the cause (instruction there is
`mov esi,[ebp]`). The API table already has IDs4430/4431 for glTexCoord4f/fv,
but no handler was found on current main. Next implement real four-component
texture coordinates through the appropriate GL state/encoder/backend path,
with projective-coordinate tests; retain fail-fast behavior until implemented.
No level screenshot/player control qualification. Audio also remains unverified
(browser logs report suspended AudioContext).

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

## Ordinary Load Game route (2026-10-12)

Root resumed the limit-blocked worker's preserved `/home/user/oni-wt` on
bx_n47sae4r after restoring missing stdole2.tlb. Built module SHA256
36029bde5328648e01f74b124c984c676745986acd47df945ca9a078b3bb26ef,
checkout HEAD09277c7c2 (software fog fix). No source change for this replay.
CLI software GL, unchanged legacy fixture `/home/user/oni-demo-preflight/game`.
Click320,240 at5400 batches skips intro; click440,310 at7000 opens Load Game.
At12000 batches the reviewed menu lists TCTF Training and Syndicate Warehouse.
Normal level selection is available without modifying guest scripts or saves.
Evidence `20261012T0147Z-oni-loadgame`.

Harness caveat: root initially used `keypress:Escape` / `keypress:Space`,
but this CLI expects numeric key codes. Do not attribute the successful menu
route to those invalid actions. Use27/32 and87 for W in subsequent controls.

Select Syndicate Warehouse at240,59 at8500, then Load185,445 at9000.
The60000-batch capture reaches a rendered warehouse and Health Meter Training
dialog (`20261012T0149Z-oni-warehouse`). The numeric-key repeat
`20261012T0150Z-oni-warehouse-input` shows the intro cinematic still playing
at41000; the scheduled40000 Close and42000 W therefore precede the health
dialog. Its final image is still modal. Neither run proves walking; defer
Close and the movement probe until after the observed60000-batch modal.

### Warehouse movement verified against control

`20261012T0152Z-oni-warehouse-late`: Close465,410 at65000; reviewed66000
image is unobstructed gameplay. Hold W (VK87) at67000..77000, stop85000.
The final image shows Konoko beyond the starting corner, attacked by an enemy,
health depleted and a weapon-pickup prompt. Matching85000-batch no-W run
`20261012T0153Z-oni-warehouse-control` retains the starting corner/door and
full health. Both use the same normal menu route, numeric intro keys27/32,
unchanged guest data and module above. This verifies ordinary movement in
Syndicate Warehouse; it does not fix the separate training standing-turn gate.
No browser/touch/audio/FPS qualification follows from this CLI result.
Next register the legacy demo layout and reproduce this route in the browser,
gating controls on visible dialog/gameplay state rather than fixed wall time.

## Local-only registration (2026-10-12 02:06Z)

Commit4e6f18393 on codex/dr2-registration adds candidate `oni-demo` and app
`oni_demo`, outside the public desktop catalog. SHA1-pinned repack archive:
d5e687481a2a11b147636ab73fce980717773d8c. Extract to `archive`, copy the
`Older Oni apps/Windows 98-ME` directory to `game`, then copy
`GameDataFolderX` to `game/GameDataFolder`. No modern OniX executable is used.
On temporary bx_jnfg98zw, extraction from the preserved archive plus the
fetcher's `--prepare` path passes:32 browser-manifest files; legacy executable
SHA256 matches d1579b3a...7a12d above. Static registry/local-only/unique-ID/path
checks pass. Fresh network fetch produced no completion receipt and remains
unverified. Evidence `20261012T0206Z-oni-registration/validation.json`.
Touch WASD/Action/Jump/Menu is declared but not yet validated. Registration
is queued for ops integration, not merged or publicly deployed.

## Registered browser gameplay verified (2026-10-12 02:51Z)

Run0243Z-oni-browser on temporary bx_hqxvzbnm, Chrome155.0.8059.39,
WebGL/Threads, viewport1000x800. Fresh build passed, actual module SHA256
36029bde5328648e01f74b124c984c676745986acd47df945ca9a078b3bb26ef
matches the CLI-tested build. The committed oni_demo entry and prepared
32-file manifest reach the menu with no temporary app-registration override.

Click465,550 opens Load Game. The attempted Warehouse row250,290 and
Load200,690 instead entered TCTF Training; do not report a verified browser
Warehouse selection. step2.png shows the orientation prompt. Ordinary mouse
motion (500,500 ->150,500 ->550,500) turns the view and advances that prompt
to WASD movement (step3). Holding W3s visibly moves Konoko and advances to
diagonal movement (step4). A further turn plus W+A1.5s advances to the control
console objective (step5). These game-owned prompt transitions and reviewed
position changes verify player-controlled browser gameplay without guest
patches. The standing-turn problem is not universal: it persisted in the
earlier CLI tutorial probes but did not reproduce here.

Exact mouse/key commands, screenshots, environment and logs are in the run
folder. The final script stage is complete and its browser/server auto-closed;
outer boat exec returned141, so use recovered script artifacts for completion.
Touch controls, audio and FPS remain unverified. Next mobile/touch validation
and ops integration; do not mark the game public or fully release-qualified.

## Touch-direction validation (2026-10-12 03:16Z)

Run0307Z-oni-touch uses the same Chrome155/module36029bde...26ef with
isMobile/hasTouch enabled. New Game465,489 -> Start260,493 reaches training;
ordinary mouse movement clears orientation. Chrome touch events start at
the visible direction pad center, drag45px upward, hold2s and release. The
reviewed step2 shows displacement and the tutorial advances from walking
to diagonal movement: forward touch input verified, without a keyboard
substitute. A subsequent upper-left drag delivers both A and W (logged),
but the diagonal prompt remains while Konoko is against a wall. Do not
claim that tutorial step complete; repeat on open floor before diagnosing
touch-direction logic. Final844x390 capture keeps the game and controls
visible in landscape, with controls in side gutters. This is Chromium touch
emulation, not Safari or physical-phone validation. Action/Jump, touch-only
menu/aiming, audio and FPS remain unverified. Core registered compatibility
can move to ops review; keep these follow-ups separate from launch/gameplay.

## Console follow-up blocked before launch (2026-11-02)

Run `20261102-oni-training-console-next` waited live at41-second intervals
for Crusaders64278, then GL69793: actual terminal exit0, result/final files,
exact AUTHOR RELEASE, and named/scoped helper absence were verified before
admission. GL69793 released an incomplete disk-blocked task without retained
production changes; it did not supply a new implementation or build.

All34 local fixture files still match the coordinator's recorded SHA256s,
including original Win98 Oni.exe `d1579b3a...7a12d`. This remains the documented
community repack, not a pristine installer. All3936 inputs of the accepted
stipple build match; module SHA256 is
`307168f9e0475fd3c10f87cbc5d98f05006c6d4494d2f564381a9a0ebe289fe6`.
No new build or code test ran. A fresh read of local/public lib/apps.js found
Oni absent from both DESKTOP_APPS lists (46/44 entries respectively).

Owned boat `bx_7c7w98zr` had finite TTL3600 and original expiry
`2026-11-02T19:53:26.756Z` recorded before use. During immutable transfer
preparation, the local disk guard observed1956048896 free bytes, below the
required2000000000, and terminated the owned transfer group with SIGTERM
(terminal143; group absent). No archive completed, fixture transfer, guest
launch, gameplay input, or screenshot occurred. This is a resource blocker,
not an observed emulator defect or new training progress. The console-use
objective therefore remains unverified; the earlier movement result is not
counted again.

The remote cleanup query returned no owned runtime directory, transfer
directory, or scoped helpers. Its JSON was retrieved in command output before
the stop request. The file-retrieval helper then rejected the latched transfer
abort flag, but a following shell command still requested boat stop. The
remote-file SHA comparison did **not** complete before that request; preserve
this closeout limitation rather than claiming verified retrieval. Local
cleanup evidence and its hash, guard/terminal logs, identity manifests, and
actual lifecycle receipts are preserved in the run. Do not resume this boat
or retry the unchanged transfer. Restore safe disk headroom and use a bounded
streaming transfer for a fresh ordinary registered-browser console attempt;
capture and review native before/held/released/settled input then.

## Streamed console attempt: startup blocker (2026-11-02)

Run `20261102-oni-streamed-training-console` waited live at41-second intervals
for Braveheart25443, then GL22106. Both actual terminal exits0, result/final
files, exact AUTHOR RELEASE entries, and scoped helper absence were verified
before execution. All3995 accepted GL build inputs matched current files.
The actual browser response used the production module
`46c90ae60c2d47d0451e5b972c88ce8d0444500e7e734fd0683ca3ca18a7667a`
(2073181 bytes), streamed directly from GL22106's verified retained artifact;
the older shared build file was not replaced. All396 source,1005 compiler,
34 fixture files, immutable api_table, and selected module matched before and
after. The fixture remains the community repack with original Win98 executable,
not a pristine installer. Fresh local/public DESKTOP lists still exclude Oni.

No local source archive or fixture duplicate was made. The initial SSH pipe
was denied by this key's ssh permission (403), before source delivery. A bounded
exec stream delivered3904 members; extraction initially rejected absolute own
controller member names. Canonicalizing only the exact own checkout prefix
on that existing remote stream, without retransferring fixtures, passed exact
member-set and SHA checks. No guest ran before verification. These transport
limitations and corrections are preserved in the run. The minimum sampled
free space across owned guarded transfer operations was2009903104 bytes,
above the required2000000000; no own guard latched.

One ordinary registered `oni_demo` invocation, Chrome151.0.7922.108, default
WebGL, threads, real clock and1024x768 viewport, immediately displayed:
"There is no hardware-accelerated OpenGL present on your system; Oni will now
exit." It did not reach the intro, training, or console. This is the observed
first startup blocker, not proof of missing physical GPU support or a proven
emulator regression; the underlying capability/guest-check cause is unknown.
The harness also logged unavailable stdole2.tlb, without establishing causality.
No renderer/clock override, guest changes, save injection, download, or second
original invocation was used. Historical movement is not new progress.

Personally reviewed full-page/canvas before, held, released, settled and final
neutral captures show the modal, its ordinary OK dismissal, and return to the
Wine-Assembly desktop. One trusted mouse down/up pair held546ms; final held
set and input queue are empty, buttons0. These are blocker-acknowledgment
captures, not gameplay or console completion. All17 retrieved PNG CRCs pass.

All73 retrieved files (2875185 bytes) were SHA-verified against remote records
and reread locally before the explicitly delegated shutdown request. Controller
and browser exited0; remote named/scoped helpers, profile, transfer chunks and
remote archive were absent. Boat `bx_puqrw5me`, original expiry
`2026-11-02T20:51:05.417Z` recorded before use, is verified STOPPED at
`2026-11-02T19:57:34.082Z`. Source/compiler/fixture identities, actual served
module, input records, review, cleanup and lifecycle evidence remain in the run.
No runtime repair or new build was made. Next investigate this startup OpenGL
capability branch before another separately authorized console attempt; the
training-console objective remains unverified.

## Startup branch map; diagnostic aborted before execution (2026-11-02)

Run `20261102-oni-opengl-startup-capability` consumed Braveheart56012 then
GL64778 after live41-second polling: actual terminal exits0, four result/final
files, exact AUTHOR RELEASE entries, and scoped helper absence. All247 and209
retained final-manifest hashes respectively matched. Main was refreshed after
both releases. No runtime source was changed or rebuilt in this investigation.

Static disassembly of the original community-repack Oni.exe
`d1579b3a205bdb7771ac32ebf3af61f927d352fe2e3e35128207e84a2937a12d`
identifies an early route to the reported modal. At `0x404e31`, startup calls
`0x40bc90`; `test bl,bl` followed by `JE 0x404f43` takes the modal when that
probe returns AL=0. The probe calls `0x408640`, checks its AL, and then requires
every pointer in the GL export table to be nonzero until the `0xffffffff`
sentinel at table+`0x564`. The loader has its own NULL scan at `0x40ac91`.
This is a concrete executable branch map, **not an observed execution trace**.
The modal also has a later registration-error route through `0x404f3e`, so its
text alone does not establish which route the predecessor took.

The table contains345 mandatory entries followed by two optional 3DFX gamma
lookups beyond the sentinel. Its first entries are `glAccum`, `glAlphaFunc`,
then `glAreTexturesResident`. The latter name is passed to imported
`GetProcAddress` at `0x4089d6`; the result is stored at table+8 at `0x4089e3`.
The exact predecessor source maps that API to ID4210 and explicitly rejects it
in `$gl_dynamic_api_unsupported`; `$handle_GetProcAddress_pinned` returns NULL
with ERROR_PROC_NOT_FOUND127 for that gate. Thus, **if this loader path is
reached**, the first predicted unavailable mandatory pointer is
`GetProcAddress(opengl32, "glAreTexturesResident")`. Neither this return nor
the preceding API results were observed in this run.

The old source statically gates54 mandatory entries. Released GL64778 commit
`1e48691f4a4d6fd6dd6a25b6bbf4d779062a547d` implements shared objects and removes
`wglShareLists` from that set; the refreshed source still gates53, starting
with the same residency query. Remaining families include evaluators/maps,
feedback/selection/name stacks, color-index and edge-flag operations, texture
priority, and WGL copy/layer contexts. Implementing only residency or returning
dummy export thunks would not satisfy the mandatory table or supply those
semantics. No demonstrated generic runtime contract error justified a repair.

Keep these distinct when diagnosing the next bounded trace:

- The loader calls `ChoosePixelFormat` at `0x40893a`, checks AX at `0x408940`,
  then tests the original request's flags at `0x408945` onward. Its request
  contains `dwFlags=0x25`; this is not a returned acceleration capability.
  [ChoosePixelFormat](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-choosepixelformat)
  accepts a const request and returns a closest-match index; selected-format
  properties require `DescribePixelFormat`. No such describe call occurs in
  this loader path. The actual chosen index remains unobserved here.
- Resolving function addresses precedes using `wglCreateContext`,
  `wglMakeCurrent`, or `glGetString` through this table. Consequently this
  early rejection route can occur before a context or extension query.
  [GetProcAddress](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-getprocaddress)
  failure is a symbol-resolution result, not a browser GPU measurement.
- The predecessor recorded Chrome151/default WebGL but no unmasked browser
  renderer identity. Other boats' ANGLE/SwiftShader records are not evidence
  for that invocation. The modal does not prove physical GPU absence.
- `stdole2.tlb` is an optional system-boot library in `lib/process-boot.js`;
  the identified table predicate does not consult it, and original imports
  provide no OLE dependency for this check. The warning supplies no causal
  evidence for this modal. No executed OLE/API trace was obtained.

Historical successful source `09277c7c2` lacks the unsupported-lookup gate
introduced in `1beaec304847b4abe22c05e15c9bde9d964eb2cc`. That difference is
useful for forming a hypothesis, but the historical module/browser/fixture
combination is not a matched regression control. Exposing an unimplemented
fail-fast thunk is not implementation evidence. In particular,
[glAreTexturesResident](https://learn.microsoft.com/en-us/windows/win32/opengl/glaretexturesresident)
has object-validation, error, return-value and output-buffer semantics; a
constant capability answer is not a justified repair.

The planned diagnostic paired production module
`46c90ae60c2d47d0451e5b972c88ce8d0444500e7e734fd0683ca3ca18a7667a`
(2073181 bytes) with exact predecessor source commit
`e318fe1c5016e393a1467c86f02e1932cdf67503`,396 runtime source files,1005 compiler
files, api_table SHA256
`8319e5f866cf102879f4debfff34a421924a8a71d87cacf8d56c5a66afaaead5`, and all34
original fixture pins. Changed baseline files and matching CLI helpers were
streamed from verified Git objects without modifying the checkout. The newer
released GL production module `a99910fa56a94123b10ab00ffc67b82d500af5c92efe02d0c6265b71b8ec524e`
was recorded separately and was not substituted for this baseline. Current
source/compiler/fixture/API/shared-module pins remained unchanged. Fresh
local/public desktop lists still exclude Oni (46/44 entries).

Owned boat `bx_u9am7dzm`, TTL1800, original expiry
`2026-11-02T21:44:40.418Z`, was recorded before use. During streaming the local
guard sampled **1959919616 free bytes**, below2000000000, at
`2026-11-02T21:16:39Z`; it latched the abort, terminated the owned workflow
group (terminal143), and placed a remote abort marker. Remote extraction had
completed4671 verified members before the abort, but the native trace had not
started. No original guest invocation, browser launch, input, or new capture
occurred. There was no transfer or guest retry after the breach.

Once free space recovered above the floor, guarded metadata recovery recorded
no scoped remote helpers or trace file and removed only this boat's transfer
chunks/archive. The first recovery check incorrectly expected no extracted
tree and failed before cleanup; inspecting the retained member inventory
resolved that transport assumption without running the guest. Both retained
remote metadata files were SHA-verified and independently reread locally
**before** the explicitly delegated stop request. The boat is verified
STOPPED at `2026-11-02T21:18:19.110Z`, error null. Exact pins, disassembly,
prediction inventory, abort/lifecycle evidence and recovery recipe remain in
the run; no local archive or fixture copy was created.

The concrete execution blocker is the disk-floor abort. First API/result
confirmation remains outstanding; do not label the static prediction an
executed cause or replay the unchanged browser modal. After stable disk
headroom is available, a fresh bounded pre-modal trace should record the
module load, DC/format result and mandatory table's first NULL, with matching
source/module pins. Only demonstrated missing semantics justify a runtime
repair and its negative controls/build/browser observation. No startup,
gameplay, console-use or training-objective success is claimed here.

## Fresh pre-modal trace blocked during admission (2026-11-02)

Run `20261102-oni-pre-modal-api-trace` preserved the predecessor's aborted
transfer and independently verified all70 retained final-manifest hashes.
`glAreTexturesResident` remains a conditional static prediction, **not an
observed API/result**. The prepared bounded read-only trace was not executed.

During the ordered scratch-only wait, a continuous local observer recorded
1995182080 free bytes at `2026-11-02T21:54:04.611382Z`, below the required
2000000000; its final minimum was1961189376 bytes. This worker had no transfer,
boat, build, runtime test, guest or browser process. Execution admission was
latched off; no retry followed the later recovery in free space. These are
ambient filesystem observations, not an emulator failure or attribution of
the predecessor's transient writes. Read-only host log-volume and allocation
observations did not establish the write cause. A prepared filesystem-write
restriction wrapper remains unexecuted and unvalidated; it supplies no safety
or acceptance evidence.

Brave99598 then GL43988 were consumed in order: actual terminal exits0, four
result/final files each, exact AUTHOR RELEASE entries, named/scoped helper
absence, and all364/48 final-manifest hashes independently passed. GL43988
also released a disk-aborted task without a runtime implementation. Main was
refreshed only after both releases. Fresh identity and local/public desktop
exclusion records remain in this run; no old module was paired with newer
host/region-map files or run. No source repair, semantic controls, code tests,
full build, original invocation, browser input or screenshot occurred. This
is a documentation-only blocker update, not new training progress.

No boat was created or foreign boat touched. Own polling, disk and board
helpers exited and were checked absent. `RECOVERY.md`, `guard-latched.json`,
`disk-observations.jsonl`, exact pins, gate verifications and result/final
metadata retain the failure. The dependency is stable host disk/write behavior
above2GB before a fresh finite-TTL, exact-hash-streamed, matching-module
pre-modal trace. Confirm the actual first branch/API result before a faithful
generic repair and one justified changed-source original browser observation;
the training-console objective remains unverified.

## Host disk transient attributed; API trace deferred (2026-11-02)

Run `20261102-oni-disk-writer-and-api-trace` performed bounded read-only
same-user `/proc` I/O and open-file allocation sampling after the predecessor
and the scoped terminal-log recovery released. Recovery had reclaimed
19,791,872 physical bytes. Initial free space was2,025,984,000 bytes; this
was a fresh measurement, independent of historical floor breaches.

At22:14:46Z the two-second observer recorded1,968,259,072 free bytes,
following2,024,771,584. In that interval `codex` PID1836136 recorded
56,344,576 write bytes. The original interval's temporary file was too short
lived for that sampling rate, so its exact path is unknown. Faster sampling
then directly caught another occurrence at22:15:08Z: `codex` PID1837492
held fd37 to `/home/user/.codex/cache/remote_plugin_catalog/.tmprpeqos`.
Its physical allocation grew9,748,480 ->33,169,408 ->56,348,672 bytes
(size56,340,716), alongside matching process write deltas. Free space fell
2,019,127,296 ->1,995,005,952 ->1,969,623,040 bytes. The catalog
`d0f1d17ff0560956.json` was subsequently observed with the same size and
allocation, and free space recovered above2GB. This identifies an actual
catalog temporary writer; it does not retrospectively prove every prior
transient had the same cause. No catalog, DB, WAL, session or log contents
were read or changed, and no foreign process was killed.

Stable disk headroom and bounded ambient writes were not established. No
boat, transfer, fixture duplicate, original guest, build, browser or API trace
was started; no unchanged transfer retry occurred. `glAreTexturesResident`
remains a conditional static prediction, not an actual API/result. No shared
runtime repair or new training-console progress is claimed. Evidence and
recovery instructions are retained in the fresh run. Before a fresh faithful
trace, address the observed roughly56.35MB catalog temporary allocation or
provide headroom that survives it, then refresh main, fixture/module/source
pins and exclusion checks. This task makes no host-cache change.

## Prepared trace reached a CLI provisioning failure (2026-11-02)

Run `20261102-oni-reserved-premodal-trace` refreshed all34 original fixture
hashes, current source/compiler/API/module pins and local/public desktop
exclusions (46/44 entries). All18 predecessor evidence hashes passed.
The exact retained production module `46c90ae6...a7667a` was read directly
from the coordinator's verified gzip recovery, paired with its matching
`e318fe1c5016e393a1467c86f02e1932cdf67503` source/host/region map/compiler and
CLI helpers, without a local archive or fixture copy. All4671 streamed member
hashes passed remotely; all4670 pinned inputs remained unchanged afterward.

The single prepared CLI command used12-second guest/40-second controller
bounds and the predicted loader-failure breakpoint `0x40acca`. It exited1
after0.238 seconds, before guest execution, because the CLI eagerly reads
`test/binaries/tlbs/stdole2.tlb` while mounting system data. That file was
absent from the prepared stream. This differs from the earlier browser's
optional boot warning: here the uncaught `ENOENT` stops harness setup. The
earlier `pngjs` warning also reports unavailable renderer support, but is
not the fatal exception. No debugger prompt, original API/result, branch,
modal, input or gameplay was observed. `glAreTexturesResident` remains a
conditional static prediction. No guest retry or runtime repair followed.

The guarded workflow completed with minimum sampled free space2020954112B,
above2000000000B. Seven small remote evidence files were retrieved and
SHA-verified locally; scoped guest/trace/transfer helpers, chunks and remote
archive are absent. Boat `bx_z8fqvy2y`, original expiry
`2026-11-02T22:55:38.215Z` recorded before use, remains running (Boat state
`idle`), with the extracted tree retained. Shutdown belongs to the coordinator;
none was requested. Next provision and hash-pin the CLI system-data dependencies
separately from the unchanged original fixture before a fresh trace. This
failure establishes a harness prerequisite, not Oni's startup capability cause.

## CLI boot provisioned; first mandatory NULL observed (2026-11-02)

Run `20261102-oni-cli-boot-dependencies-trace` reused assigned boat
`bx_z8fqvy2y` without extending its original22:55:38.215Z expiry or repeating
fixture transfer. The actual CLI loader's eager system-data/font inventory
found exactly one missing file: `test/binaries/tlbs/stdole2.tlb`. Its existing
local15088-byte content, SHA256
`db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895`,
was streamed and remotely verified. All26 other eager boot files already
matched. No broader DLL/binaries tree or optional `pngjs` was transferred;
the latter supplies screen/capture/pointer support, which this trace did not
request. Its warning remained nonfatal and original guest execution began.

All34 original fixture identities were refreshed. All1436 current pins
matched the predecessor and remained unchanged; all4669 retained baseline
inputs checked before/after execution matched source
`e318fe1c5016e393a1467c86f02e1932cdf67503`, matching host/region map/API/CLI,
and unchanged module `46c90ae6...a7667a`. The baseline count excludes the
predecessor's observer. No new module or current host was substituted.

One original invocation used12-second guest/40-second controller limits and
100000 batches. It exited0 after7.165 controller seconds (guest loop4.485s).
The observed sequence is:

- API525 `GetModuleHandleA("opengl32.dll")` returned `0x00adc8fc`.
- API526 `GetDC(0x00010001)` returned `0x00310002`.
- API528 `ChoosePixelFormat(0x00310002,0x074ffd38)` returned1 at guest return
  address `0x408940`.
- API530/531 `GetProcAddress` returned nonzero pointers for `glAccum` and
  `glAlphaFunc` respectively.
- API532 `GetProcAddress(0x00adc8fc,"glAreTexturesResident")` returned **NULL**,
  guest return address `0x4089d8`. This mandatory lookup is now **observed**,
  rather than only a static prediction.

The loader continued resolving the remaining names, then API878
`MessageBoxA` supplied the previously reported OpenGL modal text. No traced
context-creation, make-current, selected-format description or GL-string call
occurred before that modal. This establishes the first missing mandatory
export in the actual original loader, before a context query; it does not
measure browser GPU support. Other earlier optional NULL lookups, including
`SetThreadExecutionState` and VTune functions, are present in the log and
were passed before this loader ran.

The planned `0x40acca` breakpoint did **not** fire: no debugger prompt,
register/table dump, or debugger command was produced. Therefore the exact
NULL-scan branch remains statically mapped, not instruction-traced. The
observer's original “stop before modal” intent was not achieved; the bounded
run logged the modal and ended at the batch limit without input or dismissal.
Do not describe this as a captured branch/register proof or successful startup.
No second invocation, browser replay, renderer/clock substitution, guest patch,
API repair or gameplay probe followed.

Four remote evidence files were retrieved, SHA-verified and independently
reread before the explicitly delegated shutdown. Baseline inputs remained
unchanged and scoped remote helpers were absent. Local guard minimum was
2070081536 bytes, above2000000000. Lifecycle receipts and final stopped-state
verification are retained with the trace. Next implement genuine missing GL
semantics with appropriate controls; exposing dummy pointers would merely
pass the table predicate. Training-console progress remains unverified.


## Genuine texture residency query (2026-11-02)

Run `20261102-oni-texture-residency-contract` implements the previously observed
missing `glAreTexturesResident` export through its real native handler and both
resolver paths. This compatibility implementation has no separate texture
working set: native software images, frontend image levels and software/WebGL
texture resources retain backing until deletion. Valid incomplete objects and
objects with zero priority are resident too. This policy is expressly allowed
by [OpenGL 1.1 section 3.8.4](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf).
It agrees with the existing `GL_TEXTURE_RESIDENT` bound-object query; it does
not infer physical GPU residency from WebGL, which exposes no such query.

Every requested name is checked against the live shared native object
namespace under its lock. Zero/default names, unused names, generated-only
reservations and deleted names return false with `GL_INVALID_VALUE`.
Negative counts generate that error before array access; zero count succeeds
without accessing either pointer. Executed Begin/End generates
`GL_INVALID_OPERATION`. Queries execute immediately during display-list
compilation and are not replayed. All-valid queries return canonical boolean
one and leave every byte of `residences` untouched, as required by the
[Khronos reference page](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/glAreTexturesResident.xml).
Invalid-name output is indeterminate in the spec; this implementation also
leaves it untouched. There is no artificial mixed-residency state or eviction
mechanism: per-name validation still rejects mixed valid/invalid lists.

Resolved-thunk controls check literal returns/errors, stdcall cleanup,
registers, stack bytes, unaligned output canaries, both texture dimensions,
priority, sharing/isolation, deletion/reuse and retained deleted bindings.
Native and actual queued software each pass 27 recorded query cases and eight
literal image/draw checks; the queue requires zero fallbacks. Actual WebGL 1
and 2 replay all eight retained-image cases each, including old generations
remaining red while reused names draw green. The unchanged pre-change native
source/dispatcher fails at the real missing-export assertion. Seven mutations
(constant true/false, skipped name checks, skipped Begin checks, wrong negative-
count error, byte output and widened output) fail at their intended assertions.

The original Oni trace remains the last guest result: API532 returned NULL
at return4089d8 and the planned branch breakpoint was missed. No original
Oni/browser gameplay retry is part of this implementation. The independently
recomputed static table now has 52 unavailable mandatory exports out of 345,
down from 53; its next unavailable name is `glClearIndex`, a static finding
only. One implemented export does not establish full startup readiness or new
training-console progress.

Focused availability (including its three negative controls), texture-state,
shared-object, actual queue, one-dimensional texture, frame-state and texture
copy/readback regressions pass. The locked `tools/build.sh` build passes on
fresh finite-TTL boat `bx_n9c9g3rs` (original expiry
2026-11-02T23:42:19.022Z). Evidence is retained in
`scratch/runs/20261102-oni-texture-residency-contract/`.
An additional fixed-function JavaScript test fails its existing redundant-
uniform assertion (55 calls versus 53 expected). Its test and backend sources
are byte-identical to the pre-change commit; it does not load this native
handler. That separate regression remains unresolved by this change.

## Native scalar doubles and texture priorities (2026-11-03)

`glColor4d` and `glPrioritizeTextures` now resolve to native handlers. The
scalar color handler reads all eight physical argument words through guest
page translation and consumes 36 stack bytes including the return address.
It demotes each double once into the existing float color path, retaining
unclamped current color, alpha, context isolation, legal Begin/End updates and
both display-list compilation modes. Clamping remains at rasterization.

The priority handler validates Begin/End and negative counts before reading
arrays, snapshots both complete arrays, clamps priorities to [0,1], and changes
only live named texture objects. Zero, unused and generated-only names are
ignored. A private by-name stream record updates the actual frontend object
without changing bindings; native and frontend state share their existing
namespace and lifetime rules. Lists own name/value snapshots and resolve names
at execution, including names created or reused after compilation. An empty
call records a no-op so replay within Begin still reports INVALID_OPERATION.
The lifetime-backed, no-separate-working-set residency policy is unchanged:
priority zero does not evict a live object or create mixed residency.
These contracts follow the [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf)
and Khronos reference sources for [color](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/glColor.xml)
and [texture priorities](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/glPrioritizeTextures.xml).

The resolved native ABI and actual queued software each pass 88 literal typed
query checks and 11 literal draw/image controls, with stack/register/output
canaries and non-affine page crossings. The queued path submits 12 real jobs
with zero fallbacks. Actual WebGL 1 and 2 each pass all 11 pixel controls and
28 frontend priority observations. Both unchanged old exports fail at their
missing-export assertions. Eleven native semantic mutations and two frontend
mutations fail at their intended assertions; an earlier mutation that merely
made a list opcode unsupported trapped and is retained as a diagnostic,
without counting as semantic acceptance.

The static mandatory inventory is now **50 unavailable out of 345**, down
from 52; `glClearIndex` remains the first static miss. This is an inventory,
not 50 observed guest failures. The original Oni result remains API532
`glAreTexturesResident` returning NULL at guest return4089d8. No original Oni
or browser gameplay replay was performed while mandatory gaps remain.
Evidence is in `scratch/runs/20261103-oni-mandatory-color-priority-recover/`.

Focused typed color/normal/vertex/coordinate, texture state, shared-object,
state-query, command-stream, frame-state, 1D texture, copy/readback, actual
queue, WebGL sharing and availability regressions pass. Three availability
mutations fail at their intended assertions. The isolated double-color fixture
now includes released shared-context globals/atomic storage and stipple
signatures; the general query fixture uses `glClearIndex` for its negative
export control because `wglShareLists` was already implemented.
The locked `flock /tmp/wine-build.lock bash tools/build.sh` passes on own
finite-TTL boat `bx_ryejamc2`, original expiry2026-11-03T01:20:40.462Z.

Two separate pre-existing failures remain explicit. The encoder's context
parity section expects eight submissions but receives seven; the same mismatch
reproduces with all five changed native fragments restored in memory to
`94d26f406` and individually SHA-verified. Its primitive, state and array
sections pass. The optional fixed-function JavaScript test still reports 55
uniform calls versus 53 expected. Neither failure is counted as a pass or
claimed repaired by this implementation.

### 2026-11-11: original GL startup passes; repair CLI empty-poll resume

The retained NULL at return `0x4089d8` is superseded by an executed original
startup trace using the verified installed `game/Oni.exe` (SHA-256
`d1579b3a205bdb7771ac32ebf3af61f927d352fe2e3e35128207e84a2937a12d`).
Current main already implements texture residency, including the shared-context
object namespace, immediate queries during list compilation, validation and
error behavior, and matching `GL_TEXTURE_RESIDENT` getters. No additional GL
export was enabled for this attempt. The lifetime-backed, no-eviction policy
is permitted by the [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf):
textures in virtual memory are always resident; a successful all-resident
query leaves the output array unchanged. The
[Khronos reference](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/glAreTexturesResident.xml)
also specifies negative-count, invalid-name and Begin/End errors.

The original executes **all 345 mandatory lookups successfully**. In this run,
API531 `glAreTexturesResident` at the same return address resolves to
`0x07504bd0`. Two optional 3DFX gamma-ramp lookups return NULL. This conclusion
comes from executed calls and their returns, supported by aligned loader
disassembly, rather than treating a static inventory as observed failures.
The unchanged production module SHA-256 is
`75ecda5701c15f6fe2c269455ead4e15457b90653733df15d35674b08e8849d5`.

The original advances through intro movies to a fully rendered main menu in
both WebGL and software GL. Browser worker identity confirms an actual WebGL 1
context with no context loss. Harmless controls verify trusted, balanced native
input and reject stale/unreviewed-frame and invalid-action requests. Browser
capture/command timeouts remain explicit uncertain results; no uncertain click
was resent. Every attempted browser was closed normally with actual parent
waits, both output EOFs, and independent process/profile absence checks.

The software CLI exposed a separate reproducible scheduler defect: service-clock
mode left yield reason 15 (empty PeekMessage) armed indefinitely. The guest
remained on the PeekMessage thunk at `0x07500460` while six balanced mouse
messages stayed queued. The CLI now clears that park under either clock;
clock-deadline parks retain their existing timing. A compiled normal dispatcher
test reproduces the old failure, then proves the repaired CLI resumes the
five-argument stdcall frame, delivers queued keyboard input, and charges no
guest time. This changes host scheduling, without editing original guest state. The CLI
attempt uses normal harness mouse/key events; browser trusted-input evidence
is recorded separately.

Native residency checks (27 query and eight image cases), queued software
residency with zero fallbacks, actual WebGL 1/2 residency images, resolver
availability, texture state, shared objects, 1D textures, frame state and
copy/readback regressions pass. The 53 clock-spin checks, service-clock main and
worker checks, idle-deadline checks, and locked build also pass. Compact raw-hash
evidence, immutable production module, exact source SHA/patches, media path/hash
references and lifecycle records are retained in
`scratch/runs/20261111-oni-current-gl-residency-startup-1110/`.

The repaired original reaches the main menu again and services **4,285**
empty-PeekMessage parks, versus one unserviced park before the repair. Its
queued mouse move/down/up at `(440,310)`, Down/Enter, and a held Enter all drain;
the menu does not transition. Thus level rendering, movement and combat remain
unproved. The next concrete dependency is tracing those consumed input messages
through Oni's menu input handling, including its device/state polling; the
available observations do not yet establish the failing API or guest branch.
Normal CLI quit returns code 0 with actual parent waits and both EOFs; an
independent check confirms the process is absent and its control port refuses
connections. The fixed watchdog exits unfired. No cloud box was created.
