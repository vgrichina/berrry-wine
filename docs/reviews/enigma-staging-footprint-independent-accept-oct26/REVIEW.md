# Enigma bounded staging independent acceptance — REJECT

Candidate `f1aac7b9ba83e2bbc763cb58d38646653d626468`, base
`86ac66885c45866c2cbd57cb464cddccadca6893`. This review changes only its own
fixtures and evidence. Production helper, recipe, donors, root refs and main
were not modified. No build, guest, Boat, services or other workers were run.

## Blocking finding: required non-font file modes are discarded

`tools/enigma-bounded-staging.py:stage` creates each independent file with
`target.open('xb')` and applies no source/pinned mode. Thus permissions depend
on the staging process umask. In this worker's inherited umask `0002`, small
real-file fixtures demonstrate `0600 -> 0664`, `0755 -> 0664`, and
`0644 -> 0664`, while preserving every content byte. This broadens access and
can lose executable permission. The original assertion failures and subsequent
bounded diagnostic confirmations are retained, not converted into passing tests.

This is relevant to the pinned manifest: its standing non-font file sources
include two `0644` files (`runtime/test/binaries/tlbs/stdole2.tlb` and
`runtime/build/wine-assembly.wasm`); 2484 other standing non-font files are
`0664`. See `standing-nonfont-modes.json`. `check-644.py` reproduces the exact
permission transition using only a tiny synthetic payload, without staging
those standing binaries. This is a file-mode acceptance failure, not evidence
that the Enigma guest cannot start.

The manifest pins bytes/hash but has no mode contract; Git source mode is also
discarded by the helper. The coordinator owns the next repair or an explicit
revision of the acceptance contract. This acceptance task makes no repair.

## Accepted evidence reusable for unchanged inputs

The supplied helper SHA-256 is
`ed587d488cd8276191db3b7191132546943209e5bff05b67ca66dcc2b90b1652` and test
SHA-256 is `b5170742281848d3e2d47d5b2694b7d614626973d30fec7cf9045f7dfc0088be`.
All 32 source/test/recipe/evidence files in the focused closure were compared
byte-for-byte with their candidate Git blobs. Supplied seven passing tests and
the 2659-source rehash receipt were reused; they were not rerun. Retained test
stdout/stderr hashes match `tests.json`. `reuse.json` and `closure.json` bind
these identities. The coordinator's 31-payload rehash and exact remote check
are supplied prior evidence; this task does not claim to have repeated them.

Three independent groups passed: real helper identity/accounting, failure and
cleanup ownership, and execution of the exact replacement recipe on a small
fixture. These are additional acceptance checks, not a rerun of the supplied
seven-test suite. They cover newly owned immutable font aliases with no donor
links; independent writable/non-font outputs including prefix near-misses;
changed duplicate donors; missing and oversized sources; parent/child namespace
collision; existing directory and dangling symlink preservation; interruption
and link failure preserving a foreign `.enigma-stage-*` evidence tree; exact
required content; and an independent `os.walk`/`os.stat` oracle using
`(st_dev, st_ino, st_blocks)` including directories.

The recipe group executes candidate `verify-and-stage.py` through `runpy` as
`__main__`, using its real helper import and `--stage` path. Only the two
manifest/pin reads are substituted with owned synthetic input data; production
files are untouched. This validates recipe orchestration on three tiny files,
not full-media staging or remote transfer. Original unsafe path and file/Git
source groups remain covered by the reused exact-revision seven-test receipt.

Two in-memory helper mutations are rejected by the **unchanged** independent
fixture: skipping a duplicate source rehash, and charging every alias inode
again. The latter observes actual unique-inode allocation `86016` versus
mutated `98304`. Neither mutation changes production files. Exact fixture and
log hashes and each group checkpoint are retained.

## Allocation and font contract review

Both projection dictionaries conserve every original charge except remote font
allocation: `786432` is subtracted exactly once. Transfer overlap, directories
in the measured fixture, session/launcher, positive database highwater, future
charges and the `8388608` reserve are preserved. Historical failures remain
`67547136` and `67588096`; projections remain `66760704` and `66801664` against
`67108864`. These are **4 KiB synthetic projections**, not runtime admission or
actual remote allocation. This independent small fixture verifies the inventory
oracle; the unchanged exact-font-shape savings group is reused.

The pinned runner is `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`, full-file SHA
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Its `test/run.js:2844-2865` reads host fonts/substitutions, making new
`Uint8Array` VFS data. This supports keeping those host fonts immutable even
when guest VFS copies are writable. Pinned `runner/host.js` and
`runner/lib/font-substitutions.js` were also rehashed and reviewed;
`font-consumer-review.json` retains exact source identities and excerpts.
The manifest has 72 host-font paths; the only non-font runtime payloads are the
type library and wasm. The recipe explicitly prohibits chmod/writes of aliases.

Unresolved external assumptions remain: every eventual consumer and transport
must honor that host immutability contract, preserve owned aliases, rehash every
destination, and measure actual filesystem blocks plus all current retained,
transfer, session/WAL and reserve charges. Read-only file bits are not a security
boundary against an owner that can chmod. No remote/guest/frame/gameplay result
is inferred. Destination and parent exclusive ownership is an explicit helper
precondition; concurrency races were not tested as if supported.

## Reproduction, limits and incidents

Canonical working paths are `/tmp/enigma-staging-footprint-independent-accept-oct26/{repo,ops}`.
`accept.py` and `run.py` are retained snapshots of the owned ops fixtures. To
reproduce elsewhere, restore them as `ops/accept.py` and `ops/run.py` beside a
focused `repo` checkout at the candidate (or restore this exact directory).
Run `python3 -B ops/run.py` with fresh output filenames/directories. It expects
the known mode failure and both rejecting mutants; inspect per-group return
codes, not only the driver's overall status. `check-644.py` independently exits
1 for the blocking 0644 mismatch. `diagnostic-confirmation.json` retains the
bounded exception wrapper used to confirm the three assertion failures.

Tests ran serially with Python data 16 MiB, CPU 60 seconds and file 24 MiB
limits; subprocess timeouts 65 seconds. Inputs are tiny; no 37 MB guest-media
tree was materialized. Captures are small and no full root `show-ref` listing
was captured. The initial launcher root-ref digest and unchanged exact mount
argv/enumeration receipt were reused before checkout. No conditional runtime
mount execution occurred. `launch.json` records the actual live argv:
GPT-6.1-Sol, medium effort, 200000 total compaction. Flat read-only object
directories total `2899968` allocated bytes across 541 distinct inodes;
standing installed tools are identified separately without copying them.

First expected assertion tracebacks triggered additional Python diagnostic
`MemoryError` under the data limit. Original assertions and logs remain;
only the three failing cases were confirmed with a small exception formatter,
without changing the independent fixture. The first formatter had an argv
bookkeeping error; its `KeyError` is retained separately. A large initial
combined read was truncated by the tool; subsequent reads were focused and
bounded. No production access denial was encountered or bypassed.

`admission-*.json` includes all own checkout/Git, ops/evidence, external
launcher/session, positive shared database growth once, 12 MiB future
session/database, 16 MiB fixture/Git/evidence allowance and 8 MiB reserve.
Fresh admission retains the 512 MiB client plus 16 MiB heap and required RAM
and free-disk floors. Publication is task-branch-only with trusted SSH and an
exact remote ref comparison recorded in ops. No test box is assigned: ID,
state and expiry N/A; user reports previous boxes STOPPED, with no API check.
Lifecycle ownership remains with the coordinator.
