# Actual WebGL stream failure and moving Tunnel ordinary close

Published test extension: `dd9b09da5`. Run
`node test/test-d3dim-crash-close-web.js`. The existing software case remains,
and the same production Worker/decoder/doorbell lifecycle now runs through the
actual WebGL executor. No tracked test reads run evidence.

Both cases passed malformed opcode 65535 at sequence 6, error 1, completion 5,
exact RGBA readback with pitch canaries, untouched trailing records, queued
CLOSE, same-ID replacement, queued STOP, refused retired endpoints, transport
barriers and separate actual Worker-target destruction. WebGL additionally
requires the production executor's `webgl1`/`webgl2` stats and real context
renderer on both endpoint generations; software fallback fails the test.
Its transferred ImageBitmap is drawn and checked for exact frame pixels.
The observed context renderer was ANGLE Intel/Mesa UHD Graphics 620 despite
SwiftShader launch flags. This is an actual WebGL claim, not a physical GPU
claim. Malformed-record recovery is not an OS/browser crash-freedom claim.

The browser test, current native stream shutdown test, scratch-dependency gate
and locked canonical build passed before commit and immediate strict pull/push.
An initially selected obsolete pending-close test failed because it references
removed `lib/d3dim-gpu.js`; its failure is retained separately, not counted as
a pass or repaired in this task. No production mismatch occurred.

Evidence: `scratch/runs/20261118-d3dim-webgl-browser-crash-close-tunnel/`.
After publishing, exactly one fresh original `dx_tunnel` used the previously
verified `a6002d5d…862f8` module, Git `f6962ba5b1…` and renderer `06f27181f9…`.
HTTP hashes verify the served module. No module was recompiled for the original.
UTC startup, owned tmpfs, component-update switches, stable initial 800×600
viewport and ordinary focus were preserved; no inspection resize occurred.
The render Worker observer recorded `GpuStreamWebGL`, `webgl1`, actual context
`WebGL 1.0 (OpenGL ES 2.0 Chromium)` and the same ANGLE renderer string.

I viewed both complete private-display scene images. Both show textured gray
tunnel geometry and yellow detail, with visibly different geometry/orientation.
The selected scene region excluding FPS and bottom label changes at 73,115 of
73,320 pixels. This establishes moving rendered scene content in this bounded
run; it does not isolate the historical initial-black cause or claim performance.
Run-local capture retains only the selected whole images, losslessly compressed
with identical decoded pixels checked before durable writes.

Ordinary title-close mouse down and independently awaited up produced direct
native `[ExitProcess] code: 0` at 1795007742740, before host `stop()` at
1795007742741. No windows remained; guest/render retirement and real
`render-stopped` ACK completed without retirement error. I viewed the whole
closed display. Chrome, Xvfb and openbox each exited 0 with individual actual
waits and both pipe EOFs. The enclosing invocation exited 0/both EOFs; native
supervision reports no leaks. Display socket/auth and owned tmpfs are gone.
No old UNKNOWN was reopened, no unchanged original retried, and no original
endpoint was requested after this scope closed.

Task disk-floor compliance failed: a pre-original observation was 1,499,058,176
bytes free; the finite monitor recorded minimum 1,499,303,936 and one below-floor
sample. Original admission was 1,501,618,176; its outer monitor minimum was
1,500,438,528 with zero below-floor samples. These are distinct observations,
not a lifetime compliance claim. Only owned evidence was losslessly compressed;
foreign storage, WIP, security holds and common helpers were untouched.

Git plus relevant binary diffs and owned new-file patches recover the work.
Selected consequences, direct native exit, individual waits, source/module
pins and recovery notes precede `result.json`, published last. No workers,
boxes, Python, Wine, deployment, source/media copies or timer investigation.
Box ID null, state NOT_CREATED, expiry null, stop receipt null.
