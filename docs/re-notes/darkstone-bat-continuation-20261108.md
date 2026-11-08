# Darkstone: final1844 restore, live BAT damage, two recovered New Saves

One fresh original restored **only the final1844 continuation pair**. Current
native pixels confirmed a live BAT and LIFE **17/35**, then a later native panel
confirmed **16/35**. This first verified encounter consequence ended gameplay.
No attack or potion was issued. Early and final New Saves were retrieved and
independently hashed. Chrome ultimately exited by **SIGKILL**, so normal Chrome
shutdown is **unproven**, despite the repaired kernel's complete terminal drain.
No production code changed.

Evidence R: `scratch/runs/20261108-darkstone-bat-continuation-1910/`.
Predecessor: [wider floor and final1844 checkpoint](darkstone-wider-floor-20261108.md).
Preparation checkout: `c3ae03e79aa25f7e93d3198a7aa247973a3393d5`.

## Exact selection and fresh restore

The unchanged repaired selection originates at manifest SHA-256
`9a933e718cff01505b93f8d567f37c37d50b2de3edab3a310602b392c51e938c`:
**548 providers / 42 relocated helpers / 506 unchanged nonhelpers**. Kernel
`f778d0e4d05959c0bd35850533faaf0cfaa4983acee0d5718c50dbc576066429`,
runtime commit `90c1fcfee91c4680877083e80498afcb73c9384d`, module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`
and endpoint
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`
remain unchanged. All 68 accepted proofs were reread and hashed; their fixtures
were not rerun. Exact path/hash and Git fallbacks supplied selected bytes where
shared files had drifted; shared source was not overwritten.

Only predecessor `new-save-recovery.json`'s `continuationFiles` were staged,
using hard links:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,300 | bd5eeceb6b6d316634b5719906a9f756cfa7fa8d4f49a62db33d27dc4c2cefb6 |
| game641d_6af0c492.sav | 3,204,341 | 34947dc82f446e75d3506578a9ae98d55a3e54d634defba86987a58173eea6f9 |

Fresh production HTTP manifest: **1,254 bytes**, SHA-256
`d987ce6b8437ea1cb529ecae5ad23b714b362d3c80983ffcd505d7e5416405fc`.
Local HTTP and actual remote HTTP verification passed. Production `loadFiles`
loaded **15 files**; read-only VFS verification found exactly the selected two
save files with matching original sizes/hashes. Personally reviewed native
Load a Game showed one **LEVEL 1** preview at the fallen beams. One OK click
loaded it, followed by a passive loading capture. No earlier checkpoint loaded.

## Current BAT and measured consequence

Personally reviewed captures establish this sequence:

- `current-native-health`: **LIFE 17/35, MANA 25/25, Food 36, Gold 1713,
  AC 14, victories 9+0**, helmet, cape, sword, shield and red/blue quickbar vials.
- `current-native-bat-hover` was early: the ordinary mousemove still remained
  queued. No action followed that incomplete observation. Passive
  `current-bat-hover-settled` then showed explicit **BAT**, a red health bar,
  buttons zero and queue EMPTY. The live hostile was southwest of the hero.
- Early native New Save was recovered before any attack/healing attempt.
- `preaction-native-health` refreshed the numeric panel before the proposed
  healing decision. It shows **LIFE 16/35**, with BAT/red bar still visible;
  MANA 25/25, Food 36, Gold 1713, AC 14 and victories 9+0 remain unchanged.
  This **17 → 16** decrement is the first verified combat consequence in this
  run. Encounter actions stopped immediately; no potion or attack followed.
- `postconsequence-panel-closed` shows a floating red **1** near the hero.
  This is retained as visible evidence, not used to calculate another numeric
  LIFE value. **16/35 is the last panel reading, not verified post-save health.**
- `final-native-saved` initially still displayed the save menu although the
  new VFS pair was already recovered. Passive `final-native-saved-settled`
  confirms inventory closed and **BAT plus its red bar still live**. No kill
  claim. Only final save navigation and terminal quit followed the consequence.

No floor movement, human/hostile attack, potion, 64 Gold recollection, barrel
repeat, private guest write/handler call, binding/configuration, clock, seed,
backend or runtime flag change occurred. All ordinary keys/clicks were brief,
independently released and reviewed individually.

## Exact early and final continuation pairs

Allocation began **19:08:32.600 UTC**. Early recovery and independent hashing
completed **19:14:01.583 UTC**, **328.983 seconds** after allocation, before ten
minutes. R/early-save-recovery.json selects:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,308 | 36d1c251273de77fadf17d931c63b098e0c2ad636de4617266bcb7dd4c7d9133 |
| game641d_6af0c9f1.sav | 3,204,341 | f0d2abe4e52c70fab3900d4dbdd234aea4e909ed895bc1117a4469b4c0c74bf0 |

