# Jedi demo: measured stair route; death before hostile identification

The previous navigation uncertainty is resolved: the original demo's live player
position, orientation and sector were observed through existing CLI inspection,
and the physical western stairs were located and climbed. The measured route was
**874 → 266 → 267 → 276 → 256 → 277 → 280 → 265**. The player then died after
visible damage before an armed hostile could be positively identified. No shot,
restart, enemy identification, target effect or enemy defeat is claimed.

## Original-code basis for the read-only observation

The [prior CLI attempt](jedi-hostile-cli-20261103.md) measured no live location;
its intended heading labels were insufficient. I read that note, the
[static route](jedi-hostile-route-20261103.md), and retained recovery recipes.
This run used fresh authentic originals and recomputed the map geometry.

The reverse-engineered upstream
[Coords routine](https://github.com/shinyquagsire23/OpenJKDF2/blob/master/src/Main/sithCommand.c)
provided a format-string search lead. Its published addresses were **not** used
as demo addresses. In the original **JkDemo.exe**, 1,388,032 bytes, SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`,
the string at `0x54c29c` has a code reference at `0x4eecaa`. Disassembly of its
containing routine, **0x4eec10**, establishes this exact layout:

| Original instruction/access | Meaning established by the routine |
| --- | --- |
| `0x4eec10: mov eax,[0x8339d0]` | Current world pointer global |
| `0x4eec21: mov esi,[eax+0x124]` | World's local player thing |
| `0x4eec2f` / `0x4eec5e`: `[esi+0x5c]` | Player's sector pointer |
| `0x4eec68: mov eax,[edx]` | Sector ID at offset zero |
| `0x4eec51: lea ecx,[esi+0x88]` | Orientation matrix passed to angle extraction at `0x440940` |
| `0x4eec85`, `0x4eec91`, `0x4eec9d` | Position floats at `+0xc0`, `+0xbc`, `+0xb8`, passed as XYZ |

The scratch observer uses existing CLI `eval`, pure JS `ctx.g2w`, and DataView
getters only. The position observation reads at most **76 data bytes plus 174
immutable code bytes**; it does not scan memory, call the engine, or write guest
state. Each child observation verifies those original routine bytes against
SHA256 `d94012c127c570f20b7ebd4fb9f611a36725449bb38a327ccff0c2a167ff3652`.
The original loaded image base is `0x400000`. Matrix look-vector components are
retained, and heading is computed from `atan2(-look.x,look.y)`. Short ordinary
turns and subsequent displacement independently corroborate that interpretation.

During the movie the world pointer was null; during loading the world existed
with no player. Once gameplay began, the world pointer was `0x1399d58` and the
local player pointer `0x1c0d31c`. These are observed addresses for this instance,
not reusable addresses for a later run. Twenty observed gameplay states were
checked against their authentic original sector bounding boxes; all agree.

## Reviewed route and first terminal blocker

The authentic `09fuelstation.jkl` is 3,547,906 bytes, SHA256
`3cc6db585f16f2976d12750848498a39942088bad85372882c934c0e506572ae`.
It was freshly extracted from the restored original GOB. Recomputed vertices,
surfaces, sector bounds and portals match the retained planning geometry.
The original static player placement is sector275 at z0.370112. The **actual
settled player** is in lower sector874 at z0.070111. This difference matters:
static placement alone did not establish the actual starting sector.

Captures below are under gitignored
`scratch/runs/20261103-jedi-live-sector-route/live/`; selected images were
personally reviewed before steering. Coordinates are observed engine values,
rounded here; `observed-route.json` retains full values and batch numbers.

| Capture | Observed sector / XYZ / yaw | Reviewed observation |
| --- | --- | --- |
| `spawn-observed.png` | 874 / (1.07045,5.46062,0.07011) / 55.00° | First-person courtyard and pistol; health/shields/ammo100. |
| `heading-calibrated.png` | 874 / same position / 91.53° | A released 0.2s Left turn faces almost west into the lane. |
| `sector266-entry.png` | 266 / (-0.93840,5.40546,0.15779) / 91.53° | Ordinary Up enters the western passage and rises with the floor. |
| `western-passage.png` | 267 / (-1.50718,5.38816,0.27011) / 91.53° | Continues through the authentic portal. |
| `passage-turn-point.png` | 276 / (-2.15198,5.37092,0.27011) / 91.53° | Reaches the western north/south passage. |
| `stairs-facing-east.png` | 276 / (-2.18566,4.44087,0.27011) / 270.12° | After southward travel and an eastward turn, **actual stairs directly ahead**. |
| `stairs-ascent01.png` | 256 / (-1.83982,4.44175,0.37011) / 270.12° | Ordinary walking ascends the stairs. |
| `upper-passage.png` | 277 / (-0.51871,4.44552,0.67011) / 270.12° | Upper landing reached; no jump or map shortcut. |
| `upper-south-approach.png` | 280 / (-0.52915,4.04486,0.50898) / 178.84° | Enters the descending passage beside the pipe. |
| `pipe-exit-observed.png` | 280 / (-0.54606,3.88780,0.32011) / 178.84° | Standing movement is obstructed beneath the pipe. |
| `crouch-clearance-result.png` | 280 / (-0.56048,3.37249,0.32011) / 178.84° | Ordinary duck clears the pipe; green impact tint, health100/shields89/ammo100. |
| `south-corridor-entry.png` | 265 / (-1.02932,3.07071,0.11301) / 178.84° | Health92/shields30/ammo100; damage source remains offscreen. |
| `patrol-direction-view.png` | 265 / (-1.13532,2.89479,-0.12989) / 178.84° | Player corpse, health0/shields30/ammo100, “Press FIRE to restart this level.” |

The standing pipe obstruction was measured: a further 0.9s Up changed y only
from3.88941 to3.88780. Original actor21 uses `09pipe18.3do`, SHA256
`5d9403416f998d68e7114d8858b57efd195d6756557678ce426a22fc9f54621b`.
Its mesh bottom is world z0.345027 above the sector's floor z0.199997,
leaving about0.14503 clearance. The original binary at `0x4d82c7` binds
scan code0x2e (**C**) to function5, duck. One short **C+Up2.2s**, with both
released, passed underneath. No guest/configuration change was needed.

After that clearance the screenshots show green tint, shield loss, then health
loss and death. These changes are distinct from recoil or ammo consumption:
**Ctrl was never pressed and ammo remained100**. The later short Left turn did
not alter the dead player's orientation. Reviewing the death capture triggered
immediate session cleanup; FIRE/restart was not pressed and no second campaign
was attempted.

This is evidence of visible incoming damage and a concrete terminal gameplay
blocker, **death before positive armed-hostile identification**. It does not
identify the offscreen attacker or establish a particular projectile source.
Static Bossk266 remains a candidate; it cannot be promoted to the visible
attacker. Civilian65 was avoided, and the final white-shirted corpse is the
player, not hostile evidence. No emulator collision or rendering fault is
established. A later separately authorized attempt can use this measured route
and duck clearance to orient toward the patrol sooner.

## Exact execution, integrity and recovery

Only fresh boat **bx_62924zgv** was used, finite TTL7200, original expiry
**2026-11-03T13:35:19.218Z**, shutdown owner `jedi-live-sector-route`; these were
recorded before use. This task explicitly authorized native CLI execution with
no Alice/GL gate and delegated its own normal stop after preservation. There
was no Chrome/browser, predecessor boat operation, subworker or public deployment.
Held/font/TTC/CJK/HeroesII and foreign GL files were untouched.

Source was sealed committed main
`e4f498fbaa5713d95e99217c2d600ebc575cf63d`: all5825 exact Git-blob inputs
streamed directly, excluding foreign modified/untracked GL WIP and
`lib/wininit-boot.js`. Every input was checked unchanged after build and
independently verified recoverable from Git. No duplicate local source archive
or checkout was created. Fresh own-boat
`flock /tmp/wine-build.lock bash tools/build.sh` passed, plus four focused
shell CLI routing, WinExec readiness, keyboard lParam and process desktop tests.
Four no-guest observer controls passed.

The module is2,084,058 bytes, SHA256
`fa326d595b106a9e2f8242ef66c67d0ee5530462d587e7e76867640f800ebfc8`.
The source dictionary SHA256 is
`006208bdb6d6577b776d6099a3d89acb5726f0d7f8eedef3c9bbd60532cba450`.
Actual compile inputs and completed instantiation receipts independently record
matching instances in launcherPID10834, gamePID10947/control8144, and
duplicate childPID10963/control8145. Both original WinExec calls occurred;
the duplicate child found the ordinary game window and exited. These actual
instance receipts are separate from the staged module hash.

One `node test/run.js` session used ordinary original
**Play → full movie → Player/Medium → Single Player → New Game**. Guest limit
1200s and outer limit1260s were fixed at launch, with immutable outer deadline
**2026-11-03T12:02:46.435402Z**. The supervisor ended early on the death stop
request after **688.366548168s**, exitCode-9. Its own process group needed
TERM followed by KILL after the5s grace. That process cleanup is retained
honestly and is separate from the boat's successful normal stop.

Before/after checks preserve all28 originals/39,900,850 bytes, genuine
DSOUND.VXD/DDHELP, builtin DDRAW/DSOUND and all219 runtime files. All33 captured
states preserve original registry values and original file pins; the31 child
states have only the allowed Version0.1 addition. The parent's exported76
registry entries are unchanged. All scoped helpers and ports8143..8159 are absent.

All161 retrieved payloads passed stored/decompressed byte-count and full-SHA
checks. Archive7,763,172 bytes, SHA256
`7fdc5023dea7da91cbf4bca73688f5895bcf67fae16351b977edc817cf068d7a`.
`RECOVERY.md`, source seal, original/runtime manifests, original disassembly,
observer, input receipts, live states, reviewed images and retrieval scripts
retain the recovery recipe. The pre-stop recovery record was independently
retrieved byte-for-byte:6,000 bytes, SHA256
`4cd6f690d3f1606c04c1e13701ae9857f1f78563d3c4bc9e7d571eac441cabe9`.

Only own boat completed normal stop **stop_ed842bd784f10a55** at
**2026-11-03T11:56:29.688Z**: **STOPPED, completed, error:null, forced:false**,
with normal snapshot/metadata retained and snapshot available. Evidence and
recovery were verified before that delegated stop. No assigned boat remains
running. Local /home free space remained above2GB.
