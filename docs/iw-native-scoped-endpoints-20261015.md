# Native scoped endpoint fixture: bounded native validation

`test/test-scoped-dll-endpoints-candidate.js` adds no production changes. Its
base is `f5d61da2f7fe975cd70bbffea72bb85e0ca3ed8d`: candidate `17e713cd2`
plus the reviewed Worker fixture dependency correction and validation records.
The fixture refuses any module except the physical canonical SHA-256
`a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48`.
Historical `937466` is not equivalent. Source preparation used no build or
guest execution. The subsequent explicitly granted native result is below.

The fixture uses one 512 MiB shared memory per serial case. It instantiates
the unmodified canonical module with `createHostImports`, loads synthetic PE32
EXE/DLL bytes and starts production `guest-worker.js` through GuestThreadHost.
Worker initialization uses `spawnThread` with distinct native thread IDs and
real stack/TIB/TLS allocation. The fixture registers those links as active
ThreadManager owners and marks them in flight so only the explicit callback
protocol drives them. This tests the scoped endpoints, not CreateThread or the
ordinary scheduler. The main instance is the local callback owner in case one
and a metadata observer in the two-Worker case.

Both race cases use the real WndProc → LoadLibraryA → x86 DllMain path.
Byte-provider promises provide deterministic barriers, with no timing sleeps:

* A retains the scoped gate during outer lookup; B reaches native gate wait
  yield 9 before LoadLibraryA can enter byte lookup. Wrong epoch and foreign frame
  commands must leave ownership and depth intact. An ordinary nested callback
  returns 77 while the original lookup remains retained.
* Mapping delivery loses its first acknowledgement. Retried delivery must
  report duplicate without executing attach twice. The outer DllMain loads
  nested.dll; that byte barrier exposes real native INITIALIZING and pins,
  one outer attach, zero nested attaches and zero host registrations. B is
  still blocked. Nested gate depth must be at least two.
* Completing nested attach unwinds the original continuation. Publication also
  loses an acknowledgement. Both owners must return the same handle and
  generation, with one new outer mapping and exactly one publication from A.
  B takes the native existing-module fast path without lookup/publication. LIVE,
  zero mapping pins and gate depth, and restored registers including ESP.
* Actual host callback-driver FreeLibrary calls drop the two outer references;
  its x86 detach frees the nested DLL. Both detach counters must be one, the
  outer lifecycle FREE, and its retirement publication exactly once.
* A separate Worker case stops the exact owning endpoint during lookup. A
  wrong lifetime retirement command must fail without releasing the gate;
  actual stop must release it and reject the pending resolver without attach.

`WA_SCOPED_DUPLICATE_PUBLICATION_CONTROL=1` injects a duplicate call to the real
`publishScopedDlls` after successful native completion. The native attach count
should remain one while externally observed module registrations become two.
The unchanged first-owner exact-once assertion fails before B completes.
Native execution confirmed the intended failure; syntax checking alone would
not be negative-control evidence.

## Admission and exact commands

No future remote runtime is authorized by this document. Root must explicitly grant
the single bx_9ef2wdsw lane after Jedi original-child and Outlaws acquisition
release, with independent no-survivor checks. No new Boat, browser, public
deployment, game launch, or full build is needed. Use a fresh task checkout;
do not alter the retained canonical donor or its source. First compare all
`src/` and runtime `lib/` bytes against the validated candidate, and hash the
physical module before and after. Retain node version, source commit and actual
source hashes, command logs/status, and independent postflight inventory.

With `WA_TEST_WASM` naming the retained physical canonical module:

```sh
WA_TEST_WASM=/home/user/wa-iw-native-validation/build/wine-assembly.wasm timeout --kill-after=5s 90s node test/test-scoped-dll-endpoints-candidate.js
WA_TEST_WASM=/home/user/wa-iw-native-validation/build/wine-assembly.wasm WA_SCOPED_DUPLICATE_PUBLICATION_CONTROL=1 timeout --kill-after=5s 90s node test/test-scoped-dll-endpoints-candidate.js
WA_TEST_WASM=/home/user/wa-iw-native-validation/build/wine-assembly.wasm timeout --kill-after=5s 90s node test/test-scoped-dll-endpoints-candidate.js
```

