# Drakan passive observer: owning Worker/controller integration

Integrated the [27ace647a passive observer](drakan-passive-actor-observer-20261108.md) into the production guest Worker, WorkerLink and GuestThreadHost. This is offline integration qualification with synthetic x86, not another Drakan gameplay attempt. The accepted `cc6a14236` separate-drain ascent is preserved. Full27, original parity, audio, FPS, worldZ and sustained controlled flight remain open.

Evidence: `scratch/runs/20261108-drakan-observer-worker-integration-2105/`. Initial source HEAD was `84b42e990fc4d969aa70916cb8846d5d2b256c35`; Git plus the small owned patch is the recovery authority. No source archive, media copy or module copy was placed in evidence.

## Production wiring

`GuestThreadHost` passes its explicit `drakanModuleBytes` option only to its main WorkerLink. The Worker independently hashes those bytes and compiles/instantiates precisely them. A separate supplied WebAssembly.Module cannot authenticate another buffer. The required canonical identity remains **4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3**, 2,184,500 bytes. The locked build also retains compat **c3a4a1d9cd6cd6a630f6145c472d3a7d1ab6c2818dba618f2a1b82d8292d7f5a**, 2,187,146 bytes. The old retained `6cf120d0…fda1c0` bytes remain separate and unchanged.

The observer's persistent wrapper forwards the Worker's existing brokered `di_keyboard_buffer` import. There is no additional GetDeviceData, input poll or guest call. Ordinary `slice` execution invokes the existing run exactly once with the existing budget; the adapter observes before and after that call. Its notification still requires native stage12 plus the exact selected drain ESP and consumed T-down timestamp/sequence. Other execution drivers, intervening commands, retirement, rearm and command errors cancel observation. Ordinary execution continues through the existing error/return handling.

`WorkerBinding` derives the process and epoch from actual shared native state, binds its receiving endpoint and RPC slot, and captures the instance's native root/token/thread. It reads root→object→actor, actor→object, relocated handler/vtable and the actual native keyboard descriptor. The adapter checks all relocated code spans against independently supplied pins on natural run boundaries. Native ownership and direct-window guards remain authoritative; this adds no private game call/store, debug tier switch, cache flush, forced guest clock or input polling change.

`installedPins(exe, rfl, base)` hashes the installed files before extracting any expected bytes:

| Installed file | SHA256 |
| --- | --- |
| `drakan.exe` | `29ddccec4b073aaeeb998f0ce83d581ccf3e6a3e28791844f4434d661febecbe` |
| `dragon.rfl` | `b0ede61e43571f9ecead5e7637c585e1e3523ba70d7fd325ec39e99381807b1e` |

It extracts file-backed EXE/RFL ranges and applies the RFL's HIGHLOW relocations for the selected live base. Expected pins never come from a guest-memory snapshot. For a future authorized original, call `observeDrakanActor` with these installed `exe`/`rfl` buffers, fresh base/object/actor/device, the already-issued ordinary down timestamp, `actionStartedAt`, the existing public `releaseT` callback and `maxMs <= 2000`. The API also accepts externally derived pins; their independent provenance remains the controller caller's responsibility. Synthetic qualification uses independently assembled fixture pins, not original-media claims.

## Controller time and release

The controller lives outside the guest Worker. It prearms an independent release timer before guest observation, publishes new host deadline/action samples every10ms through a shared seqlock and retains each sample's actual observation time. The Worker reads a fresh independent host time and rejects samples older than50ms, future samples, UNKNOWN, released input or a changed/expired absolute deadline. A bounded seqlock retry obtains a coherent sample; exhaustion becomes UNKNOWN. It never relabels a cached observation with a new timestamp.

WorkerLink includes dependency loading/setup in the original action's deadline. It requires the action's original host start time; late setup cannot extend the hold. Deadline, Worker error/exit, UNKNOWN, setup/transport errors and retirement release input once and send cancellation. Completion never injects another down. Release callbacks may expose an asynchronous result through `releasePromise`; callback failure remains available as `releaseError`, not a claim that physical input was released. Ordinary runtime shutdown/retirement policy is unchanged.

