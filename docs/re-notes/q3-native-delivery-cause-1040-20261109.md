# Q3 native delivery boundary, 1040

Offline diagnosis cannot justify a causal delivery correction from the retained
1025 evidence. Delivery code and older sealed inputs remain unchanged; the
unchanged native retry is parked. No box, Chrome, guest, worker or agent was
started. The 100ms hold and every existing cap remain unchanged.

The original receipt and hash/size/gzip-verified recovered logs establish:

- Admission's last page-owner evaluation, request205, completed at
  10:29:01.419Z. No CDP request remained outstanding at hold entry (.420Z).
- DOWN request206 entered the actual composed controller's CDP send path at
  .421Z. The source invokes `ws.send` directly inside the Promise executor;
  there is no awaited controller queue before it. The retained trace records
  entry, not socket flush or browser receipt.
- The timer independently submitted UP request207 at .520Z, 99.843ms from
  the hold origin. It did not await DOWN. First failure was recorded at
  .521Z, 100.576ms. The terminal observer rejected both pending sends at
  .522Z and sent Browser.close request208; its reply arrived at .523Z.
- Sampling waits for the DOWN send promise. Its rejection therefore explains
  the empty samples without establishing whether the guest received DOWN.
  Neither input rejection is a matching protocol error reply. ACK0 and the
  positive capture are absent; no later input/capture appears in the trace.

The near-deadline UP timer does not support broad Node event-loop starvation.
The completed admission evaluations do not support an outstanding evaluation
blocking DOWN. Neither fact excludes browser input service delay, socket
delivery delay, or receive scheduling. The execution-marker preload observes
owner Runtime.evaluate calls only; screenshot diagnostics observe screenshots
and owner probes. Neither records the missing input boundary. Required missing
evidence is an Input socket send-return/failure and raw matching response,
browser input service timestamps, and trusted DOM/production physical-reader
observations within the hold. No retained datum selects among these causes.
Moving the origin to DOWN's reply, relaxing the bound, or retrying would conceal
this boundary rather than explain it.

The existing actual composed controller/numbered transport regression passed:
four historical guarantee-FAIL controls and seven current PASS cases, including
delayed reply, delayed application, unresolved DOWN, concurrent independent
combo UP, sticky first failure, pending-map rejection on close, no subsequent
input/capture/ACK, and ordinary success/quit. These are inert Node seams with
actual child waits and separate EOF. They verify the already-present safety
correction against its older implementation; they are **not** a new causal
oldFAIL/newPASS repair of the native failure or evidence of physical application.
The locked build passed. Relevant production source diff is empty.

Evidence: `scratch/runs/20261109-q3-native-delivery-cause-1040/`. Run
`python3 -B scratch/runs/20261109-q3-native-delivery-cause-1040/diagnose.py` to
recheck the retained content hashes, exact ordering and missing boundary.
`source-recovery.json.gz` records the Git base and relevant paths/hashes;
`relevant-source.patch.gz` is empty. `owned-run-inputs.patch.gz` preserves only
this run's small diagnostic input. Logs are gzip; no archives, media or modules
were copied. Free home remained above 1.5GB. Shared clients, custody, Q2,
Redline, host/WAT, Heroes II and Claude were untouched.

No new box: ID/state/expiry/stop NOT_CREATED. Prior box `bx_64q745zr`, UUID
`33932372-6496-45fe-8480-50016f1cfc5d`, remains recorded ARCHIVED /
PHYSICAL_DRAINED, unforced `stop_10dc8ae163c31b7d` completed
2026-11-09T10:30:10.611Z; initial expiry 10:53:06.334Z, final expiresAt not
returned. No lifecycle action was taken on it.

Next requires separately authorized observation of the missing boundary before
another native attempt; whole actual fixture and actual owning-caller Boat
cancellation proof still precede gameplay. Native REVOKED; allwriters/edictABA
UNKNOWN; actual Boat cancellation NOT_PROVEN. SingleTaskSTOP.
