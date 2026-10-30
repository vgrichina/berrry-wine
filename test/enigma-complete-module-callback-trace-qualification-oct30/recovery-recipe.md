# Recovery recipe

Candidate: `207d55bed24c2ef1cd822a0d365b20207359cb14`.
Branch: `task/enigma-complete-module-callback-trace-qualification-oct30`.
The owned root completion-receipt.json records the verified publication SHA.

Task Boat `bx_nqv2gv7d` retains `/home/user/enigma-complete`: complete.wasm,
module-inventory.json, all165 pinned sources, source-pins.json, corrected
callback.js, qualification.js, remote-supervisor.py, synthetic-midi.exe,
runtime reports, initial inputs.tar.gz and first-fixture-failure.json.
Original finite expiry: 2026-10-30T03:22:24.662Z. The worker has explicit
snapshot-stop delegation; final stopped/snapshot state is recorded separately.
Do not resume this box without new authorization. Snapshot retention is14days.

To reproduce on a separately authorized fresh large-RAM Boat, materialize every
source-pins.json path with its exact bytes/hash, then copy the corrected
callback.js, qualification.js, remote-supervisor.py and source-pins.json from
this directory into `/home/user/enigma-complete`. The harness runs from that
directory, not its repository test subdirectory. Preserve all pinned lib/src
and compiler relative paths. Check the128recursive include closure and all165
source pins before provisioning and remotely before compilation. No Git checkout,
SSH transfer, installs, extraction of functions or historical transforms.

Execute only with authorized native Boat API exec, working directory explicit:

```
/usr/bin/python3 -B remote-supervisor.py startup
/usr/bin/python3 -B remote-supervisor.py compile
/usr/bin/python3 -B remote-supervisor.py callback
```

Node is `/home/user/.nvm/versions/node/v24.22.1/bin/node`, heap flag
`--max-old-space-size=3072`; successful startup checks Node24, V8 and shared
memory and records actual inherited limits. The same executable/flags/env/limits
configuration is reused. Original Node DATA and AS remain under inherited hard
limits; Git limits never apply to Node. Remote supervisor: parentDATA256MiB,
parentRSS256MiB, groupRSS4096MiB, CPU180s, wall300s, file64MiB,capture64KiB;
allocation128MiB including16MiB reserve, available RAM>=2GiB+4352MiB projection.
The old-space flag is not a total process memory limit. The module and inventory
hashes/lengths are pinned in artifact-manifest.json; those binaries stay remote.

Local operations use original-parent ops.py/limit_contract.py: parent and
Python DATA128MiB, Git-only DATA256MiB, Node DATA exemption for original limits,
Nodeheap192MiB if local Node is needed (none was), groupRSS512MiB,
parentRSS128MiB,CPU60s,wall90s,file12MiB,capture512KiB. Task allocation64MiB
includes8MiB publication reserve; evidence<=1MiB. Keep the reserve through
coordinator closeout. No local heavy compile. Native API chunks<=64KiB;
the archive used49152decoded bytes per chunk. Large payload argv evidence is
stored as exact SHA256/byte count to avoid duplicating base64 in the evidence
budget; subprocess args and every enforcement guard remain unchanged.

Initial reference lifecycle recipe was separately pinned SHA256
`60db59885a27d90664af20f1ecb8fd93e8a741f4f107355b572e28ca020dd4c9`.
Only its minimal PE/host setup was adapted. Final callback.js is independently
pinned in artifact-manifest.json. The initial archive contains the uncorrected
fixture; overlay the committed corrected callback.js before executing it.

Publication uses task ops.py and strict SSH:
`ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes`.
Verify exact remote task-branch SHA; no force push/main integration. The root
recovery.patch plus this recipe preserve code recovery. messageboard-note.txt
is for coordinator append because the shared board exceeds the worker cap.