## Qualification

`test/test-drakan-observer-worker.js`: **33 checks PASS**. It runs the actual production `guest-worker.js` in Node worker_threads with the full exact canonical module, real initialized GetDeviceData COM thunk/handler and the real RPC broker. Separate positives exercise production WorkerLink and GuestThreadHost startup, controller, ordinary slice and shutdown wiring. Fixture-only memory construction installs synthetic callbacks and a native keyboard descriptor; a notepad PE initializes the VM. No Drakan executable or actor body is run.

The positive requires active exact down consumption, state1 entry and completed RET, and actor/event/simulation returns before release, with one completion notification. Negatives cover wrong module before instantiation, wrong process/epoch/device, changed actor/drain pins, authenticated installed pins against synthetic live code, wrong/skipped drain/simulation/event/actor, early actor return, forged return ESP, timestamp change, release during state1, same-drain cancellation, missing consume, overflow, import exception, stale/future/deadline/released/UNKNOWN controller state and notification deduplication. Every armed fixture exit releases input exactly once and awaits its actual Worker termination. In the busy ordinary-slice control, independent release occurs at **28.834ms while that same slice is still executing**, below the2000ms cap; no Worker-local timer can account for that result. Idle deadline, fresh heartbeat, setup failure and transport failure controls also pass. The browser-safe adapter hash is checked without Chrome.

Additional checks:

- Existing passive-adapter suite: **56 PASS**, including two disabled architectural/policy comparisons against the unchanged retained6cf module; original receiver/arguments/result/exception forwarding and wrapper notification deduplication remain covered.
- Existing `test-worker-imports.js`: PASS.
- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS against final production source, all gates and both outputs. Callback census updates review only the three owned host entries; broader invocation ownership remains pending.
- Existing `test-worker-bootstrap-retirement.js`: **FAIL before fixture readiness**. The fixture omits `self.RenderWorker`, and the unchanged Worker bootstrap dereferences `CommandWriterHandoff`. `original-retirement-cause.cjs` independently runs that fixture against the original Git Worker bytes and reproduces the same TypeError, with actual Worker exit1. No full retirement-suite PASS is claimed; the new full-module production shutdown controls pass.

Early integration failures are retained: the first fixture supplied the signature-file envelope instead of `.sigs`; its first readiness waiter did not surface init errors and was terminated/drained. Subsequent fixtures needed a real process ID and complete independently assembled pin windows rather than residual notepad bytes. A wrong-owner test initially altered an option deliberately overwritten by the controller; it now changes the actual owner claim. The first shared-sample reader rejected a legitimate concurrent write; bounded coherent reads fixed this without cached-time reuse. Early builds refused unreviewed callback census entries and a raw direct-window literal; the final reviewed census and named region boundary pass.

All retained command logs are gzip from first byte, including argv, with original size/SHA256 and independent gzip decompression/CRC/SHA rereads. Each command has a preinstalled finite kernel timeout and an actual parent wait result. The board watcher finished with actual wait124. Evidence inventory covers every regular file without extension filtering and records symlinks without following them. Disk samples stay above1,500,000,000 bytes; no continuous-floor or RAM claim is made.

## Disposition

This completes the assigned offline integration. A future original still needs its explicit authorization, fresh installed/live identity and ordinary input/controller setup; it must serve the new module and require exact down-active completion before any separate takeoff review/Up/heading action. Timeout/UNKNOWN ends that action without replay, deadline extension or another T-only retry. No whole-game timing, original parity or sustained-flight result is claimed.

Box ID/state/expiry/stop receipt: **none / NOT_CREATED / null / not applicable**. No Chrome, game attempt, box, remote operation, deployment, subworker, old-run deletion, guest configuration/backend/binding/clock/seed change or peer WIP edit was performed. RELEASE STOP after publication.
