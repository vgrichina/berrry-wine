# Q3 local owning interactive controller repair

Evidence: `scratch/runs/20261109-q3-local-controller-stdin-wait-repair-1607/`.
Source recovery uses `git-base.txt` plus `owned.patch`; no source/media archive.

The retained 1705 `interactive.py` spawned its caller before registering stdin
with epoll. `/dev/null` and regular files therefore raised EPERM after spawn,
without an actual child wait. An already closed pipe also spawned a caller.
Those before-fix behaviors are reproduced with the exact retained controller
body and inert local children; the regression itself recovers their waits.
The historical original child wait remains UNKNOWN.

`tools/q3-local-interactive-controller.py` is the production replacement for
that local parent. Its CLI authenticates the selected retained caller SHA and
invokes precisely `python -B CALLER launch original`. Before that sole spawn it
requires a live pipe or terminal, registers stdin, checks current EOF/HUP, and
opens exclusive output logs. Unsupported descriptors, EOF, registration errors,
or evidence setup errors reject setup without creating a child. This is a
local wrapper: it changes no caller/provider bytes, version selectors, pins,
physical/WebGL checkpoints, custody predicates, input protocol, or deadlines.

The parent uses raw reads and nonblocking writes, forwards only complete
newline-terminated input byte for byte, and observes child output/EOF before
forwarding input in each poll batch. The first error is sticky. Its finally
path closes the same caller input pipe, drains separate stdout/stderr into gzip
logs, and actually waits. EOF is terminal cancellation, never detach. The
75-second local cleanup cap allows the retained caller's existing cancellation
and read-only join path to settle; it never extends guest/runtime deadlines.
At that local cap the direct child is killed and actually waited. Inherited
pipes that still lack EOF are explicitly incomplete, never successful custody.

Example invocation (only for a separately authorized fresh run):

```sh
python3 -B tools/q3-local-interactive-controller.py \
  --caller RUN/q3-checkpoint-caller.py \
  --caller-sha256 EXACT_CALLER_SHA256 --evidence NEW_CONTROLLER_DIRECTORY
```

Keep its stdin writer open through setup and gameplay. Commands retain the
caller's exact JSON-line contract; there is no implicit start, replay, retry,
extra capture, or deadline reset. Do not invoke the already failed original.

The regression exercises the real production CLI with a small offline harness
that executes the SHA-authenticated retained 1705 original `launch()` body,
the actual retained task launch/command branches, and the real owning Session.
Only native prerequisites and the outer Boat/native transport are inert test
seams. The first actual command branch receives a transport refusal; a later
capture queued in the same batch never reaches even its requested-command
save. All Session child waits, caller wait, CLI wait, and separate output EOF
are checked. This does not claim native readiness, remote custody, normal
browser-close EOF, movement, firing, or historical screenshot-stall resolution.

Other regressions cover zero-spawn setup rejection, real epoll EPERM injection,
pipe and actual PTY input, split UTF-8 and partial line boundaries, post-spawn
stdin EOF, sink exceptions, post-spawn registration exceptions, and forced
kill/wait at the local cap. The first sink error survives later stderr and
nonzero exit. The initial test-run cleanup error, an intermediate early-exiting
test harness, and a command-boundary invocation missing its required environment
are retained as failures. `regression-final-source/result.json` plus its watchdog
wait establish the final pass.
Existing launch-client controls, both versioned lifecycle actual offline
prelaunch/custody/staged-consumer routes, command boundaries, and locked build
pass. No provider substitution or pin refresh is part of this change. Four
reproducible startup manifests were deduplicated only after independent
SHA/size/gzip-CRC verification; `manifest-recovery.json` records restoration.

No box, native/original attempt, local Chrome, worker, or public deployment was
created. Box ID/state: NOT_CREATED; expiry and stop receipt: not applicable.
The independent finite local test watchdog is armed before fixture children
and actually joins with separate stdout/stderr EOF in the final regression.

Next gameplay action: Q2 retains sole NEXT native runtime. After that slot is
released and a fresh Q3 original is separately authorized, use this controller
with fresh authenticated prerequisites and the original immutable deadlines;
stop at the first failure. This offline repair does not authorize a retry.
