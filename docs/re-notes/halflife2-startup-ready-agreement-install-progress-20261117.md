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
3.643 seconds in preflight, with only passive requests before readiness and
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
The added hidden-main variant measured 3.623 seconds and proved the ordinary
main-owner branch separately. Its existing `native-input-return` boundary is
distinct from the DialogBox's `native-button-dispatch-return`; an initially
overly narrow test assertion was corrected without changing runtime behavior.

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

Implementation `63d7b0d0e` was published after the canonical locked build and
focused sealed proofs passed. Two earlier build attempts correctly refused
the active GL worker's callback-census mismatch; that worker repaired its own
provenance. The shared build and the sealed native module are recorded
separately; the original consumes the exact sealed module above.

One freshly authorized original invocation used the unchanged 787,701,212-byte
EXE SHA-256 `24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.
Compilation, complete source/module sealing, inheritance and media validation
preceded the native 600-second clock and independent 620-second watchdog.
Persistent owner `824924` remained tied to actual worker `804457` across tool
returns. No box was created (ID/expiry null; stop receipt not applicable).

Real startup required 108 passive observations and 3.500 seconds to establish
proper USER context and healthy ordinary main owner, guest process 1000/thread
1. Only then was Welcome captured. I personally inspected that complete PNG,
selected Next `0x10011`, and obtained native confirmation, independent physical
UP and aggregate completion. The next complete PNG showed Internet Connection
Required with its real Back/Next/Cancel controls; I personally inspected it.

Before the next DOWN, the native process had already received host SIGTERM
and exited. Its actual wait at Unix time 1794910694.475081 preceded the
permanent UNKNOWN latch at 1794910697.0545516. There was no second intent
record or DOWN request. The exact adapter marks cleanup only on its local
stop-file/UNKNOWN/disk-floor branch or an exception. Neither local stop file
existed before cleanup, UNKNOWN was later, adapter/outer returned 0, and no
outer/owner/watchdog cancellation occurred. Thus the decision tree identifies
the disk-floor branch; it did not record the exact triggering byte count.
The subsequent measured free space was 1,234,616,320 bytes. The run itself
retained about 23 MB and only 260 KB of overlay, so this is shared-host space
pressure rather than a large installer-output allocation in this run.

All 114 HTTP requests are retained: 108 readiness, two captures, one bind,
one DOWN, one independent UP, and one observational snapshot. The later
controller operation found the native PID absent before HTTP and latched
permanent UNKNOWN; zero later requests were sent. No capture was retried or
rebound. Native, adapter, outer, persistent owner and every watchdog have actual
waits and both EOFs, exit 0, with empty remaining owned runtime scopes.
The guest exit recorder explicitly marks cancellation: this is host cleanup,
not native Quit. Original EXE SHA-256 is unchanged after closure.

SubscriberAgreement was not reached; its earlier offending HWND/class/text
reason remains unknown. No installation, authentication or game launch is
claimed. The conditional second invocation requires a demonstrated material
fault faithfully fixed and published after the first. Shared disk-floor
cleanup establishes no such native fault, so no second invocation was used.
Restore host free space above 1.5 GB and obtain a separately authorized fresh
ordinary invocation to continue from the now-proved startup preflight. All
old UNKNOWN endpoints remain closed. Evidence contains Git plus patches,
modules before execution, unique logs and named selected PNGs; no source
archives, frame series, capture bundles or copied original media.
