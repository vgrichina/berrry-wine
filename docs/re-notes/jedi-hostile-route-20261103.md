# Jedi demo: hostile route prepared; runtime release blocked

Read-only inspection of the authentic installed demo identifies a substantially
closer hostile candidate than the distant stormtroopers: **actor 266, `bossk`,
patrolling the corridor south of spawn**. A different ordinary route is prepared
through the passage west of spawn and its stairs. No guest or browser session
was started: the required ordered runtime releases were absent after preparation.
This is an authorization blocker, not a reproduced game or emulator failure.
No hostile interaction, incoming attack, target effect or enemy defeat is claimed.

## Positive static identification and route

I read the [previous encounter note](jedi-first-combat-20261103.md), its recovery
record, and personally reviewed `world-baseline.png`, `pre-fire-target.png`,
`fire-result-01.png` and `target-aftermath.png`. The previous shot visibly affected
a short humanoid consistent with a civilian Ugnaught. That is not hostile evidence
and must not be repeated as the route's objective.

Original `episode/jk1demo.gob` contains `jkl/09fuelstation.jkl`, 3,547,906 bytes,
SHA256 `3cc6db585f16f2976d12750848498a39942088bad85372882c934c0e506572ae`.
The static level and original resource archive establish:

| Actor | Static placement and identification | Route implication |
| --- | --- | --- |
| 19, `walkplayer` | Spawn `(1.070451, 5.460619, 0.370112)`, yaw 54.989586, sector275 | Establish the actual initial view before steering. |
| 65, `ugsit` | `(2.125035, 5.535035, 0.800997)`, sector187; inherits civilian `ug` | Avoid the seated civilian east of spawn. This does not establish the previous rendered civilian's actor number. |
| 266, `bossk` | `(1.249990, 2.000000, -0.026403)`, sector240; patrol frames `(1.250,2.000,-0.026)` and `(5.595,2.000,-0.026)` | Primary hostile candidate, about 3.49 level units from spawn. |
| 69/70, `stormtroop` | Near `(8.20,3.20,-0.028)`, sector960; `st.3do`, `+elaser`, `stdefault.ai` | More distant alternative; not a reason to shoot an ambiguous humanoid. |

`bossk` inherits `_humanactor`, uses `bs.3do`, `actor_bs.cog`,
`weapon=+econcbullet`, `weapon2=+bosskswipe`, health 120 and `bodefault.ai`.
The original actor script describes a standard Bossk with a concussion rifle;
the AI has target acquisition, primary fire, blind fire and pursuit instincts.
The model includes concussion-rifle materials. By comparison, `ug` inherits
`_civilian`, and `actor_ug.cog` explicitly treats these actors as pedestrians;
`peddefault.ai` senses danger and flees. Both AI files have alignment -1, so
alignment alone is insufficient to distinguish hostility.

The planned ordinary route leaves spawn **west**, follows the lower passage
south into the stairwell, turns east through the upper passage, then south and
east toward the patrol corridor. Static sector context is
`275 → 266 → 267 → 276 → 256/272 → 277 → 280 → 265 → 255 → 240`.
These are geometry identifiers for planning, not engine/map commands or guest
state changes. Sector 256 contains eight 0.05-high stair slices 257–264 near
`x=-1.963…-1.438, y=4.25…4.55`; the final portal enters sector240 at
`x≈1, y≈2.05`. The raw seven-hop adjoin path crosses upper space and cannot
be treated as a collision-safe walking sequence. Door state, clearance and the
rendered patrol position remain unverified.

After runtime authorization, the single allowed session would use original
Play → Player/Medium → Single Player → New Game, let the movie play, and review
each capture before short Up/Left holds with releases. Ctrl remains up until a
recognizable armed hostile is visible with an unobstructed line of fire. Static
identity is a navigation aid; it does not identify a rendered actor by itself.
An ordinary incoming attack can establish hostile interaction without a player
shot. Any shot must be assessed using target or incoming effects separately
from recoil/ammo consumption. No session was consumed and no retry was made.

## Independent native preparation

Evidence is in gitignored `scratch/runs/20261103-jedi-hostile-route/`, including
the extracted static metadata, explicit portal/stair route, exact source seal,
build/test logs, original/runtime manifests and recovery instructions.

- Source: committed main `78be212b6dadcacb2dc4c8f4e2627b3e6d252eb5` only.
  All 5,825 input paths were streamed from git blobs, verified unchanged after
  build, and verified recoverable from that commit with full SHA256 values.
  Foreign modified/untracked work, including `lib/wininit-boot.js`, was excluded.
  No local duplicate source or original-install archive was created.
- Fresh own-boat `flock /tmp/wine-build.lock bash tools/build.sh`: PASS.
  Focused shell CLI routing, WinExec readiness, keyboard lParam and process
  desktop tests: four PASS. Four observer authority/guard/fork controls: PASS,
  without guest execution.
- Module: 2,084,058 bytes, SHA256
  `fa326d595b106a9e2f8242ef66c67d0ee5530462d587e7e76867640f800ebfc8`.
  Source-input seal SHA256
  `98f5ae0f34b5d61af928342dc65ce300182e04cc9051cb3feda2f2e486b55571`.
  This is a built/staged module, not an observed guest-loaded module.
- Original installer pin and recovery recipe restored all 28 originals,
  totaling 39,900,850 bytes, and 361 historical recovery mappings. All 219 staged
  runtime members were hashed; 76 original registry entries were retained.
  Genuine DSOUND.VXD/DDHELP and builtin DDRAW/DSOUND provisioning remain prepared.
  Both original WinExec calls, duplicate FindWindow exit and the allowed guest
  child Version0.1 policy remain unchanged; their execution was not retested.
- Two preparation-helper invocation errors were corrected: an unsupported
  integrity phase name, then a registry-summary assumption about non-registry
  entries. Retained logs distinguish these from guest failures. No guest ran.

## First concrete blocker

`ordered-gate.json` records the exact board audit. Neither
`alice-first-visible-attack-nov03 AUTHOR RELEASE` nor the subsequent
`gl-copy-context-ready-nov03 AUTHOR RELEASE` was present, and no coordinator
browser handoff was confirmed. Independent native preparation was explicitly
authorized; runtime was not. The prescribed 1200-second guest/1260-second outer
session therefore did not start. There was no unrelated production-release gate.

Only new boat `bx_rsrrzwbx` was used, finite TTL 7200, original expiry
`2026-11-03T12:47:15.044Z`, shutdown owner `jedi-hostile-route`, recorded before
use. No predecessor boat, foreign owned code, held/font/TTC/CJK/HeroesII lane,
guest state, configuration or registry was modified. No public deployment occurred.
The recovery record and terminal lifecycle receipts in the run directory record
evidence retrieval and the explicitly delegated normal stop of this boat.

All 39 retrieved payloads were independently checked for stored and decompressed
byte counts/full SHA256. The evidence archive is 1,369,610 bytes, SHA256
`3885f2bec3de0d7b51ff1fb9a2311645d704405024bb3c215d2aa3470454eb3a`.
The pre-stop recovery note was uploaded and retrieved byte-for-byte before
normal stop `stop_615b0c6b9edb7dc3`, completed
`2026-11-03T10:56:38.742Z`: **STOPPED**, `error:null`, `forced:false`.
Normal snapshots/metadata were retained, snapshot available; scoped helpers
and observer ports were absent. No assigned boat remains running.

Next work requires the exact ordered releases or a coordinator-confirmed browser
handoff, then an authorized ordinary session using this static route and visual
hostile identification. This note supplies route preparation and an honest
external blocker; it does not promote controls or static metadata to gameplay success.
