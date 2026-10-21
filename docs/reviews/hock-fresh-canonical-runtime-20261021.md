# Hock fresh canonical runtime — 2026-10-21

The canonical build of exact reviewed main `5b078c91d5cf6da5e337cda5e7665803c03c99e5`
failed before compilation. `node tools/check-region-decls.js --check-owners`
rejects `src/00-regions.wat:1059`: `$STARTUP_SHOW_STATE` declares owner
`09a-handlers3-sync.wat:$STARTUP_SHOW_STATE`, but that file does not define
that top-level symbol. No source repair or gate bypass was attempted.

Command: `cd /home/user/hock-fresh-canonical-runtime/repo && bash tools/build.sh`.
Boat command `cmd_jbfqhc5tum2r` exited 1. There is no canonical module,
original guest execution, startup screenshot, input or gameplay acceptance.
Registration changes from `09a89489b2a417ecab5dd9eeaf291b2464abed00` were not applied.

Remote source tree `dbcfcd920b0cfece25cd910af43074a46651c728` is clean and unchanged;
7,125 tracked file hashes were independently compared with exact Git blobs.
Node is v24.18.1. Manifest, 127 fragment balances, census 401, census mutation
tests and exact-commit startup repair acceptance passed before the build.
The historical submitted fixture also passed; its output is source-slice
evidence, not a canonical artifact or guest execution.

Initial review commands lacked historical Git objects in the shallow clone.
The same box was unshallowed, then fetched exact fixture dependencies
`8bcd437fa4852417b13d375e54e07280621a161a` and
`b09ba2e350bf8789210c8bf6ad2fa3299b15045b`. The final repair test exited 0 with
`acceptance-passed`. An orchestration status assertion initially expected the
wrong success string; it was corrected before the sole canonical build.
All intermediate command receipts and logs are retained.

Remote root: `/home/user/hock-fresh-canonical-runtime` on `bx_36t3j4s3`.
Named snapshot: `hock-fresh-canonical-runtime-20261021`. Snapshot and final
stop receipts accompany this report. No older box was touched.
Snapshot retains source, Git history, dependencies, original package, and logs.
Do not pull the full snapshot locally under the 64 MiB allocation.

`remote-evidence/intake/recover.py` recreates the original package from its
pinned archive without executing it. All 39 game files (2,224,918 bytes) match
retained hashes, including SOS9502.DLL, BBLOOGIE.000 and 36 AIF files.
Archive SHA-256: `e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`.
BBLOOGIE.EXE SHA-256: `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.

After a separately reviewed source fix and a new authorized assignment,
build the assigned revision with `bash tools/build.sh` before running:

```sh
timeout 45s node test/run.js --no-build --exe=../intake/game/BBLOOGIE.EXE --exe-guest-path='C:\BBLOOGIE.EXE' --cwd='C:\' --vfs-include='**/*' --quiet-api --max-seconds=30 --png=../startup.png
```

That launch was NOT executed here. Inspect startup before attempting input.
The task branch contains this report and a compact evidence archive; original
binaries and dependencies are retained remotely, not committed to Git.
