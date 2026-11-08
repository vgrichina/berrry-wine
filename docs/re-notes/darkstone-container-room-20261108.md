# Darkstone: remaining 64 gold collected, onward through the passage

One fresh original restored only the selected adjoining-room pair. Current
native hover identified the remaining cluster as **64 Gold Pieces**. One
released click collected it; the native panel confirmed **Gold 1713**, up from
1649. Two reviewed floor clicks then moved southeast and south through the
narrow stone opening. Early and final incremental New Saves were retrieved and
independently hashed. No production code changed.

Evidence R: `scratch/runs/20261108-darkstone-container-room-1810/`.
Predecessor: [adjoining room](darkstone-chamber-explore-20261108.md).
Preparation checkout: `f0ccbf82d87758460eb23f261e0ae5a44da7606c`.

## Restore and personally reviewed gameplay

Only predecessor `new-save-recovery.json/continuationFiles` were staged:
`characters.lpl`, 1,342,268 bytes, SHA-256
`ed35964e704b4996e5892824ec80b9f54b114b0bb0805f1bf1c24cd89843335e`,
and `game641d_6af0b7fa.sav`, 3,204,341 bytes, SHA-256
`85aeed05454e9a9beea2bc685224719051b6c3b468a01860df86e30ea3261ad1`.
Source and staged hashes passed before allocation and after gameplay.

Fresh production provision.bytes yielded a 1,250-byte HTTP manifest, SHA-256
`f5f94b7c98b7aa17cf3e8d5db8c07f3eef852e5da80438b4a6dc30a924884b07`.
Actual HTTP verification passed, production loadFiles reported fifteen files,
and read-only VFS observation at 18:12:08.030 UTC matched exactly the selected
pair. Personally reviewed native Load a Game and its sole LEVEL 1 preview
preceded OK. The load-screen mouse release remained queued during loading;
`world-settled` confirmed buttons zero and queue EMPTY before further input.

Personally reviewed captures in R/review establish:

- `baseline-panel-settled`: victories **9+0**, **LIFE 19/35**, **MANA 25/25**,
  **Gold 1649**, **Food 39**, **AC 14**, helmet/cape and red/blue vials.
  The first panel capture preceded the visible inventory; a passive capture
  settled it without repeating the key. Inventory was closed before hover.
- `remaining-cluster-native-hover`: the actual bottom-left native label reads
  **64 Gold Pieces**, and the remaining pile highlights. One released click
  removes it in `remaining-loot-consequence`. `collected-gold-panel` confirms
  **Gold 1713**, Food 39 and the other baseline stats unchanged.
- `southeast-floor-native-hover` and `south-passage-native-hover`: reviewed
  revealed floor between rock walls, with no object, loot, hostile or human
  label or outline. Each was followed by one released native pathfinding click.
  `southeast-pathfind-settled` and `south-passage-consequence` show movement out
  of the container area through the narrow opening onto wider stone floor;
  the intact lower barrel is behind-left. Historical unexplored status is
  unavailable and is not claimed.
- `final-native-panel`: **Gold 1713**, **Food 38**, **LIFE 19/35**,
  **MANA 25/25**, **AC 14**, victories **9+0**, same equipment and vials.
  `final-native-saved` shows inventory closed; its state has buttons zero and
  queue EMPTY. Actual observed Food is retained, without estimating idle loss.

The broken upper barrel was not clicked again. The lower intact barrel and
pottery remain untouched. No hostile or human was identified or attacked; no
potion, private guest write, restart, replay, configuration, clock or seed
change occurred.

## Retrieved continuation

Allocation began **18:09:57.094 UTC**. Early New Save was retrieved and
independently hashed at **18:16:43.762 UTC**, **406.667 seconds** after allocation,
before minute ten. R/early-save-recovery.json retains it.

Final New Save was retrieved and independently hashed at **18:20:29.906 UTC**,
before the immutable **18:32:57.094 UTC** browser cap.
R/new-save-recovery.json selects these `continuationFiles`:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,284 | `bebc7fcd564603a3d79ecf54c3fb0ae8a15b080d5c0fd4db7c615bf15cb3be85` |
| `game641d_6af0bd5d.sav` | 3,204,341 | `d1ed6d70a78c2ab3ef13291fc36081daeca58240f58034c5458e0b48ffce528f` |

