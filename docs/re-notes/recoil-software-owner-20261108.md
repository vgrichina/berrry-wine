# Recoil actual software owner attestation, 2026-11-08

Run: `scratch/runs/20261108-recoil-software-owner/`.

Implemented a generic, explicit **page-software** owner attestor in
`tools/strict-software-owner.cjs`, with focused tests in
`tools/strict-software-owner.test.cjs`. It observes the existing production
post-copy hook, pins the actual context/instance/memory/window/layer/2D context
and allocation generation, and obtains complete uncached decoder/compositor
JavaScript source through each actual function's CDP `[[FunctionLocation]]`.
Both lanes start together with `Promise.allSettled`; failures drain both lanes,
close the attestor and prohibit replay. Source bytes must match explicit pins;
script/context retirement during a response is rejected. Copy age is bounded
to 250 ms and requires an independently verified same-host clock. Installing
twice or replacing an occupied observation is refused.

**The original strict gate remains refused.** This tool always returns
`gateEligible:false`. JavaScript source responses are labelled JavaScript and
are never substituted for the existing four guest/render WASM responses.
No original game, Resume, M, C, movement, weapon, timer gate or new native input
was attempted. No gameplay consequence is claimed.

## Ownership trace and retained evidence

The requested prior note is
`docs/re-notes/recoil-software-native-20261108.md` at `cf8e4252c`. Its actual
providers remain pinned to source Git
`49874a81c5ae180c20a15c6bb169d9041f028cae`. All **851 repaired providers** were
independently reread and hashed here, including the exact repaired
`browser-position.cjs`, `motion-steps.cjs`, phase/clock and compound helpers.
They were not uploaded. The accepted ten reviewed-point negatives, five
custodian controls and 36 probes/144 responses were reused by verified manifest
hash, without rerunning those controls.

Retained `recovered/software-owner-proof.json` records process1000, guest
endpoint1/slot0, one live guest Worker target
`54360B430A1DEBD25D021EC5908F9BC6` and its instantiated WASM
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The temporary slot1 worker had retired. D3D statistics and render endpoints
were empty, and no owning render Worker existed. The retained visible Software
radio196,457, tank timer09 and subsequent MENU are accepted observations.
They do not prove an unrecorded current software context or four fresh owner
module responses. The old box is stopped, so fresh execution there cannot be
reconstructed honestly from stored source identities.

The source establishes the following actual software architecture:

1. `src/09a8-handlers-directx.wat` implements surface Lock by returning the
   native DIB pointer/stride. CPU guest code writes those shared pixels.
   Unlock marks CPU writes and presents a primary; Flip rotates DIB
   associations, then presents. `$dx_present` names `0x200000+slot` canonical
   DirectDraw storage. The guest's precise rasterizer function/call stack was
   not retained and is not inferred from its current EIP.
2. `lib/guest-rpc.js` with `dxTraceLocal` publishes dirty/lock state in shared
   memory. The page's `WineAssembly._presentDxIfDirty` in `host.js` consumes
   that state and calls its own `hostCtx.sharedGdi.presentBestDxOffscreen`.
3. In `lib/host-imports.js`, that closure selects the actual live surface and
   `_presentDxSurfaceToMainWindow` converts its memory to RGBA, performs
   `putImageData` into the selected window's `_dxFrameLayer` 2D canvas, and
   emits `fallbackObservation.copy` only after that copy. The owner is the
   page host context and renderer, not a fabricated D3D worker. Source hash:
   `f468ffce84da0f517df009682c111bbcb955b67f8b5a122350abbe5abc49e1d8`.
4. `Win98Renderer.repaint/_repaintOnce` in `lib/renderer.js` composites the
   layer on the page. Source hash:
   `cb21daaf7c0ce2b2cf80436c192bda4ed78930b1b07eaf21a20eb9adb7ce7b51`.
   The page's WAT instance supplies geometry/palette access; its existence
   alone does not turn the JavaScript pixel decoder/compositor into a WASM
   render-worker owner.

This trace distinguishes source-established routing from a dynamic software
owner witness. A successor must observe an actual copy and execution context;
endpoint absence is insufficient to select or attest this route.

## Tested repairs and single integration result

