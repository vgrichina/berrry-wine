Scoped decision: PASS for rename-specific retained charge lifetime at candidate
5a88ca099b962e946160afd2d4d71a950bf46db3. Fourteen offline checks pass.
This independently accepts the preserved source/runtime contract; it does not
change the historical runtime FAIL/gatefalse or the separate startup FAIL.

The five production files match the dispatch SHA-256/byte pins and exact candidate
Git blobs. The raw runtime result, CLI stdout/stderr, original fixture and observer
match the retained runtime canonical's artifact pins. input-pins.json records
original locations and immutable identities. The predecessor remote commit
2735fde1fb75de4260932edb5b7894820759b33d is coordinator-verified inherited identity;
this task did not query or modify the donor repository.

The allocation table in acceptance-result.json is constructed BEFORE validating
runtime live values. Metadata comes from create's charge argument, root charge
from __init__, payload units from resize's floor divisor, and collection's
metadata-plus-rounded-payload expression is checked independently.

| Phase | root metadata/payload | A metadata/payload | original B metadata/payload | C metadata/payload | sum |
| --- | --- | --- | --- | --- | --- |
| root | 4096/0 | absent | absent | absent | 4096 |
| A/B created | 4096/0 | 4096/0 linked/open | 4096/0 linked/open | absent | 12288 |
| A/B written | 4096/0 | 4096/8192 linked/open | 4096/8192 linked/open | absent | 28672 |
| A renamed over B | 4096/0 | 4096/8192 linked/open at B | 4096/8192 unlinked/open | absent | 28672 |
| before C write | 4096/0 | 4096/8192 linked/open at B | 4096/8192 unlinked/open | 4096/0 linked/open | 32768 |
| requested C growth (hypothetical) | 4096/0 | 4096/8192 | 4096/8192 | 4096/4096 | 36864 |
| post reap | 4096/0 | 4096/8192 linked/closed at B | collected | 4096/0 linked/closed | 20480 |

The historical 12288 post-reap oracle counts root plus A payload but omits the
two linked-file metadata charges for A and C. The correct sum is independently
4096 + (4096+8192) + 4096 = 20480.
The original B's 12288 charge disappears only after links AND opens reach zero.

Observed retained runtime facts: exact production CLI exit 1; accepted,
accountingAccepted, childSucceeded and browserAllowed false; exact stopReason and
filesystem failure 'filesystem allocation limit'; peak 32768, written 16384;
final live 20480, inodes 3, handles 0. Raw base64 output agrees with fixtureOutput
and contains before-C-write, original B open/nlink0/size8192, and equal renamed
source/path inode 2. The pinned fixture asserts original B pread b'b' and A pread
b'a' before printing, creates C before printing, and closes B after C's write.
No separate readback byte is printed: this proof relies on unchanged fixture
assertion ordering and its actual argv identity, not a summary claim.

Source inference: rename decrements replaced inode links then calls collect;
collect requires no links AND no opens. WRITE calls resize/charge before changing
payload or cumulative written. Rejection precedes all those mutations. RELEASE
decrements opens/handles then collects. The adapter waits for supervise to return,
then samples until handles are zero (or deadline), stores that snapshot and only
then unmounts. The pinned supervisor waits/reaps owned PID/start identities and
returns cleanupComplete based on no selected owned processes. Thus final live is
a post-reap snapshot, not an instantaneous rejection sample.

Cleanup evidence: backend/supervisor and report cleanupComplete true; unmount 0,
remaining mounts empty; backend owned PID/start tuples join observed identities,
all absent/reused at closeout. sourceAfter equals all five source pins. No
external safety cleanup was required. The coordinator's separately pinned stop
receipt records bx_su4mgbyb snapshot-verified stopped; expiry is unknown/null.
This task never contacted, resumed, stopped or created a box. Lifecycle stays
with the coordinator.

Adversarial checks reject premature collection on rename, missing last-release
collection, disabled charge guard, B close before C write, source pin mismatch,
accepted C growth with a forged unchanged failure reason, missing descriptor
proof, final live falsely relabeled as 32768, and accepted CLI flags with a forged
reason. Forged raw report/CLI and descriptor output envelopes are synchronized
before validation, so semantic guards must reject them. The source-fragment
checks execute only charge/collect/resize/reject AST methods against a small
independent state model. They verify failed resize leaves live/peak/written/data
unchanged and release reclaims exactly 12288. They do not execute handle(), mount,
serve, the production adapter, CLI, fixture, observer or backend process. errno
ENOSPC occurs only in the fragment test; runtime errno was not observed.

Limits/topology: the coordinator's unchanged passing prelaunch-controls receipt
is reused. The task supervisor uses DATA soft128 with inherited hard unchanged;
ordinary Python children get hard128 and Git children hard256. All subprocesses
have explicit validated owned cwd; Git uses explicit owned -C and top-level/Gitdir
identity before mutation. Fresh per-operation aggregate admission retains the
24MiB source/Git3 + evidence1 + WAL8 + publication3 + uncertainty9 projection,
host floor and physical RAM floor. The WAL8 allowance appears once. CPU90,
wall120, file12MiB, capture2MiB, parent RSS128/group512 remain enforced.
Git uses the prescribed dedicated identity and known-hosts configuration.
No checkout or runtime mount was needed; mount/Node startup gates do not apply.

Reproduce the offline check from repository root with Python 3:
python3 -B test/toyvm-rename-topology-corrected-independent-accept-oct29/accept.py
under the original task supervisor controls. No network/runtime dependency.

Remaining gates: coordinator review/integration; this acceptance unlocks only
rename-specific charge lifetime. Instantaneous live at rejection, guest errno,
general resource safety, confinement, browser and gameplay remain unestablished.
Original failures and originals are preserved byte-for-byte in evidence/.
No production source changes, main integration or public deployment occurred.
