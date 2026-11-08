# Darkstone: ruined-wall entrance identified, Level 1 reached and saved

Restored the newly earned road checkpoint through native **Load a Game**, took
the useful lower branch at the large-tree junction, and reached the ruined-wall
recess. A reviewed ordinary click produced native **TO LEVEL 1**, followed by the
**Level 1** loading screen and a live dungeon labeled **LEVEL 1**. The entrance is
now established by native behavior. Two native **New Save** checkpoints were
recovered read-only: first beside the recess, then inside Level 1.

Evidence: ignored `scratch/runs/20261108-darkstone-road-onward/` (R).
Predecessors: [road save](darkstone-road-save-20261108.md), `252bfdb4d`, and
[nine-onward route](darkstone-nine-onward-20261108.md). No production source
changed; no production build or generic integration repair is claimed.

## Reviewed restore, route and transition

Both unique source artifacts were independently verified before allocation and
remain unchanged, as do their staged input copies:

| Native input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,172 | `b9c9a3afaadb5b7e56d879a156cd9d63cf5e67f4fd2fb68a9ce6580d008b4a43` |
| `game641d_6af07c38.sav` | 3,204,341 | `f046038cf1cde4e1f1f2cfc012b260ca8599e4738cca907083d067b3fc316489` |

Personally reviewed R/review captures and R/personal-review.json establish:

- `native-road-slot.png`: sole native preview matches the forest-road save.
  Ordinary OK restored it. Loading captures were followed by passive settling;
  `restored-live-drained-state.json` has buttons zero and queue EMPTY before input.
- `baseline-road-counters.png`: **9+0 victories, LIFE 19/35, MANA 25/25,
  Gold 1532, Food 57**, red vial retained.
- `lower-junction-branch.png` through `stonework-road-west.png`: individually
  reviewed clear-ground targets took the lower junction branch, crossed the
  clearing, joined the broad lower road and approached the walls. The wooded
  deadend was avoided. Independent UP was armed before every DOWN; holds never
  exceeded 2,000 ms.
- `saved-recess-hover.png`: exact settled recess reviewed with pointer-only
  hover; no name appeared, so appearance was not treated as entrance proof.
- `reviewed-recess-approach.png`: ordinary reviewed lip click, 100 ms, produced
  native **TO LEVEL 1** in the message panel. `native-level-one-consequence.png`
  shows **Level 1** loading. `level-one-live-settled.png` shows **LEVEL 1**, hero
  on dungeon stone floor beside barrels and an **Exit Level** return opening;
  buttons zero and queue EMPTY. No dungeon exploration or barrel attack followed.
- `saved-level-one-world.png`: second native New Save returned to Level 1.
  `level-one-counters-settled.png`: **9+0, LIFE 19/35, MANA 25/25, Gold 1532,
  Food 52**, red vial retained. A final I release was acknowledged; its immediate
  capture still shows the panel, so panel closure is not claimed.

No human or unreviewed living target was attacked. No private handler, guest
write, forced scene, configuration, clock or seed change was used. Panels were
not assumed to pause the game. No potion use, quest, audio or FPS claim is made.

## Early preservation and exact continuation

Runtime began **13:54:55.880 UTC**. First native New Save beside the recess was
followed by read-only VFS recovery at **14:02:23.325**, elapsed **447.445 seconds**;
its unique files were retrieved and independently hashed immediately. This met
the early preservation requirement before runtime minute ten. R/early-save-recovery.json
retains character index `98fd1d0640ed6336c86dda14e10fdbf2ea54af9ff4e6e0580e42937d734e4865`
(1,342,180 bytes) and `game641d_6af080ea.sav`,
`7c118985a22fb9ab94a713a1480fccdedc402d5b8c70b4c8640332febc1cc5b6`
(3,204,341 bytes), in R/early-recovery/.

The second native New Save preserved the actual Level 1 transition. Its read-only
VFS recovery completed **14:04:48.179**, elapsed **592.299 seconds**; unique
retrieval and independent hashes completed **14:05:01.938**. The immutable browser
cap remained **14:16:47.952**. R/save-timing-verification.json verifies both
read-only recoveries before minute ten; the first was also retrieved before ten.

R/new-save-recovery.json identifies the final continuation pair:

| Native path | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\\dsave\\characters\\characters.lpl` | 1,342,188 | `62322670fa4e34e9b157dde599c60e1d6c075fcf97b86c64cbaea17d1aaf7ffd` |
| `c:\\dsave\\games\\game641d_6af0817a.sav` | 3,204,341 | `da1597147ffca481ca9088f9df7ef7c00b12f8febd556354e47121e568b1c3bb` |

Both are unique R/level-one-recovery/native-vfs-<SHA-256>.bin artifacts, also
covered by terminal retrieval. The loaded road SAV stayed byte-identical.
Verify sizes/hashes, compose a **new** manifest for this changed pair, derive its
HTTP pin directly from actual `provision.bytes`, and restore through ordinary
HTTP/loadFiles/VFS/native Load a Game. Do not reuse this run's input manifest pin.
Earlier SAVs are retained separately and may be mounted for history. No second
load was performed; the claim is native save plus recovered continuation.

## Providers, verification and delegated shutdown

All **533 exact executing pins** passed before Chrome and stayed unchanged.
Runtime source `90c1fcfee91c4680877083e80498afcb73c9384d`, original module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
seven accepted controls, hover, startup queue and subreaper/reaper were reused.
Ignored providers use R/provider-recovery.json, with no ignored-binary Git
fallback or shared binary overwrite. Helper syntax and accepted reuse checks
passed without standalone control reruns. Peer WIP was excluded from execution.

Before allocation, the changed input manifest was independently derived from
actual `provision.bytes`: **1,234 bytes**, SHA-256
`a609500c399ba47e205d5cfaab859beddf7deafc5c85ecc6b196666a301a8e51`.
Normal HTTP resolution, production `WineAssembly.loadFiles`, VFS hashes and
native SAV enumeration passed. Checkout SHA
`8b11a4e93288fed007462b1790eeffb2ac5200c1`, relevant binary diff, small owned
helper patches, and existing media path/hash references are recorded. No source
archive or repeated media bundle was made.

R/final-audit.json passed: **46 exact command ACKs, zero UNKNOWN, 31 independent
pulses, 91 trusted balanced events, 46 PNG CRC/scanline decodes**, no guest trap,
exception or guest process exit. All **510 references / 341,033,494 bytes**,
representing **418 unique contents / 341,015,763 bytes**, were retrieved and
independently reread/hash-verified before normal stop. Earlier evidence remains.

One UUID-idempotent box **bx_2cjsgbey** was identified before runtime. Its own
remote lock/subreaper covered startup, provisioning, runtime and descendant
drain. All **27 exact PID/start identities**, including parents and adopted
custody, drained; endpoints/ports closed, profile/writer absent, held input empty,
remote lock free and observer transport exited zero. Local lifecycle PIDs exited,
supervisor children empty. Local wine-runtime.lock was never held. Launch free
disk exceeded 5 GB. No descendant exemption, old-box resume, deletion, deployment,
second original or subworker occurred.

The observable independent 25-minute watchdog was prearmed before allocation;
deadlines stayed immutable. Explicit ordinary browser completion preceded normal
box stop **stop_9b8d925fbd151567**, completed **14:06:48.669 UTC**, forced false,
error null. Final state **archived**, stopped **14:06:48.650**, expiry null;
R/stop-receipt.json confirms it. Normal/watchdog exited zero.

Next: restore the recovered Level 1 pair and explore the dungeon from its saved
entry. Full27, parity, audio and FPS remain open. Single-task worker stops after
publication.