The retained `bound-input.cjs` has a demonstrated fail-open branch: absent
render endpoints return `rendererTarget/rendererEpoch/rendererModuleSha256`
as `"none"`, which satisfy its identity comparison. An owned successor helper
now throws before that branch can return success. `test-absent-renderer.cjs`
executes the exact old and repaired chains: baseline accepts the absent
renderer; repaired refuses with unchanged guest bytes and parallel lanes.
This is a helper repair retained in the run, not a change to old evidence.

The committed software attestor passes focused tests for four **mock-CDP**
uncached JavaScript responses across two reads, parallel lanes, and **28**
negative cases covering owner/instance/exports/memory/context/layer replacement,
allocation changes, route changes, script retirement/source mismatch, absent
responses, stale copies, unverified clocks and sticky UNKNOWN. These mock responses are not
native evidence. The metadata-retirement negative exposed a response-time
metadata race, repaired by revalidating script metadata after transport.

Exactly **one generated Chrome integration** was launched locally under
`/tmp/wine-runtime.lock`. Its 41 production modules were reconstructed in memory
from the exact retained Git providers, not copied into an evidence archive.
The independent observable GNU timeout watchdog was armed before Chrome with
an immutable 90-second deadline and five-second termination grace. No box was
created. This integration **failed before any module-source responses**:
the generated fixture called `host.dx_trace(21,7,0,0,0)`. Production allocation
kind21 requires DDSurface type2 in its third argument. Consequently the real
copy had allocationGeneration0 and was correctly refused as UNKNOWN.

The fixture is repaired to `host.dx_trace(21,7,2,0,0)`. A focused test executing
the exact pinned production host imports and renderer independently demonstrates
type0 refusal, type2 acceptance, allocationGeneration1, actual copy generations
1 then2, pixel `[255,0,0,255]`, stable owner identity, and refusal after actual
surface retirement. This uses generated surface data only. Corrected syntax and
the full 41-module preflight pass. No second browser was launched. The real
Chrome `[[FunctionLocation]]`/uncached-source path remains unvalidated, and
**zero actual software source responses** are claimed for this run.

Initial test-path failure, initial missing-negative failure, the metadata-race
failure, browser failure and initial recovery-verifier null-provider error
remain recorded separately from corrected results. The full locked build
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Peer production files
were not edited or included in this change.

## Exact successor and cleanup

`browser-integration-attempted.cjs` retains the attempted generated fixture;
`browser-integration.cjs` contains the one-argument correction. The exact
successor diagnostic is the corrected script under `local-supervisor.py` in a
new assigned run, once authorized. First run its `PREFLIGHT_ONLY=1` check and
the focused tests; independently prearm the watchdog; hold the local runtime
lock only for that runtime. It must obtain four actual uncached JavaScript
responses, correct red pixels, and real owner-replacement refusal. Its module
wrappers are deterministic from the recorded Git providers; wrapper hashes are
in `generated-source-manifest.json`. Do not rerun it within this assignment.

Only after that diagnostic succeeds should a future assignment design the
explicit software counterpart of the four-response gate, keeping guest WASM
proof plus actual decoder/compositor module responses and current-epoch
checks. This requires an explicit contract, not silently reusing WASM fields
for JavaScript hashes. Keep actual clock verification, entry/owner/PNG/return
phases, final co-located owner/pixels, timer pair, 250ms freshness, independent
native releases and sticky UNKNOWN. The exact repaired851-pin/29-file startup
and motion helpers remain the baseline. No new original is licensed by this
note, and the existing strict native gate remains closed.

Chrome and its loopback HTTP server closed promptly on the failed integration.
The supervisor was a subreaper: all recorded parent/descendant/adopted custody
PID/start identities were absent/reaped, both ports independently refused
connections, the runtime lock was independently free, and no input was sent.
The watchdog exited with the failed test; `local-runtime-drain.json` retains
exit1 and an empty remaining-process set. No new box ID/state/expiry or stop
receipt exists; the inherited box remains `bx_kvzp7fye`, archived, expiry null,
with prior stop `stop_44fc7f9835ab35f3` untouched.

Recovery uses exact checkout SHA in `source-head.txt`, the existing851-pin
manifest, Git source providers, small owned binary patches and existing media
references. No source-tree/media archive, peer WIP, public deployment,
old-box resume/delete, subworker or clock/seed/config/guest write was used.
Full27, parity, audio, FPS, native software attestation and M consequence remain
open. This task delivers the tested bounded actual-route attestor, the concrete
absent-response refusal repair and the tested integration-fixture correction.
