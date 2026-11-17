# Native callback return and hover consumer readiness

Run: `scratch/runs/20261117-disciples2-native-callback-readiness/result.json`.
This work launches authored fixtures only. The original that ended at permanent
UNKNOWN remains closed; no new original, endpoint query, replay or rebind occurred.

## Measured boundary

The new x86 PE records instructions **after** the actual `DispatchMessageA` call
returns. It saves the public message ID on the caller's stack, checks restored
ESP, and increments that message's returned counter in the caller continuation.
The wndproc separately maintains invocation depth. These are authored fixture
telemetry, not private game reads or production input acknowledgements. Existing
production USER diagnostics still correctly label callback return unmeasured.

Its ordinary unfiltered PM_REMOVE/PM_NOREMOVE owner pump, real SetTimer callbacks,
MOVE, NCHITTEST and SETCURSOR dispatches run alongside a genuine guest CPUWorker
pumping another queue. The nonempty variant uses ordinary GetTickCount calls to
pace each query until a timer is due. Sleep alone was insufficient: the retained
first failed attempt reached real empty queries and legitimately delivered DOWN.
No clock implementation or rate was changed. The nested variant makes a real
filtered Peek inside each callback, using a separate MSG buffer.

The fixture has an explicit drain-then-sample consumer. Only its caller's empty
unfiltered Peek path calls GetCursorPos and advances its cursor sample. That is
part of the authored application, never an API injected into the original or
production callback path. Up to twenty read-only authored telemetry samples
bound observations during confirmation; the production trace remains capped at
512 rows and its native observation budget remains unchanged.

| Control | Actual callback/caller result | Hover and intent result |
| --- | --- | --- |
| Nonempty owner, PM_REMOVE, nested filtered callback | MOVE, NCHITTEST and SETCURSOR returns observed before 500 ms; timer returns also observed | No owner empty query or new consumer sample; hover pending; exact DOWN purged; UNKNOWN permanent; independent UP returned |
| Nonempty owner, PM_NOREMOVE then PM_REMOVE | Same real returned callbacks, balanced caller stack | Same refusal, no late DOWN |
| Ordinary owner, nested filtered callback | Returned callbacks followed by real owner exhaustion and GetCursorPos sample | DOWN consumed through existing native-input-return receipt; UP after DOWN |
| Window-filtered owner plus independent CPUWorker | Existing native query/dispatch controls | Filtered and sibling emptiness cannot release target hover |

Each native control runs with production diagnostics enabled and disabled.
Callback timing and timer counts vary with scheduling; equality covers public
outcomes and guard behavior, not identical wall time or timer cardinality.

## Invocation and lifetime controls

The local full-module test executes an outer x86 wndproc, a real nested cursor
DispatchMessage, and filtered Peek calls in both invocations. Single-block runs
observe depth two, inner return while the outer invocation is still live, and
the final caller continuation. A live callback cannot increment the outer return
counter. The final LRESULT is 42, ESP is restored, and the exact queued DOWN
object survives both returned callbacks and nonempty posted-timer dispatch.
The real sibling empty query still refuses readiness; actual owner exhaustion
then permits that same DOWN. Native observation on/off results are equal.

Actual window destruction and re-registration of the same HWND on another native
thread change its generation and owner. Both the old owner and the new owner
refuse the old move; the fresh exact lifetime is accepted. Existing full-module
tests also retain wrong-memory, wrong-thread, hidden, retired, replacement-window,
generation, filtered-range/window, excluded-message retention, PM_NOREMOVE,
parked GetMessage and observation-budget controls. Production guard tests retain
deadline, cancellation, owner/focus/target change, transport UNKNOWN and exact
object identity refusals. No guard, receipt, timing limit or input transcript
semantics were changed.

## Conclusion and next boundary

Real callback return is compatible with a nonempty owner pump whose consumer has
not sampled its new pointer position. This is a concrete counterexample to
releasing hover on any Peek, dispatch, NCHITTEST or SETCURSOR completion. Callback
return alone does not justify a generic readiness repair. The ordinary positive
control demonstrates legitimate readiness through the existing exhaustion path.

This authored proof cannot establish that the historical original's callbacks
returned, or that its application used this drain-then-sample policy. The original
retains its 700-seen/683-retained-union/17-missing lower-bound trace accounting;
no absence inference is made from those rows or sibling idle traffic.

The next boundary is an observable **owner consumer transition after the returned
hover/cursor callbacks**, distinguishing continued nonempty pumping from actual
cursor/frame consumption. The original's callback-return fact is still unknown.
Any proposed alternative to exhaustion needs public execution evidence for that
consumer transition, exact intent/lifetime binding and nested-callback refusals.
No semantic repair or further original launch is authorized by this result.

## Reproduction and source binding

Run `node test/test-disciples2-native-callback-readiness.cjs --unit` for local
invocation/lifetime controls. Native authored controls use
`node test/test-disciples2-native-callback-readiness.cjs OUTPUT OPTIONS_JSON`;
options include `nonempty`, `nested`, `remove` and `trace`. Each run has a prearmed
independent deadline watchdog and independent physical release, actual child
waits and both EOFs. The final command list and receipts are in
`qualified/focused-checks.json`.

The canonical build is `flock /tmp/wine-build.lock bash tools/build.sh`.
Final qualification records the exact Git SHA, relevant binary diff including
the new test, source body hashes before/after the locked build, and tested module
SHA-256. Foreign WIP is recorded to identify the tested shared tree and is not
adopted into this commit. Git is the source archive. No source trees, media,
screenshots, frame series or capture bundles were copied into evidence. No boxes
were created; box ID/expiry are null, state NOT_CREATED, stop receipt N/A.
