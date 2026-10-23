# Independent render-artifact review, 2026-10-23

**Verdict: REJECT the candidate's unrestricted executable-identity/cache
contract; do not integrate.** Candidate
`fd5e3fc9329711d3190bbd5c7046976c21d0b9a1`, exact base/unchanged remote main
`7f7358c160ae7185fc38f9a15447a6d20c00f97e`. This is an independent source and
small-fixture protocol review, not native acceptance. No renderer/WAT, D3D
fixture `09dc88de`, production helper, or main change is published by this review.

## Concrete executable-identity failures

1. `prepareArtifact` checks only `require.cache[watx.js]`. Importing the actual
   `test/compile-src.js` also imports the actual closure adapter, but does not
   load WATX until compilation. Import that adapter, replace its disk file with
   `throw Error("CHANGED adapter must reject")`, then prepare. Preparation
   succeeds using the previous cached function; the receipt seals the new,
   throw-only adapter and consumption accepts it. The before/after hashes are
   identical because the replacement is complete before preparation starts.
   This is a deterministic stale-code binding, without any concurrent writer
   during hashing or compilation. Checking the loader cache alone does not
   establish that the sealed adapters are the evaluated adapters.
2. Default mode hashes a changed compiler loader into a different cache key,
   but `compile-src` and `watx-closure` retain Node's previously loaded loader.
   First boot with the tiny loader, replace that loader with a throw-only file,
   verify that `identity()` changed, then boot again. The second boot succeeds
   using the old loader. Fresh disk identity invalidates the Wasm map entry,
   not the executable compiler cache. This control uses the real closure and
   compile adapter, with an eight-byte loader double and instantiation double.

The replay asserts both defects, rather than accepting any thrown exception as
evidence. See [independent.js](d3d-render-artifact-independent-review-20261023/independent.js),
[checks.log](d3d-render-artifact-independent-review-20261023/checks.log), and
[execution receipts](d3d-render-artifact-independent-review-20261023/execution.jsonl).

Scope qualification: both failures require disk changes after a relevant module
has been loaded. A wholly immutable tree for the entire Node process, started
fresh, avoids these reproductions. The producer explicitly documents immutable
inputs during an admitted command, which is a useful operating restriction;
these findings do **not** allege failure under that narrower condition. However,
the feature also expressly offers fresh identities and invalidation between
default calls, and its prepare freshness guard does not enforce adapter
freshness. The broad source/compiler identity claim therefore needs a narrower,
enforced lifetime contract or an executable-cache correction before acceptance.
The immutable-source requirement cannot by itself prove the requested behavior
when exercising input invalidation between calls.

No speculative compiler input omission was found. The concrete omission is the
relationship between hashed disk adapters/compiler and their cached evaluated
versions. Merely deleting all require-cache entries is not a reviewed fix:
other callers can retain exports from the same compiler, and default/prebuilt
users currently share this process. A safe correction must explicitly settle
that lifetime/compatibility behavior and retain the two reproductions as
rejecting controls. This bounded review leaves production code untouched rather
than claiming such a lifecycle change is qualified by loader doubles alone.

## Independently examined successful properties and limits

* The canonical closure enumerates every top-level `.wat`/`.watx` source and
  supplies three VFS aliases. `compile-src` transforms all three aliases of
  `13-exports.wat`. The producer inventories that whole source set, including
  unused fragments, and seals the entrypoint and adapters. Exact UTF-16LE
  `extraWat` and boolean tail-call options are distinguished. Independent
  matching, changed-extraWat and changed-tailCalls controls passed.
* `tools/watx.js` evaluates precisely four local VM stages: parser, stages,
  codegen and compiler. All four are covered by the recursive `watx-src`
  inventory, as are loader and closure adapter. The VM receives builtins,
  not filesystem/require access. Synchronous production compilation uses
  production mode, standard WAT, runtimeBuiltins false, strictDeclarations
  true and the selected tail-call boolean. Our actual canonical adapter passed
  these options to the double. No additional disk dependency was found in this
  transitive path. [Compiler identities](d3d-render-artifact-independent-review-20261023/compiler-audit.json)
  bind the inspected files to exact Git blobs and SHA-256. Node/builtin identity
  is not a field in this local receipt; it is not a portable build attestation.
* Consume reads and hashes files without evaluating compiler code. A rejecting
  import hook confirmed this independently. No compile fallback exists. The
  producer's 34 protocol controls also passed under our cheapNode wrapper,
  including missing/stale/invalid input rejection before instantiation,
  default source-only invalidation, and prebuilt overload compatibility. Their
  closure/host doubles do not prove executable freshness of the real adapters;
  the new reproductions use the real closure adapter to examine that gap.
