# ToyVM repetition evidence independent review — ACCEPT

Reviewed exact commit `9e7d67aae1dcb0a67ba295110f9306b1d54600fe`
(`task/toyvm-repeat-evidence-oct20`) against its parent
`f5b447ebbc2b047451926053a33b367d578b4a36`. Review scope is only
`tools/toyvm/arm-bench.js` and `tools/toyvm/arm-bench.test.js`.
No production changes or main integration are included in this review.

Tested identities:

| File | Git blob | SHA-256 |
| --- | --- | --- |
| arm-bench.js | ed53c842ae22a18c8f073cfd4979d2e574f1d42f | 810559841de6a29541bab70aeb5527bc899a7f55b86a64e53a9c4a7a2cf048b8 |
| arm-bench.test.js | 498794a371b0e6639c7139f2292ab67d28fe68c2 | f301e68cb476727e4d9738524f1f59b92534d2ebbcfa80c1f3dd687579dba137 |

No blocking defect found. The production loop appends the entire resolved
`runOne` result before minimum selection, including failures, frame/count
disagreements and arbitrary nested data. Each saved repetition identifies
global zero-based execution order, CLI arm, duplicate-specific label and
zero-based repetition index. The writer serializes the same rows, including
the repetitions. Calibration has a separate record with its own budget and
global execution order; it is not a measured repetition.

The original regression passed all 28 controlled calls (18 rotation/duplicate
label/mismatch calls, six failure calls and four calibration calls). Its
baseline negative control failed at the intended raw-repeat retention
assertion. A second negative control preserved in-memory repetitions but
removed them in the production JSON.stringify replacer; the original
regression rejected it at that same assertion. Serialization omissions
therefore cannot pass merely because an in-memory structure exists.

The test mocks `child_process.spawn`, load averages, timers, console and the
file sink. It executes the actual CLI parsing, runOne stdout/stderr parser,
aggregation and JSON.stringify without rewriting those functions. The sink
parses the serialized string immediately, rather than capturing live row
references. The mock is consequently appropriate for aggregation/output
review, but does not qualify real subprocess execution or benchmark accuracy.

Independent helper `tools/toyvm/arm-bench-review-ready.js` executes exact Git
object source, uses real disk writes of production JSON, and retains every
checkpoint and transport trace. Four scenarios run against both candidate and
baseline: four calls for selected ties, six for first failure followed by
success and timeout, four for successful/failed calibration, and four attempted
calls for interruption (three resolved results and one injected spawn error).
Legacy JSON projections and all existing CLI lines are identical in every
scenario; the only excluded CLI line is the new selected-summary explanation.
Both equal-minimum arms retain their first result; later tied frame differences
survive only in repetitions. This independently strengthens the original
test's tie coverage: its intermediate tied sample is later superseded by a
lower minimum, so it alone does not prove selected tie stability.

Checkpoint boundary is unchanged: one overwrite after each completed program,
not after each child. The interruption case completes the first program, then
resolves one repeat of the second before the next attempted child throws.
Disk retains only the first program's two repetitions. This is an existing
crash-recovery limitation, not durable per-repeat journaling. “Every repetition”
here means every resolved run in completed, saved program rows. No claim is
made that interrupted in-progress programs, missing `--out`, malformed child
JSON, filesystem failures or real process termination preserve partial runs.

Selection remains minimum CPU with strict `<` ties and first-failure-wins.
Selected-only mismatch classification and across-program selected-ratio
percentiles remain unchanged; they do not represent paired repeat distributions.
The new `selectedSummary` metadata and CLI explanation state that limitation.

Validation: Node v24.18.1; three JavaScript syntax checks, regression and both
negative controls, independent differential cases, and git diff whitespace
check passed. No actual benchmark, full VM, browser, runtime, Boat, deployment,
Claude, held ScreenSaver diagnostic or laptop game work occurred.

Evidence directory:
`scratch/runs/20261020-toyvm-repeat-review-ready-oct20`.
Key files: `preflight.json`, `review-tests.json`, `candidate.log`, `baseline.log`,
`serialization-omission.log`, scenario `.json`, `.checkpoint-N.json` and
`.trace.json` files, `result.json`, `remote.txt`, `SHA256SUMS.json`.
Source snapshots and the serialization mutation are retained there.

Recovery: with the exact target and parent objects available, from a repository
containing this helper run:

```sh
node tools/toyvm/arm-bench-review-ready.js /absolute/path/to/fresh-evidence
node --check tools/toyvm/arm-bench.js
node --check tools/toyvm/arm-bench.test.js
node --check tools/toyvm/arm-bench-review-ready.js
```

Setup used a fresh independent repository sharing only read-only object access,
with exact non-cone sparse patterns installed and verified before checkout.
Shared HEAD/index/config hashes were recorded for final comparison. The task
has an 8 MiB total cap including evidence and reserves
2,210,398,208 + 32 MiB + 24 MiB free bytes; admission also included this task's
8 MiB allocation. Initial available space was 2,907,324,416 bytes.
The epoch worker alone owns integration; this ACCEPT is review evidence only.
