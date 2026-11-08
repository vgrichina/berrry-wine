# Darkstone: adjoining room, another barrel and twelve gold

Restored only the selected green-chamber continuation, explored its southeast
corner, then followed two visible stone openings into an adjoining container
room. A different, native-highlighted intact barrel broke; current native hover
identified **12 Gold Pieces**, which were collected. The final native panel
confirms **Gold 1649**, up from 1637. Early and final incremental **New Save**
files were retrieved and independently hashed. No production code changed.

Evidence R: `scratch/runs/20261108-darkstone-chamber-explore-1740/`.
Handoff: [green chamber](darkstone-green-route-20261108.md).
Preparation checkout: `b9116fecdee31f779d3c2ed303e5dd06d5da122d`.

## Restore and reviewed gameplay

Only `continuationFiles` from the handoff descriptor were staged:
`characters.lpl`, 1,342,252 bytes, SHA-256
`03f44c7360bcd95ec38f1581715fbc1e540a97c8d46896a67b9884fd92ad5986`,
and `game641d_6af0b0aa.sav`, 3,204,341 bytes, SHA-256
`65e6b47c6909d14b22100ddf6e091510586df3ccb01ab680f3232909662cd1f9`.
Source and staged hashes passed before allocation and after gameplay.

Actual production provision.bytes produced a fresh 1,252-byte HTTP manifest,
SHA-256 `e590098aaacc1a616e55eca168e92014451f2aed9c500ecfbfcec1cf8fff08f5`.
The real HTTP handler and production resolver verified these bytes. Production
loadFiles mounted fifteen files; read-only VFS observation at 17:42:36.143 UTC
matched exactly the selected pair. Personally reviewed Load a Game and the
selected LEVEL 1 preview preceded OK. The load-screen mouse release was still
queued; `world-settled` confirmed buttons zero and queue EMPTY before input.

Personally reviewed captures in R/review show:

- `baseline-panel-settled`: victories **9+0**, **LIFE 19/35**, **MANA 25/25**,
  **Gold 1637**, **Food 42**, **AC 14**, helmet/cape and red/blue vials.
- `beyond-pathfind-settled` and `chamber-corner-settled`: separate released
  native pathfinding clicks moved southeast and around the diagonal structure
  to the chamber corner. The corner view reveals ladder rungs. Native hover
  gave no highlight or label, so no ladder interaction was attempted.
- `doorway-pathfind-settled`: hero crosses the chamber's stone opening,
  leaving its already-broken barrel behind-right. `corridor-pathfind-settled`
  shows passage through the next visible opening into an adjoining stone room
  with two intact barrels and pottery. This is verified movement from the
  restored checkpoint; historical unexplored status is not established.
- `next-room-barrel-native-hover`: upper intact barrel has the actual native
  gold outline. One released click followed that identification.
  `next-room-barrel-consequence` shows its collapse and coin-shaped drops.
  This is a different barrel from the broken green-chamber barrel.
- The first lower-drop hover gave no native label and was not clicked.
  `coin-pile-native-hover` identifies the upper cluster as **12 Gold Pieces**.
  One collection click removes that pile. Another coin-shaped cluster remains
  unlabelled and untouched; the lower intact barrel and pottery also remain.
- `final-native-panel`: **Gold 1649**, **Food 39**, **LIFE 19/35**,
  **MANA 25/25**, **AC 14**, victories **9+0**, helmet/cape and red/blue vials.
  `final-save-world-settled` shows inventory closed, buttons zero, queue EMPTY.

No hostile or human was identified or attacked. No potion was consumed.
Each pathfinding click followed reviewed visible floor and current native hover;
each object/loot interaction followed its actual native outline or label.
No private guest write, restart, configuration, clock or seed change occurred.

## Recovered incremental continuation

Allocation began **17:39:25.903 UTC**. Early New Save was retrieved and
independently hashed at **17:48:27.198 UTC**, **541.295 seconds** after allocation,
before minute ten. R/early-save-recovery.json retains it.

