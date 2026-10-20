# Screen Savers renderer input delivery

Candidate `4c98907328917f5917a59445bb4d5ce3e2caca09` left ordinary
renderer list/button events queued indefinitely. Review
`1e9e553a32e4f2e2df3d21025caf60ed9ac5d987` independently reproduced this:
the earlier direct WM_COMMAND tests bypassed the missing input boundary.
This task reconciles that candidate with main
`4d57bb66dae7da0a488b9546ccb0b4f4f7ba2434` (the intervening COM test/note
addition has no production overlap).

`scrsave_pump` now polls the existing process-owned host input imports before
draining posts and painting. It retains the original target and full wParam
and lParam, uses current focus for keyboard routing, initializes the MSG tail,
and runs the shared USER mouse-activation transaction. It sends accepted
events through `wnd_send_message`; the native controls still own selection,
press tracking, cancellation, release, and parent notification. No renderer
special case or synthetic command dispatch was added.

At most 64 input events are consumed per tick. The renderer can defer release
until a later poll, and the existing 50 ms applet schedule polls again.
Foreign process events remain queued. A synchronous Close notification exits
the pump immediately, before another dequeue or access to freed MSG storage.
Existing post-drain, Preview selection and ShellExecute behavior are retained.

## Executable regression

Run `node test/test-screensaver-input.js`. The test uses actual
`handleMouseDown`, `handleMouseUp`, `_dispatchMouseEvent`, `takeInput`,
the browser host's owned-input import block, and `inputEventHwnd`.
Its small compiled production closure includes the applet, control creation,
message/native dispatch, BUTTON/LISTBOX/STATIC procedures and state accessors,
parent notification, USER focus/activation and capture helpers. Source forms
are extracted unchanged; dependencies outside the selected closure throw
unless explicitly supplied as fixture adapters.

The test observes native listbox row 2 selection, native notification updating
STATIC text to `ARCHITEC.SCR`, Preview only on release, release-outside and
WM_CANCELMODE cancellation, foreign input retention, the 64-event bound,
and native Close notification with one MSG free and no subsequent dequeue.
The unchanged candidate fails at the real listbox selection assertion.
Four mutations must fail at named behavioral assertions: no input poll,
wrong event target, omitted mouse activation, and lost native button
notification. Compile errors or arbitrary exceptions do not satisfy these
negative-control oracles.

The original twelve checks also pass, including the earlier applet fixture
and its three mutations, host wiring/cancellation checks, manifest, regions,
logical operands, source syntax and diff checks. The original fixture gained
only declarations for the new imports and a no-input poll; its assertions
remain intact. Existing region map, manifest and native dispatch source are
byte-identical to the candidate. No host-import signature was added.

## Qualification boundary

This is a renderer-to-native-control regression with a small production
closure, not full-VM acceptance. Geometry/device plumbing, heap allocation,
window-record storage, default-button border bookkeeping, GDI/paint services,
and recursive window removal remain adapters. Actual native control state,
selection, activation/focus, capture cancellation and notifications run;
the complete production allocator, destruction tree and renderer teardown do
not. Preview reaches an observing ShellExecute import, not a launched saver.
The fixture hides painting to avoid pulling the GDI/interpreter build into
this bounded task. Guest-procedure/subclass paths trap if unexpectedly reached.

Full build/browser qualification remains queued behind MIDI. Actual async
startup cancellation cleanup, native recursive teardown, shell resolution,
saver rendering and saver-survives-Close remain unqualified. No remote
runtime, heavy local build, main merge or deployment occurred.

Evidence and replay recipe:
`scratch/runs/20261020-screensaver-input-boundary-fix/`.
Original candidate and source-review evidence were preserved; the review
SHA-256 manifest was verified before work. The new evidence records the
exact-path sparse preflight, original twelve plus new regression results,
source identities, final diff and remote branch receipt.
