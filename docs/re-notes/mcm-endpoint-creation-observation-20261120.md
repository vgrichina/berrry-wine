# MCM endpoint creation observation: scope blocker

Run: `scratch/runs/20261120-mcm-endpoint-creation-source-observation-quarry/`.

The preceding `03fc19d56` original reached the quarry rider/bike Start menu.
Its same-read source-arm predicates refused only the absent legacy endpoint.
Polling that menu at a different time cannot create the required owner.

The attempted explicit preparation installed the guest writer epoch and
synchronous producer at the ordinary scheduler boundary. It returned PREPARED
without an endpoint or publication join. A wrapper on the exact owning link's
legacy factory required an actual endpoint and renderer acknowledgment before
forwarding its first message. Unit controls covered timeout, cancellation,
retirement, owner replacement, endpoint replacement and concurrent creation.
The 23 stage/lifecycle tests and 29 readiness/scalar checks passed.

This is insufficient for MCM. `GuestWorkerLink._forwardRenderLegacy` explicitly
documents that D3DIM never reaches its software-GL legacy endpoint: D3DIM uses
the WAT GPU stream producer. The real GPS endpoint is created through
`WineAssembly._createRenderWorkerEndpoint`. Meanwhile the
`legacy-producer-observation` handler in `lib/d3d-render-worker.js` rejects any
endpoint whose `options.api` is not `legacy`, before installing its shared
render writer epoch and source journal. An endpoint-ready acknowledgment alone
does not install that writer/source coverage.

Two finite browser diagnostic fixtures failed their first-producer assertion:
registration remained PREPARED, endpoint null, join absent. Neither qualifies
the new lifecycle. The first failure did not retain the post-command phase;
the second retained it and also failed. There is no native old-fail/new-pass
proof and no affected-original run in this task. The retained older native29
and CPU-source proofs remain unchanged by SHA; they do not qualify this hook.

Completing this repair requires an owner-checked observation installation on
the actual GPS endpoint, with shared render writer coverage before its first
producer command, plus corresponding producer lifetime and negative tests.
That changes the common producer, explicitly read-only for this task. Creating
a surrogate legacy endpoint, accepting GPS ready as completed source authority,
or omitting render writer coverage would not satisfy the requested proof.

The unqualified implementation and added test were removed from the shared
checkout after retaining their exact Git diff and new-file patch. No code
change is committed. This also restores the existing host callback-lifetime
review hash for other authors. Quarry Start, completed source copy/publication,
Escape, current display and ordinary Quit remain unproved.
