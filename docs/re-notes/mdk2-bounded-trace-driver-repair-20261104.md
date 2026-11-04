# MDK2 original driver: bounded trace and owning Module binding

The missing edge demonstrated by `7a9fac338882b23a6b9fde7b12cffda1fa0fa259`
is repaired in `tools/mdk2-construction-driver-integration.cjs`. Its executable
composition retains the original `main-state → driver-wrapper → browser-driver`
route and adds a pre-instantiation import hook, page-to-Worker Module binding,
and one finite trace phase. `--check` now succeeds offline. This is a runnable
driver repair, with offline native-fragment and protocol evidence, not a new
game run or proof of level completion, Lua creation, or gameplay.

Evidence: `scratch/runs/20261104-mdk2-bounded-trace-driver-repair/` (RUN).
The accepted [construction cause](mdk2-lua-construction-cause-20261104.md),
[measured Escape/New Game/Medium](mdk2-measured-escape-original-20261104.md),
and [earlier integration diagnosis](mdk2-construction-driver-integration-20261104.md)
remain historical evidence. No Chrome, game, HTTP server, remote API, runtime,
box, other game, subworker, deployment, or lifecycle operation was used here.
Assigned box ID/state/expiry: **NA**. The coordinator owns future allocation and
shutdown. The closed original attempt must never be resumed.

## Binding and trace contract

The original observation preload is retained, followed by the unchanged published
Lua observer and the serialized binding installer. The page snapshots compilation
input bytes before hashing and compiling the same snapshot. A WeakMap ties that
independent SHA-256 to the exact resulting `WebAssembly.Module`. The existing
slot-0 `init` postMessage receives a diagnostic envelope containing this identity,
Worker URL, compilation ordinal, and endpoint identity. The Module, memory and
all original init fields are unchanged. There is no extra guest command/input.

The actual CDP handler requires a target waiting at startup, enables a
`beforeScriptExecution` instrumentation breakpoint, then releases only the
startup wait. At the first script pause it verifies the exact script URL/context,
evaluates the Worker-specific preload on that paused call frame, removes the
breakpoint and resumes the script. This avoids assuming Runtime.evaluate works
before the first script context exists. A late attach, foreign first script,
preload exception or30-second/absolute deadline latches the original first
failure without resuming the paused script. The first-script CDP handshake is
offline-qualified with protocol fixtures; actual Chrome behavior is unproved. Non-guest
Workers retain their ordinary instantiation path. Other guest slots receive no
trace. In the main Worker a message listener remembers the exact structured-cloned
Module object; the instantiate wrapper admits that object only, installs the
real `host.log_block` wrapper **before** calling native instantiate, and retains
the resulting instance. There is no post-instantiation import replacement.

Before arming, the actual driver joins the page's sole slot-0 send to the sole
bound Worker report, its exact CDP session/target/URL, thread1, and the frozen
main link's endpoint identity. Missing/unhashed/foreign Modules, ambiguous sends
or owners, late/duplicate init/instantiation, changed target/session, wrong
thread/loader, and replacement instances fail. The metadata is evidence from
this composed transport, not a worker-side rehash of a cloned Module; the Worker
uses object identity because WebAssembly exposes no Module-byte readback.

The wrapper stays dormant through original startup, measured Escape, New Game
and Medium. Arming requires the original reviewed `post-medium-construction`
screen/scene, capture-bound inspection approval/ACKs, NewGame and Medium ledger
prerequisites, empty/drained inputs, and the existing **16-slice** construction
command. The frozen native request must actually name `level1`, size192320,
with a supported independently read file callback. Earlier requests do not arm
or consume the phase. A differently sized quantum cannot acquire trace credit.
No new inputs, retries, callbacks, Lua writes or extra slices are introduced.

The only trace arming is the owning instance's existing `set_trace_esp(1,0,0)`.
It covers all native PCs, including dynamically saved returns. Limits are:

| Limit | Applied bound |
| --- | --- |
| Trace time | At most10000ms, further bounded by the original command/aggregate/absolute reserve deadlines |
| Boundaries |100000, the published observer's smaller default; the100001st observation is prevented |
| Records |512, the published observer's smaller default |
| Original construction quantum |16 slices, unchanged |
| Original command bound |60000ms from admission, with original540000ms aggregate ledger cutoff |
| Absolute cutoff |Original browser deadline minus180000ms recovery reserve, conservatively earlier when necessary |
| Restart |Never; one phase per fresh driver |

