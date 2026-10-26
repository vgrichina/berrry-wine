# Maelstrom preinitializer observer boundary repair

The runner now maps DLLs and patches imports/resources, validates the authentic
loaded anchors, completes its existing main setup (including the real mode
change), arms exactly once, and only then runs DLL initializers and the main
loop. This repairs the earlier `loadDlls` guest execution before validation.
Independent acceptance and separately authorized native qualification remain.
No MAIN or runtime publication is authorized by this work.

`tools/maelstrom-loader-boundary.cjs` deterministically transforms only the
pinned archived loader `8dde0a569d1c8a10b4c12119ac5fde37e4aeb45629290fd1feb24fb6291a6145`.
Its existing startup transaction becomes a generator with one yield immediately
before its dependency-ordered initializer loop. `stageDlls` returns mapped
results, releases the callback gate during host setup/awaits, and reacquires it
to resume that same transaction exactly once. The original synchronous
`loadDlls` API still drives both phases within its original callback gate.
The entire initialization body, including CARDS initialization, thunk sealing,
msvcrt globals, nested lookup and initializer error handling, remains byte exact.
Generation/hash/source checks fail closed for altered or already transformed
inputs; this is an opt-in derivative, never an edit to an archived loader.

Before initialization begins, cancellation/mapping failure rolls back its
existing lifecycle metadata but defers guest unload/drain callbacks to process
teardown. This is necessary to guarantee zero guest instructions on failed
validation/setup. No callback gate is held over asynchronous host setup. Abort
is idempotent and reports rollback errors; ordinary cancellation is consumed.
After initialization begins, the original rollback/drain and initiating-error
behavior remains. A rejected initializer prevents entry to the main loop.
The runner registers failure cleanup before staging and preserves the existing
failure-cleanup wrapper's rule that cleanup errors cannot replace the initiating
failure. Its main register/stack setup is retained, and DllMain's original
save/restore logic preserves that prepared continuation. Static worker DLL
registration and module bases use the mapped results before initialization.

The runner transformer consumes the original capture
`5b2596b3746e17427d26a50466ed36adcfec9f9f119755f05b1fa4bc3c79be58`.
`transformPair` and `recipe-generate.cjs` bind the runner and loader derivatives.
Both must be placed in the same task-owned runtime tree (`test/run.js` and
`lib/dll-loader.js`). The standalone runner CLI's receipt explicitly names its
required loader transform; the stock loader cannot satisfy `stageDlls`.
`derivative-identities.json` records byte counts and both output hashes.
No closure installation or runtime execution occurred.

Twenty-five focused groups and six affected original wiring cases pass.
The original byte-exact ordering reproducer still rejects the old runner.
The full transformed archived JS loader and the runner's entire setup execute
offline: the test uses the real pinned EXE/msvcrt/SDL/SDL_net PE bytes, section
and HIGHLOW relocation mapping in an explicit JS WASM-export fixture, actual
loader import traversal/binding, and the genuine `verifyLoaded` checks. The
small existing four-page guard fixture supplies the real adapter, mode setup,
select and native latch logic. Guest `run` is a mock, never native x86 execution.
Resource decoding and optional guest allocator helpers are explicit fixture
seams; their production initialization bytes remain unchanged. This evidence
does not qualify an emulator build, authentic native caller, errno or gameplay.

The tests establish arm-before-first-DLL-call, coverage through nested
dependency callbacks, reversed manifest dependency order, one-shot/no-DLL stage
behavior, genuine no-DLL Maelstrom validation rejection, failed mapping/anchors/
mode/late setup/arm with zero guest calls, synchronous and asynchronous lookup
errors, a genuinely awaited overlay rejection, cancellation metadata rollback,
callback ownership contention/release, initializer faults, prepared register and
stack restoration, all three successful-run observations, thrown-run behavior,
suspended runs and unchanged mode rejection reason15. Existing select completion
source bytes and guard fixtures remain pinned. The prior nine independent,
thirty wiring, four CLI and twenty-nine guard receipts are retained without
blanket replay; six affected wiring cases were rerun. After cancellation cleanup
was refined, only six prearm failure cases and the affected abort case were
replayed, alongside the new awaited rejection case. First harness failures and
their corrections are retained in `incidents.json` and stderr evidence.

Reproduction (installed Node24, exact supervised limits in the retained recipes):

```sh
node --max-old-space-size=192 test/test-maelstrom-preinitializer-boundary.cjs OPS_DIR PINNED_MODE_DONOR PINNED_REVIEW_DIR
node --max-old-space-size=192 test/test-maelstrom-preinitializer-supplement.cjs OPS_DIR PINNED_MODE_DONOR PINNED_REVIEW_DIR
node --max-old-space-size=192 docs/reviews/maelstrom-preinitializer-observer-boundary-repair-oct26/recipe-generate.cjs CAPTURE_RUN_JS ARCHIVED_LOADER_JS NEW_DIRECTORY
```

The exact archive member is `runner/lib/dll-loader.js` within closure archive
`656a1569d905f49385a7e3a3e6b878f81b96aa547d275f5fcf521cfaa254dd4e`.
Only that member and four named PE inputs were extracted; no full archive/ref
capture occurred. Immutable donors and installed tools were read in place.
The checkout is isolated and flat, with no alternates, links or donor mutation.
Resource receipts include checkout/Git, copies, derivatives, evidence, launcher,
session and positive WAL growth once, future growth and an 8 MiB reserve inside
the 64 MiB allocation. Physical admission uses the assigned aggregate reserves;
existing client RSS is already excluded from MemAvailable. Node's 192 MiB heap
flag is not a total-process cap; Git DATA512MiB applies only to child Git.
CPU90s/wall120s/file24MiB/output2MiB limits apply. The canonical parser verified
empty actual mount argv and intended files. No box, browser, guest, build,
service, Telegram or additional worker was contacted or launched. Box identity,
state and expiry are unassigned; lifecycle ownership remains with coordinator.
