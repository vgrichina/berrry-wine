# GLTron two-turn attempt: current disk floor blocks allocation

Run `scratch/runs/20261112-gltron-reviewed-two-turn-2320/` stopped before
allocation. Actual `/home` free bytes were 1,491,939,328 initially,
1,490,546,688 during the local audit, and 1,490,530,304 at the final decision:
all below the owner floor of 1,500,000,000. No holding loop, box, browser,
original game, or native input was launched. This is a capacity blocker,
not another latency qualification failure.

Local source was main `1c86ee44c040d5d78fd238358c1f1163f15b419e`.
The audit reread and hashed 729 existing paths: none missing, all 112 retained
media pins and 28 retained run-helper pins match the November 12 0015 run.
Of its 716 runtime pins, 699 match and 17 differ, including the current
modules and production runtime files; `audit.json` lists them. Current hashes
are recorded in `local-pins.json`. This establishes local availability and
identity, not current execution qualification or complete provisioning.
Relevant tracked source diff is empty; the existing untracked runtime input
has `untracked-runtime.patch`. No source archive or media copy was made.

`node test/test-gltron-original-registration.js` passed registry structure.
Its no-argument mode does not exercise the media loader. Media SHA checks
were performed separately. No production change, locked build, harmless
latency matrix, or runtime qualification was performed in this attempt.
`docs/re-notes/gltron-demo.md` was absent; current registry, launch recipe,
1930/2005 reports and subsequent 2315/0015 reports were read.

The requested two separately reviewed player turns and native outcome remain
unproved. Historical limits remain: 1930 proves one corner and collision;
2005's 7,573/9,946 ms samples are harmless fixture timing only. Its old
3,000 ms target is not a current allocation gate. The later 0015 native
motion and winner scenes do not establish two controlled turns. No existing
failure or UNKNOWN was retried or upgraded here.

Next requires actual disk space above the floor, then full current local
helper/media closure validation, an observable independent deadline watchdog
before creating a fresh private box, complete provision parent wait/EOF and
hash checks, and actual CPU/owning-renderer identity. Retain current capture
freshness and finite balanced trusted-key guards. Qualify a finite intention
only if necessary; review full scenes before dependent decisions and obtain
two distinct corner/trail consequences plus the natural result. No clock,
memory, configuration, device, asset, or route automation changes are justified.

Box ID: none. State: NOT_CREATED. Expiry: null. Stop receipt: not applicable.
No remote process or watchdog was needed or started. Only the owned local
messageboard watcher was started and stopped.