The selected final game is the sole new game path absent from the independently
retrieved early save inventory. This pair is recovered but **not reloaded**.
Future continuation must restore only this pair, derive fresh provision.bytes,
and verify HTTP/loadFiles/VFS/native preview again.

## Runtime provenance and audit

The selected generation remains **548 providers / 42 helpers**, runtime commit
`90c1fcfee91c4680877083e80498afcb73c9384d`, module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
assigned kernel `275dd018a`, endpoint
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
The newer shared kernel remained untouched; the selected hash-matched helper
was used through the existing fallback recipe. Cheap resolver/closure, actual
provisioner with recording transport, real remote content barrier, and source
and staged pair checks passed. Sixty-eight accepted references were reread and
hashed without fixture reruns. Exact Git SHA, relevant binary diff, small owned
helper patches and existing media PATH/HASH references retain provenance; no
source archive, copied media or peer WIP was applied.

R/final-audit.json passes **25 exact command ACKs**, **zero UNKNOWN commands**,
**17 independently prearmed pulses**, **46 trusted native events** with balanced
DOWN/UP, and **25 PNG CRC/scanline decodes**. No original guest trap, exception
or guest process exit was observed. All 548 remote provider hashes remained
unchanged. Helper syntax passed. Full27, parity, audio and FPS remain open.

## New shutdown failure, evidence recovery and delegated stop

The explicit finish-run quit command ACKed. During shutdown, the unchanged
selected kernel failed at `ptrace(CONT, task, data=deliver)` with
`ProcessLookupError: [Errno 3] No such process: '18349'`. Its exception handler
kills surviving recorded identities. R/recovered/kernel.stdout and
R/recovered/custody.ndjson retain the actual failure. The recovered kernel-drain
record contains
**358 owned / 305 reaped**, exit **null**, 53 identities remaining at its final
snapshot; unresolved lineage zero, clone-untraced flags unaudited. This is
**not a successful normal kernel drain**. Chrome has no exit receipt; cleanup
records `code:null`, `pending:UNKNOWN; never replay`. Ordinary Chrome exit 0
is **not proved**. No command or original was resent.

The first read-only post-close census found no live recorded descendants; the
usual first custodian-stop helper then failed its expected custodian-exit
assertion. That failure is retained. Fresh independent observation and terminal
inventory checked every recorded parent/kernel PID plus start and supervisor:
all absent. Ports **41621/40535** were closed; profile, writer, held inputs and
runtime FD writers were absent, and the remote runtime lock was free. These
later absence checks do not repair the failed normal-drain history.

All **300 remote references / 280,859,663 bytes** were retrieved and independently
reread/hashed before normal API stop (250 unique contents, 280,845,545 bytes).
The unique custody-history log was compressed individually for transport,
decompressed and checked against its original hash. No source tree was bundled.

The UUID key was persisted before the sole allocation; box ID and expiry were
recorded before runtime. Observable independent watchdog roles were prearmed,
with immutable API-stop deadline **18:34:57.094 UTC**, initial box expiry
**18:35:57.269 UTC**. All three local lifecycle PID/start identities are absent,
the normal/watchdog roles exited zero and supervisor children are EMPTY. The
board watcher stopped; no local heavy runtime or heavy lock was used.
R/final-owned-evidence.json independently rereads 564 owned artifacts,
305,210,008 bytes, including the source recovery recipe and retrieval proofs.

Box **bx_em9k73mn** is **archived**, final expiry **null**. Stop receipt
**stop_6bc4d50c5b7fe28c** completed **18:22:37.510 UTC**, forced false, error null.
R/stop-receipt.json retains it. No old-box action, resume, delete, deployment or
subworker occurred.

Next: diagnose the newly captured kernel CONT/ESRCH shutdown race with focused
offline causal coverage before another original. Gameplay continuation is at
the wider floor beyond the narrow opening, Gold 1713; hover current targets
before any interaction. RELEASE and stop after publication.
