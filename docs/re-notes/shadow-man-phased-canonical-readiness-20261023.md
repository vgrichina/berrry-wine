# Shadow Man phased canonical readiness — BLOCKED

Candidate `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, accepted source/offline by
`4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`. Prior readiness
`c8b13b778132c1d79f306af2931547dd127c5300` is retained read-only. Actual strict
SSH remote reconciliation confirmed those candidate/prior refs and main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`; no selector replay or production change.

The first failing mandatory canonical command was:

```sh
bash tools/check-test-manifest.sh
```

It exited **1**. Its nested `node tools/test-tiers.js --check` passed, but
`node tools/check-test-timeouts.js` exited **1** at line 72 with
`ENOENT: test/run-all.sh`. My readiness planner omitted that non-JS data input
from the initial phase. The candidate contains the required file, blob
`93cceb2b6a5b36980d2d916ec157436a83be190a`, **9,256 bytes**, SHA256
`7d145786b686712b6b1aee33ca5169d4c70effba15208f3b55ba9c05abb39665`.
The exact bytes were independently verified read-only against the standing
repository; they were **not** staged after failure. This is a planner defect,
not a production defect or donor-unavailability finding.

The repair dependency is a corrected, complete non-JS canonical gate-data
closure and remeasured phase plan, assigned by the coordinator. Adding this
one file alone is not proof that every later data dependency was inventoried.
There was no gate retry, omitted gate, source/census repair or baseline refresh.
The published readiness driver has a blocker latch: `--run`, default planning
and phase execution now reject before staging or gates with exit **3** and
the exact missing-input message. The original failure and manifests remain
failed-plan evidence, not an accepted recovery recipe.

## Measured phase design and limits

The earlier copied-Git excess was avoided with an independently initialized
private Git repository and full private index, using explicit read-only object
alternates. No donor refs/index/metadata were written. Actual private file bytes
before source staging were 994,794; recursive Git accounting including directory
bytes at admission was 1,043,946. The retained standing object stores are named
in `standing-identities.json`; they must remain available for history and missing
parent blobs. Every scanner/gate source file actually used was copied and charged.
No links concealed materialized task inputs, tools, or evidence.

The pre-checkout manifest independently reconciled **all 3,104 scanner-view
files** against the exact candidate tree, including all root JS, src WAT/WATX,
and recursive lib/tools/test JS. It also verified the measured data/CJS inputs
and later bundle/font bytes by candidate blob and SHA256. The scanner view was
complete during every scanner invocation. The data-input plan was incomplete,
as the first failure proves. Projections below therefore describe that measured
set, **not complete-input admission or READY**.

| Planned phase | Source bytes | Projected total including reserve |
| --- | ---: | ---: |
| Complete scanner view plus listed data | 55,353,038 | 66,647,526 |
| After browser-cache, bundle/decoder/provenance | 41,602,443 | 52,896,931 |
| After decoder, later gates/concat/parens | 34,169,441 | 66,160,145 |

Totals include the private repository/index, planning artifacts, measured external
launcher events/stderr/capture, 524,288 bytes future growth, 262,144 bytes future
evidence, 131,072 bytes directory allowance and **8,388,608 reserve**, within
67,108,864 bytes. The late phase also includes exact projected combined.wat
**20,696,216 bytes**. Initial host free 6,237,011,968 bytes passed the required
2,982,150,144-byte floor after projected growth. Installed executables run in
place and were rehashed; their separately recorded standing bytes are not copies.

`phase-manifest.json` specifies each input's blob/SHA256/bytes and phase membership.
The executable design retains every scanner input through the last planned
scanner consumer (`check-browser-cache-versions.js`). It then releases only
test files not needed by compiler provenance. The bundle check gets both exact
committed bundles and Terminal.fon after that release. After the decoder, it
releases bundles and toyvm sources, retaining provenance tests, compiler/parser,
all WAT and the later layout/variant/offset/concat/paren inputs. **Neither release
phase occurred**: the first failure happened earlier, and the initial sources
remain retained. No generated output was copied; no combined.wat was generated.

`resources.jsonl` records enforced admission before staging and every launched
Node command. At the failing command the measured total was **66,544,269 bytes**,
including current external capture, future growth and reserve; host free was
6,173,007,872. Publication accounting is recorded separately. No admission denial
was bypassed and the old broad projection/copied-Git attempt was not repeated.

## Compatibility checkpoint and actual execution

`compatibility-checkpoint.json` was written before staging/gates. It identifies
the authoritative candidate build prefix, mandatory command lines, source
generation boundary, native requirements and last-consumer phase plan. Because
the plan missed a data input, its all-compatible flag concerns the inspected
resource requirements only; it does not prove complete-input readiness.

