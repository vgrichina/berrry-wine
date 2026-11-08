# TR2 current native control and presentation-rate attempt — 2026-11-08

**The current attempt stops at a native startup composition gap. It does not
establish current WebGL controls or ordinary-speed presentation measurements.**
The initial Graphics sheet is visible, but two later original captures show
only the teal guest desktop. Read-only renderer metadata still lists the
property sheet and Graphics child as visible. The cause is unresolved; no
emulator regression or repair is claimed.

Evidence: `scratch/runs/20261108-tr2-current-control-presentation-rate/`.
Only this note is committed. The [previous TR2 gameplay evidence](tr2-webgl-gameplay-20261107.md)
establishes bounded displacement, heading and weapons on its earlier module;
it is not current-module control acceptance. The
[latest startup sweep](graphics-additional-browser-crash-sweep-20261108.md)
ends at native Graphics and has no actual graphics backend.

## Original route and blocker

One original used the unchanged registered TR2 executable/media and production
`index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl`.
There were no guest/config/clock/seed edits, map changes or private input
handlers. The browser runs at ordinary clocks, without stepping or freezing.

- Original launch: 05:48:20 UTC. `startup.png` and `fresh-graphics.png` show the
  native COMCTL Graphics sheet, Hardware 3D Acceleration, Z Buffer, Full Screen
  640×480 High Color, and ordinary OK/Cancel. Both raw images were inspected.
- The first proposed OK request incorrectly used pixel `x/y` instead of the
  driver's normalized `point`. Validation rejects it before queue publication
  (`normalized canvas point`); it causes no input. This operator error and its
  original failure output are retained. It is not a transport UNKNOWN.
- The 05:48:41 fresh capture `refresh-graphics.png` has no Graphics sheet or OK.
  `native-after-idle.png`, requested with five seconds of passive waiting,
  also has no sheet. Both were personally inspected. No action uses the old
  dialog description or coordinates, and no corrected click is dispatched.
- At 05:49:36.177, a read-only probe records the page visible, the registered
  process running, publication sequence 6, window 65538 titled Tomb Raider II
  and child 65545 titled Graphics both `visible:true`. Metadata visibility
  does not establish visible pixels, an actionable OK, or a completed dialog
  dismissal. It does not identify the cause of the missing composition.

The original has four exact complete ACKs: three input-free captures and normal
quit. There is no original mouse/key admission, UNKNOWN, partial action, replay,
second launch, Venice scene or actual render endpoint. Browser preflight on
`about:blank` qualifies five trusted balanced native key pairs and invalid-hold
zero-effects checks. Local chain controls pass one-way native-to-render binding,
owner replacement rejection, stale zero effects and independent key release;
atomic transport controls pass exact ACK and sticky UNKNOWN handling. These
controls do not replace actual gameplay qualification.

## Counter qualification gap

The production pipeline and existing `tools/measure-gameplay-presentations.js`
were inspected. A queue total, rAF cadence or screenshot count is not game FPS.
The available stages have different meanings:

| Stage | Production boundary and remaining distinction |
| --- | --- |
| Queued submissions | D3D stream flip records and batch sequences precede owner completion; batch sequences also cover non-frame work. |
| Completed GPU readback/flip | `lib/d3d-render-worker.js` awaits `adapter.fenceFlip()` before `d3dim_worker_flip`; its completed batch sequence is written after replay. The flip has a record ordinal within that batch. A readback total alone does not identify its later page publication. |
| CPU/DIB uploads | GPU `_upload` and page surface upload are distinct operations. Neither counts unique logical game updates. |
| Guest-present notifications | `lib/host-imports.js` calls `_noteGuestFrame`/`WinePerf.guestFrame`; `host.js` also forwards DirectDraw dirty/present notifications. These need route-specific duplicate/completion qualification. |
| Page compositions | Renderer `observePresentationPublication(display, sequence)` runs after ordinary composition. Its sequence identifies a publication, without an attached owning guest flip identity. |
| Content changes | A publication can repeat the same content. No full-content comparison was qualified here; screenshot or sampled-pixel cadence would not settle this. |
| Logical guest updates | No independently verified TR2 logical update marker was established. |

