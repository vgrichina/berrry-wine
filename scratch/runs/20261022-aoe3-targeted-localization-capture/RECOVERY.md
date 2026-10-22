# Recovery without another guest run

The complete new unfiltered log remains at `bx_32262dnp:/home/user/aoe3-original-oct22/diagnostics-targeted-localization-20261022T1058Z/output.log`. Lossless local `raw/output.log.gz` is committed with raw SHA256/size in `raw/trace-summary.json`. `capture.tar.gz` is this run's collection only; its archive SHA256 is in `collection.json`. Donor artifacts and originals are read in place, never deleted or modified.

Run `python3 scratch/runs/20261022-aoe3-targeted-localization-capture/verify.py` from this isolated checkout for hash/offset/return-chain validation. Node is used only for local syntax checks. The verifier also checks protected root seals, so changes subsequently made by the coordinator can make that historical protection check fail; distinguish later state from this task's recorded `verification.log`.

Do not replay driver.py or stage.py: this task consumed its one guest run. The driver has a one-launch guard and absolute no-start-after11:30UTC deadline. No next task is authorized here. No production module or guest-memory modifications exist to apply or rebuild.

Reproduce the generated diagnostic files locally only, if independently assigned, with the committed prepare-harness.py and instance-hook.js. The recipe reads the two pinned donor runner/observer files in place and requires a nonexistent output directory. It does not connect to a box. No large module or PE duplication is needed. Historical source/module and runtime373 pins are documented in REPORT.md and staging-gate-result.json. Shared Git alternates depend on the donor object store locally; the task commit is also pushed to the actual remote branch, which is the durable backup.

Coordinator retains sole box lifecycle authority. Assigned box bx_32262dnp expiry12:53:29.069UTC, shutdown checkpoint11:50UTC, is left RUNNING with no owned guest processes or8123/8124 listeners. New remote HANDOFF.json includes commit, branch, command, evidence paths and ownership. Original bx_5mu9dnhg remains stopped; Shadow Man was not accessed. No children or follow-up task may be started by this worker.
