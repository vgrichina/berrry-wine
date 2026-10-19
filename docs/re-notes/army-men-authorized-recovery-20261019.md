# Army Men original demo recovery, 2026-10-19

User authorization `scratch/license-acceptance-authorization-20261018.json`
supersedes the old licence-decision hold. **Accepted in guest remains false.**
This checkpoint recovers original assets only; no Windows executable, emulator,
build or browser ran, and no input was delivered. Root owns runtime scheduling
and TODOS/STATUS. Other review holds and public deployment restrictions remain.

## Recovered original bytes

Evidence directory on this host:
`/home/user/wine-assembly/scratch/runs/20261019-army-men-authorized-recovery`.
Its `payload/` contains all 187 original files, 43,721,065 bytes. Each path,
size and SHA-256 equals the retained 20261015 acquisition manifest. Original
archive, wrapper, licence and readme are retained separately from Git.

Reproduce using the new acquisition-only script:

```
node tools/recover-army-men-authorized.js /home/user/wine-assembly NEW_ABSOLUTE_DIRECTORY
```

The script requires a new destination, verifies exact outer and inner hashes,
uses explicit embedded ZIP extraction, CRC-tests both layers, and verifies the
complete output set. It retains diagnostic logs and a receipt on failure.
The source is the original
`https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/a.zip`.

| Original | Bytes | SHA-256 |
| --- | ---: | --- |
| a.zip | 18,373,265 | dd1faca49d6e5adc0a3db58831039274930b468caa713f1c0fb4fe074754908f |
| a.exe ZIP wrapper | 18,418,688 | 5b0db6d109d49818ce617cd539451c73273f09a98f8089065b10107790777752 |
| SETUP.EXE (NE) | 59,904 | feb61b7f007c8857ca8ae3a2b9d951bae0a52218cba8896291c14ccc9a77593e |
| ArmymenDemo.exe | 770,560 | dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c |

Fresh admission was 2,849,222,656 bytes free; projected archive, extracted
allocation and evidence cost 89,351,825 bytes, in addition to the required
2 GiB +128 MiB reserve (2,281,701,376 bytes). Final free was 2,768,031,744.
This historical receipt is not the next allocation's admission. Syntax and
real recovery verification passed; no emulator compatibility claim follows.

## Next normal installer route, awaiting root runtime grant

1. Freshly pin current canonical wasm and all physical runtime sources plus
   these originals. Recheck free bytes after reserving outputs. Do not use the
   historical 937466db module pins or run the old controller unchanged.
2. Mount the original setup manifest under `C:\ARMYMEN`, empty arguments,
   cwd `C:\ARMYMEN`, original `SETUP.EXE`. Historical setup manifest is
   `scratch/runs/20261015-army-men-original-setup/docs/re-notes/army-men-setup-manifest.json`;
   preserve its case-collision duplicate handling. Use `--vfs-tree`,
   `--exe-guest-path=C:\ARMYMEN\SETUP.EXE`, `--args=`, `--no-build`,
   explicit current `--wasm`, `--no-threads`, `--capture-launch`,
   `--save-vfs`, `--reg-export`, bounded log and screenshot outputs.
3. The normal historical bootstrap generated `windows/temp/_ins576._mp`,
   648,704 bytes, SHA-256
   `48141f38085b79f09e6e34d6c835ca3fefe970141b6f8435cf70ee7046c028c0`.
   That generated file is currently absent. Capture it again through setup;
   inspect actual receipt/header, complete VFS and registry timing before a
   separately reviewed child replay. Historical handoff had empty args and
   cwd `c:\armymen`, 246 captured files. Do not invent this state or launch
   ArmymenDemo.exe to skip the installer. Prior bootstrap cleanup warning
   remains a known limitation even though it exited zero.
