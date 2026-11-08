# Darkstone: onward floor movement, native BAT encounter, recovered New Saves

One fresh original restored the selected Gold 1713 checkpoint using the repaired
kernel. Two reviewed native floor clicks moved the hero south and southwest
around the rock wall. A current native hover identified **BAT**; one released
native attack followed. Early and final New Saves were retrieved and independently
hashed. The repaired kernel then drained normally with **358/358 terminal reap
receipts**, exit zero and empty unresolved lists. No production code changed.

Evidence R: `scratch/runs/20261108-darkstone-wider-floor-1844/`.
Predecessors: [kernel repair](darkstone-cont-esrch-20261108.md),
[container room](darkstone-container-room-20261108.md).
Preparation checkout: `f37f9c8827d3981a4c024a4e304d2c5be11b0661`.

## Exact restore and reviewed baseline

Only `20261108-darkstone-container-room-1810/new-save-recovery.json`'s selected
continuation pair was staged, with hard links and no copied game media:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,284 | `bebc7fcd564603a3d79ecf54c3fb0ae8a15b080d5c0fd4db7c615bf15cb3be85` |
| `game641d_6af0bd5d.sav` | 3,204,341 | `d1ed6d70a78c2ab3ef13291fc36081daeca58240f58034c5458e0b48ffce528f` |

