# Jedi demo: bounded CLI runtime, hostile route not completed

The original installed demo ran through **Play → full opening movie →
Player/Medium → Single Player → New Game** in one native CLI session. Ordinary
released Up/Left controls moved and rotated the view. I did **not** positively
identify an armed hostile, fire, observe an incoming attack, or capture a target
effect. The planned stair route was not completed. This is runtime evidence of
a navigation limit, not another authorization/preparation-only result and not
a proven emulator fault.

## Observed route limit

I read the [retained route](jedi-hostile-route-20261103.md) and recovery recipes,
then reviewed this session's actual captures before every movement. The initial
view showed the courtyard, pistol, and health/shield/ammo100. Small Left turns
and short Up holds reached the lane between blocks, the far courtyard, and the
low ledge beside a metal ramp-like surface. Early capture names containing
`west` or `south` describe intended steering, not a verified compass heading or
sector trajectory. I did not read actual player coordinates or sectors.

The first concrete navigation obstruction is preserved in
`opposite-lower.png → ledge-forward-check.png → ledge-block-confirmed.png`:
released forward holds of1.5s and1s approach the low ledge but do not cross it;
the later view shifts slightly along it. The subsequent
`ramp-access.png → ramp-step01.png → ramp-step02.png` pair similarly reaches
the metal surface and then shows little forward progress after another1.5s
hold. Earlier solid-wall turns and the later far courtyard check did not reveal
the physical stair entrance. These observations establish what stopped this
attempt; they do not establish that the static route is impassable, that these
surfaces belong to its intended sector sequence, or that collision is defective.

A small yellow distant figure remained ambiguous and was not fired upon.
**Ctrl was never pressed.** The later input-free idle capture shows an armed
white-shirted figure in an orbiting view, consistent with the player's idle
camera. It is not hostile evidence. Health/shield/ammo remained100 in the
reviewed captures. Bossk266 remains a static hostile candidate only; neither
its visible presence nor an ordinary combat interaction was established.

## Exact execution and preservation

Evidence is gitignored `scratch/runs/20261103-jedi-hostile-cli-execution/`.
Only new boat **bx_pw7fam7d**, finite TTL7200, original expiry
**2026-11-03T13:02:22.482Z**, shutdown owner `jedi-hostile-cli-execution`, was
used; identity, expiry and ownership were recorded before use. This task
explicitly authorized separate native CLI execution immediately and delegated
normal stop after verified recovery. No Alice/GL release or browser gate was
applied. No Chrome/browser, predecessor boat, subworker or public deployment
was used.

Source was sealed committed main
`54e558e61b948f94dfddb1392c8eba4a98a69ff9`: all5825 input paths streamed
directly from Git blobs, excluding foreign modified/untracked GL work and
`lib/wininit-boot.js`. Every source pin was rechecked after the build and
verified recoverable from that commit. No duplicate local source/original
archive or additional Git checkout was created.

Fresh own-boat `flock /tmp/wine-build.lock bash tools/build.sh` passed, as did
four focused controls: shell CLI routing, WinExec readiness, keyboard lParam,
and process desktop. Four no-guest observer authority/guard/fork controls passed.
The built module is2084058 bytes, SHA256
`fa326d595b106a9e2f8242ef66c67d0ee5530462d587e7e76867640f800ebfc8`.
The input-dictionary SHA256 is
`97894a04103c60c58ee154a93440a87e2e2a6df96f4ed1f77e314467e0a4c1f5`.
Actual process receipts separately record three matching compile inputs and
completed instantiations: launcher and both original JkDemo children. A staged
module is not substituted for those observed loaded-instance receipts.

The native supervisor used `node test/run.js` with CLI renderer/controller,
real ticks, one original launcher, guest limit1200s and outer limit1260s.
Both original WinExec calls executed. The first child's FindWindow returned0;
the second found hwnd0x20001 and exited through original ExitProcess. The
original movie was not skipped. There was no direct engine/map command,
guest/config/registry patch, invented save or retry campaign.

All28 originals/39900850 bytes, genuine DSOUND.VXD/DDHELP, builtin
DDRAW/DSOUND, baseline76 registry entries and allowed child-added Version0.1
were preserved in the recorded snapshots. The219-member runtime closure has
full byte/SHA256 pins. Original recovery uses the retained installer and layout
recipes; `RECOVERY.md`, source seal, manifests, module receipts, logs, reviewed
captures and input receipts retain exact recovery/provenance details.

The gameplay child reported3417926 batches in1199.999s and wrote its final PNG.
The supervisor ended after1255.784229898s, within1260s, with exitCode-9 and
`stop:"outer finite deadline"`. The retained supervisor reserves cleanup inside
that limit: guard1250s, TERM grace5s, then KILL/wait up to5s. The parent did not
terminate on its own after the configured run limit. This lifecycle limit and
the outer SIGKILL are preserved separately from the navigation obstruction;
neither is presented as an enemy encounter or a diagnosed guest crash.

Post-run verification passed for48 captured states, including46 child states:
original28 hashes, genuine prerequisites, builtin DDRAW/DSOUND and original
registry values preserved, with only allowed child Version0.1. The parent's
exported registry retains76 entries unchanged. All219 runtime files still
match. The three actual module instantiations match the built module, and all
scoped helpers/control ports8143..8159 are absent.

All192 retrieved payloads passed independent stored/decompressed byte-count
and fullSHA checks. The archive is7569937 bytes, SHA256
`4f611e9945afa0845511cbf39add57a658ec7e7c12f7cfed5ee60eda4bc922a5`.
The pre-stop recovery record was uploaded and retrieved byte-for-byte before
the delegated normal stop. FullSHA inventories retain the local artifacts;
no run artifacts are committed.

Only own boat bx_pw7fam7d completed normal stop
`stop_958198db679a8731` at **2026-11-03T11:31:02.228Z**:
**STOPPED, error:null, forced:false**. Normal snapshot/metadata remain retained
and available. Remote scoped helpers and local task helpers were absent.
No assigned boat remains running; no predecessor boat was operated. Local
/home free space remained above2GB, including verified evidence retrieval.

Next work is to locate and visually follow the physical west/south stair
entrance during a separately authorized session, then identify an armed hostile
and capture attack/target effects. This run supplies real bounded execution and
an honest route limit; it does not claim that objective was achieved.
