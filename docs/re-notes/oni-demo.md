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
