# Outcast demo source preflight

Selected2026-10-12 to refill Rage of Mages II's qualified core lane. No
existing Outcast task or registered candidate/app match found. Source:
https://archive.org/details/gsscda1999, `1999-09/GS0999.iso`, directory
`DEMOS/OUTCAST`. The ISO is662,108,160bytes; Archive metadata SHA1
`74d2f13d0ccb0e0a4091606b0771bb07ddf7bc44` is not a verified whole-disc hash.
Direct range endpoint:
https://ia801500.us.archive.org/4/items/gsscda1999/1999-09/GS0999.iso

ISO9660 directory reads confirm an unpacked EXE/PAK/README layout beside
InstallShield setup files. EXE contains LOADER.EXE1,253,376bytes and
OC1.EXE6,664,192, OC2.EXE6,631,424, OC3.EXE6,647,808. Do not guess which
variant is the intended launcher; inspect bundled guidance and runtime
behavior. README includes OUTCAST_DEMO.EXE360,508bytes plus a27-byte README,
so that small EXE must not be mistaken for the actual game.

Evidence `scratch/runs/20261012T0430Z-outcast-preflight` preserves range-reader
scripts, directory output and complete extents for EXE/PAK/README children.
Remote metadata `/home/user/outcast-demo-preflight/disc-source.json` on
bx_f7mupqaw. No game payload downloaded or runtime launched yet. Next recover
the named executable/asset tree on a temporary box, record per-file hashes,
read guidance/imports and attempt a bounded launcher route. No source edit,
gameplay/audio/FPS/registration/public-distribution qualification claimed.


## Recovered payload and launcher, 2026-10-12 04:45Z

Recovered all 141 selected files (141,828,299 bytes): EXE/PAK/README plus
INFO.TXT and SETUP.INI. Evidence scratch/runs/20261012T0439Z-outcast-recovery
contains the complete per-file SHA256 receipt, range download scripts, static
launcher imports, configuration and build log. The ISO itself was not downloaded
or whole-disc hashed. Node fetch stalled on larger ranges; its two interrupted
attempts are retained. Curl with checked HTTP206 and exact range lengths completed.
Payload is on bx_64vb5qy9 under /home/user/outcast-demo-preflight/independent.

INFO.TXT describes a 20-minute Shamazaar demo: arrow-key movement, mouse look,
left click use/jump/fire, right click aim/punch, 1 draws weapon, 0 holsters,
Tab map, B inventory. README.TXT dates it 290699. LOADER.INI initially selects
400x300 and includes volume=0.000000; audio has not been evaluated.

For launch, hardlinked the EXE and PAK directory contents into a flat game/
folder, preserving original recovered files and their bytes. The runtime reads
text.pak, menu bitmaps and configuration successfully from this layout. LOADER.EXE
SHA256 b06271739720cf695cb13db4d0bbb864c7f8a69429380fe307912edc66631e56.
Module SHA256 9e835f75dfe5d2fcfb91f592641e945f91baadcd20f6751460777f4dba888cd6
matches the prior temporary-box build; this is not a claim of testing clean main.

0444Z-outcast-launcher: bounded CLI with all files mounted, spawn-processes,
100000 batch size, 40-second limit, exit0 at1013batches. Reviewed final.png shows
German New Game/Load Game/Settings/Quit menu. A missing real shell32.dll warning
is retained in run.log; no ordinal trap occurred. First wrapper attempt had a
JavaScript syntax error before guest launch; transport.log preserves that and
transport-retry.log the corrected run. Menu is verified; gameplay is not yet.


0446Z-outcast-newgame scheduled its click at1020, but the80-second guard
stopped at1016: input never fired, so this does not test New Game. The launcher
idle loop makes large batches extremely slow. In0448Z-outcast-newgame-early,
ordinary click200,185 at1010 succeeds: writes selected settings then invokes
ShellExecuteA("C:/oc2.exe", "game", cwd C:/). Launcher exits0, followed by an
EIP-zero teardown diagnostic; do not mislabel that as the game executable crash.

