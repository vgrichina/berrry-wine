# Recovery recipe (do not replay without new authorization)

Owned root: /tmp/toyvm-metadata-budget-mounted-cli-oct29
Repository: /tmp/toyvm-metadata-budget-mounted-cli-oct29/repo
Branch: task/toyvm-metadata-budget-mounted-cli-oct29
Base: 7bf2ad5025b6c273193ebd48084879c61fde6293

All local subprocesses after supervisor bootstrap used:
 /usr/bin/python3 -B OWNED_ROOT/ops.py LABEL COMMAND ARGS
with validated owned cwd; Git arguments were rewritten by that supervisor to
git -C OWNED_ROOT/repo. Strict configured GitHub SSH was used unchanged.
Supervisor and limit module remain at OWNED_ROOT/ops.py and limit_contract.py;
their dispatch pins are in checks.json. Python DATA128MiB, Git DATA256MiB
children only, CPU90, operation wall120, physical parent128/group512MiB,
disk48MiB, evidence1MiB and capture2MiB applied. The2GiB RAM admission floor
and aggregate forecast were checked before each local operation.
The remote tiny observer enforces parent DATA128MiB/CPU90/FSIZE12MiB and
monitors parent128/group512MiB, wall90, capture2MiB and disk48MiB.
Production resource limits remain the explicit case argv.

Remote root: /tmp/tvmb/repo. Canonical immutable receipt:
 /tmp/tvmb/cancellation-receipt.json
Only manifest-listed sources plus original receipt, fixture, observer and manifest
were delivered with boat new --json --ttl1800 --file REMOTE=LOCAL per file.

Preflight and two cases ran via:
 boat exec --json --timeout100 BOX -- /usr/bin/python3 -B /tmp/tvmb/observer.py MODE
where MODE was preflight, then case1, then case2 conditional on full case1 pass.
Use the actual spaced --ttl 1800 and --timeout 100 CLI arguments as recorded in
the retained API envelopes (compact notation above is descriptive).
observer.py constructs the exact production CLI argv recorded in each case.
The unchanged fixture text is one -c argument; never interpolate it through a shell.
Work directories were fresh /tmp/tvmb/work and /tmp/tvmb/reject.
No standalone pinned-supervisor workload was used.

After case2, boat --json stop BOX requested a nonforced snapshot-stop;
boat --json info BOX supplies the verified final state in lifecycle.json.
Do not resume or replay this completed task. Ignored raw logs remain in OWNED_ROOT/e;
the stopped Boat snapshot preserves remote raw outputs for coordinator recovery.
