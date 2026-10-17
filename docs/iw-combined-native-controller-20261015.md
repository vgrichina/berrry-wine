# Combined IW native validation controller — prepared 2026-10-15

Source-only preparation. No combined build or native test has run yet.
Use `tools/run-iw-combined-native.js` only after root reviews the immutable
commit and grants the sole remote runtime lane. No original IW or browser run.

The controller requires the real checkout path
`/home/user/wa-iw-combined-native`, an absent build module, an explicit commit,
a new absolute evidence directory outside the checkout, and an exact dependency
manifest. It checks every tracked root/src/lib/tools/test/docs/fonts physical
blob against that commit, including Terminal.fon and the current generated
region map. The normal build runs every normal gate. A stale region map is a
hard failure; no donor map or generation bypass is used.

Root staging/preflight, after runtime grant:
1. Fetch `task/iw-main-integration` into the remote Git object store and create
   a fresh detached checkout at the reviewed commit with `--no-checkout`.
   Set non-cone sparse patterns for root files plus all src, lib, tools, test,
   docs and fonts descendants before checkout. Keep all tracked files in those
   directories, regardless of extension; no selected-source overwrite.
2. Provide the existing installed dependency closure at candidate
   `node_modules` (a read-only donor symlink is acceptable). Inventory every
   physical regular file recursively beneath its realpath as
   `[{path: absolutePhysicalPath, sha256: fileHash}]`. Do not follow directory
   symlinks inside that closure. File symlinks such as .bin are already backed
   by inventoried physical targets. Save this manifest outside the checkout and
   evidence directory; record its SHA-256. No npm install is required.
3. Independently verify the lane is idle, TTL comfortably exceeds 1500 seconds,
   remote disk/memory capacity, the reviewed source commit, dependency manifest,
   and preserved 937/a948 modules. Preserve root's other held source/artifact
   pins as well. No donor file may be edited.
4. Set `WA_IW_COMMIT`, `WA_IW_EVIDENCE`,
   `WA_IW_DEPENDENCY_MANIFEST`, its
   `WA_IW_DEPENDENCY_MANIFEST_SHA256`, and `WA_IW_RUNTIME_GRANTED=yes`.
   Launch `setsid --wait timeout --kill-after=10s 1500s node tools/run-iw-combined-native.js`
   from the candidate. Capture PID, terminal status and controller log outside
   the evidence directory. The controller enforces that exact timeout parent.
5. After terminal exit or timeout, independently check the process inventory
   and execute the same controller with `--postflight` and the same commit and
   evidence variables. That mode runs no build/test and checks the saved
   source, dependency, donor and module identities. Its
   `invariantsPassed` is not a conformance verdict. Read summary/status/logs
   independently, archive evidence and verify recovery before releasing the lane.

The controller snapshots all physically present tracked donor files in the
937 and a948 checkouts, and their preserved modules. Candidate sources remain
unchanged throughout all arms. Every stage records source hashes and process
inventory; the first unexpected failure stops subsequent arms. The normal
build has a 600-second timeout; each native arm has 90 seconds; the hard outer
bound is 1500 seconds. Finally records failure before checking final invariants,
so a failed final check cannot leave a successful summary.

Native arms use one freshly built, SHA-256-pinned normal module:
- Cross-process WAT SendMessageA through actual Workers and browser broker:
  scalar reply, A→B→A nesting, stack restoration, explicit unsupported system
  messages, transport failure, missing target and guest fault. Native mode
  probes last_error through a real GetLastError thunk, avoiding the historical
  test-only export and transformed-module build.
- Scoped DLL lifecycle primitive.
- Scoped callback loader endpoints.
- Owner retirement and exact scheduler slot retention.
- Independent send admission.
- Receiver retirement (deferred and active callbacks).
- Negative receiver control and restored receiver run.

The endpoint fixture exports an explicit `WA_TEST_WASM_SHA256` pin when set;
admission, owner-retirement and receiver-retirement fixtures already compare
their physical bytes to that exported value. Historical commands retain a948
as the default. Scoped lifecycle and the cross-process runtime fixture now
check the explicit pin directly. The controller also checks the produced
module before/after every native arm and rejects source/dependency mutation.

The negative control is an evidence-only copy of the current broker with only
the receiver onRetiring subscription removed. The receiver fixture imports
that exact path through `WA_TEST_BROKER_SOURCE`; no production source is
swapped, no historical module is used, and the same combined module remains
pinned. Exit 1 must contain `RECEIVER_RETIREMENT_DID_NOT_SETTLE`; unrelated
failure is not accepted. The restored arm uses the untouched production broker.

Local preparation checks: changed JavaScript syntax and whitespace; unique
negative-control extraction and syntax; explicit module hash propagation via
the imported fixture. No full-module local execution. The new native
GetLastError path and combined conformance remain unexecuted until grant.

After attempt 1, native-only mode is prepared for the test-only correction.
Set `WA_IW_NATIVE_ONLY_RECEIPT` to the prior `built-module.json` and
`WA_IW_NATIVE_ONLY_RECEIPT_SHA256` to its independently verified SHA-256.
The existing candidate module must exactly match that receipt's hash/size.
Only the named runtime test, controller, and two controller/result documents
may differ from the original build commit; other changes are rejected. The
dependency inventory must equal the original build's saved inventory. Update
the dedicated checkout to the reviewed repair commit, retain the existing
module, use a new evidence directory and keep all other preflight/timeout/
postflight steps. This mode skips only the already-passed normal build; all
eight native arms still run and stop at first unexpected failure.
