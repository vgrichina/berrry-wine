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

The fresh original used sealed 6308e7a3 source plus the three 5aa5dabd JavaScript
overlays, exact a51912dd module, genuine COMCTL32/COMMCTRL and unchanged
Settings100/media. Main-menu review at batch100157 was authentic. Warning
Enter and UP succeeded; ordinary main focus arrived 17.087 seconds after UP
(17.035 seconds after the completed-input record).
Its immutable lifetime was 900 seconds, independent-watch intention920 and
gameplay cutoff720, retaining180 for Quit. Mouse qualification/build publication
finished at the cutoff; no New Game, level, movement or attack is claimed.

During the reserve, ordinary mouse reference/move returned exact actor-thread1,
generation4/window10004 USER receipts in418ms and1148ms, with independent UP.
The immediate image still showed the old cursor; a later passive whole frame
showed Quit red under the moved software cursor. Ordinary Escape also returned
an exact865ms receipt. A left click returned an exact723ms receipt and UP ACK,
then visibly opened the genuine "Too scared to face the perils of Drakan?"
YES/NO confirmation. These consequences establish this ordinary mouse route
actually reaches the original menu. They do not establish ordinary exit.

The following move toward YES timed out at the fixed2500ms HTTP deadline.
Independent release still returned ACK. This is sticky UNKNOWN; no later
endpoint request, renewed review or replay occurred. The retained trace shows
host preparation approximately88ms after dispatch, handler return138ms later, the actual
WM_MOUSEMOVE queued for10004, and no subsequent observed public USER return
for that ticket. The last observed actor consumer is sequence3219/thread1,
PeekMessage(all,remove), result0. Its actor diagnostic says same memory/window
and not retired, but targetOwnerThread0/generation0/visiblefalse are not a
complete target fence and do not prove the intended window's consumption.
That incomplete bounded trace cannot distinguish later actor work,
missed native return or transport completion. It provides no actual late
consumption latency with which to justify another longer deadline. The normal
browser controls are positives; no authentic browser failure is claimed.

Containment terminated at the actual900-second deadline and reports no leaks.
The reused deadline helper had a separate demonstrated defect: its containment
deadline killed the receipt-writing wrapper and its watcher before it retained
native/watchdog pipe-close receipts. owner-complete therefore explicitly says
retainedActualWaits=false. Those missing original receipts cannot be recovered
or invented. stdout/stderr are streamed prefixes, not proven complete logs.

The targeted drakan-menu-custody helper repairs this ordering. Native termination
remains at the sealed deadline, with finite escalation and actual pipe close;
the independently prearmed920 watcher lives outside that containment group.
The outer wrapper cleanup boundary is935. A real TERM-ignoring child reproduces
the old missing waits with the retired deadline constants; a fresh corrected
control retains both actual waits and both EOFs, with no leaks. This custody
repair does not resolve the original input UNKNOWN, so it does not authorize
another unchanged original input retry. The concrete remaining blocker is an
unresolved original native return/ACK after genuine Quit confirmation, and the
gameplay goal remains unverified.

## Prepared New Game route

Evidence: `scratch/runs/20261118-drakan-prepared-new-game-mouse-route/`.
All preparation and custody qualification finished before the fresh original's
900/920/180 lifetime. Exact retained source/module/media reached the main menu.
The first absolute move established DirectInput's reference; the next ordinary
relative movement visibly placed the software cursor on New Game, then the
jewel turned red. A stationary click opened the genuine difficulty dialog.
Normal was hovered, visibly red, and clicked. Loading advanced through Wartok
Canyons assets and reached a rendered close-up intro cinematic. This proves
New Game and the difficulty consequence, not playable movement or attack.

The subsequent reviewed Escape had only873ms remaining on its original
15-second capture lifetime when DOWN was sent. Its native result was CANCELLED
for immutable deadline expiry, with no native consumption and independent UP
ACK. This is a known cancellation, not a measured late ACK or HTTP UNKNOWN.
The helper nevertheless closed the scope; no later endpoint request followed.
Filesystem cancellation retained both actual native/watch waits and EOFs.

The targeted helper now reserves the unchanged2500ms confirmation budget
before arming and immediately before DOWN. Insufficient remaining image time
returns NOT_SENT without effects. Its regression reproduces the873ms admission
error, tests the strict equality boundary, and a fresh real native control with
a13-second-old capture refuses before DOWN without closing the scope.
For a separately prepared fresh retry, the helper also accepts predeclared
finite review limits up to60 seconds for game/90 for menu. This uses Alice's
already published98e56ec00 cli-native-scene review calibration, pinned before
launch; the original capture clocks, current actor/window/generation/context
checks and immutable in-flight deadlines remain authoritative. A20-second-old
authored native capture succeeds with the declared60-second policy, exact USER
receipt and independent UP. Normal browser USER/DirectInput controls, receipt
negatives and scene identity/staleness negatives pass. No ACK deadline was
increased based on the original cancellation. Locked build passed before
publication and affected original retry.
