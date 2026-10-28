# Recovery

The canonical output directory is
`/home/user/wine-assembly/scratch/usage-watch/toyvm-browser-pointer-qualification-oct28`.
Validate receipt.json and its named hashes before reusing any artifact.

browser-evidence.tgz SHA256:
`742fb056ea4ecab1359fbad7b0e97a7a45e5a261416e288b257b5337881c4e35`.
It contains71 bounded files: exact four candidate web payloads, observed harness
versions, startup/CPU/RSS/cleanup receipts, checkpoints, original failures,
event/state traces, and seven PNG files. Extract into an owned directory using a
tar data filter; never extract over the original candidate or donor worktree.
The task repo's ignored run folder is
`scratch/runs/20261028-toyvm-browser-pointer-qualification/`.
The task output separately retains payload.tgz and input/embedded-source manifests.
The original candidate source manifest remains the authoritative full closure pin.

The committed .cjs/.js files are harness sources. To reconstruct the portable tree,
put the four files listed by REPORT.md under candidate/ at their original paths
beside server.cjs, observe.js, browser.cjs, startup.cjs and remote-guard.py. Use the
trusted supervisor.py from the archive, SHA256
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`.
The server generates the tiny COM fixture from hex; no binary install is needed.

Do not replay this task's passing groups or resume the stopped Boat as a recovery
step. Its runtime allowance was consumed cumulatively, cancellation is unqualified,
and its authoritative2026-10-28 cutoff remains binding. Any further runtime needs
a coordinator-assigned bounded task and fresh legitimate lifecycle/resource
admission. No capture restriction or provider denial is bypassed by these files.
