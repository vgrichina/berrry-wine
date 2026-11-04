# MDK2 immutable original runtime resolver

`tools/mdk2-immutable-runtime-resolver.cjs` supplies the original accepted
runtime without staging over this shared Git checkout. All **432 filesystem
reads and 432 actual loopback HTTP bodies** match the original manifest's
SHA-256 and size. The adapter is installed only after those two real checks
pass. This establishes the byte prerequisite; gameplay was not launched.

Evidence: `scratch/runs/20261104-mdk2-immutable-runtime-resolver/` (RUN).
Git is the source archive: RUN records the tested main SHA, relevant binary
diff and the three owned new-file patches. It contains small logs and identity
reports, with existing module/media paths and hashes. No source tree, archive,
media or module copy was created. No Stronghold files were changed.

The manifest remains SHA-256
`4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed`,
with source commit `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.
Matching files remain references to their existing paths. Differing historical
sources are read with real `git show` at that fixed commit, with inherited Git
environment and replacement objects disabled. Every returned blob must match
its original manifest row. A source selected as live cannot later fall back to
Git when its bytes change. Existing target paths must remain regular files
inside the canonical root, including when Git supplies their bytes.

Both original modules remain references to the recorded retained storage:
normal `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`
(2143540 bytes) and compat
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`
(2146153 bytes). Gzip is decoded in memory with a decoded-size bound. Every
read checks the decoded hash and size; current build outputs cannot substitute
for retained modules. `filesystem.json` records each exact storage path and
pin, including unchanged media references.

## Accepted entry integration

The adapter independently verifies the live accepted entry's fixed SHA-256
`6cdfd208f802daac8cb5f3fd67f51f07c5195b294a9c86a58d8c168a973a378f`
against accepted commit `6d5121b5f96ee6032a9e347e2db64db29c478518`.
It executes that entry's real `inspect()`, retaining the original111 helper
checks, observer `de6a33f257d93e8814d666bdec62361161569ac4`, four original
Git dependencies and retained-module checks. None of those files is patched.

`installAdapter(resolver)` then checks all filesystem bodies and all HTTP
bodies, closing its private proof server before installing two scoped seams:

- `fs.readFileSync` supplies verified bytes only for canonical absolute
  filesystem paths belonging to the original432 manifest. Other entry,
  helper, release, review, ledger and controller reads use the original
  filesystem function. This is an explicit byte adapter, not a fabricated
  pin-check result. Each intercepted read checks the actual bytes again.
- `test/static-server.js.startStaticServer` is wrapped in memory, using its
  existing `handleRequest` seam. The resolver serves only manifest paths,
  preserves the driver's actual audit callback, and supplies no-store,
  same-origin COOP, require-corp COEP, MIME, HEAD and single-range responses.
  Invalid or foreign requests reject without serving a fallback file.

The resolver rejects noncanonical, absolute, foreign, traversal and symlink
paths. Its server binds only loopback, and rejects alternate roots/rewrites.
A forged resolver object cannot install either seam. Neither source files nor
server modules are overwritten. The published staging tool and its
`never stage over a Git checkout` guard remain unchanged.

The read-only prerequisite command is:

```sh
node tools/mdk2-immutable-runtime-resolver.cjs --check
```

For a future separately authorized original attempt, the explicit consumption
sequence in a **dedicated Node process** is:

```js
const adapter = require('./tools/mdk2-immutable-runtime-resolver.cjs');
const runtime = await adapter.installAdapter(adapter.createResolver());
require('./tools/mdk2-construction-driver-integration.cjs').run(freshRun);
// Keep runtime installed until the original driver's terminal cleanup has
// closed its server. Then runtime.restore(), or exit the dedicated process.
```

This is an invocation recipe, not a new launch performed by this assignment.
The accepted `run()` remains the sole launch entry. Its exact fresh release,
run-directory binding, original pins, one-launch guard, author → operator →
next → control chain, personal reviews, measured Escape/input sequence,
first-failure code, command deadlines, aggregate deadlines and 16-slice trace
limit remain in the original entry and composed driver. The adapter has no
`--run` CLI and creates no release, review, controller or output directory.
Its own HTTP prerequisite has a separate 30-second bound and 10-second request
bounds; those do not modify any original command or aggregate deadline.

## Offline validation and limits

`node test/test-mdk2-immutable-runtime-resolver.js` passes 16 tests using the
real retained originals. Both original filesystem pin loops are extracted
verbatim from the unchanged accepted `run()` and its actual composed driver,
then executed against the installed adapter. Each checks all432 paths.
The original composed HTTP audit callback runs over432 real full-body fetches
with every audit match true. The unchanged original endpoint preflight also
fetches its four full bodies and passes. A missing fresh release still fails
in the actual accepted `run()` before output or controller creation.

Negatives cover altered/truncated Git source, compressed module, decoded
module and live media; changed selected live source without fallback; stale
manifest; foreign/out-of-root/traversal paths; actual symlink root and foreign
symlink; simulated pinned-path symlink; and a forged unchecked resolver.
Fault injection is isolated to a test VM reading real originals and never
changes shared files. Range, HEAD, invalid range, HTTP path rejection, restore
and closure of every owned server are also checked.

The required locked build passes:
`flock /tmp/wine-build.lock bash tools/build.sh`.
Its current generated modules are not original runtime inputs. The accepted
construction integration regression suite passes all 51 tests with its
existing sealed in-memory gzip fixture reader.

No architectural blocker was encountered within this byte prerequisite.
The full `run()` bootstrap is deliberately not invoked past its fresh-release
gate: this assignment authorizes no release or browser/game execution.
Actual Chrome/CDP, launch-time composition, Worker execution, construction,
native completion, Level creation, Lua and gameplay remain unobserved. The
future original attempt must still satisfy all original live controls.

Box ID/state/expiry: **NA**; no box was allocated or accessed. No Chrome,
heavy runtime, SSH, boat/API, deployment, approval or subworker operation was
performed. All owned loopback servers are closed. The coordinator retains
future runtime and shutdown ownership. This single assignment ends after its
own tests, commit and publication.
