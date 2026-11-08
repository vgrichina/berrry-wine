# Darkstone: cape restore, mana potion, gold and southward continuation

Restored the cape-bearing native checkpoint, destroyed the remaining wooden
container, collected its native-identified **MANA POTION**, and collected
**105 GOLD PIECES** from a broken jar. Continued south through the stone opening
and across the floor with broken wooden furnishings. A green tiled area with a
barrel became visible across the eastern partition; that area was **not entered**.
Early and final native **New Save** files were retrieved and independently hashed.
No production code changed and no integration repair is claimed.

Evidence R: `scratch/runs/20261108-darkstone-cape-1650/`.
Source handoff: [helmet/cape checkpoint](darkstone-helmet-1621-20261108.md),
published `404b1e3d6`. Preparation checkout:
`50896dcd56958f3f5d971ba3448a542069613cec`.

## Restore and reviewed consequences

The handoff's `new-save-recovery.json` selected the final `characters.lpl`
(1,342,220 bytes, SHA-256
`8dca71058d6e7ce4a1b5e148168e7cbd24043c55501b70f388535396eed4e309`)
and `game641d_6af0a3ec.sav` (3,204,341 bytes, SHA-256
`787f3c48f60fb174557fe386d7d36ce3a1aec6c33cbb6fc5035b99c41d5f34fb`).
Both sources and staged copies were verified before allocation and remained
unchanged. Actual production VFS observation at **16:52:40.690 UTC** matched
both selected hashes.

Before allocation, actual `provision.bytes` produced a new **1,230-byte** HTTP
manifest, SHA-256
`af5db659ed2aba350ea8c40ff1543444526a2f06f6ed05bb912bea4c0b5332a9`.
The local HTTP handler and remote production driver checked those exact bytes.
Production loadFiles mounted fifteen data files. Reviewed current native menu
pixels preceded Load a Game, its LEVEL 1 preview, and OK. Loading retained a
pending mouse release; subsequent observation confirmed buttons zero and queue
EMPTY before further input.

Personally reviewed R/review captures establish:

- `baseline-cape-panel`: victories **9+0**, **LIFE 19/35**, **MANA 25/25**,
  **Gold 1532**, **Food 47**, **AC 14**, helmet and cape equipped.
- `container-native-hover`: exact native gold highlight on the wooden container.
  One click destroyed it; a later settled capture showed the blue floor drop.
  `container-drop-native-hover` names **MANA POTION** before collection.
  `mana-potion-collected` shows it removed from the floor and in the quickslots.
- `western-floor-native-hover`: native gold highlight on a jar. The following
  click broke it. After the drop settled, `settled-gold-native-hover` names
  **105 GOLD PIECES**; `gold105-collected` shows the pile gone.
- `crossing-settled`, `beyond-room-settled`, and `southward-settled`: movement
  through the stone opening and farther south across floor with wooden debris,
  exposing the green tiled area beyond the eastern partition. These captures
  establish continuation from the checkpoint room, not entry into that area or
  a claim that every traversed tile was historically unexplored.
- `final-native-panel`: **Gold 1637**, **Food 44**, **LIFE 19/35**, **MANA 25/25**,
  **AC 14**, victories **9+0**, helmet/cape and red/blue vials retained.
  `final-saved-southward`: inventory closed, buttons zero and queue EMPTY.

One material review error is retained in `review-correction.json`: the western
hover visibly highlighted a jar, but the command review called it clear floor
and sent one click. This was a jar interaction, not a floor walk. A separate
command review mistyped final Food as 43; the pixels show 44 and the next review
corrects it. No perfect-review claim is made. Both early and final Save a Game
and New Save selections followed reviewed **current menu pixels**.

No human or hostile was attacked, no potion was used, and no private guest write,
configuration, clock, seed, restart, or UNKNOWN replay occurred. Floor targets
were checked with exact native hover; subsequent captures allowed pathfinding
to settle after release. Every DOWN had its independent UP armed first.

## Recovered native continuation

