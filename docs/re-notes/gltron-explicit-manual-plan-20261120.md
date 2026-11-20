# Explicit GLTron manual four-key plan

`tools/gltron-manual-plan.cjs` adds the explicit `native-manual-plan-v1`
capability. Its private one-use handle binds one session, the complete original
review source, and the exact four intents, nonces, order, holds and delays. The
only accepted shape is Space, a personally selected left/right, the other turn,
Space, from a personally reviewed paused source. Existing interval and aggregate
limits apply. There is no automatic fallback from strict frame equivalence.

The caller supplies `createNativeManualContext` from the qualified **7bca66241**
closure. `captureReview`, `authorize`, and `createGroup({manualPlan})` are separate
explicit operations. The group receives the private plan handle as its third
`gesture` argument. The transport calls `manualPlan.fence(intent,image,publish)`
at the final socket boundary; only the current private edge proof can authorize
that callback. The group still prepares all four independent UP participants
before its first DOWN, requires native USER consumption for each edge, and joins
each release. Holds start at publication. Cancellation, writer failure, order
errors, repeated use or extension close authority permanently.

The original personally reviewed source authorizes the precise plan. A current
complete capture may have different pixels and is explicitly **not personally
reviewed**. This does not assert frame equality or a freshly reviewed current
scene. The qualified helper preserves source 30s, review 15s, fresh 5s, native
500ms and hold 1500ms clocks, native focus and target identity checks, and the
signed owner/HWND generation/modal/capture/viewport/module/realm binding.
No masks, tolerance, repaint, game-state writes or deadline changes are added.

The plan requires a synchronous evidence sink. It receives detached, recursively
frozen evidence, with complete PNG bytes encoded as immutable base64 objects.
The review source is retained before return; the qualified helper supplies
prove/pre-DOWN/final comparison evidence before publication, including pixel
mismatch refusals. A false return, Promise or exception retires authority. The
run-local sink fsyncs and verifies retained PNGs. A failure inside the qualified
capture or identity observation before it emits evidence can still leave no
returned capture; this wrapper cannot manufacture those missing pixels and makes
no claim to retain such an unreturned image. There is no post-UNKNOWN recapture.

Validation in `scratch/runs/20261120-gltron-explicit-manual-plan-native-round/`:

- 50 focused tests pass, including the existing 26 tests and authored four-edge
  transport, identity/focus/stale/cancel/writer/release-race controls. Authored
  returns establish control flow, not actual native USER qualification.
- Actual compiled lazy native-init explicit-plan path passes through the exact
  loader: 27-source closure (previous 26 plus plan module), exact 7bca common/Hex,
  unchanged 10bdae module, prior five ABI checks referenced by SHA, 92 media pins.
- Own final `flock /tmp/wine-build.lock bash tools/build.sh` passes, actual exit
  0, after the Hex owner refreshed its lifetime review. The intermediate build
  refusal for concurrent `lib/guest-worker.js` and `handle_PeekMessageA_fetch`
  changes is retained. This worker did not edit those held files or reviews.
  See the final result for the strict pull/push publication disposition.
- Before any native/browser launch, actual `/home` availability fell to
  **1,467,912,192 bytes**, below the required 1,500,000,000 floor. Task runtime
  admission closed permanently. Later recovery does not reopen it. No native
  qualification, original game, visible trail/heading/pause/round, or Quit is
  claimed. Actual native negatives remain unqualified.

Prior cec7ab67c ordering evidence is referenced by SHA. Its first Space was
native CONSUMED with trusted independent UP. Its next strict RGBA refusal is a
contract limit. Refused fresh pixels were absent, so no explanation of what
changed can be established from that run. The prior scope remains closed.

The run-local recovery driver uses the coherent 34c graph, 10bdae module and
72dc/cf181 overlays inherited from the prior recipe. It is preflighted but
unlaunched in this task. No current Hex/common/controller/GPS/WAT edits were
borrowed. Box ID/expiry/stop receipt are null, state NOT_CREATED.
