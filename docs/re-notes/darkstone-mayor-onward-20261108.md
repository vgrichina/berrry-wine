# Darkstone: restored Mayor slot, identified Rozanne, native interaction and New Save

The earned Mayor-position slot restored through native **Load a Game**.
Reviewed ground travel reached a different, white-hatted robed NPC. The
accepted hover-only helper displayed native **ROZANNE** before interaction.
One ordinary left interaction then opened the native **Rozanne** conversation
heading and **Exit**. Normal Exit returned to the world, and native
**Escape → Save a Game → New Save** preserved the new position.
No dialogue body, quest acceptance or audio success is claimed.

Evidence is in ignored `scratch/runs/20261108-darkstone-mayor-onward/` (R).
Predecessor: [Mayor enclosure handoff](darkstone-enclosure-npc-20261108.md),
`bb05d9d3b`. This run proves a different NPC interaction and includes a tested
run-local startup/custody integration repair. No production edit or production
build is claimed.

## Restore, controls and reviewed gameplay

Both source inputs and staged checkpoint copies remain byte-identical:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,132 | `27d90857f410f2398754ca95a19a38b836a6afae3a35351713a2a3104667d474` |
| `game641d_6af05d52.sav` | 3,204,303 | `415887a8b3d7c991eb79bdad7ca8b712222e800a0f6c5dbd83ab03ab09ff6972` |

Before allocation, R/manifest-derived-pin.json derived the composed manifest
HTTP pin directly from `provision.cjs.bytes`: **1,236 bytes**, SHA-256
`fdfa91edd946eb9af571dc39dada9fb5f854daa65808489ac91763eeb311a271`.
Served HTTP bytes, HTTP/runtime pins, production manifest resolution,
`WineAssembly.loadFiles`, VFS save hashes and native `*.sav` enumeration
passed. All **530 providers** were checked exactly; three differing tracked
providers came from published Git `90c1fcfee91c4680877083e80498afcb73c9384d`,
excluding peer WIP. Remote HTTP pins passed before Chrome; all 530 staged
pins remained unchanged at exit. Executing guest/render module:
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.

The seven accepted controls and the predecessor's accepted hover helper and
focused test evidence were hash-checked and reused without standalone reruns.
All gameplay inputs used the existing review/identity admission chain,
independent UP and sticky UNKNOWN/no replay controls. Ground holds were
100–2,000 ms, each followed by fresh personally reviewed capture. No attack
modifier, spell, vial activation, private handler, guest write, forced scene,
configuration/clock/seed change or pause assumption was used.

A delayed **The Mayor** title/Exit screen appeared during early ground travel.
This repeated result is retained in `clear-east-grass.png` and explicitly does
**not** count as task progress. Normal Exit and passive settling drained the
queue. Subsequent travel used shorter pulses and longer passive settling.
The first robed-NPC hover produced no name; the second, upper-body hover
produced **ROZANNE**. Only then was the single 1,000 ms ordinary NPC action
sent. The resulting Rozanne conversation capture had an empty input queue.

Personally reviewed key evidence:

- R/review/native-slot-list.png and restored-live-world.png: Mayor slot preview
  and matching restored enclosure.
- R/review/robed-upper-hover.png: native **ROZANNE**, before any interaction
  with this NPC.
- R/review/rozanne-interaction.png: native **Rozanne** heading and **Exit**.
- R/review/rozanne-exited.png: normal Exit returned to the world.
- R/review/earned-counters-vial.png: **6+0 / LIFE 24/35 / Gold 1532 / Food 68 /
  MANA 25/25**, red vial still in the first belt slot.
- R/review/native-save-slots.png and new-rozanne-save-world.png: native
  **New Save** and return to the new building position.

R/gameplay-review.json records decisions, commands and screenshot hashes.
Food decreased from the inherited 69 to the inspected 68. The inventory
panel did not pause movement; no health, mana, gold or victory gain is claimed.

## Native recovery

