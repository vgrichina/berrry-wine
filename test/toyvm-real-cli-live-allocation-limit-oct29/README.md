# Production CLI aggregate live-allocation qualification

PASS: one invocation of the unchanged pinned `qualify_accounted.py` through its
`synchronous-fuse` adapter rejected aggregate LIVE allocation across two files.
Candidate: `5a88ca099b962e946160afd2d4d71a950bf46db3`. Five exact production pins
are in `evidence/pins.json`; all were checked again in the remote execution location.

The fixture uses absolute paths under `/tmp/tvlive/w/domain`, since confinement
restricts writes but does not chdir. It creates first, writes 16384 once and closes
without unlinking; it creates second, attempts 16384 once and closes. No retries,
extra files, unlinks, source changes, substitutes, mocks, Node, browser, or builds.
Both requested file sizes are <=16384; total requested writes 32768 <65536.
Root4096 + first inode4096 + first payload16384 =24576; second inode raises
live to28672. Its full payload would require45056 >32768.

The pinned write handler checks cumulative write, per-file size, then resize's
allocation charge before mutating payload or written counters. CLI exit1 and
accepted=false are expected: backend failure/stopReason both exactly
`filesystem allocation limit`. Actual live=peak=28672, written=16384, inodes=3,
openHandles=0. Output confirms first-write=16384 and second-rejected=28 (ENOSPC).
The caught error allows fixture exit0; the authoritative filesystem failure
still forces CLI rejection. No short write occurred.

Exact flags: --live-limit 32768 --write-limit 65536 --file-limit 16384
--rss-limit 134217728 --cpu-limit 2 --wall-limit 5 --output-limit 4096.
The independent owned-identity outer8second guard was unused. All observed
PID/start identities were absent after production cleanup, FUSE unmount exit0,
server exit-15, remainingMounts=[], no external cleanup. Runtime evidence records
actual executable hash, complete argv, pins, process samples and API envelope hash.
No guest filename-bearing mount argv exists; Boat --file staging is enumerated
separately, including an explicit empty comma-bearing filename set. No Node
executable or canonical guest mount parser was invoked for this non-guest task.

This qualifies only aggregate live filesystem allocation in this exact fixture.
Full resource safety, arbitrary workloads, browser and gameplay remain UNKNOWN.
Prior cumulative/per-file/RSS/CPU/output/timeout/parent-exit groups were not rerun.
Browser allowance remains CPU35.353183 wall101.495550694 captures1, browserAllowed=false.
Existing cancellation/source receipts and all original procedural limitations
remain in force; this does not retroactively repair earlier rejected attempts.
Fresh disk/MemAvailable admissions are retained. The first explicit WAL baseline
measurement was post-runtime; earlier admissions did not separately record WAL
growth. This procedural limitation is preserved, not claimed as startup proof.

Recovery: preserve this directory plus task-private raw API envelope and admission
logs. Fixture/remote harness are reproducibility artifacts, not authorization for
a second invocation. Launch, execute, preserve_stop are task-specific historical
recipes; never rerun creation/CLI after acceptance. Shutdown is asynchronous:
observe the existing stop operation to actual stopped, never repeat stop to poll.

Boat `bx_h5574x3f` snapshot-stopped at `2026-10-29T04:17:49.960Z`; creation expiry
`2026-10-29T04:46:49.152Z`, worker cutoff04:45UTC. See `evidence/actual-stopped.json`.
