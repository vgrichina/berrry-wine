# Conan 2004 demo: original installer recovery

Task: `NEW-GAME-CONAN-DEMO-20261010`. Availability checked 2026-10-19
03:16–03:18 UTC from source checkout `6d98feb01924f766b8d72fc8d656c0ab9c20f11c`.

The user's 2026-10-18 authorization permits ordinary Accept/Yes for Conan.
`scratch/license-acceptance-authorization-20261018.json` and its durable
`docs/` copy explicitly include this task. Actual guest acceptance has not
been observed; installation and gameplay are unqualified. The historical
instruction not to answer acceptance is superseded by this authorization.

## Availability and evidence

The recorded original is
`test/binaries/win98-games-a-d/Conan cauldron-DX9-D3D/ConanPC-Demo.exe`.
It is absent at that path in `/home/user/wine-assembly` locally and on
`bx_rqnkhrnr` (read-only command `cmd_0dponcufriga`). A filename inventory
under remote `/home/user` and `/tmp` found no Conan or `0803Z` names
(`cmd_rzi9zjm6ch7l`, exit 0, empty output). Local filename inventory likewise
found no original or capture. This does not establish absence inside archives.
There is no Conan candidate manifest entry in this source revision.

The append-only board records original staging and SHA verification on
`bx_hx8msa33` at 2026-10-10 07:59, followed by ordinary language, welcome,
and destination inputs reaching an EULA with I Reject selected at 08:03.
Historical evidence ID: `20261010T0803Z-conan-destination`. The actual SHA,
size, remote absolute source path, controller, and capture bytes have not
been recovered; do not substitute guessed values or current build identity.

`boat --json info bx_hx8msa33` reports stopped, healthy, snapshot available,
snapshot completed and verified `2026-10-10T21:59:36.229Z`, and no pending
wipe. CLI history can read stored command metadata while stopped, but its
latest 100 command records only reach 20:57 that day. A direct `/commands`
pagination GET with the existing wine-ops API key returned HTTP 403 and was
not retried through another route or credential.

After coordinator authorization for recovery-only resume, the normal
`boat --json resume bx_hx8msa33` command returned exit 1 / HTTP 403:
`api_key_action_forbidden`: `This API key cannot perform sandbox.resume.`
No alternate route was attempted. The sandbox was not resumed, no files
were transferred, and no guest, browser, or build ran. This enforced access
restriction is the immediate blocker, independent of license authorization.

## Owner-directed replacement, 2026-11-05

The restriction above is a historical observation, not a prerequisite to ask
the owner to change access. The owner directed fresh boxes instead of retrying
stopped boxes that return `403 api_key_action_forbidden`. Old `bx_hx8msa33`
is superseded and must remain untouched; do not resume or delete it.

Replacement `bx_wnnajw2r` was created with a persisted UUID Idempotency-Key.
Its setup command `cmd_yhu8kz94cuqx` completed successfully at
2026-11-05T10:26:25.739Z. This verifies preparation command access only.
The retained final state records normal stop at 10:26:47.081Z and a verified
snapshot at 10:26:47.045Z. Evidence is in
`scratch/runs/20261105-owner-fresh-runtime/conan-{request,create,setup,setup-receipt,state}.json`.
No installer, acceptance or gameplay was run on this replacement.

The current blocker is reconstruction of the original installer and supporting
inputs, followed by an eligible worker/runtime slot. The historical original
size and SHA-256 remain unknown. A similarly named public demo cannot be
claimed to match that fixture without evidence.

## Recovery and execution prerequisites

1. Recover original identity from retained local evidence or old-box files
   only if reachable without resume. Do not retry denied pagination or use
   substitute credentials. Preserve old boxes. Record actual source, size and
   SHA-256; distinguish any newly sourced demo from the unknown historical pin.
2. Reconstruct from the repository, recorded fixture hashes and small specific
   inputs. Reference existing media by path and hash; do not copy media into
   every run or archive the source tree. Use the prepared replacement when
   permitted. If another stopped-box resume returns 403, follow the owner's
   fresh-box procedure with a persisted UUID Idempotency-Key. Fork only when
   installed state is required and permitted. Stop each new box promptly after
   its run and evidence retrieval; never delete the superseded old box.
3. Prepare an isolated immutable stage with a coherent source/module pair.
   Audit the selected runner's full boot closure: SYSTEM_DATA_FILES including
   stdole type libraries, bitmap fonts including Terminal.fon, substitution
   font map and referenced fonts, and the actual app manifest and every mount.
   Reuse the qualified boot-closure checker with its matching source; do not
   infer completeness from an installer file existing. Preserve originals.
4. Obtain the coordinator's sole-runtime allocation. Use a bounded controller
   with deadline, disk floor, output caps, process-group cleanup, lease and
   source/hash verification. Reconstruct ordinary language/welcome/destination
   inputs from recovered evidence, observe the actual EULA, then select the
   authorized Accept/Yes control normally. Never patch around the installer.
5. Capture actual acceptance and installed-file inventory separately. Register
   the real installed executable only after identifying it. Original launch,
   player-controlled gameplay, and inspected screenshot remain required;
   an installer frame does not establish gameplay. Use distinct run folders
   and publish result metadata last after artifact verification. No public
   deployment is authorized by this task.

No code changed and no runtime tests ran. Validation for this checkpoint is
read-only availability inspection, current task/authorization reconciliation,
document review, and `git diff --check`.
