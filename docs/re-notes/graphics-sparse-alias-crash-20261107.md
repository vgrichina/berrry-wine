# Bounded graphics sparse/alias crash sweep — 2026-11-07

Three generated regressions passed on a fresh separate boat. Nested-elision
coverage reuses an identical completed source cell; viewport background texture
reported SKIP because its original screensaver was deliberately not staged.
No production crash or divergence was reproduced, so no production repair was
made. This is a findings-only commit.

Evidence: `scratch/runs/20261107-graphics-sparse-alias-crash/` (ignored).
Pinned source commit: `625807eba64d467c5731c4cfcac56e8564e05abc` on main.
`runtime-pins.json`, `supplemental-pin.json` and `relevant-source.patch` record
the exact staged inputs, including Aranna's then-uncommitted renderer-input
hunks. Those foreign files were read, never edited. Source reconstruction from
Git plus the recorded patch verified all 196 tracked inputs in memory; no source
tree archive was created. Later shared-checkout edits are not tested by this run.

| Requested test | Actual disposition | Seconds |
| --- | --- | ---: |
| `test/test-d3d9-nan-vertex.js` | PASS, exit 0 | 7.355 |
| `test/test-d3dim-transform-alias.js` | PASS, exit 0 | 6.091 |
| `test/test-d3dim-execute-data-sparse.js` | PASS, exit 0 | 5.632 |
| `test/test-d3dim-viewport-background-texture.js` | SKIP, exit 0; original EXE absent | 0.064 |
| `test/test-d3d9-nested-elision-semantics.js` | Prior PASS reused; no new execution | — |

The three fresh passes reached their original terminal assertions with empty
stderr. NaN and Infinity cull the affected triangle while preserving the other
triangle and subsequent healthy drawing. Transform aliases retain public API
identities, matrix values and COM stack cleanup. Sparse ExecuteData checks 32
cached/uncached layouts and 384 selected-field cases, relocated sparse caches,
input preservation, neighboring backing bytes, output canaries and stack guards.

The viewport fixture actually launches `binaries/screensavers/ROCKROLL.SCR`
through `test/run.js`; it is not a generated-only fixture. The no-original
restriction therefore takes precedence. The fresh box had no screensaver EXE
and printed `SKIP: binaries/screensavers/ROCKROLL.SCR not present`, before
loading Wasm or launching the CLI. This is no viewport rendering result. The
previous missing-gradient failure reported in the November 6 legacy-point
findings remains unresolved and was not reproduced here.

Nested-elision fixture and `tools/d3d9-operation-observer.js` both match
`c6b791f76628ab900921ff7dc835704bbe77ba33` byte for byte. `nested-dedup.json`
retains both current/prior SHA-256 pairs. That commit's review, combined TAP log
and command results were recovered from Git into this run. Its 167 passing
combined controls include this fixture's 39 native iterator/destructuring
controls, with fail-closed unsupported grammar retained. This is historical
reuse, not a new Node-version acceptance claim. No identical cell was rerun.
The fresh Wasm source inventory differs from the older November 1 NaN sweep
and November 5 transform coverage; changed-path lists are retained.

All fresh tests ran sequentially from `/home/user/graphics-sweep-runtime` on
`bx_h3j45weg`, Node `v24.22.1`, Linux x86-64. Each used the unchanged entrypoint:

```sh
SWEEP_CASE_DIR=CASE_DIRECTORY timeout --signal=TERM --kill-after=5s 120s \
  node --require STAGED_OBSERVER test/TEST_NAME.js
```

Exact argv, process IDs, UTC start times and durations are in
`final/results.json`. The observer copies the actual bytes passed to
`WebAssembly.instantiate`, delegates the original call, and records loaded
CommonJS source identities. It does not alter test assertions, guest inputs,
compiler options or production return values. All loaded file hashes match the
staged pins; pre/post checks verified 224 staged files. These modules were
compiled by the canonical render harness, not inferred from the local build:

| Actual instantiated module | Bytes | SHA-256 |
| --- | ---: | --- |
| NaN vertex | 2181142 | `233041eb9ae26737104471e4763c71012c4e64a267bd5b399af7321f1bc33092` |
| Transform alias | 2181370 | `c64977499de0bea25c8c18643bd30b7e3688b677d7d9de884c19fedab662ad58` |
| Sparse execute data | 2181321 | `2acdce8eb653eb51e21dc840a95169caee4e1d22a6650e00c8fd8f6899694f2e` |

An initial NaN attempt exited before compilation because the staging script
omitted `lib/wat-manifest.js`, named by the artifact inventory rather than a
literal require. Its original logs remain under `initial/`: missing
prerequisite, no Wasm executed, not a production failure. After adding its
recorded pin, a read-only artifact-inventory and dependency-load preflight
passed before the final sequential run. No stale harness or automated risk hold
was observed. No denied operation was retried or reworded.

All 25 final artifacts, including the three exact modules, were retrieved and
byte-verified before shutdown. Both the initial failed process and all four
final test processes were absent on remote inspection. No test server, browser,
profile or forwarded port was created; box platform services were left alone.
The task explicitly delegated normal stop: `stop_653951d0c050a273` completed
at `2026-11-07T03:32:03.293Z`, forced false, error null. The box is archived,
active expiry null (original expiry `2026-11-07T03:59:20.593Z`); ownership is
returned to the coordinator. No resume or delete was performed. Local runtime,
source and build ownership was never acquired. Free `/home` stayed above 2 GB.

No full build was run: repository changes are documentation only, with no code
repair requiring the mandatory locked build. No media downloads, original
relaunch, benchmarks, nested workers or public deployment occurred. This bounded
coverage establishes neither original gameplay, full27, rate, backend parity
nor broad crash freedom. Next work is a separately authorized generated-only
viewport texture reproduction; the known original gradient gap is still open.
