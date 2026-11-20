# Q2 explicit whole-host reviewed-frame equivalence, 2026-11-20

Evidence: `scratch/runs/20261120-quake2-exact-frame-review-equivalence/`.

`lib/browser-reviewed-frame-equivalence.cjs` owns native XGetImage captures of
the entire private display. `captureReview` retains its own immutable decoded
RGBA source, dimensions, orientation, original PNG hash and real capture times.
No caller can supply pixels or timestamps. A later explicit manual intent may
request a new invocation only within 30 seconds of that source and 15 seconds
of its personal review. Exact full-frame equality and unchanged native/page
identity are required. The fresh equivalence is expressly not personal review.
There is no repaint, presentation change, region comparison, tolerance, action
selection, codec transport change, old lease renewal or background retry.

Proofs are private one-use handles, with HMAC authenticated page envelopes. The
page session holds the key in its closure and compares its native context with
the signed context. It retains actual owner/module/memory/Worker/endpoint refs,
HWND generations, scene focus/modal/capture and viewport, and closes on blur,
resize, pagehide or retirement. The browser native guard adds viewport identity
only under this explicit opt-in. Default direct API review remains five seconds;
native preparation/consumption remains 500 ms with independent physical UP.
Native full-root equality is checked again before DOWN and synchronously at
socket publication. Missing, modified, replayed or expired proof closes the
scope. Source and fresh facts retain their distinct actual timestamps.

The authored realBrowser/native-display test demonstrates a real 5100 ms old
source rejected by the old API and admitted by new equality. It covers changed
pixels (including a real one-pixel draw), identity races, target/owner/generation/
viewport/focus/modal/capture/module/realm, intent/signature/replay and age
refusals. Existing authoritative capture, native input and legacy tests pass.

The first real x86 receiver calibration refused because Chrome's fullscreen
notice was still fading. Its scope closed without a guest DOWN. A separate
receiver with the notice already absent passed: source at 1795164890171,
personal review at 1795164902465, fresh equivalence at 1795164902489. The
unchanged old five-second check rejected it; the new invocation produced real
owner-Worker GetMessageA WM_KEYDOWN (65), token 1 at 1795164902937. Separate
release participant returned trusted physical-zero UP at 1795164902947.
These are receiver controls, not original game progress. Later source changes
add private-state hardening and fuller evidence fields; the fresh original uses
the final tested overlay. Build and publication details are in the run evidence.

Before original admission, actual `/home` free space fell to 1,317,015,552
bytes, below the 1.5 GB floor. The writer is UNKNOWN. Both receiver scopes had
already closed; no original was launched and no later endpoint request was
issued. Later recovery to 1,597,353,984 bytes did not reopen runtime admission.
The final evidence `result.json` is written last. Exact 10bdae/2418815 bytes,
graph34c plus72dc/native65a plus the explicit JS overlay, 67 media and
gl-gps/WebGL were verified in the native fixture. They are prepared pins, not
a new original attestation. World/combat/ordinary Quit remain UNPROVED.

Localhost box ID null, state NOT_CREATED, expiry null, stop receipt null. Root
owns shutdown. Git, relevant binary diffs and owned new-file patches are the
source archive; selected named images and unique logs are retained without
source snapshots or media copies.
