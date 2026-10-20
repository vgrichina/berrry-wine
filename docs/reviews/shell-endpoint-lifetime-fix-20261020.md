# Child loopback endpoint lifetime repair — 2026-10-20

Base: ee129daaf02d3398442c34d42e8aa67fb618771e. Defect established by
fa1f3097b16b39fe6c1c135dbe0cf31633f209f2. Implementer regression only;
**independent acceptance remains pending**.

The process launch closure now owns its preallocated child LoopbackWire. Its
one-shot completion retires that endpoint before publishing EOF, whether the
launch completes without a child, fails during boot, is canceled before/during
attachment, or an ordinary attached child stops. Synchronous shell refusal and
exceptions also complete and remove the unpublished process record; refusal
still returns zero and exceptions still propagate. No new installer skip or
successful failure result is introduced. Existing completion status and merge
rules are unchanged.

LoopbackWire.close removes only itself from its segment, clears unread input
and arrival hooks, and drops its segment reference. It is idempotent; a closed
wire cannot send or accept further frames. It does not emit GONE. The existing
process completion guard remains the sole EOF owner. Broadcast snapshots its
recipients because a synchronous delivery hook can retire an endpoint during
iteration. Live stream overflow still throws rather than silently losing data.

The caller endpoint and sibling endpoints remain attached. Closing an E4/E6
process handle does not terminate its child. Stopping the caller likewise does
not terminate its independently owned live children or their transport. Pending
and attached children retain queued input until process completion. Cleanup is
based on process completion, not process-handle close or deferred guest-memory
release. No startup-show hunks or browser-shell source were changed.

## Validation

From this repository root:

    node docs/reviews/shell-endpoint-lifetime-fix-20261020.js

17 focused groups pass. The fixture derives from the independent endpoint
review, retaining its acceptance function unchanged and using complete
production wire code, host spawn/control/stop/join/memory-release functions,
shell launch/failure/stop wrapper, process aliases and ThreadManager waits.
It checks no-child completion, 101 skipped launches, 20,001 subsequent DATA
frames, codes 0/259/0xffffffff under reentrant cancellation, ordinary exit,
TerminateProcess, cancellation before and during attachment, failure with and
without a child, synchronous refusal/throw, EOF source/type/drain/once,
caller/sibling traffic, handle closure, caller stop, reentrant recipient removal,
and explicit live receiver overflow.

Six in-memory source mutations must exit 1:

    MUTATION=retain-child node docs/reviews/shell-endpoint-lifetime-fix-20261020.js
    MUTATION=close-caller node docs/reviews/shell-endpoint-lifetime-fix-20261020.js
    MUTATION=early-close node docs/reviews/shell-endpoint-lifetime-fix-20261020.js
    MUTATION=double-eof node docs/reviews/shell-endpoint-lifetime-fix-20261020.js
    MUTATION=retain-inbox node docs/reviews/shell-endpoint-lifetime-fix-20261020.js
    MUTATION=mutable-broadcast node docs/reviews/shell-endpoint-lifetime-fix-20261020.js

The exact unmodified base must exit 1 at the original independent unused-child
endpoint assertion:

    SOURCE_REV=ee129daaf02d3398442c34d42e8aa67fb618771e node docs/reviews/shell-endpoint-lifetime-fix-20261020.js

## Evidence, recovery and limits

Evidence: scratch/runs/20261020-shell-endpoint-lifetime-fix-oct20/.
setup.json records base, sparse-before-materialization and shared metadata
hashes; tests.json and controls.json record assertions/source seals and failing
controls; validation.json, change.patch, receipt.json, remote.txt and
SHA256SUMS.json record validation/recovery and exact task-branch publication.
The patch and committed four owned paths recover the change; no generated
binaries are needed. The independent clone uses the supplied review object's
store read-only. Git warns about overly deep inherited alternates; all needed
objects were readable and exact remote verification is recorded separately.

Every write operation is preceded by a numeric free-space gate using the
conservative full-cap threshold 2,277,507,072 bytes (2,210,398,208 floor +
33,554,432 reserve + 25,165,824 concurrency + full 8,388,608 cap). The full cap
is used even as remaining cap decreases. No gate failure or retry occurred.
Shared HEAD/index/config and old WIP are preserved; no main integration.

Tests substitute environmental DOM/VFS/scheduling and unrelated runtime cleanup.
Traffic is synthetic. No compiled slice was necessary for this JS ownership
change. No guest pipe-read/EOF behavior, GC/heap measurement, full VM, Worker
IPC, browser, installer or game qualification is claimed. No Boat runtime,
403 retry, full build, worker/refill, Claude panes, laptop HeroesII/WarcraftIII,
or public deployment was used. Independent review follows; this task stops.