Final New Save was retrieved and independently hashed at **17:57:40.112 UTC**,
before the immutable **18:02:25.903 UTC** browser cap.
R/new-save-recovery.json selects these `continuationFiles`:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,268 | `ed35964e704b4996e5892824ec80b9f54b114b0bb0805f1bf1c24cd89843335e` |
| `game641d_6af0b7fa.sav` | 3,204,341 | `85aeed05454e9a9beea2bc685224719051b6c3b468a01860df86e30ea3261ad1` |

The final pair is recovered but **not reloaded**. Restore only this selected
pair in a future original, derive fresh provision.bytes, and verify HTTP,
loadFiles, VFS and native preview again. Next gameplay: native hover on the
remaining coin-shaped cluster, lower intact barrel or pottery before interaction.

## Retained refusals and runtime provenance

One preparation attempt lacked the small selected-kernel recovery helper; its
exact predecessor helper was supplied locally. Before game launch, provisioning
then stopped because an owned audit helper had been edited after pin generation.
All selected helper bytes were restored, the completed upload ledger was checked
as an exact prefix, and only the known remaining files were uploaded. The remote
content barrier verified all 548 providers before the sole original launch.
These are preparation errors, not substantive production repairs.

The close-inventory remote transport reported writer.lock EEXIST. Read-only
inspection found exactly one numbered `close-baseline` command and its exact
successful ACK, the balanced independently armed key pulse, writer absent and
no runtime first-failure or transport-closed marker. The resulting closed-panel
capture was retrieved and reviewed. No input was resent. The transport error is
retained; the cause of its lock collision is not established. This does not
claim that the remote transport itself returned success.

The selected generation remains **548 providers / 42 helpers**, runtime commit
`90c1fcfee91c4680877083e80498afcb73c9384d`, module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
assigned kernel `275dd018a`, endpoint
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
The shared newer kernel stayed untouched; bootstrap used the hash-matched
selected Git predecessor. Cheap resolver/closure, normal recording-transport
provisioner, real content barrier and queue/parent checks passed. Sixty-eight
accepted control/hover/barrier/kernel references were reread and hashed without
fixture reruns. Existing media remain PATH/HASH references. Exact checkout SHA,
relevant binary diff and small owned helper patches retain source provenance;
no source/media archive or peer WIP was applied. Full27, parity, audio and FPS
remain open.

## Audit and delegated normal shutdown

R/final-audit.json passes **38 exact command ACKs**, **zero UNKNOWN**,
**18 independently armed input pulses**, **56 trusted native events** with
balanced DOWN/UP, and **38 PNG CRC/scanline decodes**. No original guest trap,
exception, crash or guest process exit was observed. Helper syntax passed.
This is gameplay/evidence documentation; no production repair or new build is
claimed.

Ordinary Browser.close completed with actual Chrome **exit 0, signal null**
at **17:58:27.188 UTC**. A fresh read-only census found recorded runtime
identities absent before the first custodian-stop request. Kernel normal drain
passed **363 owned / 363 reaped**, exit zero, remaining EMPTY, fork lineage
complete, zero unresolved. Clone-untraced flags remain unaudited; no universal
custody claim is made. The 59-identity parent census, adopted descendants,
supervisor PID/start, ports **36141/38701**, profile, writer and held inputs
drained; remote runtime lock was free.

All **422 remote references / 503,592,688 bytes** were retrieved and independently
reread/hashed before normal API stop (345 unique contents, 503,576,643 bytes).
The 473,585,082-byte unique custody log was transported as an individually
compressed gzip log, then decompressed and checked against its original hash.
The incomplete uncompressed local transfer was removed only after that check.
This was log compression, not a source-tree archive.

The UUID idempotency key was persisted before the sole allocation. Observable
independent watchdog roles were prearmed; immutable stop deadline
**18:04:25.903 UTC**, initial box expiry **18:05:26.064 UTC**. All three local
supervisor/normal/watchdog PID/start identities are absent, role exits zero,
supervisor children EMPTY. No local heavy runtime or runtime lock was used.

Box **bx_j7sfreex** is **archived**, final expiry **null**. Stop receipt
**stop_4d80368201f7e0b0** completed **18:01:23.676 UTC**, forced false, error null.
R/stop-receipt.json retains the result. No old-box action, resume, delete,
public deployment, UNKNOWN replay or subworker occurred. RELEASE and stop
after publication.