The trace stops at the quantum's end, its first evidence/import failure, an idle
deadline timer, the next boundary at the deadline, a record/boundary cap, or
terminal driver cleanup. Stopping clears the timer and disables `set_trace_esp`.
The original import result/throw is preserved. No promise timeout grants extra
guest work. A synchronous WASM run cannot delay trace cutoff past its next
observed boundary; a Worker with no boundaries is covered by the idle timer.
Unsupported evidence latches failure; a finite cap retains only its bounded
observations. Original execution after a successful quantum has no new trace
credit. Detected failure prevents later stepping/input through the original
terminal latch.

## Frozen file/main correlation

Before/after readback uses read-only queued getters on the actual main and all
known thread links. It rejects in-flight/free-run/import-retry work, starting
Workers, pending commands, changed thread/link ownership and changed frozen
steps/ticks/guest time. Main and file sidecars must match that same frozen
ownership and counter barrier; the file is handle921600/thread2, independently
of slot0/thread1. These checks add no freeze setter, execution, or guest write.
Their browser scheduling behavior remains to be observed in a fresh runtime.

The unchanged `decodeFileSnapshot` checks pointer-derived callback contexts,
input/output cursors, size and destination. Correlation retains progress,
completion, aggregate192320-byte delta, delivered main completion/finalizer/
dofile/buffer events and read-only Level samples separately. An unsupported
callback snapshot is `unknown`; wrong ownership/frozen history rejects. An
unseen event is never reconstructed from a later snapshot. Replaced request or
buffer/name identity rejects. Initial Level table is not called creation;
missing before/after Level history remains unknown. If tracing starts inside
an already active native call, its unseen entry is not invented: the published
observer can stop with unsupported history. When the original quantum completes
within its bound, independent frozen file readbacks are retained before that
main-observer failure is propagated. File completion alone does not establish
script execution or gameplay.

## Offline qualification

`node test/test-mdk2-construction-driver-integration.js` passes51 tests. These
compile the **actual composed original driver** before its sole main invocation,
exercise its inspection guard,16-slice command/output path, construction trace
admission/end/cleanup, CDP first-script-before-execution handler and CLI preallocation gate.
Protocol fixtures and simulated CDP responses are explicitly labelled; they are
not personal reviews or newly captured game states.

Both original retained normal/compat Modules run the original executable native
fragment through the real shipped queued Worker, reconstructed in memory from
the original Git source and hash-checked pinned dependencies. The actual
composed page preload hashes compilation and sends the Module through a real
structured clone; the actual Worker-specific preload installs its import hook.
The fragment delivers completion, native type10 finalizer entry/return, real
SleepEx poll return, original dofile demand return, script-buffer entry and
memory-stream initialization. It stops before protected parse/run. Its fixture
data is synthetic; original executable instructions are unchanged.

The published whole-state qualification implementation was not edited or
relabelled. Its successful fragment fixture is reused. Because this integration
now tests the **historical pinned** Worker/Modules rather than the earlier
qualification's then-current build, the required paired control was repeated
for those dependencies: full512MB hashes after each fragment, registers, lazy
flags, slice results excluding host milliseconds, queued commands, and final
undefined-instruction trap agree. The ordinary traced control ends its trace
at the same boundary as the composed bounded phase before the trap. This
qualifies transparency against that traced control, not untraced gameplay.

Real Worker controls on **both variants** reject wrong module hash/endpoint,
thread, replacement instance, a different actual Module object, missing native
history, original-import failure, terminal restart, expired start, active idle
deadline and late preload. First-script controls reject foreign context and
deadline without evaluating/resuming the script. Separate actual-driver protocol controls reject
ambiguous owners, wrong module/thread/target, replaced session/instance,
missing history, failed observation, terminal commands, deadline and unfrozen
capture. Missing/stale/unbound release rejects before original bootstrap,
Puppeteer, HTTP, Chrome, controller creation or browser output.

