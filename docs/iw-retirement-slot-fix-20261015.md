# IW Worker retirement and scheduler slot ownership

Base: `4050bacb396c76f6b171c843f9c03ef4021e0bae`.

Scheduler exit previously removed a Worker from the host inventory before its
scoped-loader retirement completed. Lost replies or pin cleanup faults retained
the Worker but shutdown could no longer find it. An exited scheduler record also
allowed immediate tid reuse and stack release while that Worker still existed.

`dropThread` now retains exact link ownership until successful retirement and
termination, returns the completion/failure, and keeps failed owners available
to host shutdown retries. Shutdown unions live, starting and retiring inventories.
The link keeps its Worker until termination resolves and marks retirement complete
only after both guest and legacy render termination complete. Failed termination
can retry without requiring a second loader receipt from a stopped endpoint.
Scheduler allocation reserves the tid until that completion; stack release checks
the same condition. Failed bootstrap propagates its link to a scheduler record so
cleanup failure cannot silently recycle its tid or known stack allocation.

Local validation (no canonical build, native x86 execution, browser or remote):

```
node test/test-thread-send-scoped-loader.js
node test/test-thread-send-frame-ownership.js
node test/test-scoped-dll-lifecycle.js
git diff --check
```

All pass. The extended scoped-loader test uses its existing tiny Wasm ABI fixture
in an actual Worker. It opens a scoped lookup, injects a slice transport failure
to exercise the production scheduler exit/drop path, then tests lost replies and
repeated generation-pin cleanup faults. Host shutdown must retain/retry the owner;
tid and stack remain reserved through a deliberately delayed termination promise;
successful cleanup releases the pin/gate and stack exactly once. Additional mocks
cover termination failure retry, exact slot identity and failed bootstrap ownership.

Negative control: run the extended test with both production JS files restored
temporarily from the base commit, then restore the changes. Expected exit 1:
`AssertionError: scheduler drop retains failed owner`. This is an ownership failure,
not a build or test-interface failure.

Scope limits: no independent-chain broker deadlock changes, native regression or
original IW execution. A bootstrap that loses its allocation reply still cannot
report the unknown stack address; this change retains its Worker/tid until teardown
but does not invent an allocation recovery protocol. Existing RPC slots remain
monotonically assigned. Persistent retirement failures remain explicit failures
with retained owners; they do not force cleanup or free shared resources.