Static inspection of the unchanged mandatory decoder command found one awaited
`makeVm('tailcall')`, one native compile, one Memory and one instantiate, with
**one simultaneously live 676-page arena = 44,302,336 bytes**. The sole exception
pins exact `--random=20000 --seed=12345`, authentic emitted source/bytes and
compile/Memory/instance counts of one. All other native Module/Instance/compile/
instantiate/Memory routes are denied. It bounds emitted source and binary to
8 MiB each, Node old space to 512 MiB, sequence wall time to 600 seconds,
inherited per-process CPU time to 600 seconds and file size to 24 MiB (needed
for the projected combined.wat). No arena survives a gate process. Native V8
code/overhead is distinct from the linear arena and Node old space; no claim
of an RSS measurement or hard RSS bound is made. **The decoder was not reached**,
so its emitted hash, actual counts and pass/fail remain unmeasured.

Existing declaration-only region checks emitted the authentic **335-byte**
synthetic fragment, SHA256
`2c3a646b7b5b21185f8112fc08ea6cbcb6e9cc1e54e07695a3b7d3032cc7ea94`.
They did not native-compile, instantiate or allocate its declared memory.
No full/default/source compilation or 512 MiB COM/guest allocation occurred.

Exact execution:

```sh
cd /home/user/wine-assembly-shadow-man-phased-canonical-readiness-oct23
GIT_NO_LAZY_FETCH=1 PYTHONDONTWRITEBYTECODE=1 \
  python3 docs/re-notes/shadow-man-phased-canonical-readiness-20261023/readiness.py --run
```

The driver launched `bash -ex canonical-precompile.sh` under the above limits,
`NODE_OPTIONS=--max-old-space-size=512 --require=<absolute no-compile.cjs>` and
the standing pngjs NODE_PATH. Actual prefix exit **1** is in `result.json`.
`canonical.log` contains exact shell commands, expanded argv, Node argv/exits,
fragment identities and complete failure. `gate-results.json` records **19
successful Node invocations and one failure**: manifest, fragment, callback
census, memory map, region declarations/owners, AW/dup/raw-address/JS-copy/
embedded-WAT/dup-payload/hand-rolled checks, mirror, all shake modes, RPC/constants
and tier membership passed before timeout-data loading failed. These source-gate
passes do not establish runtime ownership. Prior four reviewed / 404 unrelated
census entries retain pending lifetime ownership; tools CJS is outside that scanner.

The canonical prefix is verified against the exact pinned `tools/build.sh`;
only its root `cd` is replaced. It preserves all commands/failure branches until
the full compiler boundary, then has a literal terminal exit. It never launches
the original full build script or `tools/build-compile-wat.js`. Defense in depth
rejects full compiler entrypoints/imports, default compileWat and unknown native
modules; only the declaration-only region recipe and exact decoder exception
are expressible. Later API/hash/handler/browser/bundle/decoder/ESP/provenance/
layout/variant/offset/concat/paren commands were **not executed** after the failure.

`controls.json` records five meaningful rejecting controls: masked exact required
input across donors exits 3; native Module, native compile, 512 MiB Memory and
full compiler entrypoint each exit 1 before compilation/allocation. Guard JS and
shell prefix syntax passed. The post-failure latch control exits 3 before gates.
No control weakens or skips a canonical gate.

## Qualification and ownership

Accepted selector/Module-binding/OFF/quota/WAT/discovery evidence and prior source
boundaries are reused read-only, not repackaged or replayed. Source and actual
runner/preload/adapter pins are known for the measured inventory; complete
transitive data/dynamic runtime dependency closure is **UNQUALIFIED**. No guest
media, historical archive, source recovery, tool installation or runtime import
was attempted. Future canonical production options/diagnostic imports, exports
and start-qualification recipe remain exactly as recorded in prior readiness
c8b13b7, requiring new complete readiness and separate build admission.

Full handler/module/start/guest/UI/zero-writer/persistence/reopen/Play remain
**UNQUALIFIED**. Ordinary CACA0005 remains ordinary-or-unknown, not a writer finding.
No Boat/browser/GPU/guest/test box was allocated or contacted. No box assigned;
bx_fn7pn7yg is coordinator-reported snapshot STOPPED with historical expiry
2026-10-23T03:46:00.580Z, unprobed. Coordinator owns lifecycle. POSITIONT01a16713,
RichEdit, Claude B&W2 and laptop HeroesII/Warcraft claims are preserved.

Only this new report, driver and evidence are published on
`task/shadow-man-phased-canonical-readiness-oct23`; no source changes, shared index,
donor mutation, main merge, deployment, worker launch or refill. Publication
commit/strict actual remote SHA are in the append-only messageboard and receipt.
One bounded task stops at this precise blocker.
