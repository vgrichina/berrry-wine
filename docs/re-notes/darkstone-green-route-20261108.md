# Darkstone: restored mana/gold hero enters the green tiled chamber

Restored the selected native mana/gold checkpoint, entered the green tiled
chamber through native pathfinding, and broke its native-highlighted barrel.
No floor drop was visible after settling; no loot collection or hostile encounter
is claimed. Early and final incremental native **New Save** files were recovered
and independently hashed. No production code changed.

Evidence R: `scratch/runs/20261108-darkstone-green-route-1717/`.
Handoff: [cape continuation](darkstone-cape-1650-20261108.md), published
`68f80664b`. Preparation checkout: `3898779fb3565d92d2a9ebb40b99aa1e1ac84e13`.

## Restore and visible consequences

The handoff descriptor selected `characters.lpl` (1,342,236 bytes,
`e0d7600f08151d01d109243abf495d90e35c28873d27faea8c1551ea22c69d82`)
and `game641d_6af0ac25.sav` (3,204,341 bytes,
`f9ab5af1b5731a02489b752b5e4deac6ba48857ab4d298ecd413717f2fd2b954`).
Both sources and staged bytes were verified before allocation and again after
shutdown. They remained unchanged.

Actual provision.bytes generated a new **1,244-byte** HTTP manifest before
allocation, SHA-256
`5598db9a7fe94f0164af9ae7df53568501f8a33ee2f5ce7b67cf090be84b5a22`.
The real local HTTP handler and production remote resolver checked those bytes.
Production loadFiles mounted fifteen data files. The read-only VFS observation
at **17:18:40.788 UTC** matched both selected hashes. Personally reviewed current
menu pixels preceded Load a Game, the selected **LEVEL 1** preview, and OK.
The load-screen capture retained a queued mouse release; the settled world
capture confirmed buttons zero and queue EMPTY before further input.

Personally reviewed captures under R/review establish:

- `baseline-panel-settled`: victories **9+0**, **LIFE 19/35**, **MANA 25/25**,
  **Gold 1637**, **AC 14**, helmet/cape, red/blue vials. Current **Food 43** was
  observed after idle runtime; the handoff's Food 44 is not substituted for it.
- `green-floor-native-hover`: exact ordinary native hover on green floor,
  without object highlight or item/hostile/human label. A single ordinary click
  requested native pathfinding, with its independent release armed first.
- `green-pathfind-release`: hero moves toward the opening beside the barrel.
  `green-pathfind-settled`: hero visibly stands on green tiled chamber floor,
  opening behind-left and barrel ahead; buttons zero and queue EMPTY.
  This proves entry from the checkpoint, not historical unexplored status.
- `green-barrel-native-hover` initially lacks the later bright outline.
  `green-barrel-hover-settled` shows the actual native gold outline on the
  barrel. Only then was one click sent. `green-barrel-after-click` shows the
  approach; `green-barrel-broken-settled` and `green-barrel-consequence` show
  the barrel collapsed beside the hero. No visible drop was identified or taken.
- `final-native-panel`: **LIFE 19/35**, **MANA 25/25**, **Gold 1637**,
  **Food 42**, **AC 14**, victories **9+0**, helmet/cape and red/blue vials.
  `final-native-saved`: inventory closed, buttons zero and queue EMPTY.

No human or hostile was attacked and no potion was consumed. Each save choice
followed personally reviewed current Save a Game and New Save menu pixels.
No private guest write, restart, configuration, clock, seed or UNKNOWN replay.

## Recovered incremental continuation

Allocation began **17:15:42.016 UTC**. Early New Save was retrieved and
independently hashed at **17:22:05.056 UTC**, **383.040 seconds** after allocation,
before minute ten. R/early-save-recovery.json retains the early checkpoint.

Final New Save was retrieved and independently hashed at **17:26:19.916 UTC**,
before the immutable **17:38:42.016 UTC** browser cap.
R/new-save-recovery.json selects these `continuationFiles`:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,252 | `03f44c7360bcd95ec38f1581715fbc1e540a97c8d46896a67b9884fd92ad5986` |
| `game641d_6af0b0aa.sav` | 3,204,341 | `65e6b47c6909d14b22100ddf6e091510586df3ccb01ab680f3232909662cd1f9` |

The selected final pair is under R/final-recovery and was **not reloaded**.
Redundant owned save copies were removed only after content-hash comparison;
descriptors retain their actual local references. The original loaded SAV
remained unchanged. A future restore must derive its own provision.bytes HTTP
manifest and verify production loadFiles/VFS/native preview again.

## Verification and normal shutdown

The selected runtime retains **548 providers / 42 helpers**, original runtime
`90c1fcfee91c4680877083e80498afcb73c9384d`, ignored module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`,
assigned kernel `275dd018a`, and endpoint
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
The shared checkout's newer kernel was left untouched: its selected predecessor
was recovered from Git and matched against the assigned SHA. Bootstrap read
that exact provider recovery when the current shared file differed.

Cheap closure, actual normal provisioner recording-transport check, joined
uploads, remote content barrier publication, and queue/parent checks passed.
Sixty-eight accepted controls/hover/barrier/kernel references were independently
reread; unchanged fixtures were not rerun. All 548 remote providers stayed exact;
final source/staged checks and sixteen existing media PATH/HASH references passed.

R/final-audit.json passes **24 exact command ACKs**, **zero UNKNOWN**,
**14 independent pulses**, **38 trusted native events** with balanced DOWN/UP,
and **24 PNG CRC/scanline decodes**. No original guest trap, exception, crash,
or guest process exit was observed. Helper syntax passed. This is documentation
and evidence work; no new production build or integration repair is claimed.

Ordinary Browser.close completed with actual Chrome **exit 0, signal null** at
**17:26:58.554 UTC**. This is the observed result of the unchanged close path;
it does not rewrite the prior run's SIGKILL result. A fresh read-only post-close
census found no live recorded runtime identities before the first custody-stop
request. The unchanged drain checks passed: **358 owned / 358 reaped**, kernel
normal exit zero, remaining EMPTY, kernel fork lineage complete with zero
unresolved identities. Clone-untraced flags remain unaudited. The 58-identity
parent census, adopted descendants, exact supervisor identity, ports
**34491/45363**, profile, writer and held inputs drained; remote lock was free.

All **286 remote references / 272,059,861 bytes** were retrieved and independently
reread/hashed before delegated normal API stop (237 unique contents,
272,046,060 bytes). The UUID idempotency key was persisted before the sole
allocation; observable independent watchdog roles were prearmed before it.
Immutable stop deadline: **17:40:42.016 UTC**; initial box expiry:
**17:41:42.184 UTC**. All three local supervisor/normal/watchdog PID/start
identities are absent, role exits zero, supervisor children EMPTY.
No local heavy runtime or local runtime lock was used.

Box **bx_eshg4q48** is **archived**, final expiry **null**. Stop receipt
**stop_7c30b90f9f0a2260** completed **17:28:04.845 UTC**, forced false, error null.
R/stop-receipt.json retains the confirmed result. No old-box action, resume,
delete, public deployment, archive, peer WIP application or subworker occurred.
Exact Git SHA, relevant binary diff, small owned helper patches and media
PATH/HASH references retain recovery provenance; Git remains the source archive.

Next: restore the selected green-chamber continuation for further reviewed
exploration. Full27, parity, audio and FPS remain open. RELEASE and stop after
publication.
