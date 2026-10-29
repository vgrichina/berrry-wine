# Independent retained-runtime regrowth acceptance

SCOPED_ACCEPT for candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`.
This independently checks the five pinned source files and the preserved single
actual CLI/FUSE invocation. It does not execute the production CLI, backend,
fixture, Boat API or browser. Canonical original publication identity
`79da349f088b46f62af3f4754690b00a5bbb99d8` is a coordinator-verified handoff,
not a new independent remote observation by this worker.

`accept.py` first derives the oracle from per-inode 4096-byte metadata and
4096-byte-rounded dense payload, before reading the prior source-phase oracle.
SETATTR computes `growth=max(0,size-old)`, rejects cumulative overflow before
resize, then increments written by growth. Shrinking releases payload allocation
but never refunds cumulative writes. Resize zero-extends data; the unchanged
fixture asserts size and the final byte's zero value after both 8192-byte grows.

| Phase (source inference) | Size | Live | Written |
| --- | ---: | ---: | ---: |
| Root + linked A metadata | 0 | 8192 | 0 |
| Grow | 8192 | 16384 | 8192 |
| Shrink | 0 | 8192 | 8192 |
| Regrow | 8192 | 16384 | 16384 |
| Reject attempted 8193 before mutation | 8192 | 16384 | 16384 |

The preserved raw envelope agrees with its CLI JSON report, exact argv/fixture,
five source pins and sourceAfter values, prelaunch executable hashes and API
completion envelope. The fixture prints `before-regrowth-over-budget` with
successfulGrowthBytes 16384, fileSize 8192 and attemptedSize 8193, then contains
one `ftruncate(fd,8193)` call. CLI exit 1, accepted false and the exact reason
`filesystem cumulative write limit` agree. The fixture control flow and source
guard support rejection on that next call; a direct syscall trace and returned
errno were not captured. No claim of direct syscall observation is made.

The adapter snapshots filesystem state after child supervision/reap and before
FUSE disconnection. Linked A remains: live/peak/written are each 16384,
inodes 2 and openHandles 0. These are post-reap totals, not instantaneous phase
samples or a `filesystemFinal` field. Backend and outer cleanup flags agree;
unmount succeeded, no mount remains, recorded PID/start identities are absent
or reused, and no external safety cleanup ran. The retained coordinator stop
receipt records bx_t32cdxka snapshot verified 05:03:38.096Z, stopped
05:03:38.134Z and stop completed. No box was accessed, resumed or stopped here;
coordinator retains lifecycle ownership. Historical TTL was 1800 seconds.

Ten adversarial cases reject shrink refunds, guard after resize, guard removal,
accepted growth with a forged reason, missing regrowth checkpoint, missing
zero-fill assertions, pin mismatch, wrong reason, omitted cleanup and mislabeled
post-reap instantaneous data. The first three execute only the extracted exact
SETATTR growth statements against an instrumented resize stub. They test guard
arithmetic and ordering; they are not backend, FUSE or kernel replay.

Evidence: `result.json`, `input-pins.json`, and `inputs/canonical/` with the
original exact artifact manifest, raw runtime, fixture and observer. Run offline
with `python3 -B test/toyvm-regrowth-retained-runtime-independent-accept-oct29/accept.py`
from the repository. The task's `controls/` retains launch/admission/publication
records outside Git; copied resource receipts accompany this report.

Remaining gate: no browser, gameplay, confinement expansion or general resource
qualification. Browser allowance remains CPU 35.353183 seconds, wall
101.495550694 seconds, captures 1; browserAllowed stays false. The original
hard128 startup-wrapper failure is retained unchanged and is not rewritten as
a general startup success. No Node execution or filename-bearing guest mount
occurs; the unchanged empty mount configuration receipt is reused. Root-ref
identity reuses the launcher digest; no root Git writes or ref listing occurred.
