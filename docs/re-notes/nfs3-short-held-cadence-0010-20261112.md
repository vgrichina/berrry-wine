# NFS3 short-held full-frame cadence, 2026-11-12

A run-local caller change captured a full frame during a 1.5-second native
Up+Left hold. The exact 200 ms control could not prove a held frame: screenshot
submission to ACK took 275 ms and overlapped independent release. Sustainable
original driving through successive bends, lap and result remain unproved.
No original box was allocated or original input sent.

Evidence: `scratch/runs/20261112-nfs3-short-held-cadence-0010/`, especially
`RESULT.md`, `RECOVERY.md`, `verification.json` and `control/cadence-controls.json`.
This extends the [1815 report](nfs3-full-owner-sustained-driving-20261112.md),
parent publication `05d58d56e`, without repinning its accepted qualification.

The old consumer skipped held screenshots below 3000 ms and did progress/module
reads first. The changed consumer starts full capture on its first sample. It
records physical state before/after screenshot, screenshot submit/ACK, later
validation completion, each key's DOWN ACK, and independently prearmed UP
submission/ACK separately. All 22 nonnull identity fields and the actual owning
CPU/SoftwareD3D Worker instance/module epochs match before and after observation.
Postrelease validation completion never becomes a held screenshot timestamp.

Actual Chrome used current production Boids CPU/SoftwareD3D Workers and normal04
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Both commands used Up+Left with independent per-key UP:

| Hold | Screenshot cost | Full observation | Claim |
| --- | --- | --- | --- |
| 1500 ms | 292 ms | 1025 ms | Both keys held throughout full PNG capture |
| 200 ms | 275 ms | 1060 ms | UNKNOWN; release overlaps observation |

Four complete 1024×712 observation/released PNGs were visually reviewed. Each
command has four trusted DOWN/UP edges, independently acknowledged UP, physical
state zero and a later full frame. These are Boids physical/capture controls;
they do not establish original road steering consequences. The control consumer
closed terminally after the 200 ms UNKNOWN; no action was replayed. This is a
measured blocker for this exact command, not a universal screenshot latency
floor or proof of a game runtime/physics defect. The original browser candidate
has not been qualified for gameplay or continued commands after UNKNOWN.

The full22 binding and native release implementation are byte-identical to 1815.
Thirty-five existing helper/proof files, including the exact1725 timer observer
and accepted25-refusal/controller-loss report, were rehashed. Neither expensive
matrix was rerun. All133 existing media files, original EXE
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`,
and manifest were rehashed without copying media. Current `lib/renderer-input.js`
differs from 1815 and was exercised by these local controls; no original runtime
qualification is inferred. Caesar's provider/custody changes were left untouched;
its published `5c2c410a5` bytes were finally hashed but never invoked to provision.

Earlier local attempts are retained: a missing manifest before effects, then two
preinput disk refusals. One records1470238720B with Chrome live, versus roughly
1.50GB after closure. An owned `/dev/shm` temporary directory allowed the final
local control without changing system/browser flags, existing caches or guest
time. Actual free space before its two inputs was above1500000000B; the later
verification measured1498558464B. There is no continuous-capacity claim, waiting
loop, RAM gate or original-allocation authorization.

No production code changed; focused evidence verification and JS syntax checks
passed. No locked build was required for this run-local/documentation change.
Git SHA, relevant binary diff, owned new helper patches and media references
provide recovery; no source/media archive was created. Local Chrome/controller
and release children have actual code0 parent waits and both EOFs, PIDs absent,
profile/temp removed. Box ID NONE, state NOT_CREATED, expiry null, stop N/A;
no box watchdog/manager was launched. Parent boxes and historical timer-abort and
lifecycle UNKNOWNs are unchanged.

Next work must demonstrate short held full-frame feasibility at an ordinary
physical cadence, or establish a demonstrated native Pause review workflow,
before another watched original attempt. Reviewed successive bends remain the
gameplay done condition; the parent's82MPH alone is not completion.
