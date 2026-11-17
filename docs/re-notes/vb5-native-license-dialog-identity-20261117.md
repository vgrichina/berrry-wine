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
