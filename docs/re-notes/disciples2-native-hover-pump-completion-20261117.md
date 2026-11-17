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

The one fresh diagnostic original used published `7810e8a2a0f8cef8bb27daa956453a62c2934382`,
Git-only full source SHA `714208d3b7ec4e7f2f89ce6619c593a8b617330ea0d8d8cb3c847d18c8b607ea`
and qualified module SHA `a01678daa31393ac24eff152c7ac9586700eeb166ef7dcbe20e642faa2434a2c`.
All 4589 Git bodies were independently verified; no owned patch or foreign WIP was
applied. The intervening published commit changed another worker's report only;
the sealed runtime inventory remained identical. Main, actual Worker and child
inheritance passed. The canonical flock build and focused guard/context tests
passed. Exact sealed native units, trace units, ordinary unfiltered control,
filtered on/off controls and PM_NOREMOVE control all passed with actual wait/EOF
receipts. The ordinary wndproc saw `UP after DOWN`; both filtered controls saw
`UP WITHOUT DOWN`, with no late DOWN. The 128-media preflight passed unchanged.

Five individually reviewed finite setup clicks were consumed and independently
released. The personally viewed complete fresh quest-intro frame is retained as
`original/questintro.png`; it is a story introduction, not a map. Continue then
reached permanent UNKNOWN at the unchanged 500-ms transport boundary. There was
no subsequent interactive HTTP, rebind, replay or second original. Only the
already armed independent release continued.

The new public observations materially narrow the missing fact. During this
specific Continue attempt, the same thread 1 owns target HWND 65537, generation 1,
with matching window and memory and a live visible target. Its consecutive USER
entry identities are 16939 through 16943: prior WM_TIMER dispatch; unfiltered
`PeekMessage(..., 0, 0, 0, PM_REMOVE)` at +244.276 ms; NCHITTEST dispatch at
+244.936 ms; another unfiltered PM_REMOVE Peek at +466.494 ms; and SETCURSOR
dispatch at +468.840 ms. Times are relative to trace preparation. Completed Peek
identities 16940 and 16942 each returned a message (NCHITTEST and SETCURSOR), not
exhaustion. The last observed entry at cancellation remains SETCURSOR dispatch.
These positive observations refute a filtered-query or changed-owner explanation
for those calls. They do not measure application callback return, prove that an
application frame processed, or explain why owner exhaustion did not occur.
Later owner Peek entries and timer/message dispatches show continuing public
execution after cancellation; they cannot authorize delivery of the purged DOWN.

Exact DOWN 23 remained behind pending hover and was purged at +499.718 ms.
Distinct UP 24 returned at +503.218 ms. Independent release acknowledged at
+1500.239 ms. Retained pre-purge rows include at least 127 renderer returns,
125 null returns and 121 sibling idle entries, all observed on thread 4. The
512-row per-ticket cap was not increased: final ticket saw 700 rows; the union
of bounded flushes retains 683, with sequences 129–145 absent. Counts are lower
bounds; positive USER entry identities above are consecutive and retained.
No absence-based claim relies on those missing rows.

Original native observation cost was 1976 host samples, 26.954 ms total,
0.293 ms maximum; 18 bounded flushes cost 13.118 ms total, 3.115 ms maximum.
Published filtered native control measured 1026 samples, 27.976 ms total,
0.942 ms maximum and 4.657 ms total flushing (2.208 ms maximum). Raw contention
outliers from earlier qualification remain in evidence; these are measurements,
not universal scheduling bounds. On/off public transcripts and seven guard
negative pairs remained equal; observation adds no guest calls or slices.

Native, independent watchdog, both outer wait owners and the module holder all
returned zero with actual waits and both EOFs. The unique module was retrieved
and hash-verified before normal holder shutdown. The control port is closed;
own processes and watcher are absent. No boxes were created. No map action,
turn consequence or native Quit was achieved. No contract defect was established
and no speculative readiness repair was made. The next boundary is actual native
callback/consumer completion and legitimate hover readiness/wakeup under this
observed unfiltered, nonempty owner path, using public execution evidence. This
original stays closed; another original needs new authorization.
