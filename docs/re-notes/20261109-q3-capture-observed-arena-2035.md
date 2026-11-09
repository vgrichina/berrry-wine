# Q3 capture observation composition and native startup boundary, 2035

The current native fixture stopped at session-scoped `Target.setAutoAttach`
request 6, before navigation, capture, GL samples or gameplay. Its unchanged
20-second deadline rejected the request; public MessageEvent entry and consumer
entry were recorded just afterward. The conditional original was not launched.
Alive arena firing and movement remain **UNVERIFIED**.

Evidence: `scratch/runs/20261109-q3-capture-observed-arena-2035/`.
The requested published base is
`6d6b53babfb4e83e08bde6a179e848b2031fd13f`; the runtime Git base is
`6f1600a7402815b8c0b519581b111430e96110df`, with the small recorded
`relevant-uncommitted.patch`. Git plus `run-inputs.patch` provides recovery;
no source tree or media archive was made.

## Offline causal repair

The actual generated prelaunch/custody test exposed a composition failure in
the published capture observation: inserting `q3Capture.receive` between JSON
parsing and `screenshotCompletion.receive` broke the contiguous seam required by
the unchanged input-wire hook. Node refused the generated native consumer before
Chrome launch. The earlier capture test exercised the consumer without that
native hook, so it did not detect this failure.

The repair places the capture observation after the existing screenshot
observation, preserving the input-wire seam. The capture regression now applies
the real wire hook and compiles the result. The same actual prelaunch/custody
test passes for both generated lifecycle phases after the repair. This proves
the offline composition fix; it does not claim a native startup or GPU fix.

The startup navigation stop, ownership, authentication, protocol, original
deadlines and first-error guards remain intact. The generated Python caller
still hashes to
`25acfe27a8160d4a8b396f71636e41ae4d172b3cb7e8b011cb283ce8ae7764f1`,
including the `2b945315a` stdin repair.

## Exact candidate and native observations

The sealed 942-provider manifest hashes to
`1761212f6d823381339518ff4808e16fbe77382cb92851472faf133cd72913fe`.
Compared with the 1920 closure, the only changed common provider is
`tools/q3-current-module.cjs`; all 327 original media pins are unchanged.
Both fresh build hashes are unchanged:

| Module | SHA-256 |
| --- | --- |
| Primary | `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18` |
| Compatibility | `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf` |

All sealed files passed local SHA/size validation and both remote prelaunch
checks. RF1940's 698 and Nox's 776 pinned providers were independently reread
unchanged; both edited Q3 paths are excluded from those closures. Their active
workers did not gate this separately leased remote lane. No shared provider was
mutated, and nothing was repinned after admission.

The one fixture reached DevTools, `Browser.getVersion`, target discovery and
page attachment. Request 6 addressed session
`CBB82F2125DBA7999EFA8264A1941415`, page target
`DC182C90B1BD83E9F5198A2F6B778133`. The first browser failure was recorded at
20:35:44.894 UTC: `CDP UNKNOWN Target.setAutoAttach; no replay`.

The retained Node monotonic observations show:

| Boundary | Observation |
| --- | --- |
| Send return to public MessageEvent entry | 20,005.200 ms |
| Deadline observation to public MessageEvent entry | 4.327 ms |
| Rejection observation to consumer entry | 4.360 ms |

The public and consumer records match request/session, 67-byte payload size and
SHA-256. Consumer entry found the request absent from the pending map after
rejection. These are separate Node-clock observations. Neither public callback
entry nor earlier nonobservation establishes wire receipt, browser service or
compositor timing. No causal transport/GPU diagnosis follows from them.

There were zero input commands, screenshot requests, PNGs and GL stage samples.
There is no native capture-stage completion evidence. Missing completion remains
**UNKNOWN**. The first failure was terminal: no retry, further input/capture,
manual quit, original launch, firing, movement or deadline relaxation occurred.
The generated consumer's existing terminal cleanup issued its own Browser.close;
that close ACK is separate from ordinary browser-close proof.

## Lifecycle and validation

Box `bx_xngua5gn`, UUID `2f2cea79-5491-43d4-8624-e85309188cab`, is independently
API-confirmed **ARCHIVED**. The independent observable immutable watchdog was
armed before creation, with fixed deadline 20:58:31.964 UTC. Initial box expiry
was 20:58:46.879 UTC; final `archiveAfter` is null and `expiresAt` is not returned.

All 44 unique logs/receipts were retrieved and independently reread for
SHA/size/gzip CRC before exactly one delegated normal stop,
`stop_38f2b9bbe68a0e31`. It completed unforced at 20:37:36.806 UTC. The initial
60-second status poll ended before archival completed; a later read-only API
query confirmed that same stop, without a second stop request. The actual
watchdog wait returned 0 with separate stdout and stderr EOF.

The generated parent, prelaunch child and runtime parent actually joined with
status 1 and separate stdout/stderr EOF. Kernel drain reaped 119 of 119 recorded
owned processes; independent port, profile and writer-absence checks passed.
Ordinary Chrome close remains UNKNOWN. No local Chrome, nested agent or worker
was launched. Free `/home` remained above 1.5 GB.

Passed: capture tests over the real local WebSocket and whole generated caller,
including delayed/held/large/absent replies; native wire-hook regression; both
actual generated prelaunch/custody phases; GL stage integration and six drift
refusals; foreign closure/generated caller with 27 refusals; seven arena command
cases; local interactive controller; execution-boundary tests; and
`flock /tmp/wine-build.lock bash tools/build.sh`. Native fixture failed as stated.
Routine offline invocation/audit errors and the initial composition failure are
retained. `analyze-native.py` verifies the native request timing, no later work,
retrieval and lifecycle from the retained bytes.

The next investigation should address the startup `Target.setAutoAttach`
deadline under these guards. The screenshot/compositor boundary and alive arena
interaction were not reached in this run.
