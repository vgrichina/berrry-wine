# Native DialogBox invocation identity for the VB5 CCE license

Run: `scratch/runs/20261117-vb5-native-license-dialog-identity/`.

The retained original installer imports `DialogBoxIndirectParamA`; its license
window is HWND 0x10005, owner zero, native control class zero. Those properties
alone do not establish dialog provenance. The indirect handler delegates to the
real `DialogBoxParamA` handler, which already owns the executing actor’s modal
pump, callback and return continuation.

The repair records the actual creation tuple before callbacks: HWND, generation,
process, thread, owner, initial DLGPROC and return site. The read-only export
requires that tuple to match the live window, actual actor-local and shared modal
pumps, callback table and continuation, with neither pump ended. A suspended
outer invocation cannot qualify while its nested invocation is active. Ordinary
CreateWindow and modeless CreateDialog windows cannot acquire this identity.

Reviewed context accepts this exact identity for a real DialogBox, including
ownerless pre-main dialogs. The existing strict native MessageBox identity path
remains intact. Public captions and child control state remain in the context;
password text and private application state are excluded.

Real native BUTTON controls dispatch synchronously in WAT. A new actor-local
sequence advances only after that exact native WM_LBUTTONDOWN dispatch returns.
The host requires one new sequence with the reviewed HWND, generation, process,
thread, parent and message. Generic handler return is insufficient. Queued input
still requires its existing actual check_input return; independent UP and all
UNKNOWN/deadline fences remain mandatory.

`qualification-final/` passed the sealed Git-plus-owned-source native suite:
direct and indirect pre-main DialogBox creation, nested invocation and restored
outer lifetime, real main creation, main-owned and ownerless dialogs, five real
BUTTON transitions in each positive mode, and focus/caption/child-caption,
disabled, foreign process/thread, retired HWND, changed generation/callback,
real stale wait, ordinary class-zero impersonation and modeless refusal. Faults
close permanently with no later requests. Existing native13 context tests and
unit/transport guards passed. `build-final.log` records the passing canonical
flock build; `guarded-current.log` records the current guarded-input regression.

The original installer pipeline is separately authorized once this repair is
published. Its outcome and exact immutable Git/module/source/media identities,
actual process waits and selected personally reviewed frames are recorded in
`result.json`. No source archive or copied original media is needed for recovery.

## One published original attempt

Repair `66e2124e3` passed strict pull/push. Its runtime used 5,067 exact published
source bodies (no foreign WIP), sealed module
`bc9ce60ee3c95a396f3d60f849b267d6fde84a890454afc6d4956cc5338f33e2`,
and actual sealed Worker/process inheritance. All native qualification and three
MessageBox question shapes passed again before the original deadline began.

The genuine original question and ownerless license dialog both completed via
personally reviewed real Yes buttons. The license identity was HWND `0x10005`,
generation 5, PID 1000, TID 1, owner zero, DLGPROC `0x1002e5b`, return site
`0x1005e78`. Confirmation/UP/completion were 55.2/210.9/255.5 ms for license
acceptance (106.8/266.8/461.6 ms for the initial install question).

A new ownerless initialization/extraction dialog then had a valid independent
DialogBox identity: HWND `0x1000b`, generation 11, DLGPROC `0x1003241` and the
same native return site. The retained post-acceptance public snapshot includes
visible progress control `0x10010`, generation 16, class 17, ID 2106, title
`Generic1`, plus the `Initializing... Please wait...` static. The next capture
was refused with empty context failures and `control.unsupportedClass`.
Class 17 is the native ProgressBar (`msctls_progress32`); the reviewed context
currently admits only classes 0, 1, 2, 3 and 16 and does not yet export/qualify
progress range, position, step and state. The custom class-zero child `User1`
is not evidence of a second trusted dialog.

Permanent UNKNOWN closed this endpoint after ten HTTP requests, one binding,
and two finite inputs. There were zero later requests, rebinds, replays or
second originals. The worker requested orderly host SIGTERM after the latch;
actual native wait was 0, the independent watchdog was joined with actual wait
0 and both EOFs, sealed descriptors closed, PID disappeared and port closed.
This is host shutdown, not native UI Quit. Partial temporary extraction is not
installation. Installed IDE, shipped AXListPicker project and native Quit remain
unproved. No box was created.

Next work requires native progress semantic state and lifetime qualification,
not a wider class whitelist. The consumed original authorization does not permit
another attempt in this task. `result.json` and `terminal-audit.json` retain the
exact blocker and process evidence.
