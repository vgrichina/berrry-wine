# Drakan ordinary browser observer opt-in

The ordinary `host.js` compile/start path now carries its actual selected module bytes into the existing production `GuestThreadHost` observer, under explicit opt-in. This closes the module-only gap documented by [2105](drakan-observer-worker-integration-2105-20261108.md) and retains the physical release-result repair in [2127](drakan-release-promise-2127-20261108.md), commit `296eb101594d2218378ac52163374d8699d50377`. Qualification here is offline and synthetic: no Chrome, game, original action, physical input, remote runtime, box or additional worker agent was started.

Evidence: `scratch/runs/20261108-drakan-browser-observer-optin-2140/`. Initial Git HEAD was `093990bdd671f31570bb15e4c6022d335d73e1d5`; the evidence records the prepublication HEAD and a reverse-checked owned binary patch, including the new test and this note. Git is the source recovery authority. No source tree archive, module copy or media copy was created.

## Selected bytes and actual owner

Set `window.WINE_DRAKAN_OBSERVER = true` **before the first module compilation/Launch**, with the ordinary `WINE_THREADS` main Worker path enabled in a cross-origin isolated document. The flag requires the boolean `true`. Default behavior remains unarmed and retains no observer byte snapshot. A module cached before opt-in has no observer provenance; late opt-in fails closed without refetching. Reload with the flag established before compilation to obtain a fresh eligible process.

`getWasmModule()` still selects the normal artifact (including compatibility selection), artifact-to-source fallback, or explicit source compilation. At either actual `WebAssembly.compile` boundary, opt-in takes a private unshared byte snapshot and passes **that snapshot** to compilation. A private WeakMap associates only that returned Module with those exact bytes. Source byte views respect their offset/length; SharedArrayBuffer input is refused. No public identity report, supplied buffer or independently supplied Module can populate this record.

`_maybeStartGuestWorker()` obtains the private record for its actual selected Module and independently hashes it with WebCrypto SHA-256. Only canonical **4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3**, 2,184,500 bytes, is admitted. It sends an owner-specific copy through `GuestThreadHost.drakanModuleBytes` to the owning slot-0 WorkerLink. The existing Worker independently hashes and compiles/instantiates precisely those bytes; a supplied Module never authenticates a different byte buffer. Wrong bytes do not trigger another fetch or a canonical-module substitution. Existing ordinary single-thread fallback remains the startup failure behavior; no observer is exposed for that fallback.

The private browser owner binds the actual GuestThreadHost, main WorkerLink, Module, memory and browser instance token. Those identities are checked at startup and across asynchronous observation and release. A sibling host sharing the normal compiled-module cache cannot substitute its Worker or memory. Observation consumes one browser admission before setup; failure, UNKNOWN, completion or retirement does not rearm it. Final host memory release deletes the private owner record. Existing native process/epoch, endpoint/slot, invocation root/token/thread, object/actor/device and code-pin checks remain in the Worker.

## Ordinary caller and release

After its existing ordinary caller has issued its one action, use the instance method:

```js
const outcome = await wine.observeDrakanActor({
  actionStartedAt, // actual original host start: performance.timeOrigin + performance.now()
  maxMs: 1900,    // integer 1..2000, measured from that original start
  timestamp,     // actual already-issued ordinary T-down timestamp
  base, object, actor, keyboardDevice,
  exe, rfl,      // installed files independently authenticated by installedPins
  releaseT,      // existing public caller; MUST return its actual physical completion Promise
});
// Only after this await: callback settlement succeeded. UNKNOWN is not completion.
if (outcome.result.status !== 'COMPLETE') {
  // End this action without replay/rearm. No success or ascent inference.
}
```

Alternatively the existing independently derived `pins` interface remains available; independent pin provenance is the caller's responsibility. No new down injection or ordinary input helper is supplied. The example does not authorize an original run or replace its caller setup.

