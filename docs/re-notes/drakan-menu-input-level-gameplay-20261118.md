# Drakan menu input and finite acknowledgment — 2026-11-18

Evidence: `scratch/runs/20261118-drakan-menu-input-level-gameplay/`.
All predecessor UNKNOWN scopes remain closed, without endpoint requests.

The ordinary renderer keyboard route updates physical/DirectInput key state
and separately queues USER input. Host dequeue is not native consumption.
The guarded native route acknowledges the exact owner/thread/token only after
a successful public USER return; this does not prove the guest's menu action.
Historical notes also identify relative DirectInput mouse movement/clicks as
the Drakan menu route. A delivered Enter alone does not establish New Game.

An authored ordinary PE creates/shows its own window, calls genuine
DirectInputCreateA/CreateDevice/SetDataFormat/SetCooperativeLevel/Acquire and
GetDeviceState, and polls keyboard/mouse/all USER message ranges. A two-second
guest GetTickCount busy frame reproduces slow consumption without any host
pause, forced poll/wake, focus assignment or clock change. Exact native USER
consumption takes 1.907 seconds in calibration. GetDeviceState succeeds and
returns DIK_RETURN=128 independently; the guest callback updates its caption.
The original 500ms harness confirmation times out on a fresh authored scope.
A predeclared 2500ms confirmation succeeds on another fresh scope with exact
native receipt and independently prearmed physical UP. These controls prove
an inadequate harness deadline is possible; they do not establish the exclusive
cause of the predecessor original's timeout or prove D3D pressure coverage.

The new helper validates finite policy before arming: 2500ms confirmation,
3500ms fallback UP, 6500ms physical-release completion and 10000ms operation.
Consumption must precede the sealed targeting/operation/fallback deadline.
An acknowledged native return can only shorten the already armed release;
late receipts cannot renew a pulse. UNKNOWN closes the scope with no replay.
Process/window/thread/generation/queue/device/retirement predicates remain the
existing native reviewed-context contract. No runtime file is changed.

The full normal production browser shell also runs this authored PE in its real
Chromium Worker. Ordinary DOM key input produces native callback dispatch and
successful DirectInput state, and independent CDP UP is followed by the guest's
own DirectInput zero read. This is a browser positive control, not a guarded
native acknowledgment or authentic game result. The fixture includes busy
guest work and ordinary window painting, not a D3D render workload.

Fresh authentic outcome and publication follow validation below.

Mouse preparation additionally uses an ordinary standard DIMOUSESTATE format.
The first mouse control exposed a fixture error: one message per two-second
frame allowed ordinary hover/hit-test messages to delay button dispatch. The
corrected fixture drains each ordinary message range and reads DirectInput
from its actual input callback as well as its frame loop. A short click could
otherwise end between two slow frame samples. Fresh native and full browser
controls prove button=128 and independent release; browser later reads zero.
The failed control is closed with actual cleanup and is not game failure.
The helper accepts reviewed ordinary absolute move/down coordinates, retaining
the production mapping and exact native message/actor predicates. Three wrong
mouse-message receipts are rejected. Original menu selection still requires
the visible difficulty/level consequence.
