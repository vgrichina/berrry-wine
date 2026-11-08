# Darkstone: hollow restore, reviewed Giant Wasp encounter and nine-victory save

Restored the earned roadside-hollow checkpoint through ordinary **Load a Game**,
followed the visible road between birches, and reached two living flying insects
beside a larger water-filled hollow. Personally reviewed native **GIANT WASP**
hover text and enemy health bar preceded hostile input. Two ordinary left holds
of 1,800 and 2,000 ms, each independently released, produced visible sword combat.
The next counter panel confirmed **9+0 victories**, up from 7+0. Ordinary
**Escape → Save a Game → New Save** preserved the new encounter progress.

Evidence: ignored `scratch/runs/20261108-darkstone-hollow-onward/` (R).
Predecessor: [outer-road hollow handoff](darkstone-outer-road-20261108.md),
`54e89161e`. No production files changed; no production build claim.

## Restore and reviewed consequence

Both original recovery inputs and staged checkpoint copies remain byte-identical:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,156 | `77cc4de69b703c58ea14bdd404b82c18a28aabc5ce0ec71a58ff6867a5d922a8` |
| `game641d_6af06c20.sav` | 3,204,341 | `79e1d54c3f5145deb4cda35ab5907ecd6d711b3e9f01283bc6664a434973e469` |

Personally reviewed R/review captures establish:

- `native-hollow-slot.png`: sole selected native preview matches hollow/tree.
- `restored-live-drained.png`: matching live hero and location; recorded buttons
  zero and queue EMPTY before movement.
- `baseline-inventory-settled.png`: **7+0 / LIFE 22/35 / Gold 1532 /
  Food 60 / MANA 25/25**, red vial retained. Source Food was 61; passive setup
  elapsed before this panel. The earlier immediate I capture still showed the
  world; passive settle revealed inventory without replaying the key.
- `road-past-hollow.png`, `left-road-bend.png`, `birches-onward.png`: three
  reviewed ground holds, 1,800–2,000 ms, follow the pale road beyond the hollow
  and birches to a larger water-filled hollow and two flying insects.
- `native-living-hover.png`, `close-native-hover.png`: initial hover attempts
  did not establish a native target; no hostile input followed those reviews.
- `living-hover-settled.png`: native **GIANT WASP** label and red health bar on
  the living insect below-left of the hero. Only then was ordinary left used.
- `giant-wasp-consequence.png`, `wasp-fight-aftermath.png`: sword combat and
  declining airborne insect count after two bounded holds. A subsequent hover
  found no remaining airborne insect or health bar; no further attack followed.
- `new-encounter-counters.png`: **9+0 / LIFE 19/35 / Gold 1532 /
  Food 58 / MANA 25/25**, red vial still retained.
- `native-new-save-choice.png`, `new-nine-victory-save-world.png`: native New
  Save selected, then returned to living hero in the new clearing.

No human attack, spell, vial activation, private handler, guest write, forced
scene, configuration, clock or seed change, or panel-pause assumption was used.
The location remains **Land of Ardyl**. Neither hollow is identified as an
entrance; no area transition, quest completion, audio or FPS claim is made.

## New native checkpoint

Read-only VFS recovery at **12:53:29.507 UTC** found:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,164 | `ba2c2c5fcbe8111c8ece302a3020c9ebe0793d2d0789b0a208b7bc388b7f74ea` |
| `game641d_6af070ba.sav` | 3,204,341 | `b56122d3ed4552f35c0e0df4cd1785d2d43b4fbedfcff8226d1792a05334c235` |

R/new-save-recovery.json maps exact native paths to independently hashed local
artifacts and records the normal manifest/HTTP/loadFiles/VFS/native Load recipe.
The loaded hollow SAV remains byte-identical in VFS. Native saving updated the
mounted character list; both original source recovery files are untouched.
The new nine-victory slot was not reloaded.

## Source, admission and containment

Before allocation, all **532 exact provider pins**, helper syntax, accepted
control/hover references and ordinary production manifest resolution,
`WineAssembly.loadFiles`, VFS hashes and native SAV enumeration passed.
An initial local pin-list preparation mistakenly retained predecessor helpers
(563 entries); this was corrected to 532 before allocation and retained in
R/preparation-correction.json. Seven accepted controls, hover and the accepted
parent-owned startup queue/subreaper/reaper were reused without standalone
reruns. No new generic repair is claimed.

Source providers retain Git `90c1fcfee91c4680877083e80498afcb73c9384d`.
Exact ignored original/compat modules were recovered by existing paths in
R/provider-recovery.json, with no ignored-binary Git fallback or shared build
overwrite. Executing module SHA-256:
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Peer WIP was excluded from executing providers. R/source-recovery.json records
exact checkout/runtime Git, relevant binary diffs, small owned helper patches
and existing media paths/hashes. No source or media archives were created.

The predecessor composed manifest was 1,232 bytes, SHA `40b9f4bd…`.
The new run-local URL is six bytes longer, so R/manifest-derived-pin.json derives
the new **1,238-byte** HTTP pin directly from `provision.cjs.bytes`, SHA-256
`66932702a0121e946be44130244f6ba04e91df3b6278400dafe5b5b5792bc12f`.
Served HTTP bytes and runtime HTTP pins matched; remote startup validated all
532 pins before Chrome, and all remained unchanged at exit.

One UUID-idempotent box **bx_77jg56ts** was identified before runtime.
Its own remote lock and subreaper covered provisioning, startup, runtime and
descendant drain. **29 exact PID/start identities** cover parents, Chrome,
crashpad, adopted descendants and custodian; registration preceded reaping.
All runtime descendants were absent before custodian exit and lock release.
Final scan found no live Chrome/crashpad/Node, ports closed, profile/writer
absent, and held input empty. Read-only observer transport exited zero before
stop; no runtime descendant exemption. No local `wine-runtime.lock` was held.
Launch disk exceeded 5 GB. No old box, resume, delete, public deployment or
subworker was used.

R/final-audit.json passes **22 exact command ACKs**, **zero UNKNOWN**,
**14 independent pulses**, **41 trusted events** (nine balanced mouse pairs,
five balanced key pairs, 13 moves) and **22 PNG CRC/scanline decodes**.
No original trap, Runtime exception, target crash or guest-process exit was
observed. Explicit finish-run closed Chrome **0 / no signal** at
**12:53:30.856 UTC**. All **264 remote references / 156,922,295 bytes**,
representing **220 unique contents / 156,908,437 bytes**, were retrieved and
independently reread/hash-checked before normal stop. Custody history, earlier
captures and the preparation correction are retained.

The independent 25-minute watchdog and normal-stop supervisor were armed
before creation. Immutable browser, watchdog and overall cleanup deadlines are
in R/lifecycle.json and R/watchdog-deadline.json. Delegated normal stop
**stop_9efbe660a67b2148** completed **12:54:16.010 UTC**, `forced:false`, error
null. Final box state **archived**, stopped **12:54:15.992 UTC**, expiry null.
Both lifecycle children exited zero, supervisor children empty and all local
lifecycle PIDs absent. R/stop-receipt.json retains confirmation.

Next: restore the new nine-victory checkpoint and continue the visible road
toward a named entrance or transition. Full27, parity, audio and FPS remain open.
Single-task worker stops after publication.
