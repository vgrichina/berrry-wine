# Darkstone: Level 1 containers, equipped helmet and onward corridor saved

Restored the earned Level 1 checkpoint through native **Load a Game**, broke a
reviewed wooden container and barrel, collected a native-identified **HELMET**,
and crossed the stone arch into a newly revealed corridor. The helmet equipped
automatically and raised **AC from 10 to 12**. Native **New Save** and read-only
VFS recovery preserved both early progress and the final onward position.

Evidence: ignored `scratch/runs/20261108-darkstone-level-one/` (R).
Predecessor: [road onward](darkstone-road-onward-20261108.md), `b13b01367`.
No production source changed; no build or generic integration repair is claimed.

## Restore and reviewed consequences

Both source artifacts and their staged input copies passed exact size/SHA-256
checks before allocation and remain unchanged:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,188 | `62322670fa4e34e9b157dde599c60e1d6c075fcf97b86c64cbaea17d1aaf7ffd` |
| `game641d_6af0817a.sav` | 3,204,341 | `da1597147ffca481ca9088f9df7ef7c00b12f8febd556354e47121e568b1c3bb` |

Personally reviewed R/review captures and R/personal-review.json establish:

- `native-level-one-preview.png`: sole native save preview showed LEVEL 1 and
  the matching entrance scene. Ordinary OK restored it. Earlier loading captures
  retain the pending release queue; no input followed until
  `restored-live-settled.png` showed live LEVEL 1, buttons zero and queue EMPTY.
  The inventory panel was visibly closed after restore.
- `baseline-panel-settled.png`: **9+0 victories, LIFE 19/35, MANA 25/25,
  Gold 1532, Food 52, AC 10**, red quickslot vial retained.
- Reviewed ground walks moved away from the opening and around the bounded
  entrance nook. Native Tab maps showed the corridor arrangement. The first
  barrel hovers returned no name, and no attack followed those captures.
- `object-hover-settled.png`: exact native hover gave the chest-shaped wooden
  object a gold outline. One ordinary click approached it;
  `chest-open-settled.png` shows it replaced by wooden debris.
- `barrel-gold-outline.png`: exact native hover highlighted the front barrel.
  One bounded ordinary interaction followed; `barrel-consequence-settled.png`
  shows staves and a lid where that barrel stood, with the rear barrel intact.
- `floor-object-native-hover.png`: native message **HELMET** identified the floor
  object before collection. `helmet-inventory-inspection.png` confirms it in the
  head slot and **AC 12**, with LIFE still 19/35. The particular container that
  yielded the helmet is not inferred from these captures.
- `beyond-stone-threshold.png`, `new-dungeon-corridor.png` and
  `onward-corridor-settled.png`: ordinary ground walks crossed the stone arch,
  left the entrance barrel/debris behind to lower right, and revealed a corridor
  bounded by timber, a second stone opening and additional barrels beyond the
  wall. No hostile was identified or attacked.
- `final-saved-onward-world.png`: native final New Save returned to that corridor.
  `final-onward-counters.png`: **9+0, LIFE 19/35, MANA 25/25, Gold 1532,
  Food 49, AC 12**, helmet equipped and red vial retained.
  `final-closed-drained-world.png`: inventory visibly closed, buttons zero,
  queue EMPTY before ordinary browser completion.

Independent UP was armed before every DOWN; holds were at most 2,000 ms. Native
pathfinding sometimes continued after release, so later captures were reviewed
before the next target. No human or unreviewed living target was attacked. No
potion, private handler, guest write, forced scene, configuration, clock or seed
change was used. Panels were not assumed to pause the game.

## Early preservation and final continuation

Runtime began **14:18:21.944 UTC**. Early native New Save preserved the broken
container/barrel consequence. Read-only VFS recovery completed **14:26:10.521**,
elapsed **468.577 seconds**; unique retrieval and independent hashing completed
**14:26:23.984**, elapsed **482.040 seconds**, before minute ten.
R/early-save-recovery.json and R/early-recovery/ retain:

