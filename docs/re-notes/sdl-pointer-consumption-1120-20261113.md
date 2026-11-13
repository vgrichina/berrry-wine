# SDL pointer consumption: target-specific hover delay

Run: `scratch/runs/20261113-sdl-pointer-1120/`.

The public browser path maps/clips motion in `handleMouseMove`, computes the
target client coordinates, and queues a mouse snapshot. `host.js` calls
`renderer.takeInput(owns)` with process/window ownership filtering; its follow-up
imports preserve the selected event's parameters. USER's message/wait handlers
consume or cache that event. SDL receives ordinary guest window messages;
there is no game-specific SDL input adapter here.

`takeInput` deliberately ends the motion pump before delivering a following
press, with a default 30 ms floor, so frame-based hover processing can run.
Its former global `_pointerMoved` and `_lastMovePoint` allowed another window
to bypass this rule in three deterministic cases:

- Another target previously received motion at the same screen point.
- Another target consumed a press after this target's move.
- Another process polled empty after this target's move.

The focused test uses two HWND ownership filters and a zero timing floor to
isolate the empty-poll condition. All three cases delivered the press early
on the parent implementation (35 existing checks passed; 15 new checks failed).
Hover records now belong to their target HWND, and an ownership-filtered empty
poll marks only matching records. Each target retains its latest point so
repeated stationary motion keeps the existing behavior. Records contain input
data, without guest callbacks or saved guest context. The existing timer,
release hold, exceptions and restoration paths remain in place.

All 50 hold/order checks pass after the change. Focused mouse drag/mask,
letterbox coordinates, input clock domain, cursor state, Worker event-slot
isolation and pointer receipt/error regressions also pass. The callback census
row records the reviewed lifetime delta; broader invocation ownership remains
pending. The locked build result is preserved in the run evidence.

This is a demonstrated shared-host consumption defect relevant to hover before
selection. It does not establish the cause of LMarbles Puzzle 2 behavior or a
Tutorial prerequisite. Original game pointer-first selection remains UNKNOWN:
no original game, guest payload, state, profile or config was changed or run.
Disk space was below the runtime floor. No box or worker was created;
box ID/state/expiry are NONE/NOT_CREATED/null, and a stop receipt is not applicable.
Next: once sustainable disk headroom is available, inspect native LMarbles
hover and selection using ordinary pointer input.
