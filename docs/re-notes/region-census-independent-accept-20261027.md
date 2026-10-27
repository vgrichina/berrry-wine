# Independent region-census acceptance: REJECT

Exact candidate `66436f785bbe3166a992402f95abf083ca0d6736`, compared with base
`1cf9788cc3ac807027206c39fcbf1d2771599845`, falsely succeeds when region
declarations change between the four combined build gates. No candidate repair
or main integration was performed.

The first behavioral checkpoint ran the actual original CLI in four separate
processes and the exact candidate CLI with `--build-gates` against the unchanged
portable fixture. Both exited 0 with byte-identical stdout and stderr. The build
file retains the command order `--gate`, `gen-region-map --check`, then
`--build-gates`; this order was inspected/asserted, not executed as a full build.
The four original processes execute js-copies, embedded-wat, dup-payloads,
hand-rolled, stopping on first failure.

The next checkpoint planted one change after the first read of `host.js`, after
the js-copies gate had read declarations and computed its layout:

```wat
(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))
```

The same fs preload appends that line to each fixture's `src/00-regions.wat`.
It does not replace the compiler, scanners, declarations API, layout API,
baseline, or CLI source. Both starting declaration files have SHA-256
`f678e69c7c9366c8ddf2f1682f5a0ab42badc9cf444c5534368f348bf64d7557`;
both changed files have SHA-256
`54988fabd68eedf7be0139425140bdc98df20b13bcdc1ec44230ba3e4f9ac5d0`.
Mutation-fired markers confirm both injections occurred.

| Path | Exit | Observable outcome |
| --- | --- | --- |
| Original separate processes | 1 | js-copies passes; embedded-wat rejects `(align 3) is not a power of two` |
| Exact candidate combined process | 0 | All four gates report OK; no stderr |

`tools/region-census.js:694` retains the first `collectDeclarations()` result;
the embedded-WAT scan reuses it through `declarations(options)` at line 629.
`tools/region-layout.js:87` also returns a memoized layout before rereading its
source. Grouping previously separate processes makes that existing cache span
gates. Later hand-rolled scanning reads the changed declaration text but does not
recompile it. Thus the candidate suppresses the validation the original next
process performs. This finding concerns changes between gates, not a claim that
an initially invalid declaration passes the first gate.

Acceptance stopped at this first demonstrated defect: eight actual CLI
invocations total (five clean, two failing-path original, one failing-path
candidate). No broad legacy/default/record/unsupported matrix, additional
omission controls, main-dependency execution, or independent read/parse/layout
reduction measurements were run after rejection. The unchanged fixture/baseline
was used for the clean comparison; no baseline was edited to pass.

The donor's `final-delta-results.json` names census source SHA-256
`86de689e82f7d942a6d81d3db78b8a77dbd67aebac44b65e8acbedbc9973b5b1`,
matching the tested final candidate, rather than only the intermediate revision.
Its retained final cases cover same-file JS text and JS directory discovery;
they do not establish declaration freshness between gates. Its prior test
results and reported reductions are inherited evidence, not this worker's
independent acceptance or independent measurements.

The trusted supervisor reports 3.533972 conservatively charged CPU seconds,
0.957487 wall seconds, sampled aggregate RSS peak 135176192 bytes, reaped
single-process peak 64303104 bytes, and complete owned-process cleanup for the
behavioral group. These are tiny-fixture observations, not full-build savings.
CPU accounting may double-charge waited work; RSS sampling is a lower bound.
Node v20.20.2 ran `/usr/bin/node --max-old-space-size=512` under CPU90/wall120,
file24MiB/output2MiB and RSS768MiB supervision. Its startup receipt records
unlimited DATA/AS; Git alone receives DATA512MiB and RSS256MiB. Python wrapper
work uses RSS128MiB. Heap size is not a total-process RSS cap.

Full build speedup and game qualification remain unproven. Historical CPU
126.1068 > 90 and 105.48018 rejections remain binding; emitted modules remain
UNQUALIFIED and completeness UNKNOWN. There was no full build, guest, browser,
Boat, CPU/control change, or worker launch. No box was assigned; coordinator
retains all box lifecycle ownership.

## Evidence and recovery

Committed evidence is in `test/acceptance/region-census-independent-oct27/`.
`source-and-evidence.json` binds the exact inputs and new payloads; the canonical
completion manifest is retained at
`/tmp/airstrike-census-shared-independent-accept-oct27/ops/receipt-manifest.json`
with final publication and cleanup receipts. Original stderr, successful clean
output, failure output, exact argv, startup limits, mutation controls and
resource admission are preserved. The independently tested driver is committed
byte-for-byte as `independent-accept.cjs`.

To recover without donor paths, use this task branch's fixture/dependency files
as `PARENT/repo`, place the committed driver at
`PARENT/ops/independent-accept.cjs`, and copy
`repo/test/fixtures/region-census-build-gates/original-region-census.js.txt` to
`PARENT/ops/base-oracle.stdout`. Run the driver with the same Node executable and
flags, under the retained supervisor/pool/resource controls and fresh admission.
It stages its own two fixture roots below `ops/independent`. All compiler and
scanner execution uses staged real dependencies. Its exit 0 means the bounded
rejection reproducer succeeded; read `independent/verdict.json` for REJECT.
For another location adapt only the owned wrapper ROOT/launcher accounting paths;
never execute a donor wrapper. Do not rerun a populated evidence directory.

Own sparse checkout uses flattened read-only object views; no clone, fetch or
repack. Root/donor tracked files, index and refs stayed read-only; the root board
is append-only. No filename-bearing mount exists, so canonical mount parsing is
inapplicable rather than claimed passing. Dedicated strict Git SSH identity and
known-hosts configuration is recorded unchanged. Initial root ref identity reuses
the supplied launcher digest; no full ref listing was captured.

Fresh per-command admissions include full owned checkout/Git/ops, launcher and
session/events, conservative entire current shared WAL once, 176MiB prospective
growth including 32MiB reserve, task allocation512MiB, projected host disk after
872415232 incremental reservation >= 2982150144, remaining client RSS growth to
320MiB, largest child768MiB and host headroom805306368. The behavioral admission
passed. Initial policy inspection produced oversized terminal captures before
the owned wrapper existed; this logging incident is retained in session/events.
Subsequent execution used distinct bounded stdout/stderr and operation receipts.
