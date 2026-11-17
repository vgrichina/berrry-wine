# VB5 CCE reviewed-context integration, 2026-11-16

The single authorized original run stopped **before the first input**. Its
first `native-reviewed-capture` returned `native capture context unavailable
or unsupported semantic control class` and latched permanent UNKNOWN. Exactly
one endpoint request was made. No original image was written, and no recapture,
rebind or second original occurred. A later local intent refused before any
network request. The precise rejected context/control field is unknown because
the refusal did not include a field-level comparison and the closed endpoint
was never queried again.

This run integrates `native-reviewed-context-v1` for the original VB5 CCE
installer and the intended installed `samples/axlstpik/testgrp.vbg`.
Evidence is in `scratch/runs/20261116-vb5cce-reviewed-context-install-ide/`.
Installation, IDE/sample interaction and ordinary guest Quit remain unproved.
The native log reports the initial install question, but there is no current
original screenshot or claim of personal visual confirmation of it. Host
SIGTERM cleanup returned native exit 0, which is not ordinary guest Quit.

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
are retained with that runtime. Material commit `431276180` was published with
strict pull/push before the sole original gate opened. The plain canonical
`flock /tmp/wine-build.lock bash tools/build.sh` passed with actual tool wait 0,
as did the guard, input-owner and control-variant regressions. A preceding
300 s build wrapper expired while compiling after including the foreign lock
wait; its actual 124 is retained separately and is not counted as a pass.

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
2's supervisor returned 143 after compilation with no normal release receipt.
The optional `qualification-final` personal fixture run completed four reviewed
diagnostic inputs against modal-container targets, then failed an added
assertion that the ordinary window title table contained the actual BUTTON
caption. The repaired `child-census-1` and `pipeline` personal fixture gates
expired before input. The pre-repair `qualification-3` completed its diagnostic
suite and recorded original admission as false. These were generated fixtures;
none launched original media or contacted an old original endpoint.

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
No unattended UI action sequence or second original is authorized. Before
launch, a separate audit reopened the supervisor's source/module descriptors,
verified both seal masks were 15, verified the exact module hash and every
selected source hash, and rechecked the mutable VB controller/test hashes.

The original used the verified media, declared NT4 version `0x05650004` and
real clocks. It launched no setup/IDE stage and received no input. Its native
actual wait was 0 after SIGTERM; regular stdout/stderr files closed, so pipe
EOF is not claimed for that process. Supervisor and independent watchdog actual
waits were 0, the watchdog's two pipes reached EOF, and the supervisor closed
its owned sealed descriptors. Deadline/watchdog signals did not fire. These
process results establish cleanup, not installation success.

CCE runs its shipped sample inside the IDE; no standalone EXE compiler
capability is claimed. No boxes or additional workers were created: box ID and
expiry null, state NOT_CREATED, stop receipt N/A. Telegram progress/final
updates were delivered as messages 2900, 2902 and 2903. Keyed replies to inbox
200/201 already had different saved replies; those guards were respected and
the updates were sent as follow-ups naming both requests.

The next blocker is the original first dialog's rejected native context/control
predicate. Diagnose it using a generated equivalent and field-level refusal
evidence before seeking separately authorized original execution. This task's
original endpoint is permanently closed, and this result authorizes no replay.
