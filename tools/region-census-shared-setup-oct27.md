# Read-only census build setup, 2026-10-27

Base: `1cf9788cc3ac807027206c39fcbf1d2771599845`.
Original census SHA-256: `58bf809d531f908341874bb72b2a6faed37903dc2f34e98bb288bb1e5fa781a2`.

The build previously started five separate census processes. `--gate` still runs
before `gen-region-map.js --check`. Only the subsequent four gates now use
`--build-gates`, in order: js-copies, embedded-wat, dup-payloads, hand-rolled.
Each gate retains its diagnostics and immediate process exit on failure.

The new mode privately shares successful declaration parsing between its first
two gates. Running the gates in one process also reuses the existing layout
module's canonical layout and compiler loading. It does not cache source text,
directory listings, baselines or scanner results. Scanners still discover and
read their inputs at their original boundaries. There is no persistent cache or
new shared state in exported scanner APIs. The mode accepts no additional
arguments; record/report/legacy flags cannot silently select a different branch.
Default and individual modes retain their previous flag precedence and writes.

## Evidence and reproduction

The portable fixture is `test/fixtures/region-census-build-gates/`. Its origins
file pins every source read during extraction. It contains the unchanged
production declarations, existing literal globals required by their laws,
existing symbolic base globals, and 100 distinct existing region payloads.
The duplicate-payload coverage floor remains 100. The exact original census is
retained as a text fixture. The helper stages the real production CLI and its
complete small dependency closure; scanner/layout/compiler functions are not
mocked. These files are scan inputs, not a full compilable emulator.

Run:

```sh
node --max-old-space-size=512 test/test-region-census-build-gates.js \
  test/fixtures/region-census-build-gates/original-region-census.js.txt /tmp/region-census-evidence
```

With no arguments the test uses the same pinned oracle and a fresh temporary
output directory. Retain its stdout/stderr files on a failure.

The original four production CLI commands passed first, before implementing
the new mode. The initial acceptance group retained 144 actual CLI invocations:
clean input; every nonempty combination of four gate violations and first
failure; coverage-floor and out-of-region guards; missing/invalid inputs;
default/individual/legacy combined flags; record/baseline writes; unsupported
new-mode combinations; and four omitted-gate controls. Same-file changes between
gates and exported API source/result isolation were exercised. Initial directory
sharing was subsequently removed. A final 13-invocation delta checks the final
source's success, each violation, simultaneous violations, changing source text,
new target discovery, a rejected stale-directory control and three measurements.
The committed test also includes these discovery and exact-oracle guards.

Compatibility used all nine CLI dependency files from main
`be0eb25fc33f3b057847d6c4e2c4fe5a6a9a426c`, materialized from existing local
objects. Twenty-four invocations compared clean input, each gate violation and
an added declaration. A final CLI confirmation used the final candidate census
with those main dependencies and matched the original output. This establishes
small-path source compatibility; it is not merged-tree or full-build acceptance.

## Bounded measurements

Actual preload counters on the same portable CLI closure:

| Setup work, per four-gate sequence | Independent processes | Final combined mode |
| --- | ---: | ---: |
| Layout compiler calls | 3 | 1 |
| Declaration-parser calls | 2 | 1 |
| Declaration-file reads | 10 | 5 |
| Manifest reads | 4 | 1 |
| Reads of each compiler-stage JS file, including scanner reads | 5 | 3 |
| Host source reads | 2 | 2 |

Three original sequences used 0.337107–0.352740 CPU seconds, with largest
single-process RSS 59,652–60,380 KiB. Three final candidate sequences used
0.111112–0.118508 CPU seconds and 62,344–63,148 KiB. These are bounded noisy
`process.resourceUsage()` observations with the same instrumentation, executable,
heap flag, controlled environment and inherited limits. Original observations
were reused after the source-only removal of directory sharing; candidate
observations were refreshed. RSS is the largest single process, not an aggregate
peak. Instrumentation counts were checked against raw per-process receipts.
An initial summary assertion forgot that the scanners also read the compiler JS
files; its failure and all successful underlying commands were retained and
summarized without replaying them.

These results demonstrate less repeated setup on this fixture. They establish
no full-build CPU saving, module qualification or gameplay result. The prior
trusted CPU90 rejections at 126.1068 and 105.48018 remain binding; both emitted
modules remain UNQUALIFIED. No full canonical build, guest/browser/Boat operation,
main integration, worker launch, CPU metric replacement or limit change occurred.

## Canonical operational handoff

`/tmp/airstrike-region-census-shared-setup-oct27/ops/receipt-manifest.json` is the
single operational manifest: final source/fixture pins, changed evidence,
completed groups, original failure paths, publication, resource/cleanup receipts,
and recovery. A separate evidence archive preserves ignored outputs. Exact
task-branch/remote commit receipts live there rather than embedding a circular
commit identity here. Independent acceptance of this bounded source change is
justified as the next review step; this worker does not claim independent review
or authorize a canonical build.
