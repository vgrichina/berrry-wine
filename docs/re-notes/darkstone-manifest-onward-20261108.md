# Darkstone: corrected manifest closure to a palisade and NPCs, 2026-11-08

The untouched earned **six-victory/red-vial slot restored live**. Following
**26 individually reviewed ground moves** beyond the rock reached a wooden
palisade, crossed its visible gate gap, and revealed human NPCs inside the
new enclosure. A gray-robed figure with a pale pointed hat and a person in a
white shirt/green trousers are visible in the retained PNGs. Two brief
interaction clicks opened no dialogue; no NPC name or area transition is
claimed. Native **New Save** preserved the new position. The red vial remains
unconsumed in the first quickslot. No production code changed.

Evidence: ignored `scratch/runs/20261108-darkstone-manifest-onward/` (R).
Predecessors: [staging failure](darkstone-pickup-onward-20261108.md),
`e464ba2c5`, and [earned pickup](darkstone-western-junction-20261108.md),
`a499001da`.

## Correct staging before allocation

The inherited stale `9175ef93` pin was not reused. The composed-manifest pin
was derived directly from **`provision.cjs.bytes`**, then the cheap local HTTP
preflight compared the served bytes byte-for-byte with that buffer and
checked every HTTP pin against `runtime-pins.json`. Production manifest
merge/normalization, `WineAssembly.loadFiles`, mounted save hashes and native
`*.sav` enumeration also passed **before allocation**.

This run's checkpoint URLs differ from the predecessor, so its correct
composition is **1,242 bytes**, SHA-256
`0ad7b68f80c4f8dec1cc9af0c21fb3211853beb3faf11571be571dba23916bc5`.
R/manifest-derived-pin.json and R/local-staging-validation.json retain proof.
All **523 staged providers**, including **432 tracked providers**, passed exact
source/media/helper checks. Differing current render providers were read from
published runtime Git `90c1fcfee91c4680877083e80498afcb73c9384d`; peer WIP was
excluded. Remote HTTP closure passed before Chrome, and all staged pins were
unchanged at termination. Executing guest/render module:
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.

Initial local missing-helper/pin-file preflight failures are retained. A
pre-runtime identification assertion expected `provisioned`, but the box had
already become `idle`; the exact identity observation is retained. The shell
continued file uploads, with no remote runtime started. The remote custody
lock was then armed before runtime startup and held throughout execution.
No second allocation or original was used.

## Restore and visible onward result

Both original input artifacts passed exact size/hash checks and ordinary
composed-manifest/HTTP/loadFiles/VFS loading, then native **Load a Game → sole
selected slot → OK** restored the stump/birch clearing:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,116 | `83214aa067f44b09bccfa2e819970b98bf73591e7ab1bae5ca4e00631374f5b4` |
| `game641d_6af0512b.sav` | 3,204,264 | `97228afbfa8dff1408e1272b7e1f8cd35df9e279e720c9be717fbb465abcfe4c` |

Fresh live counters were **6+0 / LIFE 24/35 / Gold 1532 / Food 78 /
MANA 25/25**, with the flask present. The route passed right of the original
rock, checked a northern sandy bend against a tree wall, followed the eastern
and southern forest edge to a new fork, then its northeast corridor to the
wooden palisade. Crossing its gap exposed the NPC enclosure. Every ground
pulse was 2,000 ms or less and followed personal review of the current PNG.
Independent UP was armed before DOWN. Panels were never treated as pause.

The first robed-figure interaction did not open dialogue while earlier walking
continued; passive settling and a distinct freshly reviewed position preceded
the second click, which also opened no dialogue. No attack input, vial use,
name, quest acceptance or conversation success is claimed. Final actual live
counters were **6+0 / LIFE 24/35 / Gold 1532 / Food 70 / MANA 25/25**.
R/onward-review.json records commands, terrain decisions and PNG hashes.

Useful retained images:

- R/review/restored-live-counters.png: earned slot restored live.
- R/review/palisade-interior-west-after.png: robed NPC inside the enclosure.
- R/review/new-npc-route-save-after.png: saved position and white-shirt NPC.
- R/review/saved-live-counters.png: final actual counters and retained flask.

## Preserved new native recovery

Native **Escape → Save a Game → New Save** returned to the enclosure.
Read-only VFS recovery at **11:14:27.812 UTC** preserved:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,124 | `8be3e3ab52047b4aeeeb5b9dff26e3eb193ab7eee317644a0a6e3a46f5007943` |
| `game641d_6af0595c.sav` | 3,204,264 | `097396b8f2c61282313f1c7c2ea12190ee843dbbc7c46b63a6a5edff20759607` |

R/new-save-recovery.json gives original native paths, local artifacts and the
recovery recipe. R/recovered/original/native-vfs-saves.json maps hash-named
binaries. The loaded `97228afb` save remains byte-identical, and both original
input artifacts are untouched. This newest enclosure slot has not been
reloaded. Restore it through the same ordinary composition/HTTP/VFS/native
load path, deriving and checking the composed-manifest pin before allocation.

## Custody, verification and delegated shutdown

Accepted actual-Worker, identity/staleness, native input, independent release,
sticky UNKNOWN and lifecycle/observer controls were reused after seven exact
reference hash checks. No heavy local runtime ran or held the local runtime
lock. Remote custody PID **5548** held `/tmp/wine-runtime.lock` before launcher
startup through runtime, recording process ancestry and PID/start-time identity.
The first drain check caught Node PID 6275 still alive immediately after
Browser.close; its failure is retained. A later independent check passed all
**68 registered processes**, confirmed custody exit/lock release, and scanned
all host processes for live Chrome, crashpad and Node. No runtime descendant
was exempted. The read-only observer and its control ancestry are documented;
its transport confirmed exit zero before normal stop.

Browser.close yielded Chrome **0 / no signal at 11:14:38.738 UTC**. Own launcher
and browser PIDs were absent, both server/debug endpoints closed, profile and
writer absent, and held inputs empty. R/final-audit.json passes **41 exact
command ACKs**, **zero UNKNOWN**, **36 independent pulses**, **104 trusted input
events** (32 balanced mouse pairs, four balanced key pairs and 32 moves), and
**41 PNG CRC/scanline decodes**. No original trap, Runtime exception, target
crash or guest-process exit was observed.

All **471 remote references / 104,176,677 bytes**, representing **388 unique
contents / 104,159,003 bytes**, were retrieved and independently SHA-256 checked
before normal stop. The custody history is included. Recovery records exact
Git, relevant binary diff, small owned helper patches and existing media
paths/hashes; no source tree/media archive was made. Two staged nonexecuting
helpers later changed locally for retrieval/audit; their exact staged recovery
recipe is R/staged-helper-recovery.json. Evidence containment and helper syntax
checks pass.

Sole fresh UUID-idempotent box **bx_evj3waq2** was created **10:56:55.483 UTC**,
with original expiry **11:22:54.648 UTC**. Independent observable watchdog and
normal-stop children were prearmed; watchdog deadline **11:21:55.492 UTC**,
browser deadline **11:19:54.480 UTC**. After retrieval and verification, normal
stop **stop_407d6b2b5f5e6c4e** completed **11:15:59.190 UTC**, `forced:false`,
error null. Final state **archived**, stopped **11:15:59.172 UTC**, expiry null.
Both lifecycle children exited zero; the supervisor has no remaining children.
Launch disk exceeded 5 GB. No old-box resume/delete, public deployment,
subworker, guest-memory write, private handler, forced scene, configuration,
clock or seed edit was used.

Only this note is committed; no production build is claimed. Next useful work:
restore the new enclosure slot, identify/interact with the nearby NPCs using
fresh settled targets, and continue from the gate. Full27, parity, audio and
FPS remain open.