The CLI ShellExecute hook needs --capture-launch for this route; --spawn-processes
alone does not follow it.0449Z-outcast-child captures the complete modified VFS
at that handoff, then launches the metadata-selected executable with --vfs-tree,
--cwd and --args=game. 4000batches/25.67seconds, exit0,20.8million MMX instructions.
Reviewed child.png shows Cutter and an NPC on a dock in the rendered3D world,
HUD/health/compass visible. No emulator source patch. This establishes world
rendering; ordinary input displacement still requires its separate test.
Captured files live remotely under /home/user/outcast-demo-preflight/captured;
use those for replay, since the launcher modified the settings before handing off.
Missing real shell32.dll/ole32.dll warnings remain; no ordinal trap observed.


## Ordinary movement verified, 04:52Z

0450Z-outcast-movement: captured-child replay, before.png at4000, ordinary
VK38 down4100/up6100, final7000. Reviewed before/after shows forward displacement:
bridge pillars move outward and the nearby NPC is passed on the right. Movement
is modest; do not claim long-distance exploration. Matching0451Z-outcast-noinput-control
runs to7000 without keys and retains the original dock/camera position. Both
exit0 (~41seconds); module matches above, OC2 SHA256 d5513a94c2aff8ed54598c60fbf28bdf5845848a5eef74ff326037ec1a54f8a1.
The input/control difference establishes player-controlled forward movement.

No emulator source fix. Next local-only registration with reproducible launcher
configuration/handoff, browser arrow-key and touch movement, scene-qualified FPS
and audio. Do not use batches/s as FPS. No browser/phone/audio qualification yet.
Original menu/child warnings and failed harness attempts remain in evidence.


## Stock configuration and local registry, 2026-10-12 05:00Z

0456Z-outcast-stock verifies direct OC2.EXE --args=game against the original
flattened EXE/PAK files (not captured launcher settings): reviewed400x300 world
rendering,4000batches/26.06seconds, exit0. A direct registry entry therefore need
not depend on prior generated configuration. Prepare copies134 original files
from that flat tree; browser manifest supplies133 data files beside OC2.EXE.
Local-only outcast_demo/outcast-demo registration uses that direct route with
relative mouse and arrow-key touch pad; Use/fire, Aim, Weapon1, MapTab, MenuEsc.
Manual source preparation and exact executable SHA256 are in the manifest.

0458Z-outcast-browser: Chrome155/WebGL/Threads with the registered stock route.
First capture at60seconds is still loading, step1 keyboard also during loading;
step3 shows the rendered world with Cutter in water after touch-pad input. Full
844x390 layout visible. This run proves browser launch, but lacks a before-world
movement baseline; use the following later-input run for input qualification.


0500Z-outcast-browser-input starts input after100seconds, with reviewed world
baseline. Holding ArrowDown4seconds moves Cutter well away from the dock onto
land (menu.png vs step1.png). At844x390, actual CDP touch-pad forward4seconds
moves him back to the dock (step2.png vs step3.png). Chrome155/WebGL/Threads,
module9e835f75..8cd6; stage complete05:01:55, browser/server closed normally.
This verifies registered keyboard and touch-pad gameplay; it is Chromium touch
emulation, not physical phone or Safari qualification. Audio, FPS, aiming/fire,
menu/map and longer exploration remain separate checks. Local-only registration
e11417836 pushed on codex/dr2-registration; main integration remains ops-owned.


## Integration reconciliation, 2026-10-13

The text above is preserved from historical evidence commit
`e13360bfd3be5b9330db9b2649cea5c62634e18a`. Registration `e11417836`
is already an ancestor of main; the old integration-pending/ops-ownership
statement is superseded. These notes were absent from main and are recovered
here without claiming a fresh runtime test. The recorded module and dates
remain the scope of the gameplay evidence. Audio, FPS, physical-device and
additional action-control checks remain open.

## Full-disc automated recovery, 2026-10-14

The complete662108160-byte GS0999.iso was freshly downloaded from https://archive.org/download/gsscda1999/1999-09/GS0999.iso and SHA1 74d2f13d0ccb0e0a4091606b0771bb07ddf7bc44 verified locally. This supersedes the historical limitation that only metadata/ranges were verified. Recipe extraction uses7-Zip23.01 Joliet names. Copy Demos/Outcast/exe then pak into game/; their filenames do not collide. Add unchanged Oc2.exe as uppercase OC2.EXE for the existing registration. No configuration synthesis.