Budget: 285 seconds including three 90-second admission bounds plus kill grace;
each process also has a 60-second watchdog and 100 protocol-turn callback cap.
Run serially, stop at an unexpected failure, and preserve logs before fixing
source. Expected statuses are 0, 1 specifically at duplicate registration, 0.
A timeout or earlier failure does not validate the negative control. Track and
clean descendants even after a failure; do not release the lane on a promise
to clean them later. Each case drops its private memory at close; Node GC may
temporarily retain prior buffers, so reserve 1.5 GiB plus engine overhead.

Local source checks: Node syntax; synthetic PE generation (three 8,704-byte
PE32 images with intact signatures); test-tier completeness; whitespace.
The `-candidate` suffix keeps this explicitly admitted native integration out
of the unit tier. Initial tier check needed two additional sparse tool files;
after adding those read-only files the complete tier check passed.

## Executed result and retained failures

Root granted the sole bx_9ef2wdsw lane after Jedi PID 141587 and Outlaws initial
acquisition released. Fresh inventory was empty; TTL 14:21:55 was sufficient.
No full build, browser or original game ran. Production `src/` and `lib/`
actual-file hashes matched the validated donor before each run; all tracked
source and donor hashes and physical canonical SHA were checked after arms.

Pre-execution root review caught a fixture buffer argument: publishScopedDlls
requires `memory.buffer`, not WebAssembly.Memory. A small production-function
check passed with the buffer, reproduced RangeError with the wrong container,
and confirmed it did not register a module. Commit `7d43c61e5` fixes all calls.

Preparation PID 146342 failed before native execution because remote Git SSH
host-key authentication was unavailable. The exact branch was transferred as
a Git bundle through Boat exec; no authentication policy was bypassed. Two
short, retained fixture failures then refined its assumptions:

* PID 146603, 172 ms: expected B yield 5, observed native gate wait yield 9.
  Commit `c5d603022` now requires yield 9 on repeated retries while A holds
  the gate, and B's native existing-module fast path after release.
* PID 147605, 117 ms: the local/Worker load, nested initialization, receipts,
  generation, pins and register assertions passed, but final host-driver unload
  rejected a stale frame token. Manual barrier dispatch had not advanced the
  automatic driver's token allocator. Commit `a2fb032a1` shares that allocator;
  native ownership rejection stays intact. Both failures stopped subsequent
  arms and have independent empty-inventory/source-unchanged postflights.

Final native source `a2fb032a191ec84882dd5d1ed6cfc4e878438903` ran under
PID 148227, API exited 0 at 14:08:48.594 UTC on Node v24.18.1:

| Arm | Result | Elapsed |
| --- | --- | --- |
| Positive | local/Worker, Worker/Worker, lookup retirement PASS | 353 ms |
| Duplicate-publication control | expected exit 1, first-owner registrations 2 versus 1 | 132 ms |
| Restored | all three cases PASS, exit 0 | 287 ms |

At 14:09:24.467 UTC a separate postflight rechecked all tracked actual source
and donor bytes, canonical a948 unchanged, and no active guest/build/browser
processes. The runtime lane was explicitly released to root then.

Evidence is retained remotely in `/home/user/iw-native-scoped-endpoints-evidence*`
and recovered as
`scratch/runs/20261015-iw-native-scoped-endpoints/evidence.tar.gz`:
1,928,953 bytes, SHA-256
`0f047eece25d0de125564b0c99403fb357307bffd85bc1ecd5bd4852e89bdde8`.
The archive contains three source/donor snapshot sets, all native logs/status,
initial bootstrap failure, independent postflight, the exact Git bundle and JS
controller. Recover it with tar into a new directory; the controller and bundle
recreate the tested checkout without network authentication. The physical
canonical module is retained in the earlier native-validation archive and at
the module path above, rather than duplicated here.

Remaining gaps include native FALSE/trap/terminal initializers, unload of a
provider while a separate consumer lookup pins it, retirement during executing
DllMain, lost retirement replies, and scheduler-driven simultaneous guest
threads. Those have separate simulated or ordinary-loader coverage and are
not claimed here. This passing fixture does not establish original
Invisible War compatibility, rendering, interaction or playability.
