# Held callback loader transactions

Based on `357727bab107158eb9e104f027754e7aff7e5436`. No main merge, broker
admission relaxation, thread-generation claim, canonical build, full VM,
browser, Boat, external download, or game run.

## Owned service

Yields 3 and 5 now receive the callback frame's exact token and a fresh yield
epoch. `scopedThreadSendLoader` captures the pending DLL name and loaded names
at the endpoint. Browser and CLI callback hooks prepare bytes through
`ProcessBoot.prepareScopedLibrary`; neither gets raw exports or clears yields.
Ordinary, noncallback loading keeps its existing paths.

The existing dependency DFS resolves dependencies before dependents. Unknown
vendor imports use a narrowly owned API-name inspection operation; missing
inspection exports or allocation failure retains a fault instead of claiming
that the API exists. Missing vendor dependencies fail before mapping. All
prepared images map before their imports are patched. The endpoint rechecks
the exact top frame and epoch after asynchronous byte resolution. A newer
nested callback defers delivery; retirement or a stale epoch rejects it.

Mapping installs a retained initializer transaction on the owning callback
frame. A duplicate or lost mapping acknowledgement cannot remap. DllMain runs
one interpreter slice at a time through the existing callback driver. Its
stack remains alive for object/message waits, generic yields, nested callbacks,
and reentrant loader yields; reentrant loads stack transactions on that frame.
Cooperative Sleep uses the existing guest-clock advance hook. The legacy
synchronous `callDllMain` remains unchanged for ordinary loaders.

DllMain success requires a normal, nontrapping return at EIP zero, halt code 2,
the original stdcall ESP, zero yield reason, and nonzero BOOL. This follows the
zero-EIP branch of `src/13-exports.wat`'s run loop. EAX starts at zero to avoid
accepting an initializer that leaves a stale successful value. Traps even at
addresses 0/1/2, malformed returns, FALSE, and partial mapping failures retain
faults. Abort/resume cannot erase them; actual owner retirement is required.
Successful initialization restores the saved caller EIP/ESP and SEH head.
COM failure clears the output pointer, sets HRESULT, and returns through the
correct five-argument stdcall frame.

After initialization and EAX/ESP completion, the endpoint emits a separate
publication epoch. It retains the DLL/thunk scalars and result until host
metadata/resources are published and the owning frame acknowledges publication.
Publication retries reuse the retained result; nesting defers acknowledgement.
The host cannot resume past an unacknowledged publication or abort away the
completed transaction. Ordinary getters remain fenced throughout.

**This host publication receipt is not a native loader lock.** `load_dll`
publishes native DLL_TABLE rows during mapping, and `loadedModuleNames` (or
another thread using a shared registry) can see a row before DllMain finishes.
Cross-thread same-name loads and in-flight initialization readiness are not
serialized by this change. That shared-registry ordering problem remains held.

## Verification and limits

`node test/test-thread-send-scoped-loader.js` passes with actual
`guest-worker.js` in Node Worker threads, WorkerLink, the local endpoint, host
callback driver, production ThreadManager, dependency DFS, and DLL-loader JS.
Its tiny shared-memory Wasm fixture implements mapping and interpreter exports;
it does not decode or execute x86, load a real DLL, or implement the native IAT
patcher. Synthetic PE import/export directories exercise dependency lookup,
ordered mapping/initialization, and actual JS dispatch of the expected
`patch_caller_iat` arguments to a recording Wasm export.

Coverage includes delayed bytes/nested frames, stale frame/epoch, exact outer
register restoration, actual event consumption in DllMain, network yield,
nested callback, reentrant LoadLibrary, missing vendor dependency, COM success
and missing-server cleanup, lost mapping/publication acknowledgements,
duplicate publication, retirement during byte lookup, and partial mapping or
initializer faults. Missing API-inspection exports (each of three), allocation
failure, traps at 0/1, bare return to 2, and FALSE initialization are negative
fixtures. Actual x86 DllMain and PE relocation/IAT behavior remain unproven here.

Three temporary source mutations independently fail the suite: remove the
top-frame deferral, remove the epoch comparison, or skip DllMain initialization.
Exact source bytes were restored after each; the unmodified suite passes.

Also passed:

```
node test/test-thread-send-scoped-yields.js
node test/test-thread-send-wait-reservation.js
node test/test-thread-send-wait-identity.js
node tools/repro-thread-send-wait-ownership.js
node tools/repro-thread-send-wait-retirement.js
node test/test-thread-send-frame-ownership.js
node test/test-worker-thread-scheduler.js
node test/test-process-send-broker.js
node test/test-browser-cooperative-budget.js
node test/test-dllmain-load-context.js
node tools/check-browser-cache-versions.js
node tools/test-tiers.js --check
```

The scheduler mock now supplies the owned loader contract. The separate actual
endpoint suite supplies mutation/lifetime evidence. Syntax and diff checks pass.
Next runtime gate remains serialized real-VM validation of the held IW chain,
including native dependency/DllMain returns and cross-thread loader readiness;
these source tests do not establish game compatibility or permit admission
changes.