Read-only VFS recovery at **11:56:04.073 UTC** found these new game-written
outputs:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,140 | `6e09d2c37e11e645f06dd45b7cf257949c0d149287dcbfb73aa2de5cc11398fa` |
| `game641d_6af06343.sav` | 3,204,341 | `579c334a7da90760184441c663f990cf19c2dc8ac88da845a9536473e86853f9` |

R/new-save-recovery.json maps native paths to independently hashed local
artifacts and gives the ordinary manifest/HTTP/loadFiles/VFS/native Load
recipe. The loaded Mayor `415887a8` save remains byte-identical in VFS.
The original source pair remains untouched; the game normally updated its
mounted character list for New Save. The Rozanne-position slot was not reloaded.

## Parent custody integration, evidence and shutdown

The predecessor's polling custodian discovered a separately launched runtime
by command text. The new run-local integration instead makes the lock holder
and Linux subreaper the actual parent of startup and runtime. It acquires
`/tmp/wine-runtime.lock` and enables the accepted orphan-adoption helper before
provisioning, consumes one unique launch request, and runs the existing
pin-verifying launcher inside that custodian. It records PID/start identities
before the accepted nonblocking reaper removes exited children, and releases
the lock only after every owned descendant is absent. No local runtime lock
was held during preparation, remote provisioning, supervision or retrieval.

R/custody-integration-focused.json passes an actual detached double-fork
fixture: launch runs under the custodian, the orphan is adopted, its exact
identity is registered, the fixture lock refuses acquisition while it lives,
all owned identities are absent after reaping, and the lock then becomes free.
This test uses a temporary fixture lock, not the local heavy-runtime lock.
The accepted adoption/reaping implementations are reused; the parent-owned
provision/startup queue is the new Darkstone integration.

One UUID-idempotent box **bx_7hc8exxg** was identified idle before runtime.
Actual remote evidence verifies the launcher was a direct custodian child,
startup was covered, and **27 registered PID/start identities** drained,
including Chrome/crashpad/adopted descendants and Node. Custodian exit and
remote lock release then passed, together with an all-host Chrome/crashpad/Node
scan, launcher/browser absence, closed HTTP/debug ports, absent profile/writer,
empty held input and exit-zero observer transport. No runtime descendant was
exempted. R/custody-reaped.jsonl is recovered with the full custody history.

R/final-audit.json passes **21 exact command ACKs**, **zero UNKNOWN**,
**15 independent pulses**, **44 trusted input events** (12 balanced mouse
pairs, three balanced key pairs, 14 moves), and **21 PNG CRC/scanline decodes**.
No original trap, runtime exception, target crash or guest-process exit was
observed. Chrome exited zero with no signal; completion was explicit.

All **255 remote references / 209,405,244 bytes**, representing **213 unique
contents / 209,391,544 bytes**, were retrieved and separately reread/hash-checked
before normal stop. The larger unique log is the detailed custody history.
R/source-recovery.json records exact checkout/runtime Git identities, relevant
binary diff, small owned helper patches and existing media paths/hashes.
No source tree or repeated media archive was made.

The independent watchdog and normal-stop supervisor were observable before
allocation. Creation **11:47:50.754 UTC**, initial expiry **12:13:50.621 UTC**,
immutable watchdog deadline **12:12:50.408 UTC**; browser deadline **12:10:50.408
UTC**. Normal stop **stop_f8e6b2b516fb4b10** completed **11:57:23.244 UTC**,
`forced:false`, error null. Final state **archived**, stopped **11:57:23.224
UTC**, expiry null. Both lifecycle children exited zero; supervisor children
are empty. R/stop-receipt.json retains the completed receipt. Launch disk
exceeded 5 GB. No old-box resume/delete, public deployment or subworker.

Next useful work: restore the new Rozanne-position slot for another ordinary
NPC/quest or an onward route. Dialogue body/quest acceptance, full27, parity,
audio and FPS remain open. This single-task worker stops after publication.
