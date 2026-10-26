# Authentic original Maelstrom diagnostic capture — 2026-10-26

**FIRST REJECTION CAPTURED: reason 3 (`uop`), mode bits 4, batch 36170.**
One authentic original guest used unchanged candidate
`44e344fdb26daab9a07210656597902ba27cb5f7` (source tree
`ec7ee531e723627fd8387c0786abf35521d9fc77`) and the retained canonical tail
module SHA-256 `aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1`.
No build, synthetic native execution, source repair or second guest occurred.

The native latch rejected at status 5/event 0. Its immutable diagnostic scalars
and adapter record agree: reason 3, modeBits 4 (`uop_enabled`), expected and
observed return `0x7a3362`, phase 3, completions 1, fault/active/capped all 0.
The select record has token 7, entries 7, parks 6, result 0, thread 1.
This is an authentic completion observation, separate from prior controlled
fixtures. The source's ordered checks test code16, block-exec, then uop before
checking return/phase/completion predicates. No mode flags were changed.

**Errno before CMP and caller remain UNKNOWN.** Their native fields were never
acquired: zero-filled rejected capture fields must not be reported as observed
errno 0 or caller 0. The result establishes this first unsupported-mode guard,
not a production defect, original `_getptd` result, gameplay or visible play.
The independently accepted 40 synthetic native records and 25 adversarial
evidence controls at `797e8a6d9b400608d634ed41ae0602574e7bc035` are reused,
not rerun. Its supplemental callback fixture remains UNQUALIFIED.

Authentic loader validation PASSED before capture start. CRT loaded at
`0x522000`, SDL_net at `0x7a2000`; `_errno` bytes at `0x52e430` are
`e82274ffff83c008c3`, relocated SDL_net bytes at `0x7a32f2` are
`8b3d10407a00`, and IAT `0x7a4010` contains `0x52e430`.
All required loaded anchors, raw exported fields, module bases and live host
registers are retained before validation and at first latch rejection.
This run does not establish a CRT loader mapping failure.

The original input schedule, batch size 1000, max 42000 batches, 200ms ticks,
60 seconds, 512MiB heap and arena were preserved. The canonical parser and
actual staged argv enumerated and hashed all 48 original tree-mounted files,
including comma-bearing names. All 250 staged manifest files passed API hash
readback. Host-only adapter controls verified errno/caller persistence through
a simulated first failure, with no Wasm or fabricated guest CRT memory.

`collected/guest/native.jsonl` is the adapter record;
`collected/guest/native.jsonl.raw.jsonl` contains raw scalars and anchors;
`collected/guest/output.log`, `command.json` and `terminal.json` bind execution.
Offline `recovery/review.py` checks raw/decoded/anchor/process/hash agreement.
Supervisor inherited-limit, TERM/KILL/reap and output-cap controls passed.
The one guest exited 1 naturally after 5.17 seconds, all owned processes reaped,
remaining group false. Evidence is not a gameplay acceptance claim.

Recovery recipes and immutable file identities are retained under `recovery/`.
They refer to standing read-only donors for original inputs and dependencies;
the binary is deliberately not committed. Restore it only from the pinned
retained canonical artifact and verify its SHA-256. Historical schedules and
box IDs are not launch authorization. A new runtime attempt requires a new
coordinator assignment; these recipes must not automatically retry this result.

Resource receipts include both hosts, checkout/Git, evidence/publication,
session/launcher, positive SQLite/WAL growth, conservative API request/response
event charges, future growth and 8MiB reserve inside 64MiB. Mandatory memory,
disk, file/output/capture and lifecycle gates passed. Bootstrap excerpt excess
and routine missing-path corrections are disclosed in `incidents.json`.

No main integration; root tracked/index/refs and all donors remained read-only.
Root streaming ref digests match. Task branch publication is separately verified
by the final external `ops/result.json`. Box `bx_7qwjxps7` remains RUNNING;
coordinator owns shutdown 05:50 UTC, expiry 2026-10-26T06:06:24.385Z.
