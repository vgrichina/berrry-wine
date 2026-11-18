# Browser stream failure regression and ordinary Tunnel close

Published regression: `c7ac59e41`. Run with
`node test/test-d3dim-crash-close-web.js` (the normal `-web` E2E tier).
The tracked test reads no run evidence. Its small 2×2 record fixture runs in
actual Chrome against the current production render Worker, stream decoder,
doorbell and software executor, with a freshly compiled canonical source
module. The HTTP server serves source bytes and the module; it does not script
responses, Worker events or native exports.

The test asserts actual malformed opcode 65535 at sequence 6, shared error 1,
completion sequence 5, exact native readback/frame RGBA and pitch canaries.
Queued CLOSE follows that failed request; trailing readback and frame 502
remain untouched. Post-CLOSE and post-STOP transport barriers require real
endpoint refusal errors and no late pixels. Same-ID replacement publishes
frame 503 before queued STOP. Actual Worker target destruction and individual
Chrome exit 0 with both pipe EOFs are retained. This is malformed-stream failure
recovery, not an OS/browser crash or arbitrary game crash-freedom claim.

Evidence: `scratch/runs/20261118-d3dim-browser-crash-regression-original-close/`.
The final focused browser test, headful cleanup failure check, tier/scratch
dependency gates and mandatory locked build passed before the code commit and
immediate strict pull/push. The authored module is retained as
`tested-authored.wasm`, SHA-256
`8b6cf57bc9edd60b29eb6e5bfc6e5a231c5a542a90b20c05b815ca8383c3100b`.
Its exact bytes were recovered from the matching mandatory build by removing
only its appended `wine-region-layout` custom section; the hash matches the
actual browser-served module. Git and relevant binary diffs recover source.

The run-local original harness now flushes console/native-exit evidence before
teardown, retains failed wait observations without an unhandled derived promise,
and attempts Chrome, HTTP, display, receipt retention and tmpfs cleanup
independently. An injected failure after a durable observation still produced
actual individual Chrome/Xvfb/openbox waits with both EOFs. This repairs the
evidence-loss path without assigning an unproven cause to the predecessor's
missing lifecycle receipts. Shared common helpers were not edited.

After publication, exactly one new original `dx_tunnel` used the existing
verified `a6002d5d…862f8` module and Git `f6962ba5b1…`, with renderer
`06f27181f9…`, as in the predecessor recovery recipe. The original served-module
HTTP hash matches. No original module was compiled or copied. Chrome used
`8fd08ea3b`'s explicit UTC helper, tmpfs state and component-update switches,
with an initial 800×600 viewport and ordinary focus; no inspection attachment
or inspection resize occurred. I viewed the entire private-display early/later
images: the early client is black and the later client shows a textured gray
tunnel with yellow detail. This does not isolate the startup/focus cause or
claim a renderer repair or new motion measurement.

An ordinary title-close mouse down and independently awaited mouse up closed
the application. The reviewed whole `closed.png` shows it absent.
`native-exit.json` retains the actual host import's `[ExitProcess] code: 0`
log before host `stop()`, separately from process-object bookkeeping.
`after-close.json` records no windows, both guest/render retirement flags,
no retirement error and the real `render-stopped` acknowledgement. Chrome,
Xvfb and openbox each exited 0 with actual individual waits and both pipe EOFs.
The driver and its outer supervisor invocation exited 0; the outer receipt has
both EOFs and the supervisor reports no leaks. The display socket/auth and
owned tmpfs are gone. All original scopes are closed; no old UNKNOWN scope
was reopened and no original endpoint was queried after closure.

Disk compliance failed after the driver completed: its final observation at
1795007019272 had 1,501,954,048 bytes free, and the outer invocation first sampled
below floor at 1795007019666. Its minimum was 1,497,747,456 bytes. The longer
task monitor recorded minimum 1,496,674,304 and 302 below-floor samples.
Selected PNGs were losslessly compressed with identical decoded RGBA verified;
the compression receipt records both hashes. No foreign storage was cleaned,
no external cause repair or floor-compliance pass is claimed, and no reserve
or RAM gate was introduced.

Recovery, patches, logs, exact module/source pins, unique module and three
selected screenshots remain in the run; `result.json` is published last.
No workers, boxes, Python, Wine, deployment, source snapshots or media copies.
Box ID null, state NOT_CREATED, expiry null, stop receipt null.
