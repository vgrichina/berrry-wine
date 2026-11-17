# Caesar III persistent owner and terminal operator sequencing error

Evidence: `scratch/runs/20261117-caesar3-persistent-owner-road-population-progress/result.json`.

The persistent launch owner repair is published as `df365af76`. A dedicated
waiting owner pins the actual task worker's PID/start token with a pidfd before
clearing inherited spawning-thread PDEATHSIG. It prearms an independent deadline
watchdog, launches the existing parent supervisor, drains both pipes, and actually
waits for that supervisor and its watchdog. The Caesar owner implementation is
byte-identical to the released HL2 `9945c2998` owner. No shared helper was edited.

Real process tests prove survival after a transient launcher actually returns,
including an inherited SIGTERM policy, and prove cancellation on dedicated-owner
SIGKILL. The latter retains actual native, adapter/outer, adopted owner children,
and watchdog waits, both EOFs, and an empty final scope. Native SIGTERM is accepted
as cancellation only; it is never reported as native Quit. The independent owner
deadline test also passed. The required locked build passed. Earlier authored
attempts exposed a substring-comparison bug in the new reuse check, an overly
strict cancellation exit expectation, and live fdinfo enumeration races. Those
failed proofs remain explicitly excluded; the corrected final native route passes.

The executed source graph is explicit: published `c993e385c` base, the exact
`aa25b83f8` Caesar authored test, and the new published adapter component. Every
other source hash matches the completed prior repair proof. AST-selected source
bodies for original execution, native cancellation, passive readiness, and the
controller match the prior repaired adapter exactly. Component reuse rejects
changed host/runner/controller/module/inventory identities. A fresh retained
sealed module and main/CPUWorker/OS-child inheritance run precede each native
execution. Its hash remains
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`.
Readiness `583db55a9`, finite reviewed arrival/press `c993e385c`, and shutdown
`aa25b83f8` are reused by those matching components; no unrelated main HEAD is
claimed qualified and no full unchanged suites were rerun.

The single authorized fresh original started with all 114 recursive media files
hashed before its 2400-second native clock, 2420-second independent watchdog,
240-second Quit reserve, defaults and real ticks unchanged. Owner 785570 survived
the launching tool return, and its worker 771799 remained alive. A passive current
unfiltered USER return preceded the first capture. I personally viewed the
complete Caesar III title image, reviewed it, and bound the input owner once.

I then made an operator sequencing error: I invoked `review-hover-intent` on the
same title scene after its immutable review already existed for binding. The
attempt to publish `title-review.json` again failed with FileExistsError before
any finite intent, pointer movement, DOWN, or independent UP was created. It
correctly latched permanent UNKNOWN. The correct sequence for an already reviewed
scene uses `hover-intent`; a fresh review-and-intent mode requires a previously
unreviewed scene. This is an agent error, not a measured game or native fault.
No speculative runtime change was made to bypass immutable reviews.

There were four HTTP requests, zero input commands, zero requests after UNKNOWN,
no retry/replay/rebind, and no second original. Automatic host cancellation then
retained native exit 0 with actual wait and both EOFs, native watchdog wait,
outer and both watchdog waits, owner/outer and owner/watchdog waits, and an actual
wait for the owner with both EOFs. All measured scopes are empty. All 114 media
files still match. This is HOST CLEANUP, not native Quit.

No city, new housing, new road, occupied dwelling or immigration was reached in
this original. The predecessor's charged plot and Pop 0 are prior evidence only.
The current allowance is spent and endpoint is permanently closed. Further city
work needs a separately authorized original and the corrected finite command
sequence. No box or other worker was created: box ID and expiry are null,
state NOT_CREATED, and stop receipt is NOT_APPLICABLE.
