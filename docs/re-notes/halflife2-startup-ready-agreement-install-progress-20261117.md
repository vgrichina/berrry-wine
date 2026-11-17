# Half-Life 2 passive startup readiness and installation boundary

Evidence: `scratch/runs/20261117-halflife2-startup-ready-agreement-install-progress/`.

`native-startup-readiness` is a separate passive command. It observes the
existing native USER main/modal/focus context and the ordinary input-owner
snapshot, including the executing guest process/thread. A genuine pre-main
DialogBox uses the existing reviewed process-owner resolver. It neither binds
input nor captures, presents, pumps, calls guest UI APIs, or changes clocks.
It deliberately does not test control capabilities: readiness ends at proper
context, and the subsequent capture must diagnose an unsupported control.

The HL2 controller exposes a single-use `startup` preflight before its first
`capture`. Its separate finite deadline is capped by the existing run cutoff.
Every observation retains context failures and ordinary-owner identity; the
ready result retains the full public snapshot. The original capture routine,
3000ms deadline, timestamps, retained-image registry and consumption guards
are unchanged. Failure latches permanent UNKNOWN before later requests.

The authored ordinary DialogBox delays its native ShowWindow by running a
real GetTickCount loop in WM_INITDIALOG. The sealed-module proof measured
3.486 seconds in preflight, with only passive requests before readiness and
zero capture/bind/DOWN. The actual wrapper then captured with original native
timestamps, reviewed the complete authored image, bound its real BUTTON,
changed title and body through native WM_COMMAND, and confirmed independent
physical UP. Reusing the capture refused input and latched UNKNOWN; every
later command made zero HTTP requests. Full original source metadata,
including the opaque `source` field and arbitrary intent name, survived.

Focused negatives cover a never-shown dialog, source identity mismatch,
wrong target/geometry/actor/generation/disabled controls, invalid focus/modal
context, and an unhealthy or foreign ordinary owner. An actual password Edit
reached readiness promptly and then capture refused exact HWND `0x10002`,
class 2, reason `passwordEdit`, with no replacement image or later request.
An initial fixture attempt using uncapped Sleep did not establish a wall-time
delay and is retained as a failed proof; it was corrected with ordinary
GetTickCount without changing the guest clock or runner pacing.

The source graph composes published HL2 components over sealed base
`70e85792e`. Only the isolated two-line passive command is added to that
runner; all remaining runner bytes must match the completed core proof.
Capture/verification bodies match `762ce2c29` byte for byte. Unchanged native
core, wrapper and lifecycle proofs are reused by exact component, including
`9945c2998` and `e71caed16`; a fresh own outer/native run and main/CPU-Worker/
OS-child source inheritance checks passed with module
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`.
Actual native, outer, persistent owner and watchdog waits reached both EOFs
with exit 0 and no remaining owned process scope.

Normal installation and authenticated game startup are still to be measured
after this startup fix is published. Old UNKNOWN endpoints remain closed.