Final recovery and independent hashing completed **19:15:29.373 UTC**,
**416.772 seconds** after allocation, before the immutable **19:31:32.600 UTC**
browser cap. R/new-save-recovery.json selects:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| characters.lpl | 1,342,316 | 4762ae9c0d7d048595433d121629a87d5a1aa24e7c3ebe84c7605006e3c10baa |
| game641d_6af0ca48.sav | 3,204,341 | 5e898dc9d6f7a13350c939bf5b712eccfff95ef1072c93023103705999f84ffc |

Each selected game path is uniquely new relative to the preceding inventory.
Both exact pairs are retained as gzip **from initial download**, with original
SHA-256/size independently verified through decompression. Restore using
`gzip -dc localArtifact` and verify the original bytes against its manifest.
Neither new pair was reloaded. A future separately authorized continuation
must decompress/stage only the final `continuationFiles`, then freshly verify
HTTP/loadFiles/VFS/native preview and current BAT/health before further action.

## Terminal evidence and actual box stop

All **18 gameplay transport commands ACKed**, zero UNKNOWN and no replay.
**12 prearmed pulses / 31 trusted native events** balance DOWN/UP; **18 PNGs**
passed CRC and scanline decoding. All 548 remote provider hashes remained
unchanged. No original trap, exception or guest process exit was observed.
Helper syntax, exact closure, source recovery and reused proofs passed.
This docs-only result reuses the accepted build/tests; no new build is claimed.

`finish-run` ACKed, but the driver's close escalation did not achieve normal
Chrome exit. `chrome-exit.json` records **code null / signal SIGKILL** at
**19:16:20.454 UTC**. Earlier `cleanup.json` had code null at 19:16:14.179.
The first terminal inventory's exact exit-one assertion failure is retained;
a distinct diagnostic identified SIGKILL rather than mislabeling it normal.
The diagnostic inventory explicitly accepts and records that observed signal.

The repaired kernel nevertheless consumed actual terminal waits for
**357 owned / 357 reaped**, exit **0**, with remaining, unreaped,
unresolvedPtrace and unresolvedLineage EMPTY. These are kernel custody results,
not a substitute for normal Chrome exit. All recorded PID/start identities,
adopted custody and kernel supervisor were absent. Ports **40925/45071**, profile,
writer marker, held input and remote lock were drained. No separate exhaustive
FD-writer census was retained; process absence does not replace that check.
CLONE_UNTRACED remains unaudited; census is not an exhaustive lineage claim.
Historical 1810 **305/358** remains unproven; predecessor 1844's normal
**358/358, Chrome exit 0** remains separate evidence.

All **234 remote references / 191,308,046 original bytes** were recovered and
independently verified before requesting API stop: **197 unique contents /
191,295,095 original bytes**. The **167,550,794-byte custody history** is retained
individually as gzip with streaming original-byte hash/size verification, no
uncompressed duplicate. The initial retrieval's final verifier hit a local
missing `Path` import after downloads had completed; the independent local-only
verifier reread every retained original/gzip stream and existing module path.
It did not replay a remote command. Existing module/media are referenced by
path/hash. Git SHA, relevant binary diff and compressed small owned helper
patches retain recovery; no source/media archive or peer WIP was applied.

Box **bx_p85tr6tn** is **archived**, expiry **null**. Stop receipt
**stop_ae93d9661a714576** completed **19:18:32.534 UTC**, forced **false**, error
**null**. UUID was persisted before create and actual ID/expiry before runtime.
Independent observable prearmed watchdog roles had an immutable API-stop cap
**19:33:32.600 UTC**; original expiry **19:34:32.771 UTC**. Normal/watchdog roles
have actual exit-zero records, supervisor children EMPTY, all three identities
absent. The detached local messageboard tail watcher was stopped and is absent;
its own terminal-wait receipt was not observed. No local heavy runtime/lock,
old-box resume/delete, public deployment or subworker occurred.

Free /home was sampled above the owner 1.5 GB floor during this worker's writes,
ending with very little headroom. Peer Quake II's reported 19:09 floor breach is
retained on the shared board; no continuous global compliance claim is made.
No old run was deleted. Full27, parity, audio and FPS remain open.

Next: separately investigate Chrome's close escalation before claiming normal
shutdown on this run. Any further encounter continuation requires a new task,
the final pair, current numeric health and live BAT review. RELEASE and STOP.
