# Recovery recipe

Base:c1ec0a3055f3d1d628fe7324f9715fabee21a0d8.
Tree:622e343cabbfb0f815b5feb29b338ced9bed2920.
Branch:task/madbomber-full-module-callback-evidence-independent-accept-oct30.
Changes only under test/madbomber-full-module-callback-evidence-independent-accept-oct30/.
Root completion-receipt.json gives exact final commit/remote SHA/recovery.patch
SHA. Recover published branch or apply root recovery.patch to pinned base in
a fresh owned checkout. Verify all input-pins.json entries unchanged.

Original owned root:
 /tmp/madbomber-full-module-callback-evidence-independent-accept-oct30
Repo is root/repo. All commands below require that explicit cwd.
Use original-parent /usr/bin/python3 ../ops.py and unchanged limit_contract.py,
pins in provenance.json. No ancestor DATA cap. Preserve24MiB physical task
allocation including8MiB reserve, evidence<=1MiB, every admission/resource guard.
Do not relocate the wrapper without a new validated allocation.

 /usr/bin/python3 ../ops.py recovery-startup /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=192 test/madbomber-full-module-callback-evidence-independent-accept-oct30/check.js startup
 /usr/bin/python3 ../ops.py recovery-check /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=192 test/madbomber-full-module-callback-evidence-independent-accept-oct30/check.js check

Reuse passing groups; rerun only for new changes/concerns. Startup receipt
applies only to unchanged executable/flags/environment/limits. Node keeps
original DATA/AS; Git-only DATA256 must not propagate. Inspect startup.json,
results.json and supervisor receipts. These are evidence/oracle controls, not
production replay. ECX/EDX/flags counterexample must remain accepted by original
oracle; do not “repair” copied assertions to hide it.

Git uses ops.py git mode and exact strict SSH:
 ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes
Verify ls-remote refs/heads/task/madbomber-full-module-callback-evidence-independent-accept-oct30
equals exact final commit. No credential exposure, trust edits, force push or
main integration. Board note is coordinator append; no oversized board access.

Full module/archive/inventory remain remote-only; hashes in report/manifest
do not authorize retrieval, compile or replay. Boat bx_3ckx3mvs remains stopped,
snapshot2026-10-30T02:30:38.704Z, original expiry02:50:23.495Z. Coordinator owns
future lifecycle decisions. Keep publication reserve until coordinator closeout.
