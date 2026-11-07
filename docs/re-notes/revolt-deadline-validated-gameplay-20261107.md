# Re-Volt deadline validation and original attempt, 7 November 2026

The predecessor's prelaunch deadline mismatch is resolved in this run's
launcher. The original launched once, then the capture helper stopped at an
initial renderer identity transition, before a screenshot or native input.
There is no new recovery, sustained race progress, checkpoint or lap evidence.
The October 31 reviewed driving/overturned car remains the gameplay baseline.

Evidence: `scratch/runs/20261107-revolt-deadline-validated-gameplay/`.
Candidate `re-volt-demo`; registered app `re_volt_demo`.

## Deadline and complete runtime qualification

`deadline.py` constructs a 25-minute absolute browser deadline once, inside the
2,400-second box TTL. `validate-deadline.py` exercises the selected, unchanged
`browser.cjs` entry point. A preload intercepts its Chrome spawn boundary:
25 minutes passes the real guard and reaches that boundary without execution;
35 minutes, an expired deadline and NaN fail the guard without Chrome or guest
execution. The guard remains strictly less than 30 minutes. No existing
deadline was reset or extended.

All predecessor 1,058 pins matched locally before selection. The ten selected
JavaScript helper files are byte-identical; only their run paths changed.
Hash-identical passing identity, exact-ACK and independent-release controls
were inherited rather than repeated. The complete selected driver received a
fresh local qualification against actual Chromium production guest/render
Workers. A personally inspected generated caption/white-canvas scene preceded
one trusted ArrowUp pulse. Exact ACK, DOWN/UP and independently scheduled release
armed before DOWN passed. Every executed repository import was pinned. This
was generated helper qualification, not game progress.

The UUID-idempotent box **bx_fhx37hqv** was created at **12:13:34.220Z**, initially
expiring **12:53:34.079Z**. Its immutable browser deadline was
**12:38:33.910Z**. Serial staging completed all 1,058 pins. Remote hash checks,
syntax checks and launcher dependency imports passed. The final staged
production guest/render Worker capture qualification also passed under that
same deadline, with zero native input and an exact quit ACK, before the
original launch.

The original 443 installed files and browser manifest remain unchanged. EXE
SHA-256: `58ba4835e6607eae62be4e023ef989172cb519c78f34811acba547e9e0e3581a`.
All 1,058 pins matched again after execution. The published generic backbuffer
attachment repair was reused; no startup diagnosis or emulator edit was made.

The recovered live WASM SHA-256 is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Its inherited compilation provenance is source commit
`1f831717cd0dec63265ff0cde43eec4d81c8da9f` plus the retained
`lib_wininit-boot.js.new.patch`. The checkout SHA in `source-commit.txt` is
separate from that provenance. Relevant uncommitted diffs and owned helper
inputs are retained as patches. No source or media archive was made.
Chrome was 151.0.7922.108; remote Node was v24.22.1. The requested route was
explicit WebGL with default guest Workers and an unemulated 1024×712 viewport.
No reviewed original scene establishes visible rendering or gameplay.

## Exact first blocker

The one original launcher started Node PID **20473**, Chrome PID **20485**.
At **12:16:26.192Z**, before the startup capture, `bound-input.cjs:110` rejected
the page identity recheck inside the first `chain.readLive()` call:

```text
AssertionError [ERR_ASSERTION]: identity changed: renderEndpoint
1 !== 'none'
```

The initial read observed no renderer endpoint and the later read observed
endpoint 1. This occurred inside the driver's startup stability loop, before
that loop could wait for a stable endpoint. The generated fixture had its
renderer already attached and therefore did not expose this transition.
The helper treated it as terminal and closed normally. No input was sent,
no command was replayed and no second original launch occurred. This is a
helper admission blocker, not evidence of an emulator defect or recurrence of
the old backbuffer failure.

Next useful work is to qualify the initial absent-to-attached renderer
transition before capture, while retaining strict identity checks around every
captured/reviewed scene and input. Then a newly authorized original runtime can
pursue native recovery and controlled race progress. Do not relax the deadline
guard or repeat hash-identical passing controls.

## Evidence recovery and delegated shutdown

Eighteen original artifacts, including the live module, were recovered and
SHA-256 verified before the explicitly delegated normal, nonforced stop.
`recovery-verification.json` maps unique local files and hashes. There were
zero native events. Chrome exited zero; both recorded PIDs were absent, both
HTTP/CDP ports closed, and profile, writer and held keys were clear.

The first read-only clearance checker falsely matched its own Python command
text as a browser process. Its retained result already showed the two actual
PIDs absent and both ports closed. The corrected checker excludes itself and
checks executable identity; it passed without repeating game execution.

Box shutdown completed normally with `forced:false`; final state and active
expiry are recorded in `box-state-after-stop.json`. Local qualification PIDs,
ports, profile, writer and input were clear, and the board watcher was stopped.
Sampled free disk remained above 2 GB. No guest code/config/save/memory/clock
edits, replacement DLLs, speculative emulator fixes, FPS/audio/parity claims
or fabricated progress. Publication is documentation only; `result.json` is
written last.
