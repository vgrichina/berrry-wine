# Guarded CLI consumption and NFS native admission, 2026-11-13

The missing opt-in CLI consumption guard is implemented and qualified against
actual `test/run.js`, including its real renderer and D3DIM Node Worker.
Native NFS III race, Pause/Continue and driving remain **UNPROVED**: the sole
post-qualification native admission sample was **1,488,797,696 bytes** available
on `/home`, below the strict 1,500,000,000-byte requirement. No NFS original
was launched and no renderer selection or driving input was submitted.

Evidence is `scratch/runs/20261113-cli-consumption-guard-nfs-native-0910/`.
The distinct remaining blocker is capacity after the consumer defect was fixed.
The designated resource0900 worker's actual outcome was
`NO_ADMITTED_MATERIAL_CLOSED_STDOUT_POOL`, with zero recovery. That result,
verification and publication are referenced by path/SHA in
`dependency-observation.json`. No other cleanup, floor polling, RAM gate or
protected Pawn/LMarbles/recovery-data modification occurred.

## Protocol and consumption boundary

`{action:"guarded-bind"}` returns an opaque `owner`, `epoch` and `identity`.
These identify actual in-process instance/exports, memory/shared buffer,
renderer/input queue, native window/canvas/dimensions, input handlers and,
when present, the production D3DIM device/encoder, adapter, module, control
and command buffers. No absent guest-main Worker role is invented.

Submit one supported edge using:

```json
{"action":"guarded-input","cmd":"keydown:38","guard":{"owner":"<bound>","epoch":1,"identity":"<bound>","nonce":"<unique reviewed intent>","deadline":1794536000000,"reviewed":true}}
```

The deadline must be a fresh absolute wall-clock millisecond value, within
the timer range. The example timestamp is illustrative, not reusable.
Supported edges are `keydown`, `keyup`, `mousemove`, `mousedown`, `mouseup`;
other actions and malformed arguments are refused. Ordinary legacy input
commands retain their existing interface and behavior.

The envelope is captured into an immutable event/deadline with a monotonic
expiry bound. Identity, health, deadline and the intent's one-use claim are
checked immediately before the real renderer handler. They are checked again
before real `takeInput`, which can otherwise reassert async DOWN state.
Expired/replaced-owner pending effects are removed from the originally bound
queue; cleanup releases survive. Nonce tombstones remain for the CLI process
lifetime. Rebinding cancels the preceding epoch's pending input.

A frozen reply explicitly says `queued:true,consumed:false`. Query
`{action:"guarded-status",nonce:"..."}` for its receipt; a consumed receipt
means the physical handler returned, not guest dispatch or a rendered frame.
After later expiry/cancellation, `consumed:true` preserves the fact that the
handler previously ran. Effect/inspection errors are terminal `UNKNOWN` with
`noReplay:true`. HTTP pending-command timeout cancels the guarded intent and
returns a 504 carrying that UNKNOWN receipt; socket disconnection also cancels
pending guarded work. Ordinary noncancellable promises retain their old timeout
behavior.

`{action:"guarded-release",owner:"<bound>"}` is the independent release path.
It cancels pending DOWN before it can execute and releases held keys/buttons
through the originally bound renderer, without requiring a valid deadline or
current owner identity. Native fault retention instead abandons guarded work
and uses the existing host-only fault cleanup, preserving its prohibition on
guest callbacks. Normal CLI shutdown releases guarded input.

## Qualification and limits

`before.log` records the actual CLI regression test failing before the change:
the new guarded action is unavailable. Parent198090574's actual legacy CLI
fixture separately supplies the concrete expired/replaced-queue DOWN and known
duplicate-nonce double-effect failures; its 16-control result was read first.
This run does not relabel the parent's 1516ms Solitaire HELD frame as native
NFS Pause evidence.

`after.log` and `cli-test-result.json` record actual CLI producer/consumer
checks for queued-versus-consumed ACK, one-effect duplicate refusal, expiry
between enqueue and consumption, long synchronous producer turn, actual
queue/window/device replacement, inspection error, epoch replacement,
independent HTTP release before pending DOWN, effect-error UNKNOWN, expiry
with DOWN still in the real queue, physical cleanup and preserved UP, and
ownership change immediately before actual `takeInput`. The separate timeout
case uses the production transport and guard manager with a controlled effect
counter, not a native game. It verifies that a timed-out ticket cannot later
consume and remains UNKNOWN; it is not described as an actual CLI timeout.

The fixture's independent absolute deadline watchdog was observably armed
before runtime creation and bound to PID/start ticks. The fixture and watchdog
both have actual exit0 waits and stdout/stderr closure. The independent HTTP
release subprocess also completed normally with a known receipt. No uncertain
input was replayed. This is consumer qualification, not native Pause, race
rendering or driving qualification.

`regressions.json` records the related existing control, stdin, frozen-control,
input-state/clock, DirectInput mouse and fault-cleanup tests. Two stale test
fixtures needed maintenance: the source-region fixture lacked real `require`
and the scheduler binding and used an outdated trace marker; the tick test
needed explicit `--clock=batch` after the default service-clock migration.
Their original assertions remain. The locked `tools/build.sh` log is
`build.log`. No broad historical fixture matrix was run.

`freeze.json` preserves the 133 original media and the prepared b8ac865a5
native catalogue/setup/export route by existing path/SHA, without copying
media. Parent module `04c53419…f0a17`, app registry and media pins remain
unchanged; the CLI source pin deliberately changes. Current source identity is
`source-base-commit.txt`, `relevant-source.patch`, `owned-new.patch` and helper
patches. Git is the source archive; no source-tree/media archives were made.

Next requires sustainable authorized disk headroom, then the unchanged native
catalogue/setup/chooser export transfer into `nfs3_chosen_renderer`. Personally
review ordinary renderer selection/race and two settled native Pause/Continue
frames with stable world timer before one reviewed >=1500ms interval, with
independent UP/Escape and a HELD frame before UP. No automatic route, extra
Present, forced call, guest/config/clock/AI edit or old UNKNOWN replay was used.

Box ID **NONE**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
No agents, other Codex workers, public deployment or new boxes were created.
