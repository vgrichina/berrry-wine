# TR2 DirectX layer coverage — 2026-11-08

Production now supports a narrowly proved native DirectX layer publication:
full, unclipped RGB565 decode with identity gamma, an exact owed upload request,
a sealed immutable source, and the actual owning window memory. The integration
commit is `b2af046efc0336cce76f21a412f7af747b0836d4`. Final publication checks also
refuse a window whose memory owner or canvas dimensions changed after decode.
This is a tested generic production repair; native original qualification and
reviewed movement/weapon consequences remain open.

Evidence: `scratch/runs/20261108-tr2-directx-layer-coverage/`.

The renderer's `_dxFrameLayer` is a separate opaque decode over its GDI backing.
The canonical GDI canvas is therefore not evidence for those displayed pixels.
`lib/host-imports.js` brackets the actual native fallback memory decode with the
existing epoch/page/host-version protocol. It uses the exact request retained
by that surface's upload, validates decoder layout against the source journal,
and seals only the canvas actually written. A WeakMap in
`SurfacePublicationJoin` binds window, layer object, canvas and version. The
compositor must transfer that very version to the display. The GDI proof
underneath cannot qualify in its place.

GPU layers, clipping, palette/gamma transformations, other depths/formats,
visible child windows, regions, exclusive child composition, menus, caret,
resize outlines and animated overlays remain unsupported. Page/writer
exclusion, stale-source/request/owner refusal, host-version invalidation,
unsupported-scene cache blocking and retirement accounting remain in force.
No source record is inferred from pixel equality or latest completion.

`test/test-d3dim-publication-directx-layer.js` uses the actual production
render dispatcher, real compiled WAT swap/page watches, native layer decoder
and compositor. Reconstructed categorical-guard behavior yields qualified0;
corrected behavior yields raw1=qualified1+discarded0, with the expected red
RGB565 source visible on the display. Twenty negative cases refuse wrong
window owner, copied token on another layer, worker owner/request mismatch,
covered GDI, page dirtiness, host-version changes, active writer, poison,
menu/caret/overlay, blocked cache, owner/dimension change after decode,
windowed device, gamma and RGB555. Cached republish adds no source. Synthetic
menu and caret test-development failures are retained in the run; the fixture
uses publication hooks for those guard-only negatives, while the positive and
source/ownership negatives use the real compositor.

Focused CLEAR, transient-writer, transient-scene and broad identity regressions
passed, as did the required locked full build before source publication. The
additional final owner/dimension checks passed the extended focused fixture
and a second locked full build. Callback census changes review only these
synchronous host/proof checks, with no guest callback, scheduling or input added.
Accepted actualWorkers4096, queue, handoff, retirement, cost, native500ms and
delayed-Chrome controls were referenced and hash-checked without separate runs.

The old retained trace is scoped in `overlap-scope.json`: it contains 80
`overlapping-or-poisoned-source-writer` rejected source proofs and 14 sealed
sources. Its 61 overlap dispositions omit 19 rejected sources masked by scene
accounting. All 61 name the same process/endpoint, owner and observation
generations, and front/back pair. The stored combined reason does not
separate missing source stamp, nonsole active writer, poison, or changed epoch;
there is no retained per-branch epoch snapshot to identify those individually.
No exclusion was weakened to reduce this count.

Before the sole fresh original, 597 pins (558 published tracked blobs), eight
HTTP pins, helper dependency/syntax/media checks and a no-browser driver
preflight passed. Only host-imports and render-worker changed from the accepted
runtime. Source recovery uses exact Git SHA, relevant binary diffs, small owned
patches and existing media paths/SHA-256; no source or repeated-media archive
was made and peer WIP was excluded.

The UUID-idempotent box **bx_aud4tmj5** was identified provisioned before
runtime. Independent observable normal-stop and 25-minute watchdog processes
were armed before creation. Initial expiry was **11:25:44.504 UTC**, with the
watchdog using the earlier immutable creation-attempt deadline. More than
5 GB disk was free. A remote subreaper custodian acquired its exclusive lock
before starting the browser and retained it until all descendants were reaped.
Local wine-runtime.lock was held only for local focused fixtures and released
before provisioning, supervision, retrieval and analysis.

All six blank-page native 500 ms preflight keys passed. Graphics visibly
selected Hardware 3D Acceleration, 640x480 High Color and focused default OK.
Enter was admitted at **8,281 ms**, below the unchanged 12,000 ms guard. Its
requested 500 ms hold was independently released, with recorded timestamps
499 ms apart. The next capture visibly shows Lara in Venice. Actual owning
WebGL2, endpoint, CPU and render module observations match the pinned module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`;
the adapter's null context field is not used as context evidence.

The full 4096 journal armed successfully. Before observation raw/qualified/
discarded are null/unobserved. Passive captures observed raw23=qualified0+
discarded23, then raw90=qualified0+discarded90. At retirement, **133 raw =
0 qualified + 133 discarded**: 112 overlapping/poisoned-writer rejections,
14 overwritten versions and seven coalesced versions. Twenty-one sources
sealed, but none survived to a qualified display publication. Read-only
inspection confirms the actual window memory owner, one visible top-level
DirectX layer, and no menu/caret/animated overlay. No native exact join or FPS
claim is made. No Up, Space or Control was sent; there was no second original.
Five numbered commands (Enter, arm, two passive captures, quit) have exact
successful ACKs, with no UNKNOWN or replay.

The first immediate drain check ran before the custodian's terminal receipt
existed and failed; that failure is retained. A later distinct read-only check
confirms the subreaper reaped all descendants, independently verifies all
recorded PID/start-time identities absent, and verifies launcher/controller/
custodian ownership, closed HTTP 37075 and DevTools 36201, absent profile and
writer, released remote lock, released input and all 597 pins unchanged.
All **87 artifact references, 79 unique hashes, 9,430,602 bytes** were retrieved
and independently reread for size and SHA-256; five PNGs also pass CRC checks.
Only then did delegated normal stop run.

Stop **stop_965b57b9cd8d6ca5** completed **11:03:23.269 UTC**, forced=false,
error=null. Final box state is **archived**, stopped **11:03:23.250 UTC**,
active expiry **null**. Normal/watchdog delegates exited cleanly and the local
supervisor has no children.

Next work is source lifetime/writer diagnosis sufficient for a native exact
join before reviewed movement or weapon input. Full27, parity, audio, game FPS
and simulation FPS remain open.