The existing sampler validates monotonic telemetry, module/runtime identity and
visibility, then differences `presentsTotal` and retains pacing timestamps. It
does not join submission `(endpoint, batch, ordinal)` to completed readback,
guest present, upload and page composition. Its local unit tests pass.
`counter-gap.cjs` additionally exercises the **actual released measureWindow
function with synthetic data**: two notifications for potentially one frame
count as two, and a notification delayed into the next interval counts there.
These are counterexamples to interpreting that tool as a unique-frame
collector, not observed TR2 duplicate/delayed completions or game rates.

The required live collector qualification cannot proceed without an actual
owning graphics endpoint. Completion duplication/delay, owning-frame clock
association, content-change discrimination and observer overhead remain
unqualified. No collector was armed, no three warmed 10-second gameplay windows
were collected, and no interval median/p95 or rate is reported. Queued,
completed, composed, content-change, logical FPS and physical scanout rates
remain unknown. The optional matched software D3DIM run was not attempted.

## Runtime identity and evidence checks

Staged published-main source is
`0a38cf48438096482d059c5d8f27c048474c83b9`;
relevant worktree diff is empty. Runtime pins retain individual Git blob
identities and existing untracked-source/helper patches. Actual guest Worker
`B5D5871013212A1FF7DFB33873FD3089`, endpoint 1, slot 0, yields Wasm SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`,
2,182,452 bytes, matching served bytes at all four checkpoints. This existing
module was reused; no fresh build is claimed.

Chrome is 151.0.7922.108, V8 15.1.206.16. Native screenshot dimensions are
945×889; guest canvas 640×731, CSS rectangle 605×691 at (10,160). All 596
staged input pins remain unchanged in the cleanup checks; 173 successful HTTP
reads and four recovered host-source reads match pinned bytes. Four non-200
HTTP responses and Chrome's environment diagnostics remain raw. All four
original PNGs pass chunk CRC and IDAT inflation. Media are referenced by
existing paths and SHA-256, including the unchanged registered three-path TR2
closure; no source tree or media archive was made.

Owning render module/context/backend are **not-created**. Adapter errors,
fallbacks and GPU completion counts are unavailable, rather than zero.
Physical GPU is unknown; the requested WebGL selector establishes no physical
hardware identity. No exact page-to-OS-renderer PID mapping is claimed.

## Retrieval and delegated stop

A persisted fresh UUID Idempotency-Key created only **bx_arw2e4cn**. Independent
normal/watchdog delegates were observably armed before allocation, with the
unchanged 25-minute deadline **06:12:55.394 UTC**; initial box expiry was
**06:12:55.578 UTC**. No old-box resume, delete, nested worker or public deployment
occurred. Sampled local free disk stayed above five billion bytes; no continuous
minimum or RAM gate is claimed.

Chrome exits normally at **05:49:47.411 UTC**, code0/signal null. Both cleanup
checks show HTTP/CDP ports refusing and profile/writer absent, but the controller
PID is still present. **Full process drain before stop is not proven.** Both
failed assertions remain in evidence; no software launch followed them.

All **63 remote artifact references, 56 unique payload hashes**, were retrieved
and independently reread for size/SHA-256 at **05:50:00.856 UTC**, before normal
stop. Unique captures, logs and executed modules are retained. The independent
normal-stop delegate then requests shutdown. Final state is **archived**, active
expiry null, stopped **05:50:02.610 UTC**. Receipt
**stop_c17945f526512ba2** completes **05:50:02.638 UTC**, `forced=false`,
`error=null`. Both delegates exit0; supervisor children are empty. The box is
not left running.

Next work is a separately scoped investigation of native Graphics publication
loss, followed by ordinary OK → Venice and current-module control review. A
collector must then prove owning-frame association and overhead before three
ordinary-clock windows can answer the owner rate request. Full27, backend
parity, audio, full-level completion and logical FPS remain open.
