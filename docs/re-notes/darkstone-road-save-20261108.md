# Darkstone: onward road checkpoint saved and recovered

Completed native **Save a Game → New Save** at a reviewed forest-road position
beyond the nine-victory source clearing. The new exact continuation pair was
recovered read-only from the live VFS, retrieved to this run's unique directory,
and independently hashed before normal shutdown. This preserves useful onward
progress; it does not exceed the predecessor's unsaved ruined-wall exploration.
No named entrance or area transition was established.

Evidence: ignored `scratch/runs/20261108-darkstone-road-save/` (R).
Predecessor: [nine-onward route](darkstone-nine-onward-20261108.md), `8d9854780`.
No production source changed; no production build or generic repair is claimed.

## Reviewed gameplay and early native save

The untouched hollow-onward recovery pair was verified before allocation:
`characters.lpl` 1,342,164 bytes, SHA-256
`ba2c2c5fcbe8111c8ece302a3020c9ebe0793d2d0789b0a208b7bc388b7f74ea`;
`game641d_6af070ba.sav` 3,204,341 bytes, SHA-256
`b56122d3ed4552f35c0e0df4cd1785d2d43b4fbedfcff8226d1792a05334c235`.
Both source artifacts and staged input copies remain byte-identical. The loaded
old SAV also remained byte-identical in the recovered VFS.

Personally reviewed R/review captures:

- `native-nine-slot.png`: sole native Load preview matches the source clearing,
  hollow lower-left, road above, and red vial. Ordinary native OK restored it.
- `restored-live-drained.png`: live clearing, buttons zero and queue EMPTY before
  movement; the preceding loading capture was not treated as a settled load.
- `road-joined.png`, `road-east-bend.png`, `forest-road-turn.png`,
  `road-lower-stretch.png`: four individually reviewed ground targets followed
  the pale road away from the hollow and around the forest bend. Each hold was
  2,000 ms with independently armed UP. No blind replay, human attack, or hostile
  input occurred. The retained map/route was reviewed to avoid the wooded deadend;
  this run finalized before reaching that junction.
- `native-save-menu.png`, `native-new-save-choice.png`: ordinary Escape then
  Save a Game, with the actual New Save choice reviewed before clicking it.
- `new-road-save-world.png`: native New Save returned to the road scene.
  `saved-road-counters.png` shows **9+0 victories / LIFE 19/35 / MANA 25/25 /
  Gold 1532 / Food 57**, with the red vial retained. `saved-road-final.png`
  records the closed panel before runtime completion.

Runtime began **13:39:00.021 UTC**. New Save DOWN/independent UP acknowledged
**13:42:16.655 / 13:42:16.755**; read-only VFS recovery completed
**13:42:32.354**. Thus finalization and recovery completed within four minutes,
well before the minute-ten latest start and unchanged **14:01:00.965** browser
cap. The prior run's UNKNOWN command was never replayed. Panels were not assumed
to pause gameplay. No private handler, guest write, forced scene, configuration,
clock or seed change was used. No red vial use occurred.

## Exact continuation recovery

R/new-save-recovery.json maps native paths to unique local artifacts:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\\dsave\\characters\\characters.lpl` | 1,342,172 | `b9c9a3afaadb5b7e56d879a156cd9d63cf5e67f4fd2fb68a9ce6580d008b4a43` |
| `c:\\dsave\\games\\game641d_6af07c38.sav` | 3,204,341 | `f046038cf1cde4e1f1f2cfc012b260ca8599e4738cca907083d067b3fc316489` |

The two artifacts are R/recovered/original/native-vfs-<SHA-256>.bin.
Restore by checking these sizes/hashes and mounting this updated character index
and new SAV at their exact native paths through ordinary composed manifest,
HTTP, `WineAssembly.loadFiles`, VFS and native Load a Game. A second load was
not performed; the claim is completed native save plus recovered continuation.
The original pair remains the fallback and was not overwritten.

## Providers, verification and shutdown

Pre-allocation checks passed for **533 exact executing pins**, retaining production
source `90c1fcfee91c4680877083e80498afcb73c9384d` and original module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
R/provider-recovery.json supplies the ignored modules without a Git fallback for
ignored binaries or shared binary overwrite. Seven accepted controls, native
hover, startup queue and subreaper/reaper were reused without standalone reruns.
Helper syntax checks passed. Peer WIP was excluded from executing providers.

R/manifest-derived-pin.json derives the new HTTP pin directly from
`provision.bytes`: **1,230 bytes**, SHA-256
`2e717fa173084fa2ea40ea15e23119fadbe768185fccd7c88c043379cb49e531`.
Actual production `loadFiles`, normal manifest resolution, VFS hashes and native
SAV enumeration passed before allocation. All executing remote pins passed before
Chrome and remained unchanged at exit. R/source-head.txt records checkout
`807e003e236c0bfe887b070a191efb0651113753`; source-recovery, relevant binary diffs,
small owned helper patches and existing media path/hash references are retained.
No source archive, repeated media bundle or peer WIP was staged.

One UUID-idempotent box **bx_5g5a9sn2** was identified before runtime. Its remote
lock/subreaper covered provisioning through runtime and descendant drain. Local
wine-runtime.lock was never held. Launch free disk exceeded 5 GB. All **29 exact
PID/start identities**, parents/descendants/adopted custody included, drained;
endpoints and ports closed, profile/writer absent, held input empty, remote lock
free and observer transport exited zero before stop. No descendant exemption.
Local supervisor, normal-stop and watchdog PIDs also exited.

R/final-audit.json passed: **14 command ACKs, zero UNKNOWN, 11 independent pulses,
30 trusted balanced native events, 14 PNG CRC/scanline decodes**; no guest trap,
exception or guest process exit. All **183 references / 129,751,032 bytes**,
representing **155 unique contents / 129,738,571 bytes**, were retrieved and
independently reread/hash-verified before stop. Earlier evidence remains retained.

The observable independent 25-minute watchdog was armed before allocation;
overall/cleanup deadlines stayed immutable. Explicit ordinary browser completion
preceded delegated normal box stop **stop_e60beedc38fa9e04**, completed
**13:43:53.180 UTC**, `forced:false`, error null. Final box state **archived**,
stopped **13:43:53.163**, expiry null; R/stop-receipt.json confirms it. Normal and
watchdog exited zero; supervisor children empty. No old-box resume, deletion,
public deployment, second original or subworker.

Next: load the recovered new road pair, follow the retained lower-road route at
the large-tree junction toward broken stone walls, review native identification,
and preserve the next useful consequence early. Full27, parity, audio and FPS
remain open. Single-task worker stops after publication.