4. On the original child's freshly reviewed Welcome screen, normal Next was
   historically at `(415,394)` in 640x480. Re-observe before clicking. Wait at
   least five seconds after the genuine Software License Agreement appears:
   the old immediate capture had an incompletely painted text control.
   Inspect the fresh Yes control, send one ordinary mouse click and retain
   actual input receipt plus before/after evidence. Historical dialog has
   Yes control ID6, but this is identification only, not a direct command.
5. Stop at the next stable screen or first failure. Only a delivered click
   and observed guest transition establish acceptance. Installation, normal
   game launch and player control are later, separate proof stages.

Proposed first allocation is bootstrap only: 30s guest, 45s controller,
60s hard process-group deadline, 2 MiB log cap, 192 MiB output reserve,
fresh admission above 2 GiB +128 MiB after reserve, stop at 2 GiB +64 MiB.
This generates evidence for the child stage without granting an automatic
retry. All original/source/module hashes and owned group absence must be
checked on exit. Current runtime grant is still required.

Readme's later game controls are Numpad8 forward, Numpad2 backward, Numpad4/6
turn and Space/left mouse fire; it recommends Boot Camp first. These are
future gameplay criteria, not an authorized shortcut around normal setup.

## Root-granted current bootstrap result

One bootstrap ran on 2026-10-19 at 00:10:41–00:10:42 UTC with current root
HEAD `3be2f9678cf5f1fb20b362cabbebdc38bf68692e`, canonical module
`93818216116a49fbc2b52074a80254d5f8aebdef753b7f22b34d90be84c323c6`.
The new `tools/army-men-authorized-bootstrap.js` records the actual bounded
command and physical pins; the exact executed copy is retained as controller.js.
It used all 187 safe case-unique original mounts (no duplicates existed in
this manifest) and original NE header offset3584. No original bytes changed.

The normal WinExec/ShellExecute handoff produced the expected `_ins576._mp`,
648,704 bytes, SHA-256 `48141f38085b79f09e6e34d6c835ca3fefe970141b6f8435cf70ee7046c028c0`,
PE i386, header offset128. Actual receipt gives empty args, cwd `c:\armymen`,
guestExe `c:\windows\temp\_ins576._mp`, and 246 files. Capture directory
contains these 246 files plus launch.json. Full final VFS has 246 files.
Registry export SHA-256 is
`46ff1eea835bb0633ae74b5bb23a4f22c625f8bcda53a76d9c50bdcd5ad2ea3e`;
it is end-of-bootstrap state, not an asserted launch-time registry snapshot.
The genuine child was **not launched**. No guest input or acceptance occurred.

Exit0, no signal or guard; output log79,059 bytes. All 3,224 physical runtime
pins, original/mounted files and canonical wasm remained unchanged. Owned
process group was absent. The historical `thread 1 window cleanup failed:
unreachable` warning recurred and is preserved; exit0 is not installation
success. Reviewed final640x480 PNG is uniformly teal, with no installer UI
or gameplay. No runtime retry was made.

Admission free2,765,135,872 minus192MiB output reserve exceeded2GiB+128MiB.
Controller's sampled minimum was2,765,103,104 before rapid final exports;
independent postcapture free2,671,403,008 is the later disk reading. Both are
retained rather than representing the sampled minimum as a full-run floor.
Output allocation including hardlinked mounts was132MiB, below192MiB.

Evidence is `scratch/runs/20261019-army-men-authorized-bootstrap/`: original
manifest, physical pins, executed controller, launch/terminal receipts, full
log, registry, capture and finalVFS, reviewed PNG and capture-review.json with
every captured/final path hash. No candidate result is fabricated for this
unregistered game. Next requires root review and a separate child allocation;
use the newly captured original child and exact receipt, not the absent old
remote tree. The prior licence authorization remains valid for the later
ordinary visible Yes action.

## Authorized child licence accepted; stopped at destination

