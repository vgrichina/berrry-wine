# Darkstone pickup onward: prebrowser manifest-pin blocker, 2026-11-08

The sole fresh attempt stopped **before Chrome or Darkstone launched**. No
native load, movement, attack, vial consumption, new gameplay consequence or
production repair is claimed. The earned six-victory/red-vial save remains
untouched. This task's onward objective is unfinished.

Evidence is ignored `scratch/runs/20261108-darkstone-pickup-onward/` (R).
Predecessor: [western junction and pickup](darkstone-western-junction-20261108.md),
`a499001da`.

## Concrete failure and recovery

I replaced the predecessor's save pair in the run-local composed manifest but
failed to regenerate its inherited HTTP pin. The ordinary production
manifest merge/normalization, HTTP resolution, `WineAssembly.loadFiles`, VFS
mounted hashes and native `*.sav` enumeration all passed locally. Those checks
did not compare the composed manifest itself to `runtime-pins.json.httpPins`.
The remote browser helper checked that pin before spawning Chrome and refused
the changed manifest at **10:50:38.332 UTC**:

| Composed manifest | Bytes | SHA-256 |
| --- | ---: | --- |
| Inherited expected pin | 1,244 | `9175ef936df999fb4e15a02293fbdf57195d4830b933927eb8a4d092ff28837f` |
| Actual new composition | 1,238 | `1b2d53e25b6c1db5b63c7acb311d019464fcbacf1a64987ff7538bbd8fbf9e26` |

R/recovered/original/first-browser-failure.json and served.jsonl retain the
original refusal. A separate local recomputation matched the observed actual
hash exactly; R/corrected-http-pin-recovery.json records the corrected pin and
recipe. The launched pin manifest is preserved unchanged. No second original
or replay was attempted. This is my run-local staging error, not a demonstrated
production integration defect.

Next attempt: derive the composed-manifest HTTP pin directly from
`provision.cjs.bytes`, compare it during the cheap local HTTP/VFS preflight
**before allocation**, then perform the original native Load a Game → slot → OK
and personally reviewed ground route past the rock. Retain the existing input,
identity, independent UP, sticky UNKNOWN and lifecycle controls.

## Earned save preserved

Both predecessor artifacts and the small checkpoint inputs still match:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,116 | `83214aa067f44b09bccfa2e819970b98bf73591e7ab1bae5ca4e00631374f5b4` |
| `game641d_6af0512b.sav` | 3,204,264 | `97228afbfa8dff1408e1272b7e1f8cd35df9e279e720c9be717fbb465abcfe4c` |

R/checkpoint-provenance.json and R/preserved-save-recovery.json give original
native paths and exact artifact references. The slot has not been reloaded in
this attempt. The supplied accepted state remains 6+0, LIFE 24/35, Gold 1532,
Food 78, MANA 25/25, red vial in first quickslot, unconsumed; no fresh live-state
claim is made.

## Custody, checks and shutdown

The **523 staged file pins**, including **432 tracked files**, matched published
runtime commit `90c1fcfee91c4680877083e80498afcb73c9384d`. Committed blobs were
read directly from Git when the shared checkout differed; peer WIP was excluded.
Source recovery records exact Git, relevant binary diff, small helper patches
and existing media path/hash references. No source/media archive was created.
Accepted controls were reused after seven exact reference hash checks. No local
heavy runtime ran or held the local runtime lock. The sole remote launcher used
its own `flock -n /tmp/wine-runtime.lock`.

The independent observable 25-minute watchdog and normal-stop children were
armed before the one UUID-idempotent allocation. Box **bx_sj45adzn** was created
**10:48:30.126 UTC**, with original expiry **11:14:29.963 UTC** and watchdog
**11:13:30.137 UTC**. All **11 remote artifact references** were retrieved and
independently SHA-256 checked before requesting normal stop. Terminal custody
proved the launcher absent, no live owned Node/Chrome process, no Chrome
process record or endpoint ever created, no profile/writer/commands/held inputs,
and the remote runtime lock free. Thus there were no browser-owned ports,
profiles, descendants or native inputs to drain.

Normal stop **stop_db4c6fe2ac0b304a** completed **10:51:17.146 UTC**,
`forced:false`, error null. Final state **archived**, stopped
**10:51:17.128 UTC**, expiry null. Both lifecycle children exited zero and the
supervisor has no remaining children. Launch disk was 12 GB free. Initial local
provision-helper indentation failures occurred before uploads, were retained,
and were corrected with Python syntax checks; they were not guest failures.

Only this note is committed. No production code changed; no code build is
claimed. Full27, parity, audio and FPS remain open.
