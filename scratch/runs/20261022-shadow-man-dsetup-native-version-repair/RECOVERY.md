# Recovery

Base canonical main: `89f1e9d2c67aa94d56d2319115589d07204d42e0`.
Task branch: `task/shadow-man-dsetup-native-version-repair-oct22`.
Final verified SHA is in the ignored post-push `publication.json` and root append-only messageboard. A local commit alone is not a backup.

Recreate only the paths in source-pins.json plus the task commit's changed files using existing verified Git blobs/read-only donors, `GIT_NO_LAZY_FETCH=1`, and a tree-preserving explicit index. This local checkout intentionally omits most tracked files; never `git add -A`, commit sparse absence, mutate donor Git metadata, or use a broad fetch to reproduce it. Dependencies for the small source fixtures are pinned; no package download is necessary.

Replay the command in REPORT.md. It writes checks/resources and mutation diagnostics inside this evidence directory. Those are bounded offline source checks: they compile only small in-memory source fixtures and never run an x86 guest or write a Wasm artifact. Default tests can later be run by the coordinator against a qualified full module.

Native inputs remain read-only at `/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22/{dsetup.dll,dsetup32.dll,dsetup16.dll,d3dconfigutility.exe,receipt.json}`. The receipt lists exact size and SHA256 for all four; 830976 logical and 843776 allocated bytes including receipt/directory. They count within this task's allocation and are not in Git. They were already locally available; this task did not extract/download/recover them. `test/test-dsetup-loading.js --native-dir=...` checks seals before use; do not supply replacements from another release.

Original full installation and registry are preserved in coordinator-owned stopped bx_m4xrrj5a and its existing retained installation/game backups. Earlier recovery recipes remain at the original-install-continue and installed-game-bounded-launch donor paths named in the accepted ordinal-support donor RECOVERY.md. Do not resume/recover a runtime as part of this offline replay. On another host, coordinator must authorize native-input recovery separately. Source pins and test fixtures remain usable without binaries, but authentic-input acceptance must then be marked unavailable, not silently substituted.

No full current Wasm was built. Historical f644bbb2 is not the current canonical build. No registry branch/output or capability version was established from offline inputs. Existing imported registry metadata is preserved; historical seed provenance cannot be inferred from a version string.
