# Enigma original-supervisor ownership implementation

The previous production CLI accepted caller JSON and procfs listener possession
as existing-guest authority. An alternate listener into the same handler/state,
inherited by an unrelated sleeping PID, obtained a new claim and seven HTTP
commands while the original owner remained live. The original failure and
source-backed contract analysis are retained, not rerun or relabeled as passing:

- `/tmp/enigma-listener-retained-independent-publication-oct27/ops/inherited-identity-outcome.json`
- `/tmp/enigma-original-authority-binding-repair-oct27/ops/contract-analysis.json`

The new production `tools/enigma-supervised-gameplay.py` launches one new child
using the original recipe's Popen/monitor/cleanup pattern and owns the handle,
endpoint, immutable schedule, aggregate allowance, terminal journal and one-use
controller delegation. It has no attach or replacement mode. The old CLI and
public controller constructor fail closed before config reading, HTTP, claims
or evidence creation. The original supervisor recipe and JS runner are readonly.

The private adapter is only created inside that launching lifetime. Delegation
consumption is fsynced before controller construction; controller failure cannot
reconnect. At each dispatch the live original handle, ticks, endpoint, terminal
and aggregate limits are checked again after durable intent. Serial ACK and
frozen-zero gates, reviewed-frame input binding, captures and cleanup reserves
remain enforced. Cleanup uses identity-checked pidfds for owned descendants.
This is cooperative local orchestration, not same-UID isolation or an atomic
procfs check-and-send guarantee. Sampling limitations remain explicit.

Actual production Python entry tests use launched Python HTTP children that
serve their own state. They cover positive reviewed input/ACK/frozen-zero, live
same/alternate endpoint competitors, changed output/timing/config, death,
terminal and synthetic identity changes at send, crash/timeout poison, caps,
distinct new children, same-process replacement refusal, unrelated-process
preservation and pre-launch schedule rejection. Scheduler/helper tests remain
separately labeled; historical shared-parent/idle-holder fixtures do not prove
real original execution. The Node preflight branch was inspected but not run.

Whole-test caps: physical 128 MiB, CPU 90 s, wall 120 s, file 24 MiB, output 2 MiB,
excerpt 8192; one execution-pool slot. Git uses two slots then the shared lock,
physical 256 MiB and DATA 512 MiB on Git subprocesses only, with exact trusted
SSH. Fresh disk/RAM admissions include the peer reservation and positive WAL
once. Prior disk/provenance incidents stay in their original evidence.

Two new harness failures are preserved: a closure binding NameError and rejected
empty command argument. Corrected entry tests passed; neither failed run is
accepted evidence. Controller SystemExit reporting was then corrected and its
affected boundary/positive methods passed. Per-group checkpoints bind exact
source/fixture hashes; unchanged methods are reused rather than broad reruns.

Full compact result, commands, cleanup, source hashes, reuse provenance,
tested/staged/tree relation, commit/branch/exact remote and manifest:
`/tmp/enigma-supervisor-owned-controller-implementation-oct27/ops/`.
See also `test/fixtures/enigma-controller/README.md` for the production launch
schema and migration. No actual Enigma, Node, browser, build, Boat, service,
public deployment, main integration, trust-key or access change occurred.
No assigned box; all prior boxes were coordinator-reported stopped.

This is a tested implementation candidate. Independent acceptance and separately
admitted actual Enigma runtime remain required; no gameplay qualification follows
from these transport tests.
