# Q2/Q3 owning caller orderly completion, 0924

Implemented offline repair of the actual shared Session used by both production
launch clients. Q20900 and Q30912 had normal native browser shutdown, numbered
quit ACKs and remote wait0, followed by an unconditional owning-client EOF
failure. Their runtime facts remain recorded in their respective notes; this
task created no browser, guest or box and makes no new native/gameplay claim.

The production Q2 Caller and Q3 main now admit commands through Session.request.
Only an explicit quit with a safe exact ID can arm orderly shutdown, at the
actual retained quit transport call. Subsequent requests cannot publish another
command. Launch EOF/status0 can then be provisional while that quit's ACK is
in flight. Success requires the exact successful numbered ACK (including the
locally expected sequence), real launch transport wait0, both launch pipe EOFs,
an explicit successful remote result, and, in the PIPE controller, return of the
retained launch branch. This handles EOF before or after quit ACK without
admitting arbitrary EOF as success. Joining uses the remainder of the existing
sender deadline; it introduces no additional runtime or cleanup budget.

Verified completion ends run_input promptly with the same stdin writer still
open, records normal-completion and joined cleanup, and rejects later commands
without publishing cancellation. Unexpected EOF/exit before quit, nonzero exit,
stale/incorrect/refused ACK, malformed/incomplete remote result, missing waits
or pipe drain and input EOF during pending shutdown remain fail closed. The
first failure still owns bounded cancellation and cannot be replaced by later
ACKs or cleanup. Local proof never upgrades remote custody from UNKNOWN.

Evidence is in `scratch/runs/20261109-q2-q3-orderly-caller-repair-0924/`.
`pipe-final-accepted.log.gz` has 26 full PIPE controller scenarios, executing
the actual retained Q2 launch/request and Q3 launch/command branches and actual
Node numbered ACK senders/consumers. Four recorded pre-repair cases fail as
expected; four corrected EOF-before/after-ACK cases pass while stdin remains
open. Eighteen negative cases cover unexpected EOF, nonzero, wrong ID, wrong
number, refused quit, incomplete launch result, missing ACK, incomplete wait
and stdin EOF. Each controller and independent watchdog records actual waits
and distinct stdout/stderr EOF. No process absence is treated as a wait.

The existing Q2 and Q3 focused launch-client suites pass, including SIGPIPE,
SIGTERM, clean early exit, pending real sender cancellation, early EOF and a
separately held pipe with incomplete cleanup at its cap. Production Q2 CLI
lifetime controls pass, including EOF during setup/pending command, explicit
start, retained 0425 branches and sticky pre-parent revocation. Locked build
passes; CPU remains 2185596 bytes. No Q3 composition or run input was edited.

Fourteen unchanged helper/class ASTs match the recorded Git base. Thirty-eight
unchanged custody/close/transport proof references were independently SHA/size
verified, with gzip CRC where applicable, and reused instead of duplicating
their accepted qualification. Changed Session/full caller behavior is tested
freshly. Initial offline harness attempts are retained but excluded: the first
omitted Boat's stdout envelope; a later wrapper could leave a Node descendant.
The final harness wraps the envelope in the directly owned Node process and
records its actual wait. Earlier harness senders were revoked through their
own failure files; their later absence is not promoted to parent-wait proof.

Recovery is Git base plus a small relevant binary diff, including the new test
as a patch, with SHA/size evidence. No source/media/module archive was made.
Box ID, UUID, expiry and stop receipt are null/NOT_CREATED; no allocation or
physical-drain claim applies. No agents, workers, public deployment, local
heavy browser, shared custody, host/WAT, Redline, Heroes II or Claude edits.
PreCPU/preDLLmain identity/flags, freshness/work/ACK/cleanup caps and native
REVOKED remain unchanged. All-writers, edict ABA and actual Boat cancellation
remain UNKNOWN. Next: the waiting Q3 worker consumes this exact committed
release and tests its owned ordinary fixture quit before original gameplay.
Single-task STOP.
