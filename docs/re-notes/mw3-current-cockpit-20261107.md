# MW3 current cockpit attempt — 2026-11-07

Task: GLD3D-CORPUS-27-20261006. Run:
`scratch/runs/20261107-mw3-current-cockpit/`.

The first prerequisite failed before allocation. At
2026-11-07T13:17:07.727002Z, `os.statvfs('/home')` reported
**1,565,884,416 available bytes**, below the owner's required **2 GB** floor
(and below 2 GiB). The raw observation is `preallocation-disk.json` in the run.
No box was allocated or resumed, and no browser, guest or render runtime was
started. No native inputs were sent. There are no current cockpit captures or
visible movement, turn or fire results from this attempt.

Read `CLAUDE.md`, `ops/README.md`, the sandbox skill,
`docs/re-notes/mechwarrior3-demo.md`, and existing browser control, qualification
and recovery recipes. The existing MW3 route includes direct renderer handler
calls; it cannot be used unchanged under this task's native-input requirement.
The disk prerequisite prevented running the staged production guest/render
observer, deferred closure, exact ACK, owner/module/freshness rejection,
independent release and immutable deadline qualifications. Complete registry
EXE/DLL/assets and manifest HTTP body verification was not performed.

The actual active D3D backend and live module hashes are **unknown** because
there was no runtime. Historical cockpit/performance evidence does not fill
that gap. No renderer failure was demonstrated, no PBO-warning inference was
made, and no emulator, installed asset, app-local MSVCP50/Mech3Msg, configuration
or clock was changed. No FPS, native parity or full-corpus claim is made.

The run records the observed checkout SHA and relevant uncommitted patches;
these identify preparation context, not a loaded runtime. No source/media
archive was created. Existing archives and other agents' files were preserved.
This worker created no disposable runtime data to reclaim. No box shutdown or
handoff is applicable; no owned runtime processes, ports, profiles or held inputs
were created.

Next: restore free space above the owner floor through authorized cleanup of
disposable files, then assign a fresh bounded attempt. Qualify the complete
staged observer and native controls before the one fresh allocation, verify
registered input and HTTP body closure, and review fresh original captures
before any ordinary action. This attempt stops at the recorded disk blocker.

## Fresh assignment recheck at 13:22 UTC

The fresh assignment also stopped before allocation. The initial `df -B1
/home` reported **1,896,611,840 available bytes**. The recorded
`os.statvfs('/home')` check at **2026-11-07T13:22:46.580070Z** reported
**1,033,785,344 available bytes**, below the required 2,000,000,000-byte floor.
These are separate observations during shared disk activity. Evidence for
this assignment is under `scratch/runs/20261107-mw3-current-cockpit/recheck/`;
the earlier terminal artifacts and root `result.json` are preserved.

No production observer/native-control qualification, registry/HTTP body hash
verification, deadline qualification, allocation, guest launch or input was
attempted after this prerequisite failed. The actual D3D backend, runtime
module hash, current cockpit and visible action remain unknown. There is no
demonstrated emulator failure to repair. Installed assets, app-local DLLs,
configuration, memory and clocks were untouched. No box exists for this
assignment, so no shutdown or lifecycle handoff is needed. The source record
contains the preparation Git SHA and relevant working-tree diff, with this
note's change retained as a patch; no source or media archive was made.

Next: the coordinator's authorized disk recovery must restore the floor
before another fresh assignment. This worker retains the first blocker and
stops without a runtime retry.