Root independently checked all247 capture entries and prior process absence,
then granted one90/105/120-second child allocation with4MiB log/192MiB output
bounds. On2026-10-19 00:15:20–00:16:09 UTC, the exact captured child ran with
empty args, cwd `c:\armymen`, all246 captured VFS files and the authentic
end-of-bootstrap registry. Actual HEAD was
`afba00f721802b6e125979d8d32b32b4edea5665`; canonical module remained93818216
as pinned above. The preflight's inherited mountFiles187/setupHeader fields
describe the original bootstrap provenance; the actual child mount is246
files, as controller.js and the complete artifact seal show.

Fresh Welcome was visually reviewed. Ordinary Next `(415,394)` was delivered
at batch1435052. After a5.5-second settling wait the captured populated
Software License Agreement visibly identified The3DO Company / Army Men Demo.
The normal **Yes** button at `(415,394)` was clicked once at batch2606714;
the reviewed after image shows **Choose Destination Location**. **Army Men
acceptedInGuest is now true.** The next destination Next was not clicked.
The controller was quit normally there; installation and gameplay remain
unattempted. No silent install, direct command, memory edit or game bypass.

The first attempted ctl command used unsupported verb `click:415:394` and
was rejected locally, without guest input. Correct `click 415,394` then
delivered Next once. Both actual normal clicks are recorded in input receipts
and full guest log. `acceptance.json` records the reviewed guest transition
and explicitly supersedes the automatic false default in raw postflight.json;
that initial controller field was not a review of guest state. The committed
controller now leaves acceptance null pending review. Its executed copy is
retained unchanged in evidence, and it was not rerun for this metadata fix.

Exit0, no signal/guard; owned process group absent, all3224runtime pins,
187 originals, captured mounts/original capture and wasm unchanged. No child
cleanup warning or crash was found; the bootstrap warning remains separately
preserved. Admission2,667,089,920 minus201,326,592 reserve exceeded required
2,281,701,376. Minimum including final free sample was2,615,853,056.
Log55,175 bytes. Final VFS and registry were exported, but registry SHA is
unchanged from bootstrap: the observed acceptance is **not proof of persistent
acceptance after restart**. A new process may show the terms again.

Evidence `scratch/runs/20261019-army-men-authorized-child/` preserves reviewed
welcome/licence/after/final PNGs, both delivered input receipts, full log,
physical/original pins, exact executed controller, final VFS and registry,
acceptance.json and521-artifact hash seal (the seal itself is the522nd file).
Original licence SHA-256:
`a3befa2602aa870d65fd059a14619590684e803b56bc66820529da1f76512dfa`.
Runtime released for root scheduling. No installation/gameplay claim.

## Prepared next installation allocation (not granted or run)

The saved VFS/registry does not preserve the live Choose Destination dialog.
Restart the authentic captured installer child from the reviewed bootstrap
receipt, re-observe Welcome, click normal Next, wait for populated terms, then
select the still-authorized ordinary Yes again. Observe destination anew and
use its default location through normal Next; inspect each later setup-type,
program-folder or DirectX choice before any action. Do not invent its sequence
or paths from the truncated destination label. Stop at first failure or the
completed installer/normal launch offer. Do not automatically launch the game.
If setup itself starts a new process, capture that original handoff for review.

Measured original payload43,721,065 bytes, current child input45,748,330 bytes,
post-licence VFS47,995,155 bytes. A conservative prospective complete VFS adds
another full original payload (about92MB). Budget two such exports (finalVFS
and possible captured handoff), conservatively charge45.75MB for the hardlinked
input mount, and allow16MiB for logs/screens/metadata: about246MB total.
Propose **256MiB output reserve**,4MiB log cap, same90/105/120s bounds and
2GiB+128MiB admission after reserve /2GiB+64MiB stop. This is a bounded
planning estimate, not an asserted installer expansion size; actual growth
must be monitored and stopped at the cap. No payload/build copies are needed.
Fresh source-time free2,614,083,584 minus268,435,456 reserve gave2,345,648,128,
only63,946,752 above admission. Recheck on grant; any shortfall stops before
guest launch and is not permission to lower the reserve or delete evidence.
