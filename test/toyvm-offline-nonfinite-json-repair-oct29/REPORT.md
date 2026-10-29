# Offline exponent-overflow repair: partial validation, control blocker

Candidate: `354c5651f6f11bbd430424c3163d7e87e125fc9a`.
Independent rejection: `ef64b21875c04a34ea29ded0c31664feb3d45f8b`.
Task: `toyvm-offline-nonfinite-json-repair-oct29`.

The unchanged 364-byte reproducer (SHA256
`0a1537b8c35ac1379d7e4b028b47a1ba0656e692163ccf7b909d1ed08fffa11e`)
was executed first through the pinned actual Python CLI. It returned exit 0,
`accepted=true` for `metadata: 1e999`. Original stdout, stderr, argv, exit and
source/input pins are preserved in `operation-evidence.tar.gz`.

The repair adds a `parse_float` callback which converts JSON floating numbers
and rejects nonfinite results with `math.isfinite`. Python's JSON decoder invokes
this at every depth, including ignored metadata. Existing constant rejection,
duplicate-key handling, integer parsing, live caller and backend are unchanged.
The pinned caller SHA256 remains
`73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60`.

53 actual CLI child tests passed, including the exact original overflow fixture
(now exit 2), original boolean-cleanup rejection (exit 1), legitimate control
(exit 0), positive/negative nested overflow, maximum finite float, subnormal and
underflow boundaries, finite exponents, zero with huge exponent, null/string
keys/data, named nonfinite constants, resource-field overflow, malformed JSON
and duplicate keys. Results and source hashes are in `evidence/focused-results.json`.
Five negative cwd/Git controls rejected omitted/root/donor/outside cwd and missing
explicit Git `-C` before spawning; their sentinel remained absent.

The next test stopped before spawning: the wrapper put its 1 MiB input-size
fixture in the evidence directory, triggering the 1 MiB aggregate evidence guard.
The fixture had already been written, so the cap was exceeded transiently.
The supervisor also measured logical evidence bytes rather than allocated blocks;
full per-operation resource-control compliance is NOT established. The failed
admission could not save its own exact timestamp/measurement record because that
write was rejected by the same guard. The preceding timestamped disk/RAM check
passed and is retained verbatim in `evidence/first-control-incident.json`.
No acceptance retry or allowance increase occurred. Generated padding was removed;
its bytes/hash and generation recipe remain. Per-operation evidence was losslessly
archived to reduce retained filesystem overhead. Initial WAL/session baseline is
preserved and allocation remains held through coordinator closeout.

Remaining unexecuted checks: exact/over input-size boundary, explicit finite/nonfinite
CLI-limit delta, and the mutation restoring the old parser against the original
reproducer. The regression recipe includes these checks, but its current fixture
placement must be corrected before a separately authorized acceptance attempt.
This branch is a partial repair handoff, not a completed acceptance result.

The prior 72 passing independent checks and prior 52-case evidence remain historical
reused results bound by `evidence/reuse.json`; they were not rerun or relabeled as
fresh results for the modified parser. Only the affected JSON groups were exercised.

`offlineValidationOnly=true`, `runtimeQualified=false`; the original live CLI,
FUSE and browser gap remains **OPEN**. No backend, game, guest, browser, build,
Boat, installer, download, mount, main push or public deployment was executed.
No test box was assigned. Lifecycle/shutdown ownership remains with coordinator.

Publication is recorded in the canonical receipt and bounded publication note.
The coordinator owns messageboard delivery because the standing board exceeds
the worker file-size cap. Do not promote this partial result as accepted.
