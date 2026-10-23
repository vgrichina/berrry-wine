# Assigned task and recovery boundaries

This task owns only `bx_fn7pn7yg`, fresh no-env allocation expiring
2026-10-23T03:46:00.580Z. Coordinator owns lifecycle and the 02:50UTC shutdown;
worker handback is due by 02:45UTC. Leave the box RUNNING; never resume the old
stopped box or create/fork/delete another box. No follow-up task is authorized.

Runtime source is 58e90870a40a541a4083cae5e987ca8de31889e6; authoritative main
bb9c496ed13095cc832fdf607f0937fb9c14b7de is its documentation-only successor.
The isolated index preserves every base path without materializing missing blobs.
`GIT_NO_LAZY_FETCH=1` is mandatory. The bootstrap admission measured all selected
donor files, donor Git, and root inputs before checkout; the 64MiB budget includes
own checkout/evidence, used donors/tools, and an 8MiB reserve. Admission is
remeasured throughout streaming; host-free floor is 2,982,150,144 bytes.

`recover.py` is single-use and refuses its own prior start marker. It uses the
accepted 2,083-file, 186,399,681-byte manifest and original snapshot
3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f, prefix
`shadow-man-install-continue-oct22/retained-session`. Every source is HTTP206
with exact Content-Range, file entry-kind and bounded 64KiB reads; each raw PUT
has known Content-Length and SHA256 equality. Secrets and signed URLs stay in
memory. There is no layer/archive staging, installer, extraction or source build.
It stages precisely the accepted plan: 216 immutable entries and eight fixed
helpers, then the separate ctl-pin receipt (217 accepted immutable entries), checking
materialized donor bytes and main Git identities. Recovery failure is final for
this task; do not rerun or silently retry any transfer.

Root is `/home/user/shadow-man-launcher-configuration-capture-oct23`.
`immutable/restored` contains pristine original files; `immutable/runtime` holds
the canonical 1,879,387-byte Wasm (ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553),
158 main JS/input entries, 23 PNG package entries, 27 data files (692,498 bytes)
and ctl. Original registry remains separately sealed at 17,088 bytes,
d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3.

After complete original and staged-file hash verification, `prepare_runtime.py`
uses the accepted single clone recipe: hard 896MiB tmpfs, uid/gid1000 mode0755,
ordinary write/delete probe before the one 2,045-file VFS/registry clone.
Immutable cap is 2GiB; fixed cap 96MiB plus tmpfs896MiB plus reserve32MiB is 1GiB;
remote free must remain at least 2GiB. Original identities and complete command,
conditional dependencies, explicit Worker roots, PNG fixture, forwarding,
compile guard/canonical consumption, settings observation and an out-of-process
blocking-Node watchdog fixture precede all guest execution.

At most three unique <=90-second sessions share only genuine saved state.
`operate.py` uses the accepted top-level launcher readiness helper. Ordinary
1024 opens Configuration; genuine PNG and actual control geometry/ID establish
OK before ordinary IDOK. `settings-observer.cjs` observes the original in-memory
VFS and exports the real registry into evidence, recording all file identities
and only actual changed bytes. It cannot set registry/VFS/capabilities or enable
Play. Separate pre/post copies are observations, not proof of acceptance or
persistence. A subsequent original launch is permitted only after genuine
enabled Play and a successful ordinary save; no direct game EXE workaround.

The external Python watchdog supervises only its fresh process group, records
inventory, sends TERM/KILL and reaps descendants even if Node cannot service an
internal timer. Parent OS termination is distinct from guest ExitProcess.
`ABANDONED wndproc` remains an explicit synchronous callback limitation; warnings
alone are not guest failures. First exercised failure or disabled Play ends the
task. Read final REPORT and receipts before interpreting any outcome.

Git preserves recipes and evidence, not original game/media/Wasm binaries.
Publication uses the root's existing exact trusted SSH command per invocation,
then independently verifies the remote task ref. No main merge is authorized.
