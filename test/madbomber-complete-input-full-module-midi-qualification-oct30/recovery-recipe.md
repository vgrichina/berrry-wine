# Recovery and reproduction

Base: `dc22b2b38624da40b2dcec29c76bfb986ae03a35`.
Task branch: `task/madbomber-complete-input-full-module-midi-qualification-oct30`.
Root completion receipt records the verified published commit.

Use `source-pins.json` for all 143 exact paths, lengths and SHA256s. Materialize
those paths from the pinned base into a fresh owned directory, verify every pin,
then copy this directory's qualification.js, lifecycle.js and
remote-supervisor.py to that root. Do not transform the WAT closure.

Original transferred archive: 3,758,313 bytes, SHA256
`d5af048c35258b4906cc63b28350a4c314d8f4fddb0a72d87f051b587793b5e1`.
It contains the initial compile harness; the final qualification/lifecycle
harnesses were subsequently transferred separately and are pinned by the artifact
manifest. All API transfer payload chunks were at most 49,152 decoded bytes.
No guest-runner mounts were used; mount argv is empty. The preflight enumerates
every intended archive filename, so no comma-delimited guest mount parser was
applicable. No checkout was performed: the coordinator supplied the born branch.

Retained remote root: `/home/user/madbomber-midi` on `bx_3ckx3mvs`.
Stop operation: `stop_eafd43bc72d6f7da`, completed, not forced.
Snapshot completed and verified: `2026-10-30T02:30:38.704Z`.
Original finite expiry: `2026-10-30T02:50:23.495Z`; snapshot retention is subject
to Boat's retention policy. The coordinator owns any later allocation decision.

Execution commands on a separately authorized suitable box, explicit cwd equal
to the source root (the supervisor ROOT and executable pin must be reconciled
if the path changes):

```
/usr/bin/python3 -B remote-supervisor.py startup
/usr/bin/python3 -B remote-supervisor.py compile
/usr/bin/python3 -B remote-supervisor.py lifecycle
```

Node is `/home/user/.nvm/versions/node/v24.22.1/bin/node`, with
`--max-old-space-size=3072`; no installs were performed. Require unlimited
inherited Node DATA/AS, CPU180s, wall300s, file64MiB, capture64KiB, parentRSS256MiB,
groupRSS4096MiB, physical disk128MiB including the16MiB reserve, available2GiB
floor plus4352MiB peak projection. Old-space is not total RSS. Supervisors check
the physical limits separately. Keep the same configuration after startup.

Local original-parent entry is task `ops.py`, with `limit_contract.py`; Git
DATA256MiB applies only to Git, parent/Python DATA128MiB, groupRSS512MiB,
parentRSS128MiB, CPU60s/wall90s, file12MiB, capture512KiB, task64MiB including
8MiB reserve, evidence1MiB. The supervisor's only extension dispatches the
streaming index check in `index-closure.py`; it retains admission, cwd identity,
per-Git limits, group/parent RSS, wall and output controls. Original and extended
supervisor hashes are recorded in the root receipt. Never use history fsck as a
substitute for required index object availability.

All publication commands use:
`GIT_SSH_COMMAND="ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes"`.
Push only the task branch; verify `ls-remote` equals the exact commit. Do not
force-push, alter trust files, or integrate main. Root `recovery.patch` preserves
the staged change. Root `messageboard-note.txt` is for coordinator append because
the shared board exceeds the worker file cap. Keep the publication reserve until
coordinator closeout.
