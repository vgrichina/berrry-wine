# CivII independent acceptance: rejected

Candidate `a3fa32333bbcdc2c8717811432ef5cf6938be776` is **rejected** for non-atomic
start/launcher ownership. No source was repaired or published to main.

The unchanged production `launchController` admits two calls for the **same output
directory and allocation**. The deterministic schedule pauses A immediately before
its first `capture-plan.json.tmp` write. B passes both existence checks, writes and
renames its ledger, and invokes its launcher. A resumes, overwrites the ledger,
and invokes its launcher too. Both real controllers report started; two launcher
callbacks execute. The expected ownership count is one. The test intercepts only
filesystem-call scheduling; every filesystem operation and result is real. No
production guard, persistence operation, or admission check is removed. These are
offline sentinels, never guest launchers. See `atomicity-observation.json` and
`failure-atomicity.json` for the unchanged failure.

Repair needs invocation-owned atomic lifetime ownership before **any launcher**
or control write. Both launcher and standalone controller paths must reject a
concurrent owner before execution, keep uncertain ledgers, and grant no budget or
replay credit on restart. An atomic JSON replacement alone does not claim ownership.
The coordinator owns a separately assigned repair and affected acceptance.

The first behavioral checkpoint used the pinned production launch/start/input
boundary with the unchanged impossible 20-image allowance: zero launch callbacks,
zero transport callbacks. It still requires 22 images: sixteen setup, Orders,
city name, founding notice, first-city tutorial, production screen, and quit
confirmation. At 2 MiB each this is **44 MiB of images alone**, a planning lower
bound, never runtime admission or a claim that 22 always suffices.

Three additional groups used the entire production controller and its real
append-only `control-in.jsonl`/`guest.log` ACK adapters with a tiny offline peer:

- Unrelated ACKs cannot satisfy exact ownership; a failed PNG ACK retains the
  actual 17-byte output, charges one attempt, and blocks all replay. A new session
  cannot restart an existing ledger.
- Duplicate exact ACKs reject before PNG dispatch, retaining one conservative
  uncertain capture charge.
- Partial step completion, nonzero frozen credits, and pixels from before a step
  all block input. No input was emitted by these rejecting cases.

The ten unchanged donor groups, predecessor exhaustion, setup transformation,
and production planningguard-omission rejection are reused from exact source and
fixture hashes, without repeating them. New omitted-control mutations and broader
independent challenges were stopped when atomicity rejected. This is not full
acceptance. No guest, browser, emulator, compilation, Boat/SSH runtime, lifecycle,
service, public deployment, main change, or additional worker was invoked.

## Reproduction and evidence

`pins.json` binds the exact donor revision, Git blobs, SHA-256 and byte lengths.
`test/independent-civ2-controller.js` is the actual independent implementation;
`operations.json` records exact executable, flags, environment, limits, measured
physical peaks and outputs. The own source copies are untracked in `input/`;
recover them from the existing verified donor files, without fetching missing
runner blobs. Copy `tools/civ2-serial-controller.js` and `tools/civ2-capture-plan.js`
from the donor named in `pins.json` to `input/`, then check their SHA-256 values.
The test itself checks the identities before loading the production modules.
The source remains unchanged. Checkpoints bind each completed group and its test
hash; `failure-stream.json` preserves the earlier fixture-path error.

The original commands, from this isolated repository, are:

```sh
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- \
  python3 /tmp/civ2-capture-reserve-independent-accept-oct26/ops/run.py test \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=64 \
  test/independent-civ2-controller.js atomicity
```

This command must exit 1 on the rejected candidate with `2 !== 1`. `guard` and
`stream` are already passed; reuse their receipts on unchanged inputs. The
retained `supervise.py` is the same task supervisor recipe, with paths/accounting
requiring fresh measurement before any future reuse. Restoring a recipe does not
waive platform controls or permit extra tests after a rejection.

## Limits and handoff

Tests: physical aggregate 128 MiB including outer pool, Python supervisor,
watcher and descendants. Node old-space 64 MiB is separate; inherited DATA/AS are
unlimited, confirmed by a successful exact-executable startup. Git: pool slots=2
before the exclusive production Git flock, physical aggregate 256 MiB and DATA
512 MiB **on the Git subprocess only**. CPU90s, wall120s, file24MiB, output2MiB,
excerpt8192B apply to both. Installed tools and standing read-only donor files
are excluded from new task disk bytes. No links conceal materialization.

The complete own allocation is 48 MiB: selective source/Git/output/publication,
launcher/events/session, positive WAL growth once, future16 MiB, reserve8 MiB,
and an additional conservative publication/output increment budget8 MiB.
`admission-final.json` contains the measured complete projection and fleet
remaining growth. Historical initial full-fleet overestimates remain in events;
the final recipe uses exact fleet allocations64/64/48/96/96 and actual task names.
Aggregate MemAvailable already deducts client RSS; count future64MiB per resident
once, prospective320MiB only per unlaunched client, host768/sharedchildren256MiB.
No individual client128/320MiB cap or inherited heavy-build floor applies.

All incidents and first failures remain in `incidents.json` and original receipts.
The earlier erroneous client-cap rejection, real denials and historical guest
reserve incident are preserved. No runtime denial was retried.

Rome founding and movement remain historical passes, not rerun here. Exact
remaining runtime gates are personally inspected **production city-screen UI**
and **normal guest quit/Exit0**, including inspection of actually presented quit
confirmation. A tutorial image or controller stop flag establishes neither.
`future-controller-recipe.json` binds retained runner/module/controller/planner
hashes, current complete permitted footprint, and the conditional serial recipe.
It is explicitly blocked by this defect and requires a separately admitted full
gameplay footprint and lifecycle after repair. No automatic tutorial/confirmation
clicks were invented. No box is assigned; no box state was queried or changed;
coordinator shutdown ownership is unchanged. Evidence publication is task-branch
only, with exact remote verification recorded externally in `ops/publication.json`.
