# Recovery and replay

The complete raw run is retained remotely at
`bx_5mu9dnhg:/home/user/aoe3-original-oct22/diagnostics-localization-boundary-20261022T0950Z/`.
`evidence.tar.gz` SHA256 `196b66bc2310b265c41f569d95a2838fc4699ff4477edabcbbcf1eed0daa76ed`
is1147692 bytes; the local copy preserves exactly this run, not old packages.
`raw/output.log.gz` is the complete unmodified raw log compressed losslessly.
`raw/focused-trace.log` indexes original log line numbers and byte offsets.
Screenshots and control receipts are separate local artifacts.

Run `python3 scratch/runs/20261022-aoe3-localization-runtime-boundary/verify.py`
for offline archive/hash/offset/buffer/state/control checks. It does not use the
box or start any guest. `node control-test.js` beside it exercises read-only
observer logic against mock memory; `harness.patch` is against the exact
historical-run.js preserved here. Do not use this observer for another runtime
without fixing and testing quota starvation under a new assignment.

Original media, MSI/CAB,174 installed files, historical engine/native support,
initial registry and existing game-run logs remain in the original root. The
input recovery procedure is in commit e8c6728be1de7763b01e6661011e43b2f1df4b26,
`scratch/runs/20261022-aoe3-original-recover-launch/RECOVERY.md`.
This task required no new media acquisition or engine build. Git contains
metadata/diagnostic evidence, not the ignored installed originals/module.

The retained exact command is raw/launch.json. `prepare.py` creates/validates
a diagnostic-only relocated harness copy; `driver.py` guards the one guest
run with max-seconds240, process-group TERM255/KILL260. Output export paths
were changed, save-vfs duplication omitted, and original XP/VFS/registry/native
arguments otherwise preserved. `raw/preguest-failure` preserves the one Node
relocation error before engine loading. Do not rerun these launch scripts as
part of offline verification. Any further runtime needs a coordinator task.

The runtime is exited, process group absent, control ports closed. The box is
left RUNNING; expiry2026-10-22T10:48:47.315UTC and coordinator shutdown
checkpoint10:38. Do not stop, delete, resume, fork or touch the other task tree.
Coordinator owns lifecycle and all next assignments.
