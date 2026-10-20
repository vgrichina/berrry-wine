# Independent WATX capacity review — ACCEPT within source-level scope

Reviewed fix `7423d9f5cb0424bcd3b19667b84834190d446d86` as present in
`b222e28dce8ed9538e1ce5158e4cbc8c9c0cf659`, against its exact pre-fix parent
`5ed38e67969d4379acc160f460dc051ed9774da7`. The four compiler files and changed
test/provenance bytes match the fix at the reviewed tip. No compiler defect found
within location encoding, bounded source accounting, regression, and provenance scope.
No production changes or integration performed.

Independent `review.js` ran 22 passing checks. It loads exact Git blobs into fresh
Node VM contexts; tests.json records Node version, compiler Git blob IDs and SHA-256,
test identities, and emitted fixture hashes. The shipped production regression and
23-file sealed provenance gate also pass, with logs retained.

- Exact 256 filename IDs and source lengths strictly below 4,194,304 UTF-16 code
  units pass. A non-ASCII comment of length limit-minus-one exercises actual parsing
  at the last filename and near the last offset. Filename, line, and column decode
  correctly. Maximum packed value is 1,073,741,823 (`0x3fffffff`), the nonnegative
  30-bit Smi numerical boundary. No claim of engine heap allocation measurement.
- Full snapshots of names, retained source strings, and name-to-ID map are identical
  before and after rejected new oversized source, rejected oversized replacement,
  and rejected filename 257. Duplicate filename reuses its ID.
- 127, 128, 150, and 255 real includes plus root compile in both full-tree and
  streaming production modes. Every function export executes and returns its unique
  expected value. The implicit memory export is separately checked.
  Both modes emit matching fixture hashes; the 127-include fixture is byte-identical
  to the baseline output.
- Baseline fails at 129 total sources and demonstrably allocates a filename ID before
  rejecting an oversized new source. Candidate fails explicitly at 257 sources and
  at a missing include. Independent guard-removal mutations for both source length
  and file count are rejected by the boundary harness.
- The exact candidate main manifest contains 128 fragments plus root. Git blob
  accounting confirms every source fits the new limit; maximum byte size is
  1,375,748. Byte size is a conservative upper bound on decoded code-unit length.
  Source identities and prior receipt/tests/report hashes are recorded separately.

The initial supplemental harness counted all exports as functions and failed because
the compiler also exports implicit memory (compiler-codegen.js documents this).
The assertion was corrected to require exactly N functions plus a WebAssembly.Memory.
Initial results are preserved in initial-harness-results.json; compiler bytes were
never changed. This was a harness defect, not a production defect.

Qualification limits: the new tradeoff intentionally reduces the per-source limit
from 8 Mi code units to 4 Mi code units while increasing filenames from 128 to 256.
It does not provide unlimited source capacity. Transactionality tested here means
capacity-rejected source registration; it does not promise rollback of an entire
failed compilation, parse syntax failure, or old AST locations after successful
replacement of a filename's text. These behaviors are outside this fix.

Prior evidence reports 18 compiler suites and a canonical build that cleared the
capacity failure but stopped at ownership census. This review independently reran
the relevant production suite and provenance gate, not all 18 suites. No canonical
build, full VM, browser, guest runtime, SSH, deployment, or remote test was run.
No full-module hash/parity or ScreenSaver lifecycle qualification is implied.
Ownership census and subsequent build gates remain outside this acceptance.

The task branch descends from the reviewed candidate and therefore contains
ScreenSaver ancestry. Do not merge this review branch wholesale onto main.
Any future integration must select separately reviewed changes; this task performs none.

Recovery: preserve this report directory and the exact candidate/baseline refs.
`preflight.json` lists the exact sparse paths installed before materialization.
`node review.js /absolute/path/to/evidence` replays the checks with those local Git
objects and the sparse checkout at preflight.wt. No fixture files or heavy artifacts
are required. Shared HEAD/index/config match admission; unrelated WIP and all laptop
and review holds were untouched. Storage includes a 2 MiB conservative publication
allowance and remains below the 8 MiB cap and above floor plus reserve/concurrent caps.
