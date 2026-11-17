# Disciples II native hover consumer boundary, 2026-11-17

Authored native fixtures distinguish a filtered owner pump from an exhausted
unfiltered pump. They establish proper refusal under the existing hover contract;
they do not identify the cause of the previous original's missing thread-1 idle.
The prior original and its endpoint remain closed. Evidence is in
`scratch/runs/20261117-disciples2-native-hover-pump-completion/result.json`.

## Public native fixture findings

The authored PE first establishes an actual owner-thread unfiltered idle, then
switches through an ordinary WM_APP message to a window-filtered or range-filtered
PeekMessage loop. An actual CPUWorker independently pumps its empty queue. MOVE
and NCHITTEST pass through real USER and DispatchMessage. Once the native hover
barrier is armed, filtered owner queries and sibling empty queries cannot finish
it. DOWN remains queued; 500-ms transport cancellation purges that exact edge,
and independent UP reaches the real wndproc as `UP WITHOUT DOWN`. An unfiltered
control reaches `UP after DOWN`. PM_NOREMOVE followed by removal preserves the
same ordering. An earlier fixture that switched before readiness was established
did consume DOWN; its failure is retained, not treated as an armed-barrier proof.

Production-WAT public-thunk tests exercise both filter forms and both removal
modes, actual x86 MOVE/NCHITTEST callbacks, filtered-out message retention,
filtered GetMessage's native wait, sibling refusal, and the legitimate transition
back to owner unfiltered exhaustion. The complete public API transcripts match
with native observation enabled and disabled. Wrong thread, memory, generation,
replacement window, retirement and hidden target cannot acknowledge hover.
Actual nested x86 PeekMessage inside a wndproc retains a separate observation
identity. Existing guard tests cover focus/actor/context changes, cancellation,
release-before-delivery and late DOWN refusal. No timeout, actor, target, frame,
focus, writer, receipt or independent release rule changes here.

## Essential diagnostic

The old public trace cannot identify the native consumer or its Peek/GetMessage
filters at a host empty poll. `set_user_pump_observation(budget)` now enables at
most 4096 observations in that WASM consumer; the default is zero. Peek/Get entry
records include native thread, MSG pointer, HWND/range/removal filters, stack and
return address. A separate handler-return identity records EAX, yield reason,
stack position and a returned MSG header when its API frame was consumed.
Disposition 1 means consumed API frame, 2 means yielded/parked, and 3 means another
stack shape, including possible callback redirection. Dispatch entry retains the
actual public MSG HWND/message and its own sequence. These counters are diagnostic
identities only; routing and readiness never consult them.

`WINE_PUBLIC_INPUT_TRACE` samples those exports at the existing renderer poll and
ticket lifecycle boundaries. It identifies the bound actor/main source and
records the target's actual native owner/generation, memory match, renderer-window
identity and retirement/visibility. It invokes no additional guest API, reads no
private game state, and does not run another guest slice. Unsupported or retired
diagnostic exports produce an unavailable record while preserving dequeue and
refusal behavior. Consumer entry and last completed handler have separate IDs;
their fields must not be combined as one call when the IDs differ. The explicit
`callbackReturn: unmeasured` is intentional: neither host dequeue nor native
handler redirection proves that an application callback returned or processed a
frame. This is sampled public execution, not a complete API-call history.

The existing limits remain 64 tickets, 512 rows/ticket and deadline plus 1750 ms.
An idle-tail qualification exposed loss of the distinct UP in the old rotating
ring. At most one quarter of those same rows now preserves exact input and
lifecycle identities, alongside the prefix and rotating tail. Lifecycle rows
retain their latest native sample so cancellation's filter/wait identity survives
later idle traffic. Overflow counts remain explicit. No queue action or native
acknowledgement is inferred from those records.

Native on/off public-API samples and actual CPUWorker controls measure the cost;
raw sample/flush timings and earlier failed tests remain in the run. Observation
budgets exhaust without changing public return values or callback execution.
Seven trace-on/off guard negative pairs and unavailable-export failures preserve
the original outcomes. Canonical and exact published-module qualification are
recorded with the final outcome in the evidence result.

## Original and next boundary

The one fresh diagnostic original is conditional on published observation and
native qualification. Its complete fresh frames, individual reviewed intents,
immutable Git-only source/module, unchanged 128 media files, fixed native and
independent watchdog deadlines, terminal boundary and shutdown are recorded in
the evidence result. This report does not claim a map action, turn consequence,
native Quit, or a causal repair from authored fixtures alone.
