# Darkstone: restored enclosure and native Mayor conversation, 2026-11-08

The earned palisade enclosure slot restored through native **Load a Game**.
After settling inside, ordinary pointer positioning over the white-shirt,
green-trousered NPC displayed **THE MAYOR** in the native bottom panel.
One ordinary left interaction approached him; passive settling revealed a
native conversation screen headed **The Mayor**, with an **Exit** control.
Exit returned to the world. No dialogue body, quest acceptance or audio
success is claimed. Native **New Save** preserved the new position.

Evidence: ignored `scratch/runs/20261108-darkstone-enclosure-npc/` (R).
Predecessor: [manifest/onward handoff](darkstone-manifest-onward-20261108.md),
`49a15dbf0`. This is new visible NPC interaction evidence; no production
change or production build is claimed.

## Exact restore and input

Both inherited source artifacts and their staged checkpoint copies remain
byte-identical:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,124 | `8be3e3ab52047b4aeeeb5b9dff26e3eb193ab7eee317644a0a6e3a46f5007943` |
| `game641d_6af0595c.sav` | 3,204,264 | `097396b8f2c61282313f1c7c2ea12190ee843dbbc7c46b63a6a5edff20759607` |

Before allocation, the manifest pin was derived directly from
`provision.cjs.bytes`: **1,238 bytes**, SHA-256
`71d9411922c9b5f58388b2a9c4f3578682d0610d992a5b87f97be1930f9cc623`.
Local served HTTP bytes, all HTTP/runtime pins, production manifest
resolution, `WineAssembly.loadFiles`, VFS save hashes and native `*.sav`
enumeration passed. All **527 providers** were checked exactly. Runtime
tracked source comes from published Git
`90c1fcfee91c4680877083e80498afcb73c9384d`; differing workspace providers
were read from that commit, excluding peer WIP. Executing guest/render
module: `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Remote HTTP pins passed before Chrome and all 527 staged pins matched at exit.

The seven accepted control references were hash-checked and reused without
standalone reruns. The retained browser helper lacked a hover-only action.
R/pointer.cjs and its browser integration add a reviewed, identity-bound
native `Input.dispatchMouseEvent` move with `buttons:0`, without a press.
Focused tests cover exact target/session/coordinates, invalid points and
geometry, and routing through the existing admission chain. Accepted input,
identity, independent release, sticky UNKNOWN and lifecycle controls remain
in use. This run-local helper extension is retained in the recovery patch.

The shipped readme documents left mouse for movement/action/speaking.
Two brief feet-position ground inputs and one **1,500 ms** grass approach
were each independently released and personally reviewed. The hero's
unchanged position in `settled-near-humans.png` and `white-shirt-hover.png`
establishes settling before the named NPC interaction. The single Mayor
action held **1,000 ms**, then passive captures showed the conversation.
No attack modifier, spell input, potion use or arbitrary repeated human
click was sent. Panels were never treated as pause.

Key personally reviewed screenshots:

- R/review/native-slot-list.png: selected enclosure preview.
- R/review/white-shirt-hover.png: native **THE MAYOR** feedback.
- R/review/beside-mayor-settled.png and R/review/mayor-native-conversation.png:
  native **The Mayor** heading and **Exit**.
- R/review/mayor-conversation-exited.png: ordinary Exit returned to the world.
- R/review/live-counters-vial.png: **6+0 / LIFE 24/35 / Gold 1532 / Food 69 /
  MANA 25/25**, red vial still in the first belt slot.
- R/review/new-mayor-save-world.png: native New Save returned to the enclosure.

R/gameplay-review.json retains commands, decisions and screenshot hashes.
The fresh counter inspection was after the conversation; the predecessor's
Food 70 restoration value was not independently inspected before movement.

## New native recovery

Native **Escape → Save a Game → New Save** produced these files, recovered
read-only from VFS at **11:30:50.415 UTC**:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,132 | `27d90857f410f2398754ca95a19a38b836a6afae3a35351713a2a3104667d474` |
| `game641d_6af05d52.sav` | 3,204,303 | `415887a8b3d7c991eb79bdad7ca8b712222e800a0f6c5dbd83ab03ab09ff6972` |

R/new-save-recovery.json maps native paths to independently hashed local
artifacts and gives the ordinary restore recipe. The loaded enclosure
`097396b8` save remains unchanged in VFS. The source enclosure pair remains
untouched; the game's normal New Save updated its mounted character list.
The newest Mayor-position slot has not been reloaded.

## Custody and shutdown

One UUID-idempotent fresh box **bx_gvpx72u5** was identified before runtime.
Its remote custody process acquired `/tmp/wine-runtime.lock` **before
provisioning/startup**, held it through runtime, and registered descendants
by PID/start time. No local heavy runtime or local runtime lock was used.
The inherited registrar that checked 68 identities was reused; this shorter
run registered **42** identities. The first drain/inventory checks caught
the launcher Node process still alive after Browser.close; both failures
remain in R. A distinct later observation showed its exit. Fresh custody
and inventory checks then passed every registered runtime descendant,
custodian exit/lock release, all-host Chrome/crashpad/Node scanning, launcher
and browser absence, closed server/debug ports, absent profile/writer, and
empty held input. The read-only observer's ancestry and exit-zero transport
receipt are retained; no runtime descendant was exempted.

Chrome exited **0 / no signal at 11:31:01.278 UTC**. R/final-audit.json passes
**18 exact command ACKs**, **zero UNKNOWN**, **12 independent pulses**,
**34 trusted input events** (nine balanced mouse pairs, three balanced key
pairs and ten moves), and **18 PNG CRC/scanline decodes**. No original trap,
runtime exception, target crash or guest-process exit was observed.

All **219 remote references / 41,771,905 bytes**, representing **182 unique
contents / 41,758,758 bytes**, were retrieved and separately rehashed before
requesting normal stop. R/source-recovery.json records exact checkout/runtime
Git identities, relevant binary diff, small owned helper patches and existing
media path/hash references. No source tree or repeated media archive was made.

The independent observable watchdog and normal-stop supervisor were armed
before allocation. Creation **11:23:36.837 UTC**, original expiry
**11:49:36.679 UTC**, immutable watchdog deadline **11:48:36.846 UTC**,
browser deadline **11:46:36.508 UTC**. Delegated normal stop
**stop_ec7600e550361a02** completed **11:32:26.005 UTC**, `forced:false`,
error null. Final state **archived**, stopped **11:32:25.942 UTC**, expiry
null. Both lifecycle children exited zero and the supervisor has no remaining
children. R/stop-receipt.json retains the completed receipt. Launch disk
exceeded 5 GB. No old-box resume/delete, public deployment, subworker,
private handler, guest write, forced scene, configuration/clock/seed edit
was used.

Next useful work: restore the new Mayor-position slot for another freshly
reviewed ordinary NPC/quest or onward interaction. Full27, parity, audio and
FPS remain open. This single-task worker stops after publication.
