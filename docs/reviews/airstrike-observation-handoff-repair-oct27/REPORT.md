# Airstrike serial observation handoff repair

Source-only candidate: `tools/airstrike-observation-bridge.py` provides a reusable
`Bridge(argv, controller_path, evidence_dir).run()` transport adapter around the
actual, unchanged accepted `Controller`. Twelve lightweight fake-runner integration
cases pass. No game, Node, guest, build, browser, Boat operation, main publication,
or public deployment occurred. Fake menus and fake image bytes are fixtures only.

## Problem and resulting behavior

Evidence commit `25a3bb3feaa63c5ed0869cdcbcecd9a36b456707` reached focused HWND
`0x10001` and an inspected full seven-row menu selected at row 0. The historical
parent waited only eight seconds for external menu review. That deadline expired;
SIGTERM cleanup produced runner exit 0, which the accepted controller correctly
refused. No Down/Enter occurred and ordinary Quit remains unproven. Original
bridge/result/checkpoint and the published report remain unchanged at
`/tmp/airstrike-accepted-focus-menu-quit-api-oct27/ops/recovery-0335/` and its repo.

The new serial adapter publishes a capture-bound review request. It monitors runner
stdout, stderr, terminal state and the original overall deadline while factual
review is pending. It starts a ten-second response/dispatch window only after the
review arrives. The accepted controller validates the observation; immediately
before its first keydown, the adapter captures again and requires exact image hash,
Airstrike main-window focus and window/screen identity to match. Each key release
also requires current focus. A changed state, expired lease, rejected/missing ACK,
unexpected ACK or terminal state stops input. There is no uncertain replay.

The accepted file remains SHA256
`e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb`
from candidate `565ceadbe8e63c88754bda4590df156cbba6bf85`, independently accepted
in `2a4b5de2e135c567d1f0f854ad4ff2982982bcf4`. Its `Controller` class executes
unchanged in process with the adapter's receive/send callbacks. The standalone
CLI, including its ten-second `main.receive` implementation, is unchanged; this
new transport does not run that CLI wrapper. Observation preparation happens
outside the adapter's ten-second response phase. Neither that phase nor the
accepted controller's observation, ACK or ordinary-Quit predicates are relaxed.

## Integration contract and bounds

The admitted caller supplies the exact runner argv/CWD/environment after successful
exact-configuration startup, source/mount validation and resource admission. This
is a Python API, with no automatic launcher or guest startup actions. The caller
must retain sole control-channel ownership; concurrent external input invalidates
the observation/dispatch safety contract. A trusted factual reviewer atomically
writes `review-<token>.json` using the session, capture token, SHA256 and `after`
from `review-request.json`, plus the accepted-controller observation object.
This is not OCR or hostile-observer authentication.

Review time counts against the same original guest allowance, at most 120 seconds
from process creation, with no reset after inspection. The ten-second response
budget also consumes that allowance. Arbitrarily long review is therefore still
infeasible; overall expiry performs cleanup and refuses input. No frame is assumed
unchanged merely because a menu was previously observed. There is no frozen-state
edit, automated focus inference, memory patch, control Quit or WM_CLOSE.

Production admission must retain aggregate CPU140/wall150 and the existing physical
RSS supervisor; the adapter never authorizes a larger runtime. Its child CPU limit
is at most 140 and respects lower inherited limits. The offline task used the
pinned supervisor `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`,
physical128MiB/CPU90/wall120/file24MiB/output2MiB under the one-permit light pool.
Git alone used physical256MiB/DATA512MiB, two permits, the shared Git flock and
the launcher-supplied dedicated strict GitHub SSH configuration.

Runner stdout and stderr have distinct pipes and owned files from process creation,
including failed spawn/setup. Their aggregate cap is 2MiB. Captures are bounded
at 4MiB each and 16MiB cumulative. The adapter persists spawn state, serial commands,
review/response timestamps, terminal proof and process-group cleanup. An external
runtime supervisor remains required to supervise/reap detached descendants; the
adapter cleans its owned process group and never equates leader exit with cleanup.
Normal Quit requires the accepted controller's complete same-run host-exit, log,
absence-of-signal/fault/timeout and cleanup predicates.

## Verification and reusable evidence

`test/test-airstrike-observation-bridge.py` executes the actual hash-pinned accepted
controller with a small Python NDJSON fake runner. The final group passes 12 cases:

- The menu review after Escape takes 11 seconds, exceeding both the historical
  parent eight-second deadline and the ten-second controller window. The response
  phase starts afterward; only the reviewed serial Esc/Down/Enter sequence occurs.
- Process exit during review, stale `after`, unmatched capture token, changed image
  and changed focus all refuse further input.
- The actual accepted controller refuses a wrong selected row and runner exit 0
  without the required guest host-exit line.
- A missing ACK gets the unchanged ten-second budget, then refuses without replay;
  an unmatched ACK also stops the stream.
- Overall deadline cleanup and failed-spawn distinct diagnostics are retained.

Final group: 12 tests, 23.630 seconds; supervisor 23.759 seconds, peak physical RSS
63,438,848 bytes, cleanup complete. `test.log`, `test-supervisor.json`, source hashes
and `checkpoint.json` bind this final group. Two preliminary 11-case passing groups
remain in ops as development history, not reusable receipts for the final source.

The original controller/test SHA256 identities match independent acceptance.
Its unchanged 14 CLI cases and five existing groups are reused, not rerun. The
production runner is read-only SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`;
no substitute runner or actual guest was executed. Mount validation is inapplicable
to these offline fixtures and remains mandatory before a future guest attempt.

## Remaining gates and handback

Independent acceptance/integration of this new adapter, a separately authorized
fresh exact-runtime startup/mount/resource/lifecycle preflight, factual same-run
menu navigation and ordinary Quit terminal proof, and current-main qualification
remain open. Offline tests establish transport behavior only. No boxes are assigned;
the two historical boxes remain coordinator-owned, idle and snapshot-verified as
reported at dispatch; neither was resumed or otherwise operated on.

Recovery/evidence lives in `/tmp/airstrike-observation-handoff-repair-oct27/ops/`.
The initial root-ref digest receipt is reused from
`scratch/usage-watch/airstrike-observation-handoff-repair-oct27/root-ref-digest.json`;
root tracked files, index, refs and all donors remain read-only. The task uses an
isolated sparse repository and read-only donor alternates, with no full checkout,
asset/module copy or repack. A transient Git config.lock accounting sample failed
during init; that receipt is retained, and a bounded whole-sample retry handles
known owned-directory churn. No resource floor or access denial was bypassed.
