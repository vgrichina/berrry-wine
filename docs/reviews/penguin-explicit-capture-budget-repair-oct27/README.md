# Penguin explicit capture budget repair

Source/tests only. Base donor revision: `f78bca4820c5de96afe46d81e5583d71e39d1882`.
This is an orphan sparse report repository: do not merge its tree into main.
Extract only `tools/penguin_capture_contract.py` and
`test/test_penguin_capture_contract.py`, or apply the zero-context `candidate.patch`
with `git apply --unidiff-zero` to the exact
base. The unchanged `test/fixtures/penguin-wire-envelope.json` is included so
the affected tests run without additional recovery. Coordinator owns independent
acceptance and integration. No guest, Node, Boat, public deployment or main changes.

`capture_budget` is an explicit integer in 1..8388608, default 1048576.
Both production planners pin it at construction. The provider plan and nested
canonical plan must agree; collector/restoration callers may additionally bind an
expected budget. A collector snapshots its plan and rejects later budget edits,
charging rejected raw responses before poisoning. There is no budget setter or
task-ledger reset. `used` must include all preceding serialized responses; callers
must never replay/reset an existing invocation under a larger profile. Dict budget
field tampering is rejected against a private construction pin. This is an API
contract, not protection against arbitrary Python code using `object.__setattr__`.

CLI planning/restoration accepts `--capture-budget 8388608` only when the task has
that authorization. This does not alter `API_BYTES`, the launch profile/supervisor,
per-image bounds, local output/display limits, or any live execution allowance.
CLI response files are bounded by the selected budget; the transcript-index cap
remains its historical 1 MiB. All framing is measured as original raw response
bytes. Tail bytes spend their reserve once and cannot displace remaining frames.
Schema, chunks, base64, decompression EOF/size/hash, poisoning and atomic publication
retain the original guards.

The first behavioral check was the unchanged production CLI with the actual two
retained images, `--used 0 --tail-reserve 1048576`. It rejected locally with
`UNSUPPORTED_PLAN`, transfer 2104362 bytes at the default 1048576 cap. Both original
planner rejections and source/fixture identities are retained in baseline receipts.

The fresh explicit offline pair uses 840x660 PNGs of 806077 and 811393 bytes, pinned
in `checkpoint.json`. They compress to 764394 and 771120 bytes. The synthetic full
Boat envelopes contain 191 capture responses totaling 2130054 raw bytes. Previous
response charges are 333 bytes, and the terminal/account response spends exactly
1048576 bytes. Actual total charged once: **3178963 bytes**. Conservative framing
plus prior charges plus terminal reserve: **3304396 bytes**, within 8388608.
Both original PNGs restore byte for byte and hash for hash without scaling or
truncation. These historical images are offline transport fixtures, not new
projectile/gameplay evidence. The 1 MiB terminal fixture is not printed.

Targeted tests (Python stdlib only):

```sh
python3 test/test_penguin_capture_contract.py ExplicitBudgetTests TransportTests ProviderTransportTests -v
```

Six new methods cover both profiles' exact/one-byte-over boundaries, invalid
profiles, immutable pins, plan/collector mismatch, previous-response charges,
poll/error spending, late capture poisoning, remaining-frame/tail reservation,
production CLI pair roundtrip and failure without partial output. Ten unchanged
transport methods cover framing/schema/order/decompression/hash regressions.
Four in-memory omission controls must produce assertion failures (not setup
errors): maximum budget, construction pin, raw charging, remaining reservations.
They never monkeypatch the task's global `API_BYTES` or execute API/guest traffic.

Unchanged launch functions and `LaunchTests` are compared byte for byte to the
pinned donor; `reuse-launch.json` references accepted launch/supervision evidence
in the donor's `ops/result.json` and `ops/reuse-report.json`. Those unrelated tests
were not rerun. Remaining live gates: exact Node startup/limits/config diagnostics,
canonical filename-bearing mount validation, runtime startup, input and projectile
observation, gameplay and ordinary Quit. No assigned/touched boxes; coordinator
retains lifecycle ownership.

Evidence: checkpoint/pins, initial rejections, targeted stdout/stderr and inherited
limits, omission transformations/results, per-frame raw byte counts and hashes,
reuse receipt, and manifest. Operations remain under
`/tmp/penguin-explicit-capture-budget-repair-oct27/ops`. `run.py` imports the pinned
trusted supervisor; `child.py` redirects distinct streams before exec and applies
DATA512MiB only to Git. Execute via the light pool: one slot for Python, two slots
plus `/tmp/wine-ops-production-git.lock` for Git. Physical limits are respectively
128/256MiB; CPU90, wall120, file24MiB, output2MiB and disk floor remain enforced.
The supplied strict SSH command is hashed in receipts; no trust files are changed.
No full checkout, fetch, repack, root tracked/index/ref write, or donor write.

Historical incidents are retained, not retroactively declared compliant: initial
oversized read-only display; alternate-nesting warnings; installed-package collision
with unittest module import (corrected to exact-file invocation); first pin-omission
control passed a provider plan to the legacy restorer and yielded KeyError after
removing the pin guard. The test now checks the pin directly and restores only the
canonical plan; omission controls then yield assertion failures as intended.
