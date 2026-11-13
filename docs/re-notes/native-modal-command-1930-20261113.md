# Native modal command routing: bounded no-defect result

On 2026-11-13, the current native UI routes passed 17 focused groups in
`test/test-native-modal-command-pump.js`. No production change was justified.
Evidence: `scratch/runs/20261113-native-modal-1930/`.

The original inspected main revision was
`c3335ce9b3a91913e876e8e090dcffabbaa38313`; the final checks also include the
concurrent keyboard repair at `99e55c57c97252bc41d12548b5896b0408bc2413`.
Relevant WAT remained unchanged. Exact route hashes, Git revisions, binary
patches, compilation provenance and the tested diagnostic module are retained
in the run directory. Git remains the source archive.

## What ran

The new test compiles the full canonical WAT closure and uses actual native
EDIT/BUTTON controls, hit testing, capture, keyboard handling and interpreter
modal continuations. Its visible document frame contains `document text` with
a collapsed selection at offset 3 and actual EDIT focus before each modal.
An inspected canvas capture shows that EDIT behind native YESNOCANCEL.
The calc PE loader initializes interpreter thunks; only isolated allocated
test code executes. No game program is launched or patched.

The 17 groups cover:

- MessageBox mouse down/up for No 7, Yes 6 and Cancel 2.
- Native BUTTON Space key down/up for each of those three buttons.
- Dialog Space on No, Enter on default Yes, Escape, and WM_CLOSE.
- A held No press retired by Escape, followed by a replacement MessageBox:
  delayed mouse/key releases and an old-HWND Space cannot complete it.
- Real DialogBoxIndirectParamA with a guest DLGPROC: native BUTTON command 7,
  Space/Enter command 7, and Escape command 2 enter its queued modal pump.
- A native DialogBox button opening a nested MessageBox from its guest
  callback: inner No returns 7, the callback resumes, and EndDialog closes
  the outer modal with its stack/result preserved.
- A guest frame's command 7 still selects all document text.

All dialog cases preserve the document selection. Actual API EAX and ESP,
window destruction, native pressed state, and modal lifetime are asserted.
The last run consumes a provenance-checked prebuilt diagnostic module and
passes the same assertions; preparation alone is not counted as execution.

## Why the suspected collision did not reproduce

`$wnd_send_message_inner` already limits the edit-command bridge to
`ctrl_class=0`, protecting MessageBox (currently class 16). Standard dialogs
also have class 0, but their BUTTON notifications enter the post queue when
a DLGPROC is retained. Dialog keys likewise post to their active dialog pump.
That pump invokes the retained guest procedure directly, preserving command
7. The new tests exercise these actual paths rather than synthesizing a
parent WM_COMMAND and treating it as a mouse click.

An early test assertion ran before the native DialogBox queue drained and
reported command 0. The selection was still `[3,3]`; after pumping, the real
DLGPROC received 7. This was a test timing error, not a routing defect. The
initial logs are retained with this explanation.

The existing uncommitted `test/test-messagebox-idno-command.js` cannot compile
against the current register layout (`Unknown global '$esp'`). It was read
and attempted unchanged, preserved as a patch/hash in evidence, and excluded
from this commit.

## Validation and limits

`flock /tmp/wine-build.lock bash tools/build.sh` passed. The new 17-group test,
test-tier membership check, and existing dialog-key-posts-to-modal-pump,
modal-common-dialog-worker, end-dialog-lifecycle and dialog-timer-pump tests
passed. The timer-pump test initially expected a 20-byte live callback frame;
current USER deliberately pushes 24 bytes including its cleanup sentinel.
The corrected test checks that sentinel as well as the existing callback
arguments, deferred execution, and final caller-stack restoration. This
changes the stale test expectation, not the interpreter ABI. The initial
failure and corrected execution are both retained.
Each CPU invocation had an independent `timeout` deadline; diagnostic
module/capture staging used `/dev/shm`.

This establishes the tested single-instance native USER routes and the
existing focused shared-memory lifecycle checks. It does not establish DOM
event delivery, real concurrent Worker input, arbitrary nested common-dialog
combinations, or game compatibility. The next frontier is guarded browser or
original-application input after sufficient disk capacity is authorized.
Free disk was about 924 MB at admission, below the 1.5 GB native/browser floor;
no heavy run, capacity-setting change, cleanup, denied-operation retry, worker
or box was attempted. Box ID/state: none / NOT_CREATED; expiry and stop
receipt: not applicable.
