# CivII atomic lifetime ownership repair — independent acceptance pending

Parent `a3fa32333bbcdc2c8717811432ef5cf6938be776`; original independent rejection
`1f5b33a8341ba9e1d9d2938ef02fe1a6069398bc` is retained, including the actual
2-launch observation and source pins. This task publishes to its task branch
only. Main is forbidden. No guest, browser, Wasm build, Boat operation, service,
public deployment, additional worker or refill was performed.

`tools/civ2-serial-controller.js` now exclusively creates `controller-owner.json`
with `openSync(..., 'wx')` before any ledger/control write or launcher callback.
Launcher and standalone paths use the same claim. Its random invocation token,
file identity and containing-directory identity are checked before writes,
transport dispatch, ACK adoption and launcher entry/return. Initialization must
finish ledger persistence before marking the controller started. Failed starts,
failed/pending launches and repeated run/start/launch calls cannot restart work.
Run termination persists stopped state and poisons the controller.

The claim is deliberately retained forever for this task directory, including
partial/empty claim writes, failed ledger writes/renames, process death and clean
handoff. Nothing removes stale locks or another owner's files. A dead process is
not evidence that guest dispatch did not happen. This repair supplies no recovery
or replay mechanism and grants no reset allowance. An empty or foreign claim
requires coordinator resolution, never automatic deletion. External parties must
not remove task evidence; detected replacement stops further writes/dispatch.

The planner is byte-exact to the donor. The 22-image route minimum and **44 MiB
image-only planning lower bound** remain; neither admits runtime. Real ACK
adapters, conservative uncertain charges, zero frozen credits and stale-frame
invalidation remain. Setup/game decisions are unchanged. Rome founding/movement
remain historical passes. Personally inspected production city UI and normal
guest Quit/Exit0 are still pending.

## Verification

`acceptance.json`, per-group checkpoints and `operations.jsonl` bind the tested
source, fixture, commands, flags, limits, results and physical peaks.

* The original deterministic real-filesystem atomicity schedule and assertions
  pass with one launcher. The test is unchanged except candidate source loading
  and SHA binding (`reproducer-adaptation.json`). Original pins are retained.
  Its historical `candidate`/`productionPins` checkpoint fields still identify
  the rejected donor; **candidate-pins.json** and this task's acceptance/checkpoint
  records identify the repaired source actually loaded and hash-checked.
* Nine focused ownership groups cover both paths, aliased directories, all four
  reentrant start pairings, claim/ledger/rename failures, pending/failed launcher
  reentry, failed/concurrent standalone runs, existing uncertain artifacts,
  lost/replaced owner identity, independent directories and retained lifetime.
* Four simultaneous process pairings each start exactly one owner, kill that
  winner, then reject a new launcher and the actual standalone CLI with no
  control stream or ledger/marker change. Use the **shell** process fixture.
* All three affected actual append-stream groups pass: exact/duplicate ACKs,
  failed capture retention/no replay, partial steps, frozen zero and stale pixels.
  The independent impossible-plan guard also passes with zero callbacks.
* Original groups 1 and 3–10 pass. Group 2's byte-exact predecessor oracle is
  reused. After the final run-only lifecycle delta, affected groups 1/7 and
  process CLI/ownership groups were rerun; unchanged guard/stream and other
  original groups reuse exact relevant bodies. `reused-input-identities.json`
  reconstructs the entire previous tested source SHA using only that inverse
  delta and verifies unchanged setup/planner/fixture/test identities.
* Removing exclusive creation changes the retained owner and fails the oracle.
  Removing lifetime verification permits a request after owner replacement and
  fails the ownership assertion. Removing production admission fails the
  impossible-plan oracle. Mutations compile the actual module in memory; the
  production file remains unchanged.

Original test adaptation only adds unique task-owned real output directories,
ensures their parent exists, relocates receipts and updates the planning-mutation
anchor. Assertions and original group bodies remain unchanged. Historical donor
checkpoints were restored unchanged; new receipts live under `original-groups/`.

## Resources and incidents

Tests reserve one shared pool slot and enforce physical aggregate **128 MiB**
including the pool parent, supervisor, watcher and descendants. Git reserves both
slots before the production Git flock, enforces physical aggregate **256 MiB**,
and sets DATA512 MiB only on the Git child. CPU90s/wall120s/file24MiB/output2MiB/
excerpt8192B apply. Node's old-space64 MiB is separate from physical RSS; DATA/AS
remain unlimited. Exact Node startup receipts are in operations. Ordinary groups
use Node v24.18.1 heap64; the shell process fixture uses additional `--jitless
--single-threaded` flags after its startup check.

Two later Python-hosted concurrent-process attempts exceeded the physical cap
(147927040 and 137949184 bytes) and were killed. Both remain in operations and
incident receipts. No limit was raised or unchanged attempt retried. Replacing
only the concurrent Python harness with Bash, and verifying after both V8s exit,
passed all four pairings at **131756032 bytes < 134217728**. Archived Python
harnesses preserve the initial passing run and both stopped configurations; they
are historical recipes, not recommended commands. The first stream retry also
retains its error-message mismatch; production now preserves the established
`existing task ledger` diagnostic without weakening its oracle. Historical real
denials, the erroneous individual-client cap and guest reserve incident remain
in prior incident evidence. No runtime denial was retried.

The own 64 MiB allocation includes selective source/Git/output/publication,
launcher/events/current session and positive WAL growth counted once, future16
MiB, reserve8 MiB, plus an extra8 MiB publication increment budget. Admission
measures physical bytes, aggregate MemAvailable and remaining fleet growth;
projected disk free must stay at least 2982150144 bytes. Actual client RSS is
already deducted; future64 MiB/resident is counted once, with no individual RSS
cap. Conservatively reserved unused fleet disk growth remains in admission.
Standing read-only donors are excluded, with no materialized links hiding bytes.

## Reproduce and handoff

From the isolated repo, run through the supplied pool and physical supervisor:

```sh
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- \
 python3 /tmp/civ2-atomic-controller-ownership-repair-oct26/ops/run.py test \
 /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=64 \
 test/independent-civ2-controller.js atomicity
```

Other groups: `test/test-civ2-controller-ownership.js`, independent `guard`/`stream`,
original `--from=1 --through=1` and `--from=3 --through=10`, and supervised
`/bin/bash test/test-civ2-controller-process-ownership.sh`. Omission flags are
`--omit-exclusive`, `--omit-lifetime`, and original `--omit-planning-guard`; each
must fail. Do not repeat passed groups without a relevant change. A future task
must freshly admit its own paths/session/footprint before reusing this recipe.

No box was assigned, queried or changed; state/expiry are N/A. Coordinator keeps
shutdown ownership. Next gate: fresh independent acceptance of the published
source. Final commit, exact remote verification and final admission are retained
externally in this task's `ops/publication.json` and `ops/result.json` and in the
append-only repository messageboard.
