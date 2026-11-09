# Q2 staged health preload path repair, 1030

Corrected the fresh run-only `control.py`: compute `HEALTH_PROVIDER` relative
to the source checkout alongside `FIXTURE_PROVIDER`, before production caller
`main()` rebinds `ROOT`; join that provider to `REMOTE` when generating launch.
The correction is one added assignment and one expression substitution. The
1020 inputs, terminal, manifest and sealed evidence remain unchanged. Shared
callers, custody, production composition, health reader, host and WAT are untouched.

Evidence and corrected inputs:
`scratch/runs/20261109-quake2-staged-health-path-repair-1030/`.
`staged-health-path.test.py` calls the real production caller `main()`, observes
its `ROOT=Path(REMOTE)` namespace, and executes its actual composed launch
branch. Historical source raises the exact ValueError before transport;
corrected source generates the invocation with the nonlocal staged root.
Only input driving and remote transport are intercepted for generation; no
launch formula is duplicated. The generated invocation then runs locally from
an unrelated cwd through the actual parent, supervisor and production Node
preloads with `DRIVER_PREFLIGHT=1`, before browser creation.

Valid passes; missing staged root and wrong root refuse at the actual fixture
provider. A changed health-provider read refuses at the real startup barrier
before parent spawn. All 724 provider checks remain enabled. Only the three
fresh run-input paths and hashes replace their 1020 counterparts; every other
provider hash and pinned Git identity is retained. An offline read adapter
supplies pinned Git bytes in memory for Python and Node, without copying
production modules, updating hashes to current files, or bypassing preflight.
Observed NODE_OPTIONS retains the generated health and fixture preloads.
Actual parent waits and separate EOFs are retained. This is offline preflight,
not an actual native fixture PASS or a gameplay result.

Reused 35 unchanged proof references, verified by SHA/size and gzip decoding,
including unchanged health100/100/98 integration and damage-reader tests.
Fresh focused regression and locked `flock /tmp/wine-build.lock bash
tools/build.sh` passed. Free `/home` stayed above 1.5 GB. No Box, Chrome,
native guest, worker, agent, deployment, media copy or source archive.

Recovery: `git-base.txt` names the exact Git base. The 31,777-byte
`run-input-recovery.patch.gz` adds only corrected control, unchanged small
health/fixture inputs and the focused test. Its reverse check passed against
the owned files. At that Git base, recover the prior ignored dependencies
using the retained 1020 run's `run-input-recovery.patch.gz` and its referenced
recipes; do not overwrite existing historical inputs. Apply this task's patch
only for missing owned inputs (`gzip -dc .../run-input-recovery.patch.gz | git
apply`). Run `python3 scratch/runs/20261109-quake2-staged-health-path-repair-1030/staged-health-path.test.py`
with its case output directories absent. Existing evidence is preserved;
`result.json`, `recovery-check.json` and `unchanged-proof-reuse.json` identify
the checked result and dependencies. Git remains the source archive.

Next separately authorized caller must repin fresh inputs and pass the whole
actual native fixture before any original diagnostic. The retained 1020
failure is terminal; this correction does not authorize replay. Native lifetime
remains REVOKED; all-writers/edict ABA UNKNOWN. Runtime order was
Redline1020 then Q31025; this offline task did not interfere.

No new box: ID/state/expiry/stop receipt are inapplicable. Prior Q21020 box
`bx_8xta4w6s`, UUID `d28d470b-d359-478e-8960-5a794e4cbe6a`, remains recorded
ARCHIVED / PHYSICAL_DRAINED, stop `stop_b39b6e9f3761e79c` completed
2026-11-09T10:23:49.292Z, initial expiry 2026-11-09T10:47:30.920Z. This task
neither resumed nor changed it. SingleTaskSTOP.
