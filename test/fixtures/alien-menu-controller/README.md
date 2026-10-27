# Alien original-supervisor menu controller

Existing-guest attachment is retired. `tools/alien-menu-gameplay-controller.py`
always exits 1 before reading configuration, creating authority claims, or sending
HTTP. PID, start ticks, UUID, output directories, JSON, and possession of any
listener FD cannot delegate control. Old registry receipts remain untouched.

Use `tools/alien-supervised-gameplay.py` to launch a genuinely NEW child. The
launcher creates the actual `subprocess.Popen` handle, fixes the numeric endpoint,
original start/deadline/reserves/capture credits, and invokes the menu controller
once in process. That private continuation closes over the live child; no public
authority constructor or serialized authority object exists. This is cooperative
local orchestration, not isolation from arbitrary same-UID file/memory changes.
Process/terminal observations are not atomic with socket writes.

Example shape (replace all paths, port and absolute epoch deadline with admitted
production inputs; this is NOT authorization to run a guest):

```sh
python3 tools/alien-supervised-gameplay.py \
  --invocation /absolute/NEW-invocation \
  --endpoint http://127.0.0.1:18129/ctl --cwd /absolute/runner \
  --deadline ABSOLUTE_EPOCH_SECONDS --after-batches 128 \
  --capture-limit 8 --captures-used 5 --capture-bytes 25165824 \
  --rss-limit 3221225472 -- \
  /absolute/node --max-old-space-size=2048 \
  --require=/absolute/capture-wrapper.cjs /absolute/runner/test/run.js \
  --app=alien_shooter --no-build --wasm=/absolute/current.wasm \
  --d3d9-renderer=software --trace-render-wait --tick-ms-per-batch=5 \
  --batch-size=200000 --max-seconds=110 --no-close --quiet-api \
  --frozen --control=18129
```

This uses the same Popen/monitor/controller path as the offline Python child
fixtures. The argv shape comes from the original production
`/tmp/alien-accepted-dispatch-menu-mission-oct27/ops/guest-args.json`; historical
box paths and cutoff have been removed from the launcher. No Node/guest execution
was performed for this implementation. Runtime closure, mount validation and
actual gameplay acceptance remain separate gates. A child must itself serve the
unused endpoint passed to its command. The launcher rejects an occupied port;
that cooperative preflight is not an atomic network ownership proof.

One new directory belongs to one original child. The supervisor writes
`command.json` (actual argv/cwd/PID/runId/limits), `budget.json`, terminal and cleanup
receipts. It waits locally for review publication without sending HTTP. The
review must arrive inside the original startup bound (at most 75s) while retaining
at least 30s action and 10s cleanup. The entire original lifetime is at most 120s.
No changing output, deadline/config, terminal path or retry creates new credits.

A reviewer supplies `menu-frame.json` after reviewing the exact frozen menu image:

```json
{"runId":"from-command.json","batch":4722,"path":"/absolute/NEW-invocation/menu.png","sha256":"full-image-sha256"}
```

Publish matching `approval.json` LAST, after the frame and review record are ready:

```json
{"runId":"from-command.json","batch":4722,"frameSHA256":"full-image-sha256","humanReviewed":true,"reviewId":"review-record","action":"New Game","command":"click:98:296"}
```

There is no default approval or image recognition. The specific target remains
the reviewed 640x480 Alien Shooter main menu. The first snapshot must match that
reviewed batch and confirm frozen/zero-credit/alive state. Approval authorizes
only this original child; it cannot attach to another guest. Startup capture
usage must be included in `--captures-used`; review publication grants no capture
credits. Three credits must remain for after-action/observation/before-Quit frames.
The launcher does not duplicate a completed startup/menu phase or grant new credits.

For a newly frozen guest that still needs to reach its menu, explicitly supply
`--startup-batches N` (0..8192). This ports the original drive's bounded serial
snapshot/step/snapshot schedule into the owning launcher. It takes one before
frame, hashes the actual local image and publishes `menu-frame.json`; review
must still be supplied separately. Use initial capture usage that leaves FOUR
credits (before plus three after), for example `--captures-used 4` with limit8.
Startup time, CPU and capture usage are carried into the action phase unchanged.
When this option is absent, no startup HTTP is sent. Readiness probes for the
explicit startup schedule send no HTTP bytes and never retry a ctl command.

Control remains serial through the unchanged gameplay-sequence and HTTP helpers:
frozen snapshot, one approved New Game click, two snapshot-bracketed bounded fully
ACKed steps, following frozen zero-credit checks, after-action and observation
captures, before-Quit capture, final Quit. There are no overlapping commands,
retries, automatic cleanup reconnects, or replay after uncertain delivery.
Every socket header/body write checks the original live Popen, terminal latch and
original budget, including after connect. Input/captures are charged before bytes.
The durable sequence ledger retains pending intent after failure. A delegation is
consumed before review/controller validation and never refunded. Any controller
failure ends the original lifetime and cleans up the owned child/descendants.
A new launcher cannot reuse an existing invocation or an occupied endpoint.

The monitor retains the original production supervisor's subreaper/descendant
tracking, physical RSS sampling, conservative per-identity CPU accounting,
CPU90s, wall/deadline, file24MiB, output2MiB, allocated capture ceiling and host
floors. Cleanup signals the original child through its retained pidfd and tracked descendant identities, escalates,
waits and records `remainingOwnedLive`. RSS sampling remains a lower-bound
observation between polls, not an exact physical peak guarantee. DATA/AS are not
limited by this launcher: Node virtual reservation is not physical RSS.

Offline commands (run inside the assigned pool/128MiB physical supervisor):

```sh
python3 test/fixtures/alien-menu-controller/test_supervised.py /NEW/production-evidence
python3 test/fixtures/alien-menu-controller/test_controller.py /NEW/retired-cli-evidence
python3 test/fixtures/alien-menu-controller/test_process_owner.py /NEW/retired-pid-evidence
```

`child_server.py` is an actual lightweight Python HTTP state child created by the
production launcher. Its two listeners share handler/state; a sleeping descendant
inherits only the alternate listener. Tests assert the actual Popen PID serves
the requests. Competing standalone CLIs send zero HTTP and create no new claim
while the original controller is live. Connection-boundary injection is confined
to `inject/sitecustomize.py`; never put either fixture injection directory in a
production PYTHONPATH. The legacy fixtures now explicitly test retirement rather
than silently skipping old attach-success expectations. The historical incident
reproduction remains unchanged and is reused, not rerun.

These fixtures establish the cooperative supervisor/controller contract, not
mission entry, playability, real image review, native guest execution, returned
MSG behavior, or actual-game Quit acceptance.
