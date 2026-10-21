# Jedi Knight missing-payload diagnosis — 2026-10-21

**Blocked at the source-file contract; no localized emulator defect established.**
One ordinary traced replay reproduces 0 MB and Finish/exit 0 with no game
payload. The installer searches `C:\WebJedi\*.*`; the exact retained source
capture has no such directory. Its unchanged game originals are at `C:\`.
Returning failure for that absent directory is consistent with the mounted
filesystem. Changing lookup to return root files would hide the mismatch.
No production change, source-layout alteration, registry fabrication, original
patch, rebuild, bootstrap, second replay or game launch was performed.

## Minimized observed failure

`recovered/replay1/output.log` records:

* API #275189: `FindFirstFileA("C:\WebJedi\*.*", 0x00495e7c)`,
  ESP `0x074ff19c`, return PC `0x0042049d`, result `0xffffffff`.
  Frame chain starts `0x00420213, 0x004257de, 0x004210fb, 0x0041e403`.
  API #275192 retries the same operand, return PC `0x0042067f`, same failure.
* This precedes `Install Jedi Knight Demo      0 MB` (log line 1588).
* APIs #545488/#545491 repeat those failed searches during route progression.
* After `Copying files...`, APIs #809993/#809996 again search exactly that
  directory and fail. ESP is `0x074fe2e8`; return PCs remain
  `0x0042049d`/`0x0042067f`. The first frames are now
  `0x00420213, 0x0041b8a6, 0x0041a234, 0x00424288`.
* Separate sound probes for `C:\Gamedata\Mininstall\Res1hi.gob` and
  `Res1low.gob` also fail (APIs #544894/#545034). Those filenames are absent
  from the 39 originals; this task does not infer their required presence.

The unchanged `setup.ins` contains `WebJedi` at byte 0x4590 and `*.*` at
0x45ac. `controls.json` preserves surrounding raw bytes. This is an original
script operand, not a guessed host path. Runtime tracing uses existing
`--trace-fs`, filtered `--trace-api` and `--trace-stack` facilities.

The package's 39 local ZIP headers all have flat names; both historical
extractors recover those names and bytes. That verifies byte recovery, **not
the original self-extractor's directory semantics**. The package has data
outside compressed member bodies. This task has not decoded its outer layout
metadata or observed the outer self-extractor producing its source tree.
Consequently the upstream cause of the source-layout mismatch is unresolved;
an emulator defect cannot be responsibly inferred from these observations.
Resolving that would be broader source-layout recovery work, outside this
bounded emulator repair. No speculative rearrangement was tried.

## Controls and actual installation result

Nine read-only controls use exact-source `lib/filesystem.js` and the same 96
captured files, mounted at their retained paths with the runner's
`ensureParentDirs`/`setLazyFile` mechanism. All pass:
absent WebJedi with both `*.*` and `*`, both absent sound paths, and an absent
directory containing the basename `jedi.exe` return no match. Existing root
Jedi.exe (305664), JKDEMO.EXE (1388032), res1demo.gob (31326451), and
Linstall.bmp (50686) return their correct sizes. Root enumeration finds
Jedi.exe and no WebJedi directory. These controls do not create an installed
layout or alter the captured tree. A preliminary harness used nonexistent
`addFile`; its TypeError receipt is retained, then corrected to the runner's
real mounting API. No guest ran in that failed control.

Replay 1 ran 13:16:09–13:16:13 UTC, terminal 13:16:13.465Z, exit 0.
The driver verifies each expected page, captures it, then sends ordinary
renderer clicks. Actual licence Yes was `click:415:395` at batch 14611,
13:16:10.235Z, followed by Welcome; the prior authorization record remains
unchanged. README No was `click:354:277`; actual Finish was
`click:415:395`, batch 135129. The 0-MB and Setup Complete images were inspected.

The saved destination again contains only deisl1.isu (3659 bytes),
jedi knight demo readme.lnk (241), and uninstall jedi knight demo.lnk (205),
identical hashes to the predecessor. No installed Jedi.exe/JkDemo.exe/GOB,
startup, gameplay or input qualification. Setup completion is not installation.
There is no baseline-versus-fix result because no fix was justified.

## Provenance, recovery and handoff

Source `fe49a84e745015ecdbe752e028235924ef4324dc`, all 7403 tracked blobs
verified before/after, clean remote status. Canonical module reused unchanged:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
Prior canonical gates/build pass is reused from evidence commit
`866e4249818d27a8c2a4397008e577d552cfd3db`; no changed production source needs
new gates. All 39 originals, package SHA-256 and 97 capture entries verified
unchanged. Generated child contract remains `_ins0432._mp`, empty args,
`C:\` cwd, genuine INI and bootstrap registry.

Evidence archive: 839450 bytes, SHA-256
`122663afcec1d296b8c1a206e917c8af5a947f4b7369c4a03088b5f28b3c4c6e`.
It contains 56 sealed evidence files and a seal, with full trace, page/input
receipts, images, registry, controls, identities and recovery payloads.
`recovery-trees.json` maps all 104 output VFS files to exact source blobs,
unchanged originals or included content-addressed payloads. Use the predecessor
`restore.py` with this recovered directory to restore the observed failed tree;
do not treat it as an installed game. No duplicate original package was fetched.

Local run: `scratch/runs/20261021-jedi-missing-payload-diagnosis`.
Task branch: `task/jedi-missing-payload-diagnosis-oct21`; no main integration.
Tracked report: `docs/re-notes/jedi-missing-payload-20261021.md`; compact
archive, drivers and verification: `docs/reviews/jedi-missing-payload-diagnosis-20261021/`.
Run `python3 verify.py` there from this repository: 56 seals, 104 recovery
mappings, nine controls and six failed WebJedi API calls must pass.
The dashboard checker retains its existing Zuma outside-run containment error
and historical missing/invalid records. Jedi is unregistered; no unrelated
candidate result was fabricated.
Remote source `/home/user/jedi-current-main`, originals `/home/user/jedi-original`,
prior evidence `/home/user/jedi-evidence` are preserved. New remote evidence is
`/home/user/jedi-missing-payload-diagnosis` and its sibling `.tgz` archive.
Recovery completed 13:18:32Z, before 14:30 handoff.

Box **bx_723bg5h6 is left RUNNING**, API `idle`, health `ok`, expiry
**2026-10-21T14:51:37.859Z**. Postflight finds no guest/controller processes.
Coordinator owns shutdown and staging. No SSH, resume, new box, other worker,
public deployment, laptop/fleet action or shared WIP change.

Task allocation remains below 64 MiB. Admission was 3516649472 bytes free;
shared free space fell to about 2.81 GB during this 3.4-MB task, below the
floor-plus-600-MiB reserve (2915041280 bytes), still above the hard floor.
Only small evidence publication remains; no unrelated cleanup or heavy local
work is authorized. This is a handoff constraint, not an emulator finding.
