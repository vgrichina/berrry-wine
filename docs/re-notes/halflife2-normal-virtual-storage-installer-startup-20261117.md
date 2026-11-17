# Original Half-Life 2 demo: normal storage and startup

Run: `scratch/runs/20261117-halflife2-normal-virtual-storage-installer-startup/`.
Original installer identity remains 787701212 bytes, SHA-256
`24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.

The predecessor's 3995000 script units are a declared installation requirement,
not a measured physical installed footprint. A bounded-buffer, read-only scan
CRC-verifies all 26 raw DEFLATE streams through the exact package EOF. Total
decoded payload is 3531518277 bytes. Six streams have the common 1/1/6 header,
IDs 221/219/200/206/207/208, and a file-length field exactly equal to each decoded
length. Together those six streams contain 3529662856 decoded bytes in
786980466 compressed bytes. No decoded content was written to the host and no
installed tree was constructed. The measured installed footprint is unknown.
The scanner and per-stream CRCs, lengths and header prefixes are retained in
`stream-scan.json` and `content-streams.json`; this inspection never runs WiseMain.

Normal writable VirtualFS files live in JavaScript Uint8Arrays, with provider
and sparse-provider paths and optional asynchronous overlay persistence. Host
`/home` free space is therefore not the ordinary in-memory volume's capacity.
`public-api-before.json` proves that a successful real 4096-byte write/read
leaves GetDiskFreeSpaceEx's 1073737728 free bytes unchanged. Its 2147479552 total
comes from legacy geometry, not an enforced writable-volume quota. Neither a
larger constant nor a host statfs value was substituted for memory capacity.
Legacy signed-32-bit and CD geometry are unchanged; no volume-capacity repair
is claimed here.

The same public probe establishes a real storage fault: after a representable
seek to Number.MAX_SAFE_INTEGER, SetEndOfFile propagates a host RangeError.
`lib/filesystem.js` now converts failed resident backing allocations to
ERROR_NOT_ENOUGH_MEMORY (8). Write extent arithmetic outside the exact numeric
range returns ERROR_INVALID_PARAMETER (87). Failed writes preserve their
cursor and existing bytes; failed resizes preserve the file size and contents.
The focused test exercises actual WAT SetEndOfFile BOOL/GetLastError/stack
behavior, normal writes, exact reads, truncation, zero-filled extension and
unallocatable write/resize refusals. VFS and overlay regression suites pass.
This is an allocation-error fix, not evidence that the original installer has
encountered that error.

`tools/halflife2-current-native.py` prepares a sealed complete published source
graph, exact module, main/CPU Worker/OS child inheritance proof, ordinary genuine
Wise DLL load/free on a joined guest worker, native ownership/modal/dialog/input
controls, and a process-parent supervisor adapter. Qualification does not call
WiseMain. An early authored adapter run reached its separate 240-second
preparation limit; actual child/watchdog waits, both EOFs and an empty remaining
scope were retained. The adapter now permits a bounded 900-second qualification
phase with a 920-second independent preparation watchdog. The original's
runtime limits remain fixed at 600/620 seconds, starting after preparation.

At this note's initial preparation, shared integration still holds index writes.
Own changes remain uncommitted until that critical section is released. No
original installer or installed game has been invoked by this worker. No boxes,
Codex workers, authentication substitutes, script edits or public deployments.

The second authored outer run passed its full sealed graph at published
7ad95ad6029e5307db06fe1b489f7bb30eabd76d plus only this worker's material source
patch. Module SHA-256 is
`5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`.
`outer-working2/full-native-qualification.json` and `outer-working2/outer/wait.json`
record full controls and actual normal native/outer/watchdog completion, both
EOFs and an empty owned process scope. Later code compacts only traces whose
writer PID is absent and shares storage for byte-identical immutable runtime
receipts. Individual trace gzip files have verified round-trip hashes and exact
recovery commands; no source or media archives are created. This matters because
concurrent proof output briefly crossed the host disk floor; it says nothing
about the normal install's unknown physical footprint.

Shared Git integration was released after ae70a5473 was published. The restored
foreign callback review mismatch was reported to its coordinator owner; a fresh
focused census now passes all 465 boundaries. Final canonical validation and
explicit-path publication follow before any original startup. A published exact
outer fixture and another complete sealed original preparation remain required.
The compaction helper also runs during long qualification tests, using a lock,
checking that each trace writer has exited before reading it, and joining its
thread before releasing the runtime. This preserves the host floor without
adding an admission threshold, changing guest clocks or discarding trace bytes.

The startup handoff retains the fixture's exact published Git revision through
later unrelated publication. A fresh sealed source pool, compiled module and
inheritance probe must match the fixture's entire source hash map, source-pool
hash, retained module bytes and full native/outer wait proof. The completed
identical native controls are reused rather than repeated on a refreshed graph.
No failed or interrupted qualification can pass this handoff. The own periodic
compactor and a subsequently published shared helper compactor use one lock.
