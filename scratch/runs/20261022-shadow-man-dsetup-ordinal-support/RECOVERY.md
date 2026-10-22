# Recovery and reproduction

Task branch: `task/shadow-man-dsetup-ordinal-support-oct22`, based on canonical main `89f1e9d2c67aa94d56d2319115589d07204d42e0`. Only this report/evidence directory is added. The commit preserves the unrelated source tree; the local focused checkout has intentional missing files and must never be committed with `git add -A`.

Original binaries remain read-only and ignored at:

`/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22`

`native-receipt.json` preserves exact names, sizes, SHA256s and coordinator recovery command ID cmd_m7vjlhyyj5lx on bx_m4xrrj5a. Git does not preserve these original binaries. Their immutable installed-session source and remote snapshot recovery paths are documented by the existing donors:

- `/home/user/wine-assembly-shadow-man-original-install-continue-oct22/scratch/runs/20261022-shadow-man-original-install-continue/RECOVERY.md`
- `/home/user/wine-assembly-shadow-man-installed-game-bounded-launch-oct22/scratch/runs/20261022-shadow-man-installed-game-bounded-launch/RECOVERY.md`

Do not recover, resume or rerun a box as part of reproducing this offline task. The four inputs already exist locally. On a different host, obtain them only through coordinator-owned recovery authorization; the probes deliberately fail if original seals do not match. `native-analysis.json` plus the retained objdump export/import/disassembly text preserve the inspected contract even without local native payloads.

`source-pins.json` names exact canonical Git blobs and SHA256s for inspected files. Reproduce the thin checkout by materializing only those paths from commit 89f1e9d2 using existing verified objects/donors, with GIT_NO_LAZY_FETCH=1. No broad fetch or automatic dependency installation is needed. Read/report files can be inspected directly from the task commit. Run the two offline verifier commands in REPORT.md; neither maps or executes a PE or builds a Wasm module.

Retained disassembly was produced with `/usr/bin/objdump -p INPUT` (headers/imports/exports only, relocation/resource bulk omitted) and `objdump -d -Mintel --start-address=START --stop-address=STOP INPUT`. Filename labels contain original read-only input paths. Native code ranges are 0x10001450..0x100018f7 and 0x10001b30..0x10001c7c; caller ranges 0x402970..0x4029a5 and 0x40309c..0x4030a2. Independent Python parsing checks the actual original bytes, not just disassembler text.

`publication.json` is an ignored post-push receipt naming the actual remote SHA; the append-only root messageboard independently records it. Never interpret a local commit alone as a remote backup. No deployment, main merge, runtime fix or gameplay qualification is included.