* Both receipt and module use open-descriptor type/size checks before
  `Buffer.alloc`: 128 KiB and 8 MiB respectively. Module metadata is also bounded
  before the module read, and schema/options/hash mismatches reject. Independent
  descriptor-size doubles with an allocation sentinel confirmed both limits.
  No oversized staged input or module compilation was needed. Per-file source
  input reads are capped at 24 MiB; the inventory has no aggregate input cap,
  so future execution still needs external admission.
* Helper preparation is synchronous and exits before its host imports, guest
  memory, instantiation, or assertions. Both **actual unchanged entrypoint files**
  ran through this branch with the real helper/closure/compile adapter and tiny
  loader double. Top-level Device/fixture imports were intercepted; these runs
  do not qualify those modules' side effects. Exact extraWat digests differed:
  compaction `aedd14faff32e47f95292dd8b40bc0f39f13c04f97da96164e288d1521276a0b`,
  arena reuse `ffbd12b13656c33399fb47914adb70f78f98584c4fd9fb4d81292ae508ffa2c1`.
  Both exit-0 results are labelled **PREPARATION ONLY**, never native test passes.
* Environment selection is process-wide. Prepare exits on the first harness;
  multi-harness tests are unsupported by that command. Consume can service
  repeated identical invocations but rejects differing extraWat/options instead
  of selecting or compiling another artifact. Both modes reject prebuilt mixing;
  empty/relative paths and conflicting modes fail closed. `process.exit(0)`
  bypasses later assertions/cleanup and can truncate pending asynchronous work;
  the module writes themselves are synchronous. Preparation must be invoked and
  labelled separately from a suite runner that treats exit 0 as a passing test.
* Prebuilt mode bypasses identity/compilation and retains the Module overload.
  Default mode now reads/hashes the complete source/compiler inventory on every
  call, even a cache hit: the base source inventory alone is 128 files and
  20,706,777 bytes. This adds synchronous disk/CPU cost; source revisions also
  retain additional Wasm map entries. No full-source performance measurement was
  authorized. Moving host imports later changes error/side-effect ordering but
  preserves the ordinary construction path by inspection and protocol doubles.
* Descriptor growth checks and before/after identity comparisons do not prevent
  same-size rewrites, ABA edits, or cross-file snapshot races. An immutable tree
  remains necessary throughout an operation. Receipts are unsigned trusted-local
  integrity records; a caller able to rewrite receipt and module can forge them.
* The actual main classifier returns `unit` for the new regression; discovery
  matches its filename, and `test/run-all.sh` takes unit/quick membership from
  that classifier. No test-tier omission was found. No broad tier/gate ran.

## Evidence, resource bounds, publication, and remaining gates

Replay from this report's directory in its checkout:

```sh
timeout 60s python3 docs/re-notes/d3d-render-artifact-independent-review-20261023/run.py \
  node --max-old-space-size=256 \
  docs/re-notes/d3d-render-artifact-independent-review-20261023/independent.js
```

The adjacent sealed `reviewed-inputs` contains small exact candidate/main input
copies for replay after rejection; no executable was copied. Fixtures create
tiny temporary input files and always remove them. Node executes installed in
place. The full compiler is neither copied into fixtures nor evaluated.
`input-seals.json` records copied inputs. The original independent harness had a
generated-regexp quoting error; its failed log/receipt remains, followed by the
corrected passing run. No guard failure was retried unchanged.

Initial admission projected 59,649,803 / 67,108,864 bytes including full SQLite
WAL/SHM, external events/session growth (16 MiB), private Git/checkout/evidence
cap (8 MiB), and 8 MiB reserve; projected host-after 4,558,106,624 bytes.
Execution receipts recheck full WAL/SHM and external output and include 1 MiB
publication allowance. Python wall <=60 seconds, Node heap 256 MiB, CPU/wall
<=60 seconds and MemAvailable >=805,306,368 were enforced. The wrapper bounds
captured subprocess output incrementally before writing/buffering; checks.log
is limited to 128 KiB. It retains the first harness failure. No package recovery,
full-source compile, native module/memory, guest, remote runtime or box operation
occurred. Root dirty files/index and other agents' work were untouched.

Only this report/evidence is committed to the named task branch, rooted on the
exact main, excluding the rejected feature commit. Actual task/main remote refs
and final resource evidence are recorded in the task publication receipt and
root append-only messageboard. Main remains the exact base above; nothing was
integrated and no force push was used.

Canonical build/gates, complete admitted cold closure, missing `pngjs`, and the
native D3D suite remain unexecuted and separately blocked. This review does not
turn producer preparation or doubles into native acceptance. Shadow Man's
128 MiB approval hold and original Airstrike/Penguin SSH 403 blockers remain
unchanged. Runtime lifecycle N/A: no assigned box, state/expiry N/A; prior boxes
were reported stopped by the coordinator, who retains shutdown ownership.
One bounded task ends here, without replacement selection or other workers.
