# MDK2 bounded ordinary startup provenance

The owning binding now retains passive evidence from actual ordinary native
`run(budget)` calls before observer admission. This implements the measurement
recommendation in [the checkpoint diagnosis](mdk2-reachable-checkpoint-cause-20261105.md).
A host step remains a scheduling opportunity, not a fixed native instruction
prefix. This change does not qualify a new checkpoint or authorize another
original attempt.

`__mdk2BoundTrace.report().startup` contains at most 128 recent native run
records, 16 power-of-two run-ordinal milestones, and 128 existing browser
Worker `sliceDone` messages. Eviction counts and cumulative captured
run/completion/block counts remain available. Milestones share captured
records; they are not reconstructed history. Each run retains the actual
forwarded budget, whether the original call returned, completed blocks, halt,
measured elapsed time, and before/after registers including yield and guest
tick count. Its owner identifies the authenticated transferred Module hash,
compilation epoch, target, Worker URL, endpoint and sole owning instantiation.
The existing binding rejects replacement instantiations.

After each run, the journal reads 48 raw words (192 bytes) at the actual ESP.
Thread1, main loader identity, integer registers, aligned main-stack bounds
and every translated byte must validate. Invalid context is marked invalid;
the first capture error is retained. These saved words are caller context,
never a pending-call ledger, CALL/RET witness, or GC entry. A valid record
ending at a maintenance seam can establish that sampled PC and stack were
actually reached. It says nothing about unobserved instructions between slice
boundaries. Dropped records cannot be recovered from milestones or totals.

Incoming ordinary slice sequence/budget metadata correlates native runs with
the unchanged browser Worker's outgoing `sliceDone` body. The latter preserves
its actual `ms`, blocks, PC/ESP, yield and sleep fields, including the elapsed
interval consumed by the adaptive host. The hook forwards the identical
message, transfer arguments, receiver and result. Completed request tags are
cleared; overlapping requests and unmatched responses remain explicitly
uncorrelated and preserve the first diagnostic error. It does not consume
`get_sleep_yielded`, which reads and clears a flag. Node's shipped Worker uses
`parentPort` instead of browser `postMessage`; its report explicitly marks
browser feedback unavailable. Native run timing and registers are still
captured there.

The elapsed `run()` interval excludes the following caller readback. The
Worker's enclosing elapsed interval includes instrumentation overhead, as does
the adaptive host's normal feedback. Consequently this instrumentation cannot
promise an unchanged adaptive trajectory or replay of either retained
original. Fixed-budget native fixture parity establishes unchanged guest
effects for identical supplied commands; it does not establish wall-time or
original gameplay equivalence.

The journal seals on first native run failure, observer admission or terminal
cleanup. Later reports and cleanup cannot replace its first failure/error or
restart collection. Reports return copies of retained journal data. Capture
failures do not replace the original native return value or exception.
Malformed transport metadata cannot append unbounded objects. Production
admission, the seven caller guards, scheduling, clocks, input, readiness, and
the observer's one-shot 50M-boundary/360-second/512-record contract remain
unchanged. In particular, `4641c7` remains unsupported. No saved return seeds
an observer frame.

Evidence is in `scratch/runs/20261105-mdk2-startup-native-provenance/`.
Both Stronghold0250 final `666b5ee4c` and ReturnFire0305 final `691020294`
runtime AND file releases preceded shared edits and executable checks.
`release-gate.json` independently rechecks six exact PID/start-tick identities,
four refused ports, removed profiles, normal Chrome exits, absence of heavy
processes, both free locks and disk space. Source-only proposals were prepared
before that gate without applying shared changes or running modules/tests.

Validation passed:

- 13 final focused provenance cases cover bounded records, copied reports,
  immutable first errors/failures, invalid owner/loader/register/caller state,
  failed clocks, primitive exceptions, sequence lifetime and ambiguous feedback.
- Both accepted native modules execute the existing original-instruction
  fragments through the actual shipped Worker queue with dormant provenance.
  Full memory hashes, registers/lazy flags, commands and traps match the
  uninstrumented dormant controls. The fixture's inputs/caller are explicitly
  synthetic; these are not original-startup or gameplay observations.
- The broader integration/runtime run passes 234 regression checks. The
  unchanged observer focused suite also passes both native modules. Final
  targeted provenance checks cover the subsequent correlation/exception edge
  cases; no admission/controller code was changed.
- The public composed entry verifies 439 filesystem, 439 proof-HTTP and 439
  actual-caller-HTTP identities with public/native spawn barriers. Zero Chrome
  launches and zero forbidden spawn calls occur. Both servers close and both
  ports refuse connections. This mock uses an explicitly synthetic host clock
  at 02:00Z to exercise the unchanged historical helper before its existing
  cutoff; no production deadline or guest clock changes. Browser feedback
  transport tests are synthetic; Node native fixtures truthfully mark browser
  `postMessage` feedback unavailable.
- `flock /tmp/wine-build.lock bash tools/build.sh` passes on the final code.
  Existing module hashes remain `e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`
  and `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8`.

`binding-ledger.json` names the old/new integration and focused-test hashes;
the local helper, resolver and observer hashes are unchanged. Historical
inputs remain untouched. `admission-unchanged.json` verifies the complete
`createTraceDriver` source against pre-edit Git `6910202949bf56e9b3488587fdd0b96893e07922`.
The final public-entry proof binds integration SHA-256
`62e3c2ff1654d4808170c6ee47e577fa6dd0636510b952bcdc341c5e891bba9f`.
Evidence uses Git SHA plus relevant binary diff and owned new-file patches;
media/modules are referenced by existing paths and SHA-256, without copies.
No source tree snapshots or archives were created.

The next actual-native evidence needed is an explicitly authorized ordinary
startup with this exact binding: correlate genuine budgets and Worker elapsed
intervals with register/caller witnesses at an actually reached candidate
seam. Preserve unknown or evicted intervals. Any later admission proposal must
still justify absence of relevant pending tracked calls and continuously
witness genuine GC entry/return using one unchanged contract. No original,
browser, gameplay attempt or box lifecycle action was made here. Box
ID/state/expiry: NA; shutdown remains the coordinator's responsibility.
