# Held scoped generic callback yields

Checkpoint following `9923c587fe129722b41c6544f8dcf9f1f1d31eba` on
`task/iw-scoped-callback-yields`. No main merge or admission change.

## Implemented boundary

The actual Worker and local endpoint now observe yields 8/9/12–16 with an
endpoint-issued epoch on the exact callback frame. `scopedThreadSendYield`
checks both identities and the current yield; an outer frame receives pending
while a newer frame owns the interpreter. A stale frame or epoch fails explicitly.
Completion pumps networking (8) and clears yield synchronously at the endpoint,
retaining a duplicate acknowledgement until owned resume. Resume requires the
same completed epoch and uses the existing lost-resume receipt machinery.
Ordinary exports/commands remain fenced, including getter-shaped mutations;
the scope does not grant arbitrary export access. Ordinary noncallback methods
retain their behavior.

ThreadManager's production resolver retains async work in its callback polling
state, checks exact link liveness before and after it, and completes only through
the owned endpoint command. Delayed I/O/render work cannot clear a nested or
newer wait. Render readiness keeps polling runnable siblings. I/O retrieves the
pending read by the real registered receiver's tid + 1 (or main's 1), never the
polling state's absent `tid`. It passes that exact pending object to the existing
VFS fill service; provider cache/fault and file-retirement semantics remain owned
by `filesystem.js`, not a new guest-memory write path in this patch. Arbitrary
custom fill hooks are not sandboxed or made transactional.

If an endpoint operation throws after partial mutation, its scope retains a
fault. Retries do not pump again; live abort and resume refuse it. Actual owner
retirement is required. A lost successful completion reply can retry without
repeating the pump. Source-only tests exercise both cases.

## Verification

```
node test/test-thread-send-scoped-yields.js
node test/test-thread-send-wait-reservation.js
node test/test-thread-send-wait-identity.js
node tools/repro-thread-send-wait-ownership.js
node tools/repro-thread-send-wait-retirement.js
node test/test-thread-send-frame-ownership.js
node test/test-worker-thread-scheduler.js
node test/test-browser-cooperative-budget.js
node test/test-process-send-broker.js
node tools/check-browser-cache-versions.js
node tools/test-tiers.js --check
```

All pass. The new suite uses real guest-worker.js in a Node Worker, WorkerLink,
the local endpoint, the actual host driver, and production ThreadManager
resolvers. Its tiny Wasm fixture has actual register/depth state and a network
pump that increments EAX, optionally trapping afterward. Tests cover all scoped
yield kinds, outer object-wait restoration, delayed same-kind I/O nesting,
stale frame and repeated same-kind epoch, delayed render, exact Worker owner 7
versus main owner 1, retirement during I/O, lost finish acknowledgement, and
partial-apply trap retention. It does not execute x86 or real socket/render/I/O
providers. Controlled async provider/render hooks establish the transport races.

Three temporary mutations, restored before final verification, fail as intended:
removing exact-top deferral returns resume instead of pending for delayed
same-kind I/O; removing the epoch comparison accepts a forged epoch; replacing
the real receiver tid with state.tid requests owner 1 instead of 7. Unmodified
suite passes again. The scheduler mock was migrated to the scoped command;
the real endpoint suite supplies the state-mutation proof.

## Explicit remaining loader boundary

Yields 3/5 remain unmigrated. Do not treat this checkpoint as all callback
resolvers being safe or as game-compatible validation.

* `ThreadManager.resolveThreadSendYield` still invokes
  `_resolveThreadSendExternalYield(link, r)` then `_publishLinkLoaderState(link)`.
  The publication helper reads get_dll_count/get_thunk_end/get_num_thunks through
  ordinary exports and catches errors; these reads remain fenced under an outer
  wait. Removing that catch or admitting the getters alone does not solve loading.
* `host.js` configures that hook near line 3151. Its
  `_handleLoadLibraryThreaded` and `_handleComDllLoadThreaded` resolve DLL bytes
  asynchronously, then call GuestThreadHost.loadLibrary/comLoadDll. Those send
  ordinary `_ask` commands, which the Worker fences while an outer wait is live.
  Browser loader publication has its own `_publishLinkLoaderState` path.
* `guest-worker.js` loadLibrary/comLoadDll handlers map/patch DLLs, invoke
  DllMain through the loader, clear yield, and alter EAX/ESP. A future scoped
  loader command must own this whole operation, including partial failure and
  duplicate/lost acknowledgement handling; arbitrary scoped callExport is not
  sufficient. Audit DllMain run/yield behavior before claiming nested support.
* `test/run.js` resolveThreadSendExternalYield near line 5257 identifies the
  local link and calls process-boot handleComDllYield/handleLoadLibraryYield with
  raw instance.exports. This bypasses link fences. A proxy link alone cannot
  migrate that path. Local and Worker loading need one explicitly owned service
  contract, preserving dependency mapping and DllMain semantics. The CLI Worker
  path uses GuestThreadHost's ordinary loader commands too.

Next work should bound that loader transaction and publication contract in both
endpoints and migrate browser/CLI external hooks, with real resolver tests for
late bytes, nested callbacks, epoch changes, duplicate acknowledgements and
partial loader failure. Do not make the fence permissive or silently skip DLL
initialization/publication. No full VM, canonical build, browser, Boat, game or
external download ran. Independent-chain broker admission, generation proofs,
and real-game validation remain held.
