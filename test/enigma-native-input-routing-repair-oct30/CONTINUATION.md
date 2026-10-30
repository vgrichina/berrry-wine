# Routing continuation: no production routing defect reproduced

Pinned source: `ff9e0f8845c8e7fdb753a5718437609517009249`.
The renderer/input blobs equal observed main
`eb0485865eb9abce4562f0ca56450138d86b22b1`. No production file changed.
The predecessor README, receipt and resource-denial evidence remain intact.

Run `node test/enigma-native-input-routing-repair-oct30/routing-reproducer.js`.
This loads the actual untransformed production renderer and input mixin. It
does not extract/reimplement their routing methods. The canvas and USER export
boundary are fixtures; no guest CPU, compiled WAT procedure or SDL executes.

The original top-level self-hit trace is reproduced at canvas (343,213), with
HWND 0x10001 and the same `child ... dispatched=1` and `native child` labels.
Both button messages are queued, paired and returned exactly once through
production `checkInput()`/`takeInput()`. The labels describe the generic target,
not its native-control identity or a synchronous callback. Client coordinates
are (320,170) for the down at client origin (23,43); WM_NCHITTEST retains screen
coordinates. Custom children, WAT-marker BUTTON children on an ordinary main
window, and registered guest-proc dialog children preserve target/local signed
coordinates through release. A foreign ownership poll leaves the queue intact.
The CLI's actual hold setting is -1, so a stale release floor does not explain
the missing button dequeues in the recorded run.

A WAT-marker BUTTON in a dialog takes the native dialog routing export on its
owner for both edges even after the drawing instance changes. Its actual
release screen point is preserved and no duplicate message is queued. This
tests the JS/native-export boundary, not the WAT BUTTON procedure itself.

Microsoft's authoritative mouse-input contract posts client button messages to
the appropriate queue and uses client-relative coordinates:
https://learn.microsoft.com/en-us/windows/win32/inputdev/about-mouse-input
https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttondown
The assertions distinguish this externally specified behavior from merely
returning success or emitting a trace. Negative controls
`--mutant=drop-top-button` and `--mutant=false-down-result` must fail: the first
recreates the suspected top-level loss while retaining misleading success;
the second recreates the documented lost release-pair state. Neither is a
claim that the pinned production code contains those defects.

Existing mouse-drag regression passes; button-hold regression passes 35 checks.
The initial missing-helper failure is retained; only exact candidate helper
blobs were recovered. No complete tree enumeration, full build, original
runtime schedule replay, guest-memory edit or Boat operation was performed.

The exact candidate test/run.js is 693262 bytes and was streamed only into a
SHA-256 and selected lines 4510-4600, with no full source capture. Its host
`check_input` calls `renderer.checkInput()` at line 4574 and logs dequeue at
4578 before packing the return. The earlier causal-source runner has a
different Git blob, so it is not substituted as current-runner acceptance.

The earliest unresolved observable is an actual guest `host.check_input` entry
after enqueue, with queue head/depth and which higher-priority pending source
was selected. If that reaches renderer.checkInput, correlate the returned
button tuple with a qualified successful Peek/GetMessage MSG return, then the
actual wndproc invocation and completion, and finally SDL consumption. The
recorded unqualified post-handler snapshots do not prove any of these.
Initializer/scheduler ordering would need to accompany that guest observation;
this bounded source reproducer cannot establish it. No gameplay or guest
callback completion is claimed and no additional task is commissioned here.