Run `node tools/fetch-candidate-corpus.js --id=outcast-demo`, then `node test/test-outcast-demo-recovery.js`. All135 output files are pinned in test/candidate-corpus/outcast-demo-files.json and compared byte-for-byte with the independently downloaded/extracted disc tree. Previously recorded executable SHA256 matches. Restored-fixture differences: none. Private-fixture restrictions remain; full-disc download needs roughly1.5GB temporary/free space and contains unrelated disc material. No new game launch/audio/FPS/deployment qualification.

## Ordinary weapon draw, aim and firing, 2026-11-01

Run `scratch/runs/20261101-outcast-original-weapon-control/` closes the
native ordinary weapon-action gap with one original execution. Historical
movement evidence above did not cover these actions. MDK2 worker01a1967a's
fresh final/result and explicit09:43:15 runtime/source/build RELEASE preceded
the09:44:06 ownership gate. Actual main was
`b7ba31ca53bc575f31521bd15592e8d68d73d907`, superseding dispatch baseline
`c0c991a95`. No game or emulator change was made.

Registered `outcast_demo` used stock direct `OC2.EXE game`, with its original
flat local tree and no captured configuration. All135 recovery-manifest files
matched; the full135-file tree plus three manifest files were hashed before
and after without changes. OC2 SHA256 remains
`d5513a94c2aff8ed54598c60fbf28bdf5845848a5eef74ff326037ec1a54f8a1`.
The complete4392 accepted build-input pins and141 prior runtime-read pins
matched, allowing build reuse. Actual runtime WebAssembly compile bytes were
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
the region mirror matched. All4444 current source/module pins and141 observed
runtime reads also matched after execution. This identifies the runtime module;
it does not claim fresh build/compiler-source read coverage.

Reviewed `before.png` at4000 shows the original dock. Ordinary WM plus DI
key1 down/held/up first showed an incomplete draw pose. Right/left mouse
down/held/up while facing the NPC instead opened `GRÜSSEN`; those early
`fire-*` captures are interaction evidence, **excluded from firing success**.
Escape dismissed that menu; ordinary Right-arrow turned toward clear terrain.
A fresh key1 down6400/up6500 and1000 further batches completed the draw:
`weapon-selected.png` at7500 shows the pistol in Cutter's hand. Right mouse
down7500, held through7800, gives the raised pistol, targeting brackets and
ammo80 in `clear-aim.png`. Left mouse down7800, held through7900, changes
ammo to79 in `clear-fire100.png`; it remains79 at8200 in
`clear-fire400.png`. This ammo expenditure establishes a shot beyond pose
animation. No projectile trajectory, impact, damage, kill or combat outcome
is claimed. The lower1198-to1191 counter is the demo timer, not ammo.

Both buttons were released at8200; `clear-released.png`8500 and
`clear-settled.png`9000 show the lowered weapon. Key0 down9000/up9100,
settled10100, removes the weapon/targeting brackets in `holstered.png`.
`input-consumption.json` retains actual WM dequeue/route/DispatchMessage and
DI FIFO consumption: head/tail6/6 at aim,7/7 after firing,10/10 after release,
zero pending, host button masks2,3,0 respectively. Known WM queues drained.
This does not instrument individual key-state polls; guest postqueue and SDL
consumption remain unknown. Read-only eval inspected emulator DI state only.
NPC animation and environmental lighting changes are not action evidence.

Local Node24.18.1, cooperative backend,100000-block batches, frozen small
control steps;640x480 capture contains the400x300 game. Orderly quit exited0
after170.150seconds. Startup free space2247335936bytes, minimum2240036864,
always above2GB. Actual synchronous and asynchronous observer execution passed
whole512MB memory equality, clock identity and emitted late-event10001 retention.
An initial offline observer output-directory mismatch failed before guest
launch, was corrected, and is retained in `observer-validation.log`.
Observer coverage is synchronous file reads and complete, closed, bounded
descriptors up to24MiB; async/stream/incomplete/open/oversize descriptor reads
are not covered. Exit-only flush is not a finalflush completeness guarantee.

`node test/test-outcast-demo-recovery.js` passed135 originals; identity,
input, cleanup and evidence checks are retained. Own runtime3468605,
driver3468595, watcher3469442, runtime group and new temporary paths are absent.
Native local box ID/state/expiry: N/A. Evidence remains ignored and preserved.
No browser, physical-device, GPU, audio, FPS or broad playability qualification.
