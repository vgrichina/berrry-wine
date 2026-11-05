# Conan: opening cinematic to first normal-transform blocker

Run: `scratch/runs/20261105-conan-player-control/`.
Predecessor: [texture residency repair and retest](conan-texture-residency-cause-20261105.md).

**Player control remains unverified.** The single original session progressed
through New Game / Warrior, Kordava loading and several opening cinematic shots.
Near the end of the cinematic, the render queue failed with
`D3D9 fixed function: singular normal transform`; later rendering became black.
No movement or combat acceptance is claimed. FPS and audio are unknown.
No emulator source or shared test was changed, and no original retry was made.

## Gate, installation and actual execution identity

Stayed source-only until the ordered exact FINAL releases: AoW2 browser1850
19:35:35Z, AoE3 native1900 19:46:30Z, legacy framebuffer1925 20:01:42Z.
At 20:02Z, `verify-release.py` independently checked 421 absent PIDs,
181 refused ports, 56 absent profiles, four free locks, no heavy process and
sufficient disk. Execution deadline was 20:47:16Z.

The existing 37-file installation was verified and reused in place:
`scratch/game-media/conan-installed-20261105/`. Manifest SHA-256:
`adf7c78e9ab56519edd53479b2151f04e18496668dec450ba2af12cc0b90cd38`;
registry SHA-256:
`64969ff6f94d58b54431e18f937af3374bda5755e233ad62517840e1611d8de3`.
Every installed file matched its manifest size/hash. No installer, media copy,
source archive, box, subworker or public deployment was used. Box ID/state/expiry:
N/A; Heroes II was untouched.

Runtime source commit:
`114b6f13ab55433c39fd356f3d118cc7f07c7f5b`, with empty relevant tracked
binarydiff. `source-before.json`, `runtime-relevant.binarydiff`, and the
untracked-source index/patch preserve source identity without archiving the tree.
The run-owned driver reused the predecessor app configuration, registry and
production isolated server/launch path. Its ordinary-input queue had a fixed
35-minute bound, screenshot references for inputs and completion receipts that
prevented overlapping/replayed commands. Attachments used `defaultViewport:null`.

Actual Chrome was `151.0.7922.108`, using SwiftShader/WebGL and guest Workers.
The loaded 2174134-byte module was independently observed through the page
compile identity and CDP in the guest and render Workers:
`b6c36db2aa538aa8c6e411d1cbe421d7898f791d65003b5ed54b8564495289d2`.
The unique module is retained in this run. `executor-identity.json` records
actual script hashes, including:

| Owning component | SHA-256 |
| --- | --- |
| `lib/guest-worker.js` | `806c29ef6e7d1536e52229e189436d2cef0bfc002be3c483d5d904e96fcaeee1` |
| `lib/d3d-render-worker.js` | `79bf32cd97ee9d5810cfca7cf8c6820158e475b0a77f15e4fa6ff6c0713d0516` |
| `lib/d3d9-render-worker.js` | `5f34e09ca5b1ece8cc0b163e188004de87cccb8715004da5cdecefd3f6b26e54` |
| `lib/d3d9-backend.js` | `0d6cea709b269d2c3e1461d6354bf822087f51543f57d39ee10ac61de57bcbdb` |
| `lib/d3d-command-stream.js` | `264e15f0cf88a7c82c0a606293b98e0eb6cb6e41b6d9ff62c991b0f6349cfef9` |

The actual process was 1000, guest-main Worker slot 0. Render endpoint 1 was
`api: neutral`, `backend: webgl`, device 136450064, generation 1. The loading
thread occupied guest Worker slot 1 and exited normally. Its CDP session had
already closed by final collection; that limitation is retained explicitly.

## Personally reviewed route and first failure

Reviewed legal splash, transition, menu, difficulty, loading, town/street/Conan
cinematic shots, final fade and black blocker captures. `capture-review.json`
lists the reviewed images and limits. Browser input logs and `input-*-before.json`
record trusted key/button events and corresponding guest input consumption.

One ordinary Escape press reached the main menu. An Options click and a short
Enter press did not open settings. Keyboard navigation then visibly selected
New Game; Enter opened difficulty with Warrior highlighted. Confirming Warrior
reached Kordava loading. No claim is made that the ineffective settings inputs
established a defect. Longer key holds can repeat menu selection, so every
subsequent action used the actual visible selection rather than a presumed one.

