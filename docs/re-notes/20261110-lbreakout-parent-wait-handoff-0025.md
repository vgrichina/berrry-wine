# LBreakout fixture parent completion handoff, 2026-11-10

The actual generated workflow now awaits fixture close, successful parent wait,
stdout EOF and stderr EOF before creating the original parent. A close ACK or
cleanup record cannot release the gate. The single authorized live original
process was created after this gate passed, then exited before browser creation
because the run-specific generator substituted inside the environment key
`BROWSER_DEADLINE`. This was the first live failure. Immediate owning native
cancellation found the process already absent. No original input, SDL diagnosis,
brick removal or score progress was obtained. No second live attempt followed.

Evidence: `scratch/runs/20261110-lbreakout-parent-wait-handoff-0025/`.
The tested handoff implementation was published as `9eb0b48f6` before allocation.
`runtime-pins.json` records the exact staged Git SHA, sizes and hashes for 822
inputs. Git and small binary diffs preserve source; no source/media archive was
created. The accepted unchanged fixture from `4fc62b7d7` was reused without
rerunning it. `accepted-fixture-reference.json` names and verifies its original
cleanup and completed wait record. Derived per-stream EOF receipts explicitly
reference that prior completion and its hash; they do not claim a new wait.

`tools/lbreakout-case-inspection.py` now generates both the launcher and the
close-to-original workflow. The launcher drains each pipe on its own thread,
records actual `wait()`, and publishes each stream EOF independently. The gate
waits for all three completion records with a bounded deadline and rejects
negative cleanup, parent or EOF records and passive fixture failures. Inspection
also reports the separate EOF records.

Offline controls ran the actual generated close command, delayed fixture child,
parent wait, a pipe inheritor delaying stderr EOF beyond child exit, and original
creation. Eleven missing/failure negatives never create an original parent.
Original launcher stdout/stderr content, actual wait and EOF publication pass.
Existing native SDL/handler controls, browser caller terminal/pulse controls,
case-specific inspection consumer controls and the locked build passed before
allocation.

The first live gate passed with `fixtureParentCompleted:true,separateEOF:true`.
The original Node child exited 1, with actual parent wait and two independently
published EOFs. Its passive stderr identifies the startup deadline assertion;
there was no Chrome process or usable image. The run-specific generator had
used `source.replace('DEADLINE', ...)`, renaming the environment key as well as
its value. This helper error is not evidence of an SDL or game failure.

The follow-up code repair adds `original_workflow_source()`, which composes the
launcher directly and reads `browserDeadline` from lifecycle JSON under the
literal environment key. It performs no placeholder substitution. The permanent
full-handoff test uses this actual composition and asserts the deadline and case
environment in the original child. The corrected run generator also executes
that complete path offline; its separate corrected artifacts preserve the
failed live inputs unchanged. Final focused tests and another locked build pass.
No corrected runtime was launched under the consumed one-experiment grant.

All 16 unique remote artifacts were independently retrieved and SHA-256/size
verified before the sole delegated normal stop. All 822 remote source pins
remained unchanged. Box `bx_kp4nf6uq` had independently observable immutable
25-minute watchdog UUID `ea580614-cc1a-4c56-9201-052d2bccdb6c`, initial API expiry
2026-11-10T00:51:50.272Z and deadline 00:51:50.767Z. Stop
`stop_d618b9d8377d04e7` completed unforced at 00:28:19.124Z; final independent API
state is ARCHIVED with expiry null. Actual watchdog wait code 0 and both EOFs
are retained. Home remained above 1.5 GB free; inherited boxes were untouched.

Next is a separately authorized original experiment using the corrected
composition and the unchanged accepted fixture/observer. Original SDL decode,
keyboard state, paddle handler/inhibit/coordinates and visible score/brick
progress remain unmeasured by this task.