The browser method prearms release before availability/configuration checks, then synchronously hands the same original deadline to the existing WorkerLink setup timer and Controller. Dependency loading stays inside that deadline; no deadline extension is introduced. Ordinary host scheduling drives the existing slices while the method is pending. The method waits for Controller stop, **awaits its live `releasePromise` and checks `releaseError`**, and joins its own cached physical result. Successful return requires release callback settlement and an unchanged live owner; the result is either the already-qualified completion or UNKNOWN. It does not require observation completion to initiate release. A stopped/retired owner throws after joining release even if a completion had previously arrived.

Setup failure also joins `error.releasePromise`, reads the live release error and retains the original failure as the cause. Returned errors expose `releasePromise` and a live `releaseError` getter. Synchronous throws and asynchronous rejections release exactly once and remain visible. Optional `onStop` retains its existing immediate-notification meaning; it is not a physical settlement receipt and must not drive a success/cleanup claim. The method never claims Worker shutdown waits for input I/O.

The caller must supply its real original start and real release-completion Promise. Timers need the controller event loop to run. Physical callback completion may exceed the initiation deadline or never settle; the method then remains pending rather than inventing a receipt. No new browser/user-facing control, automatic original launch, retry, rearm or UNKNOWN replay is added.

## Qualification and limits

`node test/test-drakan-browser-observer-optin.js`: **17 PASS**. It executes actual `host.js` artifact/source selection, compile retention, `_maybeStartGuestWorker`, the browser instance method, production GuestThreadHost/WorkerLink and real Node guest Workers with the complete canonical module. The source-loader boundary is synthetic and supplies existing canonical bytes; source-layout validation is stubbed in this test, while the required locked build validates actual source. Only synthetic x86/objects/pins, a fixture keyboard FIFO and notepad PE initialization are used. There is no original guest actor or physical input claim.

Controls cover boolean opt-out, cached late opt-in without refetch, actually compiled wrong bytes, explicit source/fallback selection, shared mutable source input, stale Module, sibling same-module Worker substitution, expired/future starts and >2000 cap, setup failure with delayed rejection, synchronous release throw, exact-down state1/enclosing-return completion, delayed success/rejection after completion, independent idle deadline, retirement and refusal to rearm/replay. The browser Promise stays pending until the physical-result fixture settles. The live Controller records delayed release rejection. Actual production Worker retirement is awaited by each fixture; duplicate cleanup accepts an already-retired GuestThreadHost.

Additional checks pass: existing Worker integration/release suite **59** (including browser-method dependency-loading controls); passive suite **54**, and **56** with the two retained6cf disabled architectural/policy comparisons; Worker imports **11**; existing host Worker lifecycle; `flock /tmp/wine-build.lock bash tools/build.sh` with all gates and both outputs. The exact host.js callback-census hash/reason alone is refreshed; broader callback ownership remains pending.

Early failed test runs are retained. Two failures were fixture-prefix parsing errors, one expected undefined where the real constructor uses null, and one duplicate-retirement cleanup dereferenced an already-cleared link after all behavior assertions passed. These were test defects; no failed result is treated as acceptance.

Canonical4b45 and compat **c3a4a1d9cd6cd6a630f6145c472d3a7d1ab6c2818dba618f2a1b82d8292d7f5a** (2,187,146 bytes) remain unchanged. Retained **6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0** and accepted `cc6a14236` ascent evidence remain unchanged and separate. Exact32, finite observation and native CALL/RET semantics are unchanged; no CPU/backend/config/bindings/clock/seed or peer TR2/Quake2 file was edited.

Retained command logs are gzip from first byte with original SHA256/size/CRC independently reread. Each command has a parent signal deadline prearmed before spawning and an actual wait result; no RAM gate was used. Every regular evidence file is inventoried without extension filtering; modules/media are referenced by existing path/hash. Disk initially cleared the 1.5GB floor, then concurrent writes took it below; documentation/publication waited for the coordinator's verified lossless closed-event compression to restore headroom. No continuous-floor claim, old-run deletion or peer cleanup is made.

Box **NONE / NOT_CREATED**, expiry **NULL**, stop receipt **NA**. No runtime was authorized or created. Next work requires separate original authorization and fresh installed/live identity with the existing real ordinary action/release caller; this offline change supplies the browser path only. Full27, original parity, audio, FPS, worldZ and sustained controlled flight remain open. RELEASE STOP after publication.
