# VB5 CCE reviewed-context integration, 2026-11-16

This run integrates `native-reviewed-context-v1` for the original VB5 CCE
installer and its installed `samples/axlstpik/testgrp.vbg`. Original execution
is conditional on native qualification and publication of the material change.
Evidence is in `scratch/runs/20261116-vb5cce-reviewed-context-install-ide/`.
Current original installation, IDE/sample interaction and ordinary Quit results
will be recorded below after the single authorized pipeline closes.

## Native child-control defect and repair

The first NT4 generated fixture exposed a prerequisite defect in the published
contract. `controlSnapshot.windows` enumerated `renderer.windows`, but native
MessageBox controls share their parent's backing canvas and have no renderer
window. The snapshot listed main `0x10001` and modal `0x10002`, while its actual
live focused BUTTON was `0x10004`. Binding that actual target returned
`reviewed target unavailable`; the controller latched permanent UNKNOWN and
issued zero later requests. A modal-container pointer target could consume an
input but did not qualify the real button's semantics for installation.

The coordinator authorized a narrow repair to released core files in the
same task. `lib/cli-native-user-windows.js` now walks public native USER child
relationships and includes their HWND, generation, process/thread, parent,
owner, style, effective visibility, geometry, control ID, class and caption in
every capture and consume-time snapshot. Pure read-only exports return the
same native BUTTON/EDIT/STATIC text that WM_GETTEXT exposes. They allocate
nothing, send no messages and read no application-private state. Native button
captions are stored in ButtonState, not the ordinary window title table.
EDIT snapshots also include public selection/cursor/flags; password controls
remain unsupported. Other unsupported control classes still refuse capture.
The build's control-variant attribution documents the class-2 EditState branch.

The VB-only controller retains the complete original reviewed image and its
capture times, identifies one exact finite target, and uses the retained-image
contract at binding and consumption. It no longer substitutes a new capture
for the reviewed image or requires identical repaint bytes. Process/socket
identity, public USER context, 5 s game/30 s menu freshness, 500 ms confirmation,
1750 ms independent physical UP and 3000 ms durable completion remain enforced.
Every refusal/UNKNOWN closes subsequent requests permanently. Generated fault
injection is confined to authored fixtures, never original media.

## Qualification and original admission

The repaired `pipeline-qualified` run passed all seven native cases. Every
native log reports NT4 version `0x05650004`. Positive and repaint-positive each
completed both modal generations and ordinary ExitProcess with actual parent
waits and both pipe EOFs. Targets were actual native BUTTONs `0x10004` and
`0x10007`, with public caption `OK`, rather than modal surrogates. Confirmation
was 68.623–75.498 ms, independent physical UP 243.477–317.370 ms, and durable
completion 287.534–420.836 ms. Both complete positive images were personally
viewed after the automated generated-fixture run. This is diagnostic fixture
evidence, not personal review before original input.

The tested immutable module SHA-256 is
`5c9f7126daff2e586685c0dd2ad46b79c5e43e8dbf569aea2919b733b075614a`.
The exact source Git identity, selected file hashes and owned binary patches
are retained with that runtime. Its supervisor remains at the unopened
original gate until publication and the final canonical build succeed.

The NT4 fixture uses two distinct guest-created native MessageBoxes and ordinary
button interaction/ExitProcess. The positive repaint variant changes complete
PNG bytes while keeping the same native target and semantics. Negative cases
change focus, renderer owner, modal caption and actual native BUTTON caption
between preparation and consumption; stale menu evidence uses real elapsed
time. Closure checks attempt local later capture/bind/input and assert no new
endpoint requests. These generated protocol tests use explicit fixture
attestations; they do not claim personal review of original installer frames.

Earlier preparations are preserved honestly: qualification 1 completed positive
and repaint transitions but failed on a duplicate result filename; qualification
2's supervisor returned 143 after compilation with no normal release receipt;
later optional personal fixture gates expired before input or original launch.
The pre-repair `qualification-3` completed its diagnostic suite and recorded
original admission as false. None launched original media or contacted an old
original endpoint.

The immutable runtime is compiled from one recorded Git tree plus explicit
owned patches, then sealed in memory. Other workers' uncommitted source changes
are excluded. No source tree, module, media or screenshot bundle is archived.
The canonical shared build is a separate required check and is not the runtime
module. Shared build failures from the initial missing EditState attribution
and concurrent host/renderer lifetime pins are retained, not counted as passes.

The sole authorized original pipeline verifies installer SHA-256
`022af94b651cd9d31e0676a6819dd5085940893f1ecc4abaa85b48c30de6f318`
and genuine SetupAPI SHA-256
`51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159`.
The retained DirectX 7 package and extraction recipe are documented in
`vb5cce-current-original-20261116.md`. Media/defaults remain genuine. Runtime
and children declare NT4 and use real clocks. Preparation completes before the
fixed 2400 s native deadline, independent 2420 s watchdog and 240 s Quit reserve
begin. Original inputs require personal review of a complete current frame.
No unattended UI action sequence or second original is authorized.

CCE runs its shipped sample inside the IDE; no standalone EXE compiler
capability is claimed. Native guest Quit and host cleanup will be reported
separately. No boxes or additional workers were created.
