# Streaming gzip reconstruction: exact forms proved, pool too small

**22 previously refused gzip streams reconstruct byte for byte using codec-derived
flush offsets. Their total allocation is only 90,112 bytes. No logs were removed,
and native NFS actor/Pause/driving remains capacity-blocked.**

Evidence and retained experiment sources:
`scratch/runs/20261113-streaming-gzip-1950/` (`codec.py`, `pool.py`, `external.py`,
`controls.json`, `pool-proofs.json`, `external-decoders.json`, `result.json`).
This follows [the 1830 recovery](application-exact-xz-1830-20261113.md), its
unified/expanded proofs and protected `RECOVERY.txt`. Its 73 removed originals,
XZ and all 675 older recovery dependencies were not reworked.

The material bound precedes the real codec trial: the **entire 101-file refused
parent pool** contains 65,729 gzip bytes and occupies **434,176 allocated bytes**.
Even perfect zero-cost recovery of every refused file cannot close the current
capacity gap. The recorded trial measured 917,897,216 available bytes on `/home`,
below the required 1,500,000,000. This upper bound includes paths that might fail
closure eligibility; it is not unlink admission. No partial tiny cleanup was
performed. The 33-session/module pools and other prohibited cleanup categories
were not revisited.

The experiment reads the installed `/usr/include/zlib.h` descriptions of
`Z_BLOCK`, `data_type`, `Z_SYNC_FLUSH` and `Z_FULL_FLUSH`. Python and the actual
loaded native zlib both report **1.3**. Native raw `inflate(..., Z_BLOCK)` supplies
deflate block boundaries and exact decoded byte offsets. Only a nonfinal empty
stored block at an actual boundary supplies a candidate flush offset. Searching
for marker-like bytes in the opaque payload is not used.

Sync and full flush share that wire marker; it cannot establish which encoder
operation produced it. For up to eight offsets the experiment enumerates sync/full
schedules; above that it tests uniform sync and uniform full only. Unsupported
schedules remain refused. A setting/schedule is retained only when raw window
-15, memLevel 8, default strategy and the tested level reproduce **every original
gzip byte**, including the verbatim original header and trailer. These are proven
reconstruction schedules, not claims about historical producer calls. Raw CRC,
length, complete deflate consumption and single-member framing are checked.

Synthetic controls run first: sync, full and mixed flushes, including an optional
header with extra/name/comment/header CRC, all reconstruct exactly after XZ
encoding/decoding. Each positive also differs from every tested whole-stream
level 0–9. Multimember, trailing data, truncation, bad trailer CRC, bad header CRC,
reserved flags, partial flush, block flush and whole-stream marker-like payload
controls all refuse. These unsupported forms are not silently normalized.

Of the 101 real originals, **22** match a sync reconstruction schedule: 21 at
level 6 and one at level 9, with one original optional header. They contain
**7,027 gzip bytes** and occupy **90,112 bytes**. All pass complete raw SHA and
encoded SHA checks plus byte equality after XZ round-trip. Independent external
`gzip -dc` and `xz -dc` agree on all 22 full raw identities; reconstruction from
that external XZ output again equals the existing original gzip byte for byte.
The other 79 refuse: 22 have multimember/trailing framing and 57 have no supported
empty stored flush boundary. No expanded parameter or payload interpretation
was used to force a match.

All 101 originals retain their parent-recorded inode metadata and complete
encoded hashes. Every parent protected file matches its manifest, all six
protected artifacts retain their protected modes, and every one of the 675 named
older dependencies retains its size/hash. The 73 parent original paths remain
absent. The parent recovery directory and all older helpers/indices remain
unchanged. No new recovery was installed because nothing was removed. Keep the
experiment sources/proofs with this run; the real original gzip files remain
the authoritative inputs.

Any future removal still requires the parent closure/census protections, durable
recovery, genuine metadata/refusal restores and unchanged old-helper-chain tests
before unlink. The parent's protected originals must still be hydrated to their
**exact original gzip** before invoking an older helper or consumer. This trial
does not authorize bypassing that prerequisite or substituting freshly gzipped
raw bytes.

NFS was not launched or given another floor-only admission attempt. Actor fix
`bcd413390`, unchanged chooser/local media, actual available capacity above
1.5 GB, independent observable deadline/disk watchdog, heavy lock, actual-child
census and fresh freeze remain prerequisites. Live actor inspection, reviewed
Pause/Continue and finite held driving with independent UP remain unproved.
No reserve proposal was applied, no guest/config/clock/AI writes or input occurred,
and no denied transport, credential or API retry was made.

Only this note is committed; experimental code remains run evidence. No
production code changed, so a production build was not needed. Focused controls,
the complete 101-file trial, independent decoders, parent hash/mode checks,
syntax and scoped diff checks passed. Git SHA plus relevant binary diff and
owned new-file patches record provenance without archiving source trees/media.

Box ID NONE; state NOT_CREATED; expiry null; stop receipt N/A. No runtime box
was created, resumed, deleted or stopped. The owned board watcher is stopped
before this worker finishes. Next is separately authorized material capacity,
then guarded native NFS; this refused pool cannot provide that capacity.