Allocation began **16:49:12.989 UTC**. Early New Save recovery was retrieved and
independently hashed at **16:55:28.908**, **375.919 seconds after allocation**,
before minute ten. R/early-save-recovery.json retains `characters.lpl`
(1,342,228 bytes, `b4561ffab2b0675697911e868c3423093cd72da1cd3055f9456b1163c89efe58`)
and new `game641d_6af0a969.sav`
(3,204,341 bytes, `3e932d088ef97cb992b06935d62a37be094127f048c6a2484d84ef66b8a56368`).

Final New Save recovery was retrieved and independently hashed at
**17:07:21.181 UTC**, before the immutable **17:12:12.989** browser cap.
R/new-save-recovery.json selects these `continuationFiles` under R/final-recovery:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,236 | `e0d7600f08151d01d109243abf495d90e35c28873d27faea8c1551ea22c69d82` |
| `game641d_6af0ac25.sav` | 3,204,341 | `f9ab5af1b5731a02489b752b5e4deac6ba48857ab4d298ecd413717f2fd2b954` |

The original loaded SAV remained unchanged. The final pair was **not reloaded**.
Next restore must derive another actual provision.bytes HTTP manifest for these
selected bytes, then verify production loadFiles/VFS/native Load preview.

## Verification and shutdown

The selected generation retains **548 providers / 42 helpers**, original runtime
`90c1fcfee91c4680877083e80498afcb73c9384d`, ignored module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
published kernel `275dd018a`, and endpoint SHA-256
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
Cheap exact closure, actual provisioner recording-transport check, joined
uploads, normal content publication, and queue/parent receipt checks passed.
Sixty-eight accepted control/hover/barrier/kernel references were independently
reread; unchanged fixtures were not rerun. All 548 remote providers stayed exact.

R/final-audit.json passes **45 exact command ACKs**, **zero UNKNOWN**, **25
independent pulses**, **75 trusted events** with balanced DOWN/UP, and **45 PNG
CRC/scanline decodes**. No guest trap, exception, or guest process exit was
observed. Helper syntax passed. This is docs/evidence work; no new production
build result is claimed. Exact Git SHA, empty relevant final binary diff,
small owned helper patches, provider recovery mapping, and existing media
path/hashes are retained; no source archive or peer WIP was applied.

Ordinary Browser.close used its existing SIGKILL fallback. Actual Chrome exit
was signal **SIGKILL** at **17:07:53.107**; browser exit-zero is not claimed.
The initial drain check ran while driver/Chrome identities were still present
and refused **before** writing custody-stop. Its failure is preserved. A new
read-only census found them absent, then the first custodian stop request passed
the unchanged drain checks. Kernel normal drain: **359 owned / 359 reaped**,
exit zero, remaining EMPTY; all PID/start identities and supervisor independently
absent, remote lock free. Kernel fork lineage was **incomplete with one unresolved
identity**; exhaustive lineage is not claimed. CLONE_UNTRACED flags remain outside
the audited scope. The 58-identity parent census, adopted processes, both ports,
profile, writer and held inputs drained.

All **503 remote references / 458,408,782 bytes** were retrieved and independently
reread/hashed before delegated normal API stop (412 unique contents,
458,391,456 bytes). The observable independent watchdog was prearmed before
UUID-idempotent allocation with key persisted first. Initial expiry was
**17:15:13.143**, independent stop deadline **17:14:12.989 UTC**. All three local
supervisor/normal/watchdog PID/start identities are absent, both roles exited
zero, supervisor children EMPTY. The board watcher was already absent; its
initial start was not recorded. No local heavy runtime or local runtime lock.

Box **bx_ck6rengu** is **archived**, final expiry **null**. Stop receipt
**stop_af3d09cb35130341** completed **17:09:51.995 UTC**, forced false, error null;
R/stop-receipt.json independently confirms it. No old-box action, resume,
deletion, public deployment or subworker occurred.

Next: restore the final mana/gold continuation and inspect a route into the green
tiled area. Full27, parity, audio and FPS remain open. RELEASE and stop after
publication.
