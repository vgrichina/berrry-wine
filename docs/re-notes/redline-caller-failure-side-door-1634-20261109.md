# Redline caller exit verification and offline launch blocker, 1634

The recorded 1617 missing-ACK run used `DRIVER_PREFLIGHT=1`. Its generated owning
caller intentionally exited zero before starting a server or Chrome; the
production controller correctly exited one because readiness never arrived.
That observation is not a falsely successful failed browser program.

A new `--caller-failure` regression runs the actual staged production CLI,
generated controller, publication custodian and generated owning caller with
Git forbidden and the independently prepared manifest digest. An offline
preloader fails the first HTTP validation after real server acquisition and
refuses Chrome spawning. The generated program retains its first browser error;
the kernel records actual root exit one, the custody launcher exits one, and
the controller exits one. All seven owned tasks are actually reaped, and the
ordinary waits retain separate stdout/stderr EOF. The collector's existing
`assert root_status == 0` rejects the failed caller before the publication
launcher's success return. No production exit-propagation repair is warranted
by these results. The regression also retains the existing 16 changed/missing
provider controls and forged-manifest refusal.

The startup suite exposed a separate test defect: its 250 ms deadline expired
during native module compilation, before reaching the parked-owner timeout it
was intended to test. That control now runs the actual admission implementation
and real selected CPU with an isolated clock and timer callback. It verifies
the owner is parked, advances the clock to the original test deadline, fires
the captured callback, and verifies sticky refusal. The complete current
startup/admission suite passes. Production clocks, deadlines and admission
limits are unchanged.

Evidence is in
`scratch/runs/20261109-redline-caller-failure-side-door-1634/`. Git base and
small relevant patches identify the sources; no source-tree or media archive
was made. Fresh preparation authenticates 903 providers. The independent
manifest digest is
`67b26c70d62575ccd353d69fb67731854efce92aaacd538004d06356049af214`.
The exact retained provision routine, byte-checked uploads, generated media
assembler and real startup barrier pass offline. A direct generated-caller
read/import audit finds 905 checkout reads and no dependency outside the
authenticated closure. Primary `3e491c08…` and compatibility `ecb45716…` CPU
bytes, provider pins, physical input and capture custody remain unchanged.

The exact generated remote launch command was also executed offline in a real
Python subprocess with production `DRIVER_PREFLIGHT`. It failed at its original
120-second deadline while the owning caller was in `closure-validation-begin`.
The controller retained `fixture controller deadline`; custody actually reaped
all seven owned tasks and recorded root termination by SIGTERM. The generated
parent actually waited for controller exit one with separate stdout/stderr EOF;
its ordinary outer parent and independent sibling watchdog were also actually
joined. No deadline was extended and this generated launch attempt was not
retried. The successful separate startup-suite custody preflight does not turn
this failed exact-command gate into a pass. The cause of the validation delay
remains **UNKNOWN**.

Both assigned predecessors published final RELEASE STOP. Independent rereads
verify Q3 `bx_t2ubq3yn` / UUID `e6dac148-e633-495b-b3f4-2727b4c80540`, exact
API **ARCHIVED**, completed unforced `stop_eb076fca0d3c6cdf`, 132 kernel reaps,
three distinct parent waits and separate EOF, closed ports, profile/FD/writer/
lock drain, and actual watchdog join. Q2 1626 created no box; its inherited Q2
box `bx_y37jnhc6` / UUID `fd8fb7e6-b84e-4ff0-9ee0-a715bc859c6c` is independently
API **ARCHIVED** with completed unforced `stop_2175d0a06f9c43a9`, six reaps,
two distinct parent waits, physical drain and actual watchdog join. Its missing
historical generated wait and its reported local-browser EOF remain **UNKNOWN**.

Outcome: **offline allocation gate failed; gameplay unverified**. No box,
native fixture, original-game comma input, capture, local Chrome, agent, worker
or public deployment was created by this task. Own box ID/state:
**NOT_CREATED**; expiry and stop receipt: **N/A**. The runtime UUID watchdog was
not armed because allocation prerequisites failed. Empty or invalid artifacts
remain invalid evidence. Completed unique evidence is independently SHA/size
checked, with gzip CRC checked where applicable; free `/home` remains above
1.5 GB.

The focused failure regression, first-error controls, repaired current startup
suite and `flock /tmp/wine-build.lock bash tools/build.sh` pass. The failed
generated launch remains a required failing gate. Next work must diagnose the
closure-validation delay offline before a separately prepared native attempt.
This worker ends with final published RELEASE STOP and no leased box.
