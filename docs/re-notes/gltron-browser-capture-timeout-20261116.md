# GLTron host screenshot wait boundary, 2026-11-16

Evidence: `scratch/runs/20261116-gltron-browser-capture-timeout-cause/`.

**No material repair is proved. No original or guest input was launched.**
The new native evidence isolates waits in the browser's old visual-state
snapshot path and, in the final consent-visible case, after CopyFromSurface
entry but before observed Viz copy/result processing. It does not justify changing paint
readiness, forcing a frame, increasing the deadline, switching capture routes,
or attributing this cause to a historical original. Every UNKNOWN connection
remained closed, with zero subsequent CDP requests and no adopted late pixels.

## Actual native boundary

The released, unqualified authored Win32/OpenGL fixture was reviewed before
editing. Its production host, native temporary display mode, 1,000-block slices,
continuous GL calls and message pumping were preserved. Git blobs and the WATX
closure are served/compiled from memory, without shared build output or foreign
source WIP. Each browser owns a fresh profile, native process and OS-assigned
HTTP/CDP ports. No source, media or Wasm bundle was copied into evidence.

Final `native-boundary-v8` used Git
`ed707e861e99c93c1ec6d36358f2a01956932561`, with freshly compiled Wasm
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`
(2,279,037 bytes). Actual recovered Worker hashes, producer/owner/window object
IDs, render endpoint and module inventory remain in its `workers.json`,
`before-owner.json`, `host-state.json` and `actual-gl.json`. HWND 65537 had one
current native GL context, 84 presents/transfers and 168 observed device draws.
That v8 host observation preceded visible fullscreen consent; v6 and the final
consent-specific v9 observation had the button visible/enabled/hit-tested. The touch
cursor still occluded the guest output; it was neither hidden nor exempted.

All captures used the unchanged full-host request:
`Page.captureScreenshot({format:'png',captureBeyondViewport:false})`.
There was no clip, canvas substitution, forced idle/paint, extra native GL work,
renderer warmup, freshness rewrite or timeout increase.

Prearmed Linux uprobes identify actual native function entries. Probe offsets
were corrected for the executable segment's 0x1000 virtual/file-offset delta;
the initial incorrectly positioned probe was removed before recording. The
registered definitions, ELF disassembly, native events, browser binary hashes
and actual probe waits are retained. Recording was limited to sampled owned
browser PIDs; v8 reports ignored opens for six already-exited transient PIDs.
The browser, actual renderer and GPU processes were included. Installed browser
hashes were collected after the runs, not as a claimed before/after immutable
binary attestation. The sealed Git source/module identity is separately known.

`native-boundary-v8/probe-events.txt` records:

| Native event | Monotonic seconds | Since capture entry |
| --- | --- | --- |
| PageHandler::CaptureScreenshot | 2874267.930538 | 0 |
| RenderWidgetHostImpl::GetSnapshotFromBrowser | 2874267.931033 | 0.495 ms |
| Old visual-state call site | 2874267.931070 | 0.532 ms |
| WidgetCompositorProxy::VisualStateRequest | 2874267.931097 | 0.559 ms |
| RenderWidgetHostViewAura::CopyFromSurface | 2874275.614034 | 7,683.496 ms |
| Viz SkiaRenderer::CopyDrawnRenderPass | 2874275.628035 | 7,697.497 ms |
| CopyOutputRequest::SendResult | 2874275.671151 | 7,740.613 ms |
| OnSnapshotFromSurfaceReceived | 2874275.681526 | 7,750.988 ms |

The controller sent the single screenshot at **11:04:07.321 UTC** and recorded
permanent UNKNOWN at **11:04:10.323 UTC**. Wire evidence contains zero later
requests. The late function entries were passive control-flow observations;
no screenshot reply, PNG encoding or pixel adoption followed. Browser closure
and passive diagnostics continued independently, without asking that endpoint
another question. Earlier `uprobes-v6` similarly entered the visual-state path
and saw no copy/readback/encode entries through its probe EOF.

This v8 case establishes an asynchronous browser wait **after issuing the old
visual-state request and before CopyFromSurface**. It does not identify the underlying
renderer/compositor scheduling defect. The internal Blink request/response
symbols did not fire even in the successful calibration; their absence is not
used to claim the renderer never received the message.

The final **consent-visible** `native-consent-v9` separately removes that UI
timing ambiguity. It observes only the ordinary visible/enabled/hit-tested
button prerequisite, without waiting for renderer idle or changing readiness.
Git is `41162662224e1ce1cfe9f3c0d71007dc6630d6b4`; its module hash/size match
v8. The button bounds are `(351.515625,165,131.875,22)` in a 1024×757 viewport.
Its actual browser PID is 3493485. The one screenshot request at
**11:08:13.851 UTC** becomes permanent UNKNOWN at **11:08:16.853 UTC**.
Native events enter capture at monotonic 2874514.461693, snapshot at
2874514.462084, old visual-state call at 2874514.462101 and visual-state proxy
at 2874514.462117. **CopyFromSurface enters at 2874515.763086**, 1,301.393 ms
after capture entry. No observed Viz Skia copy, copy result, surface callback,
ScreenshotCaptured or PNG encode follows through the independent recorder's
actual eight-second completion. Fifteen browser-main samples after copy entry
and before UNKNOWN show ordinary poll. This narrows this final case to an
asynchronous wait after browser-side copy entry and before observed Viz
copy/result processing. The exact surface request/activation/scheduler cause
is unproved; these probes do not distinguish all possible early-return or
pending-surface cases inside CopyFromSurface. No later request or late pixels
were accepted. The two native cases must not be flattened into one fence.

The independently bounded `boundary-v4` syscall probe shows the actual browser
main thread in its ordinary `MessagePumpGlib` / `RunLoop` poll. Passive `/proc`
samples show renderer, native Worker and SwiftShader activity continuing during
capture. A short prearmed trace also shows render-worker/guest-RPC traffic and
raster work. These facts exclude neither scheduling starvation nor an unmet
visual-state fence; they are not a demonstrated generic runtime repair.

## Calibrations and limits

The separate idle production shell `idle-v7` completed the same full-viewport
request in **136 ms**. Its native events positively calibrate capture entry,
old visual-state call, CopyFromSurface, Viz copy, copy result, surface callback,
ScreenshotCaptured and PNG encode. Its complete host image was personally
reviewed. No native producer ran in that calibration, and it did not warm a
later native session.

`uprobes-v5` completed an unchanged native full-host capture in **1,959 ms**.
The complete 1024×757 image was personally reviewed: shell controls, ordinary
fullscreen button, runtime log and native GL triangle are all visible. That
intermittent success is not a causal fix. The initial probe setup was not ACK
synchronized and missed early stages; v6/v8 added an acknowledged independent
recorder before capture. After v5 capture, normal visibility validation refused
the touch-cursor occlusion before consent or input. Its known refusal is not
relabeled UNKNOWN. Only the two named calibration/native images are retained.

Current qualification remains incomplete: no repaired native capture/input
positive, 500 ms confirmation, 1,750 ms independently prearmed physical UP, or
full current busy/stale/owner/occlusion/late-ACK/UNKNOWN fault matrix is claimed.
The old controller's 2,000 ms checks remain explicitly insufficient. Completed
immutable-ticket lifetime, held-paint/input guards, three-second observation and
five-second gameplay/thirty-second menu freshness were not changed. The focused
existing controller suite passed only within its existing policy/loopback/child
scope. Two initial focused invocations refused a missing/relative output path;
the corrected absolute-path invocation passed, with actual child/watchdog waits.

Other diagnostic preparations remain recorded: startup tracing produced no
file; the short CDP trace ended before UNKNOWN but never reported complete;
whole-tree strace made browser startup miss its bound and required explicit
owned-tracer SIGKILL. That preparation never reached a screenshot. None is
silently counted as a native positive or used to extend the observation bound.

## Publication and shutdown

Publication is report-only. Both owned helpers are unchanged. The expanded
`test/test-gltron-browser-live-input.cjs` remains **unqualified, uncommitted WIP**,
recoverable from `final-new-test.patch`. Earlier development revisions without
individual launch pins are diagnostic only; idle-v7/v8 use the retained
idle-v7 patch and final v9 uses its separately retained new-test patch. Git plus relevant binary/new-file patches are the source
archive. No full locked build or code-repair PASS is claimed; the unused shared
build queue was cancelled without reading/writing its outputs.

Nine diagnostic native children, nine prearmed independent watchdogs, nine
browser/tracer children and all recorded passive probes have actual waits and
both pipe EOFs. Recorded native process groups, all sampled exact PIDs/TIDs,
profiles and loopback ports are absent/closed. Detached descendants were not
exhaustively inventoried before detachment; the audit states that limitation
and separately checks surviving task-profile processes. Every task-created
uprobe was removed. Host browser shutdown is not native guest Quit.

All 92 original media hashes were checked without copying or launching media.
The conditional single original remains **NOT_LAUNCHED** because a material
cause fix and current native capture/input/fault qualification were not obtained.
There is no human-cycle identification, two-turn result, natural round or native
Quit claim. Full-27, FPS, audio, parity and physical-GPU claims remain open;
the installed launcher explicitly selects SwiftShader despite the reported
renderer string. No permission override, consent click or private game-state
inspection was used.

Box ID null; state `NOT_CREATED`; expiry null; stop receipt `N/A`. `/home`
remained above 1.5 GB free. The next work must address this measured browser
visual-state-to-copy boundary at the same bounds, then qualify native trusted
input/faults before any original. This task releases its files and stops.
