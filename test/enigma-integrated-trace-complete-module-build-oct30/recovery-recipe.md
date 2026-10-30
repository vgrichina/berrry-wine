# Recovery

Candidate: `0398b45f47717da0f178779a34bc54aa0ef0ec53`.
Branch: `task/enigma-integrated-trace-complete-module-build-oct30`.
Root completion-receipt.json records the exact verified published commit.

The task snapshot on `bx_6gnt49q9` retains `/home/user/enigma-complete`, including
complete.wasm, module-inventory.json, all 147 pinned sources, compiler files,
source-pins.json, artifact-manifest.json, harness and supervisor. The initial
archive was 3,832,701 bytes, SHA256
`a739b3eebe68d3e370ee07c3471fc0114ddb29c516f02faab3da3ac35bfa0180`.
Native Boat API transfers used at most 49,152 decoded bytes per chunk.
No mounts or guest runner argv were used; input-preflight.json enumerates every
archive path. No checkout or root/donor Git mutation was performed.

To reproduce on a separately authorized fresh box, materialize every exact pin
from source-pins.json, verify all lengths/hashes, copy qualification.js and
remote-supervisor.py to `/home/user/enigma-complete`, and execute there:

```
/usr/bin/python3 -B remote-supervisor.py startup
/usr/bin/python3 -B remote-supervisor.py compile
/usr/bin/python3 -B remote-supervisor.py instantiate
```

Use only supported native Boat API exec. No installs, SSH or historical WAT
transforms. Node executable is `/home/user/.nvm/versions/node/v24.22.1/bin/node`,
heap flag `--max-old-space-size=3072`. Supervisor requires original unlimited
DATA/AS, available RAM >=2GiB+4352MiB projection, disk128MiB including16MiB
reserve, groupRSS4096MiB, parentRSS256MiB, CPU180s, wall300s, file64MiB,
capture64KiB. The old-space setting is not a total physical memory limit.
Startup records the exact Node/V8/flags/inherited limits and shared memory test.

Local commands enter original-parent ops.py / limit_contract.py, keeping
parent/Python DATA128MiB, Git-only DATA256MiB, groupRSS512MiB, parentRSS128MiB,
CPU60s, wall90s, file12MiB, capture512KiB, allocation64MiB including8MiB reserve,
and evidence1MiB. Native Boat CLI retains its original inherited DATA limit.
The streaming index-closure.py gate uses the same limits and checks the complete
index rather than unrelated full history.

Publication uses only the task branch and strict SSH:
`ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes`.
No force push or main integration. Root recovery.patch preserves the committed
change; messageboard-note.txt is for coordinator append because the shared board
exceeds the worker file cap. Publication reserve remains until coordinator
closeout. The coordinator owns later allocations; do not resume this stopped
box without a new authorization.