Relevant regressions passed: original wrapper1, endpoint4, construction
controller12, main readback10, and operator/author4. The direct operator regression initially
failed because its retained JSON capture is gzip-only. RUN's
`run-operator-regression.py` runs that unchanged test using a sealed in-memory
gzip reader; it passed without restoring/copying the capture. Serialized
`flock /tmp/wine-build.lock bash tools/build.sh` passed. The final shared-tree build includes concurrent, separately owned lighting work;
current build module paths/hashes are recorded in RUN/build-references.json.
These current builds are not substituted for the retained execution Modules.

## Exact fresh entry and recovery recipe

```sh
node tools/mdk2-construction-driver-integration.cjs --check
node tools/mdk2-construction-driver-integration.cjs --run /ABSOLUTE/FRESH/RUN
```

The first verifies the concrete composition seams, compilation, direct driver
closure plus108 pinned controller/helper files, observer identity, original
432-pin runtime manifest, and original Modules (gzip is decoded in memory).
RUN/check.json records every retained path/size/full SHA and composed/preload
hash. The served source commit is
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`; observer is
`de6a33f257d93e8814d666bdec62361161569ac4`. Keep those unique ignored helper
inputs at the listed paths; no source-tree snapshot is created.

A separately authorized future coordinator run must supply its own
`runtime-release.json` with `assignment:20261104-mdk2-bounded-trace-driver-repair`,
`runDirectory` equal to the exact absolute fresh path, original authorization
`RUNTIME RELEASE MDK2 TARGET ONWARD`, shutdownOwner `coordinator`, fresh boxId,
expiry, closeBy and recoverBy satisfying the unchanged finite deadline check.
The browser subdirectory must not exist. No historical release/identity/review/
ledger is reused. This worker has supplied or requested no runtime release.

The fresh `runtime-pins.json` must be the original sealed manifest (SHA256
`4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed`),
decoded in memory from the retained fresh-pending-scene runtime-pins.json.gz.
Every served byte must match it. Recover Git-backed served paths using
`git show SOURCE:path`, verify each manifest hash, and retain existing media
and module references. Today's changed main does not silently qualify as that
runtime. The original additive endpoint preflight checks the exact query
`index.html?debug&candidates&frozen&gl-renderer=webgl`, isolation headers and both
served Modules before Chrome. The original all-file HTTP pin gate remains.

After these preallocation checks, `--run` emits only six small run-specific
controller inputs. Original author.py/operator.py/next.py/control.py stay in the
same chain; runtime_io's obsolete allocation constants are replaced solely by
the fresh assignment/run-directory binding. The run-local native-menu entry
delegates to the sealed **measured repaired Escape** implementation, not the
unrepaired fresh-pending-scene helper. These source compositions are available
offline through `controllerSources(absoluteRun)` and tested without invoking
any remote operation. The invocation after separate personal capture review is:

```sh
python3 /ABSOLUTE/FRESH/RUN/operator.py MODE EXPLICIT_CAPTURE CURRENT_PERSONAL_REVIEW.json
```

Keep separate matching NewGame and Medium personal reviews/ACKs, and a fresh
construction review for each existing quantum. No automatic visual review is
authored. The original next/control phase gates, ACK sequence, command/output
limits and absolute bounds remain. Only the first qualifying input-free16
quantum arms the trace; it cannot be retried. An inability to meet the frozen
ownership or exact byte pins is a failed prerequisite, never a reason to resume
the closed attempt or grant slices.

Original Module references, without copies:

| Existing path (also available with `.gz`) | SHA-256 of decoded bytes |
| --- | --- |
| scratch/runs/20261104-mdk2-browser-gameplay/recovered/build/wine-assembly.wasm |cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee |
| same directory/wine-assembly.compat.wasm |580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3 |

Media remains at
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`
(`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`)
and adjacent `data/scripts.zip`
(`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`).
RUN retains preparation/tested Git SHAs, relevant binary diff, owned new-doc
patch, hashes, exact invocations, test/build logs and native results. Git is the
source archive. No media/module copies, source snapshots or tars are added.

Next: coordinator may use this entry in a separately allocated fresh original
attempt. Actual browser startup, all-Worker runtime readback, native completion
and Level creation remain unproved by this offline repair. This worker stops
after testing, its own-path main commit and strict pull/push.
