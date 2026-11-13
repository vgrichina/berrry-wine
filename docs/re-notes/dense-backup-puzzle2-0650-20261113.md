# EXACT23 stopped-snapshot backup and LMarbles floor refusal

Recovered **69,382,144 allocated bytes** by offloading only the FINAL shared
EXACT23 archive, after Dense0340's explicit resource RELEASE at
2026-11-13T01:02:20.210072Z. The archive is 69,375,344 encoded bytes, SHA-256
`b8bfdfc465b0e7cb9971327f4a80d5dabc3582cd52c5bec3edcad7a7a89ea039`,
representing 145,065,975 raw bytes across the original 23 closed-log indexes.
No superseded per-file encoding or NFS runtime file was transferred or removed.

Recovery instructions, durable mapping and evidence:
`scratch/runs/20261113-dense-backup-puzzle2-0650/RECOVERY.md`.
The private resource box **bx_ht7haw8p** is **stopped**, with completed normal
stop **stop_dd4e0f2ce8cd5ed8**, forced:false, error:null. Its completed stopped
snapshot is **2250f000-4946-4b65-a41a-486718b0a13a**.
Default 14-day retention expires **2026-11-27T01:05:39.765Z**.
**The coordinator must notify the owner of this backup ID and expiry.**
This worker sends no owner messages. This is expiring recovery storage; restore
or arrange continued recovery before expiry. Do not resume or delete by default.

The independent deadline watchdog acknowledged before box creation. Remote
whole-file SHA verification, normal stop and actual full stopped-snapshot
readback passed. Archive, mapping, manifest and initial resolver bytes were
downloaded and verified independently. An additional snapshot download restored
the full physical archive with its original mode/mtime. Before local removal,
all 23 raw restores and all 23 bit-exact historical gzip reconstructions passed
full SHA/size, mode, nanosecond mtime, existing-file refusal and symlink refusal.
Corrupt XZ and wrong reconstructed gzip identity were refused before output
creation. Both legacy commands worked before removal; separate fresh snapshot
raw and gzip restores also passed. Only after a durable exclusive local stub,
unchanged indexes/mapping and privileged FD/maps checks did the worker unlink
the final XZ. Both legacy commands then restored from the stopped snapshot with
full identity and metadata checks. Backup parent and independent watchdog each
have actual code0 waits and both EOFs.

Every old index and Dense0340's mapping remain byte-identical. Original shared
restore helper and RECOVERY bytes are preserved in this run; all earlier prior
recipes remain untouched. The original raw command is still:

```
python3 -B scratch/runs/20261113-closed-worker-gzip-proofs/restore.py INDEX [DESTINATION]
```

The historical gzip command is still:

```
python3 -B scratch/runs/20261113-closed-log-dense-0340/dense_restore.py --prior-gzip INDEX [DESTINATION]
```

The released Dense0340 helper delegates to the checked snapshot resolver.
Its historical `restore`, `encoded`, `sha` and `RUN` imports remain available;
an actual imported `encoded()` recovery from the stopped snapshot was checked.
The recovery recipe also explains restoring the shared XZ at its original path
for preserved local-only recipes, or reconstructing the original gzip siblings
for older gzip-only commands. Raw restoration is required before history use.
No log payload was interpreted, and original compressor identity metadata is
retained, including gzip level6/mtime0 and zlib1.3.

LMarbles launched locally through the accepted registered `lmarbles_108` route,
with unchanged current04 module, all 86 original media references plus CRT,
real ticks, cooperative threads and port8430. Fresh launch capacity was
**1,530,437,632 bytes**, and an independent 1,200-second deadline guard was
observed alive before creation. All input effects had fresh floor checks.
Visible Tutorial boards and selected targets were reviewed individually;
nine moves reduced 18 to9. This was prerequisite work only: **no new Puzzle2
clear or next/tally was earned**. One initial named arrow produced vk=NaN and
no board change; its balanced release and unchanged capture are retained.
Subsequent arrows used numeric native key codes. No automatic move chain,
state/profile/clock patch, forced call or blind replay occurred.

The next reviewed key was refused before input at **1,499,942,912 bytes**,
**57,089 bytes short** of strictly greater than 1,500,000,000. The worker
promptly requested ordinary quit; its command completed code0 with both EOFs
and `quitting:true`. Native PID935043 and guard PID935042 were subsequently
absent. The outer supervisor returned143 without writing its native/guard wait
receipts: **native and guard actual parent waits/EOFs are UNKNOWN**, and no
clean game-parent completion is claimed. Postflight media/module hashes pass.
No relaunch, disk polling, other-worker cleanup or further game effect followed.

Source provenance is the exact Git SHA in `source.json` and `game/route.json`,
relevant binary diffs and reconstructable owned helper/note patches. Media are
referenced by existing path and SHA, without copies. No source tree, scratch
tree or media archive was created. Only this scoped note is committed; no
production code changed and no production build was warranted. Tests were
backup/restore/metadata/refusal/legacy compatibility, syntax, media/module,
balanced input, process absence and sealed evidence checks.

Next: coordinator owner expiry notification, then additional sustainable
authorized capacity before another freshly guarded native Puzzle2 attempt.
Capacity was actually recovered, but shared free space later fell below the
floor; the worker does not attribute other writers' usage to this backup.