| Early file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,196 | `d9c7c4378b1aa108bfd75c40850960c979e3341d7f3b7e29291a6108605b1846` |
| `game641d_6af08678.sav` | 3,204,341 | `26a19d048a3f0ceabfbb8614559877f1edcaf465cb45221f3a7c46abc2a1f741` |

The second native New Save preserved the equipped helmet and onward corridor.
Read-only recovery completed **14:32:51.398**, elapsed **869.454 seconds**;
unique retrieval and independent hashing completed **14:32:52.678**.
R/save-timing-verification.json records both checkpoints. The immutable browser
cap remained **14:40:23.711** throughout.

R/new-save-recovery.json selects the final `continuationFiles`:

| Native path | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\\dsave\\characters\\characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `c:\\dsave\\games\\game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

Unique files are R/final-recovery/native-vfs-<SHA-256>.bin, also covered by terminal
retrieval. The loaded SAV stayed byte-identical. The final pair was **not
reloaded**; the claim is native save plus recovered continuation. Earlier SAVs
remain separately preserved for history. Before another run, verify exact sizes
and hashes, compose a new manifest for this changed pair, derive its HTTP pin
from actual `provision.bytes`, then use normal HTTP/loadFiles/VFS/native Load a
Game. Do not reuse this run's input manifest pin.

## Providers, verification and delegated shutdown

All **534 exact pins** passed before Chrome and remained unchanged: 501 inherited
provider/helper pins plus 33 current run inputs/helpers. Runtime source
`90c1fcfee91c4680877083e80498afcb73c9384d`, module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
seven accepted controls, hover, startup queue and subreaper/reaper were reused.
Ignored providers use R/provider-recovery.json, with no ignored-binary Git
fallback or shared overwrite. Helper syntax and accepted reuse checks passed;
standalone fixtures were not rerun. Peer WIP was excluded from execution.

Before allocation, the new input manifest pin was derived directly from actual
`provision.bytes`: **1,230 bytes**, SHA-256
`e2ae6f6661299158d281fedd47904dd99946d697da1389411ead5e7eeb6bcfe8`.
Normal HTTP resolution, production WineAssembly.loadFiles, VFS hashes and native
save enumeration passed. Checkout SHA
`795cc45d905d6e8e4924148d2a170f7596643fb8`, relevant binary diff, small owned helper
patches, and existing media path/hash references are recorded. No source archive
or repeated media bundle was made.

R/final-audit.json passed: **44 exact command ACKs, zero UNKNOWN, 29 independent
pulses, 81 trusted balanced native events, 44 PNG CRC/scanline decodes**, no guest
trap, exception or guest process exit. All **492 references / 439,318,576 bytes**,
representing **404 unique contents / 439,300,963 bytes**, were retrieved and
independently reread/hash-verified before normal stop. Earlier captures and
nonfinal outcomes remain retained.

One UUID-idempotent box **bx_wm5z2xf8** was identified before runtime. Its remote
lock/subreaper covered startup, provisioning, runtime and descendant drain. All
**29 exact PID/start identities**, including parents and adopted custody, drained;
endpoints/ports closed, profile/writer absent, held input empty and remote lock
free. Observer transport exited zero. Local supervisor/watchdog/normal processes
are absent and supervisor children empty. Local wine-runtime.lock was never held.
Launch disk exceeded 5 GB. No descendant exemption, old-box resume, deletion,
deployment, second original or subworker occurred.

The observable independent 25-minute watchdog was prearmed before allocation;
deadlines stayed immutable. Explicit ordinary browser completion and verified
retrieval preceded delegated normal stop **stop_63b60cb9d889d34c**, completed
**14:34:53.173 UTC**, forced false, error null. Final state **archived**, stopped
**14:34:53.155**, expiry null; R/stop-receipt.json confirms it. Normal/watchdog
exited zero.

Next: restore the final helmet-bearing pair and continue through the newly
revealed corridor's second opening. Full27, parity, audio and FPS remain open.
Single-task worker stops after publication.