The selected predecessor manifest SHA-256
`9a933e718cff01505b93f8d567f37c37d50b2de3edab3a310602b392c51e938c`
was checked before relocation. All **548 providers / 42 physical helpers**
resolve. All **506 nonhelpers** remain unchanged from that selection, including
kernel SHA-256 `f778d0e4d05959c0bd35850533faaf0cfaa4983acee0d5718c50dbc576066429`,
accepted module `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
runtime commit `90c1fcfee91c4680877083e80498afcb73c9384d` and endpoint
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
The exact Git-object fallback remains available for the selected kernel; shared
source was not overwritten. Sixty-eight accepted proofs were reread and hashed,
without rerunning their fixtures.

Fresh production HTTP provision.bytes was **1,244 bytes**, SHA-256
`a81769b4b890bbad7f51adee638e915a75981fb2da569d5eee287d25708d77a9`.
Local and actual remote HTTP checks passed. Production loadFiles mounted
**15 files**. Read-only VFS observation at **18:44:11.846 UTC** showed exactly
the two selected save files, matching their hashes and sizes. The personally
reviewed native Load a Game screen showed one **LEVEL 1** preview with the
wider-floor position. OK loaded it. A passive capture allowed the loading
release to drain before any further input: buttons zero, queue EMPTY.

`baseline-panel` confirms **Gold 1713, Food 38, LIFE 19/35, MANA 25/25, AC 14,
victories 9+0**, helmet, cape, shield and red/blue vials. Inventory was closed
before floor hover.

## Reviewed onward progress and hostile encounter

Personally reviewed captures in R/review establish:

- `south-floor-native-hover`: pointer on revealed stone floor south of the
  hero, native label blank and no object, loot, human or hostile outline.
  One released floor click moved south. `south-floor-consequence` and the
  subsequent hover show the camera following the movement and more masonry.
- `east-floor-native-hover`: pointer near an unclear dark edge. **No east
  click** followed. `southwest-floor-native-hover` instead reviewed visible
  gray stone floor left of fallen beams, with no native target label or outline.
  One released click moved southwest; `southwest-floor-consequence` shows the
  rock wall and fallen beams shifting behind the hero.
- `final-native-panel`, before the encounter, shows Gold 1713, Food 37,
  LIFE 19/35, MANA 25/25, AC 14, victories 9+0. The inventory close initially
  captured before the visible change; a passive capture settled it without
  repeating the key.
- `final-panel-closed-settled` then shows **BAT** in the native bottom-left
  label and a red health bar northwest of the hero. `bat-current-native-hover`
  places the pointer on that creature below its bar and retains the explicit
  BAT label. Exactly **one released native left-click attack** followed this
  unambiguous current hostile identification.
- `native-bat-attack-consequence` loses the label/bar, but this does **not**
  establish a kill. `post-bat-native-panel` still shows victories **9+0**, with
  **LIFE 17/35**, MANA 25/25, Food 37, Gold 1713 and AC 14. Equipment/vials remain.
  `final-native-saved-settled` again shows BAT and its red bar: the encounter
  remains live. LIFE 17/35 is the last numeric panel reading, not a verified
  post-save health value. No further attack was issued.

No 64 Gold recollection, broken upper-barrel repeat, human attack, potion,
private guest write, binding/configuration, clock or seed change occurred.
The final settled save capture has inventory closed, buttons zero and queue EMPTY.

## Retrieved continuation

Allocation began **18:42:03.654 UTC**. Early native New Save was retrieved and
independently hashed at **18:46:45.561 UTC**, **281.907 seconds** after allocation,
before ten minutes. R/early-save-recovery.json retains its selected pair.

Final New Save was retrieved and independently hashed at **18:51:07.702 UTC**,
before the immutable **19:05:03.654 UTC** browser cap.
R/new-save-recovery.json selects these `continuationFiles`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,300 | `bd5eeceb6b6d316634b5719906a9f756cfa7fa8d4f49a62db33d27dc4c2cefb6` |
| `game641d_6af0c492.sav` | 3,204,341 | `34947dc82f446e75d3506578a9ae98d55a3e54d634defba86987a58173eea6f9` |

The final game path is the sole new path absent from the independently recovered
early inventory. The pair is recovered, **not reloaded**. Next continuation
must restore only this pair through fresh HTTP/loadFiles/VFS/native preview,
then review current BAT and health before further interaction. The earlier
New Save remains available as a separate pre-encounter checkpoint.

## Real shutdown, evidence and delegated stop

The finish-run quit ACKed. Chrome exited **0**, signal null, at
**18:51:47.718 UTC**. The repaired kernel records **358 owned / 358 reaped**,
exit **0**, with **remaining, unreaped, unresolvedPtrace and unresolvedLineage
all EMPTY**. There were no ESRCH events in this run's journal; the successful
drain is based on actual consumed terminal waits, never inferred from ESRCH.
The historical 1810 shutdown remains **358 owned / 305 reaped / 53 remaining /
exit null**, Chrome normal exit UNPROVEN. This run does not amend that history.

Independent post-drain checks verified every registered kernel and census
PID/start, adopted-process custody and kernel supervisor absent. Ports
**40123/37213** were closed; profile, writer marker, held inputs and all runtime
FD references were absent; remote `/tmp/wine-runtime.lock` was free.
Clone-untraced flags remain **unaudited**; no exhaustive history claim is made.
The generic cleanup JSON retains its fixed `pending: "UNKNOWN; never replay"`
policy string. All **26 actual commands have exact ACKs**, with zero UNKNOWN
commands and no replay. Seventeen prearmed pulses and 47 trusted native events
have balanced DOWN/UP; **26 PNGs** passed CRC and scanline decoding. No original
trap, exception or guest process exit was observed; all 548 provider hashes
remained unchanged. Helper syntax and actual provisioner recording-transport
checks passed. Full27, parity, audio and FPS remain open.

All **315 remote references / 262,632,994 bytes** were retrieved and independently
hashed before the normal API stop: **262 unique contents / 262,618,701 bytes**.
The large custody-history log is retained individually as gzip, with original
size/SHA and recovery recipe in retrieval-verified.json. Original bytes were
verified by streaming decompression; no durable uncompressed duplicate exists.
No source/media archive or repeated media was created. Exact Git SHA, relevant
binary diff, owned helper patches and existing media/module PATH/HASH references
retain recovery; peer WIP was not applied.

Box **bx_8cmmt82t** is **archived**, final expiry **null**. Stop receipt
**stop_bd2240707deb603a** completed **18:52:54.916 UTC**, forced false, error null.
The UUID was persisted before creation, ID/expiry before runtime, with observable
independent prearmed roles and immutable API-stop deadline **19:07:03.654 UTC**;
initial expiry was **19:08:03.858 UTC**. All three local lifecycle identities are
absent, normal/watchdog exited zero, supervisor children EMPTY, and the owned
board watcher was retired. No local heavy runtime or local runtime lock was used.
Free /home remained above 1.5 GB. No old-box action, resume, delete, public
deployment or subworker occurred.

Next: separately assigned continuation from the final pair, with the live BAT
encounter reviewed first. RELEASE and single-task STOP after publication.
