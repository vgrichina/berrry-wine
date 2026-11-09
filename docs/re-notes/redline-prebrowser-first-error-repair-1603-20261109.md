# Redline offline prebrowser and first-error repair, 1603

The production fixture controller caught its first error, then could throw a
watchdog assertion in `finally` before rethrowing that error. The actual generated
controller regression reproduces this: before the repair, a synthetic crossing
of the original deadline reports only the secondary watchdog assertion. After
the repair, deadline, early caller exit, and retrieval-error controls retain the
first caught stack in `fixture-first-error.json` before cancellation. The inert
child's signal handler independently observes that file before exiting. Cleanup
errors are retained separately, retrieval is attempted despite the watchdog
assertion, and every failure still exits unsuccessfully. Actual child/watchdog
waits and separate stdout/stderr EOF remain required and tested.

This repair is confined to the explicit current publication composition. It does
not edit the retained controller, observer, custodian, readiness consumer, or
their independent pins. It preserves the independent prepared manifest digest,
both provider-validation passes, staged Git-free authentication, original
admission ceilings, immutable supplied browser deadline, command and capture
boundaries, single comma600 fixture, and ordinary joined quit. No validation
failure becomes qualification.

Write-once bounded phase files now identify controller validated launch and
custody spawn return; owning caller entry, closure validation, source composition
and program evaluation; browser-program provider validation, server acquisition,
each HTTP pin, and the Chrome launch boundary. Records include PID, wall time,
process-local monotonic elapsed time and the unchanged supplied deadline.
Per-process filenames allow the existing offline direct preflight and subsequent
custody preflight to retain distinct records. Writes finish before advancing to
the next phase; they do not promise power-loss persistence or browser EOF.
Synchronous owning-caller errors also get a write-once first-error file.

The historical 1635 fixture remains a failed native attempt. Its 1114-second
pre-execution-window delay and subsequent prebrowser stall have **UNKNOWN**
causes. The incomplete syscall observations establish no fsync attribution.
New instrumentation supplies future measurements; it does not reconstruct
missing historical phases.

Offline evidence is under
`scratch/runs/20261109-redline-prebrowser-first-error-repair-1603/`.
`before.log` and `before/deadline/observed.json` retain the original masking.
`first-verified/` records the repaired actual-controller failures and real joins.
`prebrowser-verified/` runs the actual generated owning caller and unchanged
provider checks, injects a 60ms pinned-read delay while returning original bytes,
and exercises real server acquisition. One control fails HTTP validation; the
other checks all four HTTP pins with the real server and stops at an explicitly
inert Chrome-spawn boundary. Neither creates Chrome, admits input or captures.
The phase records bracket the injected read and distinguish the HTTP failure
from reaching browser launch. They measure this offline environment only.

The initial offline staged preflight's 40-second deadline also failed and is
retained under `staged/`, including its original deadline error. Its recorded
closure validation took about 11 seconds and browser provider validation about
18 seconds under syscall custody. This does not establish the native stall's
cause. The two existing offline custody preflights now choose an initial
120-second test deadline, with `DRIVER_PREFLIGHT` returning before server/Chrome
creation. No supplied production deadline is extended, renewed or recalculated.
An initial inert-filesystem seam mismatch is retained under `startup/`; the
existing startup test now captures only its phase writer at that service seam.

Final checks pass: all three first-error controls, both actual prebrowser
controls with independently prearmed and joined sibling watchdogs, full staged
production CLI with Git forbidden and 16 missing/changed providers plus forged
repin refusals, current startup/admission controls including actual custody
preflight, existing startup-boundary old/new controls, and
`flock /tmp/wine-build.lock bash tools/build.sh`. The build retains primary
`3e491c08…` and compatibility `ecb45716…` bytes. Evidence recovery uses the
recorded Git base plus a small owned binary diff, never a source-tree archive.
Completed own logs may be losslessly compressed with SHA/size recovery records.
Empty files and empty decompressed logs remain **EMPTY_INVALID**, never proof;
native readiness and browser EOF remain **UNKNOWN**.
The inherited-writer boundary controls deliberately retain two unfinished stderr
gzip streams; the evidence manifest marks these **INVALID_INCOMPLETE**, without
repairing them or treating them as EOF evidence.

No native retry, leased box, local Chrome, worker, agent or public deployment
was created. Box ID/state: **NOT_CREATED**; expiry and stop receipt: **N/A**.
Next gameplay step requires separate authorization: freshly prepare and
authenticate the current production closure, then use the sole admitted runtime
lane for one fixture under the existing original deadlines. Review the new
phase/first-error records on its first failure. Only all existing gates passing
can permit the original game's car-door comma input and capture. This task
authorizes no such runtime attempt. Final published RELEASE STOP.
