# Independent caller migration acceptance — 2026-10-30

Accepted for the offline caller-loading contract: candidate
`2baa8c78850ea843dcd76392ba74bff73716b279`, caller SHA-256
`f0e7d5ecc55613c64706e2849b33852cb577c18adc811ef7e869fc8b5ae7ab09`,
backend SHA-256
`13bf42f071f5eb84542286f35faf2dc814aaf63bf1bcfe7bb306e3e2f7f4f963`.
No production counterexample found. No production edits or main integration.

The migration diff changes exactly the backend SHA in the production caller.
All dispatch source pins and the migration's canonical completion receipt
(`8116e6a3a9977d48bf297981e665a189152371637aeb7c3f846609afacc33ef0`)
were checked. Existing backend socket acceptance remains inherited, unchanged
evidence; it was not replayed or represented as fresh runtime qualification.

First behavioral checkpoint was the unchanged
`CallerPins.test_exact_production_pair` reproducer on the exact pinned caller.
It passed. The eight-test migration suite was not rerun.

Fresh independent assertions are in `test/toyvm-caller-independent-oct30.py`.
Nine groups pass:

* Executable tampering of each adapter, confinement, backend and supervisor
  source fails with the exact path-specific identity error before compilation.
  Read-order observations establish where rejection occurs. Restored sources
  and an executable unrelated decoy allow loading.
* All four reads precede the sole adapter compilation; the compiler receives
  the accepted adapter bytes with `dont_inherit=True`.
* A valid timestamp/size-matching poisoned pyc is demonstrated executable by
  the ordinary loader. The production caller returns the original code.
* After the last transitive read, the adapter file is replaced with a valid
  executable poison. The ordinary loader executes that replacement; the caller
  still returns the previously verified original code.
* A source-derived confinement-pin-skip mutant really loads altered input,
  then fails the same independent oracle with `PIN BYPASS: <exact path>`.
* A source-derived post-validation reread mutant consumes valid replacement
  code, then fails with `VERIFIED BUFFER BYPASS`. Neither mutant uses a syntax
  error or an unrelated startup failure as its rejection evidence.
* Real browser/domain and invalid receipt identity gates reject before backend
  loading. Later gates cover every resource key with booleans, zero, negative,
  NaN, infinity, over-limit and missing values, plus extra quotas, invalid argv,
  inconsistent file/live quotas and occupied work directories.
* 86 independently constructed authoritative result rejection cases cover
  accounting, cleanup, stop reason, resources, child exit and output. Inclusive
  resource/output edges and both allowed cleanup alternatives succeed.
* Synthetic forwarding preserves explicit synchronous backend selection,
  passes no rename-evidence opt-in, keeps browser permission false and retains
  the allowance. An exception with a clean filesystem receipt still cannot
  establish complete child cleanup.

Later qualification/forwarding checks stub historical receipt validation;
forwarding uses a synthetic backend result. These isolate caller logic and do
not qualify live execution. Real invalid receipt/domain rejection is unstubbed.
The oracle invokes no production backend workload, FUSE mount, guest or browser.
No Node process or filename-bearing mount argv was used, so their conditional
startup/parser checkpoints were not applicable. No Boat was allocated; box,
state and expiry are none, lifecycle owner remains coordinator.

Reproduce from the owned repository with the task's unchanged supervisor:

```sh
python3 ../ops.py production-boundary python3 test/toyvm-bounded24-caller-wiring-oct28/test_accepted_rename_pin.py CallerPins.test_exact_production_pair
python3 ../ops.py independent-acceptance python3 test/toyvm-caller-independent-oct30.py
```

Reuse these passing groups for unchanged inputs rather than rerunning to package.
Evidence and canonical completion receipt:
`/tmp/toyvm-rename-caller-independent-accept-oct30/e/` and
`/tmp/toyvm-rename-caller-independent-accept-oct30/completion-receipt.json`.
The latter records the exact published remote SHA, input/test hashes and limits.
Recovery patch/recipe and coordinator messageboard note are beside it.

All behavioral/Git operations used task-owned `ops.py`, original-parent limit
configuration, explicit validated owned cwd, admission and evidence gates.
Python DATA128MiB; Git-child-only DATA256MiB; parent RSS128MiB; descendant RSS
512MiB; CPU60s/wall90s; file12MiB/capture512KiB; evidence1MiB; task physical
allocation24MiB including an 8MiB retained publication reserve. The reserve
remains allocated through coordinator closeout. Strict configured Git SSH
trust is retained. Initial root-ref digest is reused; no root/donor Git writes,
shared board access, credential changes, public deployment or runtime allocation.
The coordinator must append the supplied bounded messageboard note.