The town cinematic appeared by 20:09:03Z. A single ordinary Escape press during
the cinematic at 20:11:36Z was consumed; the next capture showed Conan on a
rooftop, still letterboxed with story subtitles. Subsequent idle captures showed
different street views and advancing subtitles through the temple narration.
These are cinematic progress, not player-controlled movement. There were no
game inputs after that Escape.

The first logged normal-transform error is at **20:15:14.349Z** in
`console.log`. The previous reviewed shot, `cinematic-eastern-edge.png`, was
captured at 20:14:52Z. `cinematic-temple.png` at 20:16:01Z is black with the
last subtitle, and `after-opening-fade.png` at 20:16:48Z is fully black.
The error was noticed during inspection of that later capture.

`retained-first-render-error.json` preserves the original sticky queue error
and its receiving stack. Device 136450064 / generation 1 has successful prefix
73296, first failed entry **73297**, then failed entries 73298–73301. All five
were consumed/retired; no commands or bytes remained in flight. The error is
`QueueError`, code `EXECUTION`, with the singular-normal message. Its host stack
begins at `WorkerConsumer.receive`, through the render endpoint and manager.
The actual render Worker dispatches this device's DRAW to
`D3D9Backend.Device.draw`, whose fixed plan invokes `D3D9Fixed.compile`.

**The original failing packet's matrices, normal declaration, shader/lighting
flags and executor throw stack were not retained.** Queue retirement clears
the command payload and transport reconstructs the Error. Therefore neither
the exact singular matrix nor its guest producer is established. There is no
claim that a specific zero-scale, shadow, animation or guest-state bug caused it.
No texture residency failure was logged in this session.

A bounded, false-condition CDP probe was attached after discovery, without
guest export calls, input, production wrappers or source changes. It did not
observe another normal-matrix calculation: the queue was already failed.
The main producer probe also reported inaccessible optimized `fvf` scope.
`normal-fault-owning-context.json` preserves that failed observation rather
than substituting later draw state for the original packet. All temporary
breakpoints were removed. The retained original queue error is the useful
owning evidence; exact first-draw parameters remain unknown.

## Tested boundary and repair limit

The run-owned `normal-boundary.cjs` passes ten checks using the production
JavaScript fixed lowerer and production command receiver. Identity and an
independently calculated nonuniform diagonal inverse succeed. Singular world
and view matrices fail normal lowering, while an unlit position-only singular
matrix does not require normal inversion. The probe checks source immutability,
the failing command's identity, suppression of subsequent executor calls in
that stream, continued execution on another device, and a fresh generation.
This is a generated contract probe, **not a reconstruction of Conan's lost draw
or a GPU pixel test**. See `normal-boundary.json` and its log.

Existing `test/test-d3d9-fixed-plan-cache.js` and
`test/test-d3d9-fixed-cascade.js` pass. The latter covers native six-stage
lowering, camera normal/reflection transforms, singular-input refusal and
allocation lifetime; its complete result is in `existing-fixed-cascade.log`.
No full build was needed for this documentation-only change; the worker did
not change shared code or claim a repaired build.

Microsoft's [camera-space transformation specification](https://learn.microsoft.com/en-us/windows/win32/direct3d9/camera-space-transformations)
requires the full 4×4 inverse transpose for normals. The
[matrix inverse reference](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dxmatrixinverse)
also permits inversion failure. These do not establish a substitute normal
matrix or device-level outcome for Conan's missing packet. Replacing the
matrix, dropping the draw or swallowing the error would be speculative.
No rendering repair was implemented.

Next: retain the first failing command at the actual render executor before
retirement, including world/view matrices, vertex semantics and fixed-stage
flags, then resolve its producer and required behavior against the documented
contract. Use generated controls before any separately authorized original
execution; do not repeat this unchanged original or the repaired residency work.

## Closure

The original session closed normally at 20:20:27Z: driver code 0, Chrome code 0.
`runtime-cleanup.json` independently confirms the Node/Chrome processes absent,
both ports refused, profile absent and four locks free. Final verification also
checks the detached launcher and board watcher, heavy-process absence, retained
installation hashes, source identity and artifact hashes. Evidence remains in
the named run; no Conan candidate exists in the corpus, so it is an investigation
note rather than a fabricated gameplay acceptance record.
