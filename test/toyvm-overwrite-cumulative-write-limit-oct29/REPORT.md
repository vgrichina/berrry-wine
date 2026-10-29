# Cumulative write limit on overwrite

PASS for one unmodified production CLI/FUSE invocation at candidate
`5a88ca099b962e946160afd2d4d71a950bf46db3`.

The pinned fixture writes 8192 bytes, overwrites the same 8192 bytes with
`pwrite64` at offset zero, checks file size 8192 and reads back `b`, then emits
the successful-16384-byte checkpoint. Its single final one-byte overwrite
triggers `filesystem cumulative write limit`. The CLI exits 1 and reports
`accepted: false`. Final filesystem counters are written/live/peak 16384,
two inodes and zero open handles. Limits were live 32768, write 16384 and
file 16384; overwrite accounting therefore rejects without live growth.

Before execution, source inspection confirmed the WRITE operation checks
`written + size` before resize/payload mutation, then charges the full accepted
payload size. All five production files matched the dispatch pins both before
and after execution. No source patch, second invocation or external cleanup
was used. The 8-second emergency guard did not fire. The observer matched
production-owned PID/start identities, observed their reap and found no FUSE
mount left. The actual fixture checkpoint is retained in runtime-result.json.

Boat `bx_dngjt3zd` was created with TTL 1800 and expiry
2026-10-29T05:22:48.732Z. API execution used `/tmp/tvow/repo` with absolute
work/domain paths under `/tmp/tvow/w`; status socket length was 23 bytes.
The task explicitly delegated lifecycle closeout. Snapshot-stop completed at
04:53:49 UTC; a subsequent API info receipt proves actual state `stopped`,
completed stop operation and verified snapshot. The first stop acknowledgment
was `pending`, and remains retained rather than treated as stopped evidence.

The local limit wrapper was extended with mandatory owned cwd, explicit owned
Git identity, per-operation aggregate RAM/disk admission, Git-only DATA256MiB,
Python DATA128MiB, physical parent/group RSS guards and bounded private capture.
Startup controls rejected omitted/root/donor cwd before spawn. The unchanged
dispatcher preflight correctly bound write16384; the inherited quota-preflight
file's historical write65536 value was not used as the runtime oracle.
Boat creation emitted JSON Lines; the initial single-JSON parse failure was
resolved from the retained output without repeating creation.

Run `python3 -B test/toyvm-overwrite-cumulative-write-limit-oct29/check.py`
for offline evidence verification and eight rejecting controls. It adds no
production invocation. Evidence and canonical.json live in this directory.

Scope is this tiny overwrite fixture only. Historical failures and browser
allowance CPU35.353183/wall101.495550694/captures1 are unchanged. This does not
qualify general resources, browser execution or gameplay. Publication is to the
owned task branch only; no main merge or public deployment is performed.
