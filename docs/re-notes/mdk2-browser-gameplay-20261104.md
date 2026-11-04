# MDK2 original browser/WebGL control — 2026-11-04

**Result: reviewed original browser/WebGL tutorial movement and reversible sniper mode.**

This task repairs the first production launch blocker: the existing `mdk2_demo`
registration and HTML option were absent from the selector catalogs. The normal
selector initializer removed the option, including with `?candidates`. One
localhost candidate catalog row now exposes MDK2 through the ordinary selector
and Launch button. The existing proprietary-dropdown regression includes MDK2;
the callback census seal was reviewed and updated without changing ownership.

Evidence: `scratch/runs/20261104-mdk2-browser-gameplay/` (ignored). Dispatch
baseline was `f8e3a295e39425b36ac857fb7ed1fd51200715d0`; actual runtime Git
source was `625be68f9c2b685797a81f837992f4421d469f16`, fetched directly from
Git, plus the recorded selector/test patch. Foreign shared-checkout WIP was
excluded. Git plus relevant binary diffs is the source archive; no source-tree,
scratch, docs or game-media archive was created.

The coordinator's explicit MDK2 release followed the DeusEx shutdown. Fresh
box `bx_j37q6y9a`, TTL 3600, expiry `2026-11-04T01:45:50.694Z`, was recorded
before execution. Shutdown belongs to the coordinator; the worker leaves this
box running and recoverable and does not stop, delete or resume it.

The original 29-file media pin was checked before launch. Executable SHA-256:
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
Manifest: `a0c90df1480e9e81c5734dca97a8e8b308c3709e87964433fe1f4df5875c6316`.
Original 88-byte configuration:
`87261f003683d21f366e28e3c37c89d85804e69daaa2348b17da15bfe8e902ba`.
Only required original media was transferred into the runtime. No game,
configuration, mandatory check or guest memory was patched.

The browser actually compiled and instantiated canonical module
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
The main-realm observer links that compiled object to each Worker transfer;
receiver observers link the received module object to actual instantiation in
both guest workers and the render worker. Receiver SHA fields are null because
the structured-cloned module cannot itself be hashed there; identity is linked
through the sender's hash, target URL/slot and received-object reference.
Compatibility module:
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
Both runtime modules were recovered and fully hashed. A fresh locked local
build produced exactly these module hashes.

The owning `lib/d3d-render-worker.js?v=dev` endpoint reported `api: gl`,
`backend: webgl`, native worker OffscreenCanvas WebGL1, provider
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
This is actual WebGL rendering, with inspected game pixels and owning-context
observations, rather than acceptance based on the dropdown or queued input.
The prior native-provider context-zero result remains environmental evidence.

Initial run-only driver failures are retained. A missing candidates flag first
left Notepad selected and produced its missing-media failure; the corrected
fail-closed selector check then exposed the production catalog omission.
After the catalog repair, an incomplete HTTP seal omitted `src/api_table.json`.
The final launch included all required tracked source seals. It began at
00:50:22Z, with an immutable twenty-minute browser deadline. Early gray/black
startup captures do not establish renderer failure: subsequent menu and 3D
cutscene captures contain real game rendering.

An observational preload was incorrectly applied to an AudioWorklet and threw
`ReferenceError: addEventListener is not defined` at completed batch 2960.
The original control driver halted and preserved this first failure. A bounded
controller reattached to the same browser, skipping unsupported worklet
observation; no game relaunch or guest-state writes were used. The first
resume helper used an unavailable Puppeteer method and failed; the corrected
method found no remaining worklet targets. Reattachment changed the viewport
from 1200×900 to 800×600; later comparisons use that same viewport. These
harness failures and continuation are retained, not represented as a clean
uninterrupted driver run. The original twenty-minute deadline stayed in force.

Reviewed ordinary startup route:

- 3472: readable main menu, New Game selected.
- Enter held 16 batches, released, then 32 batches: Medium highlighted at 3520.
- Enter held 16 batches and released: original Hectic comic loading screen.
- 14544: original comic intro, after prolonged loading with an active file worker.
- Escape held 16 batches, released: in-engine dialogue visible at 15200.
- Escape advanced to the Jim Dandy title card at 15728.
- 20608: Kurt falling through the sky; 21392: minecrawler doorway.
- Another ordinary Escape was followed by a black transition at 22176.
- 24224: Aboard the Alien Minecrawler, Edmonton, 9:05AM title card.
- 27296: tutorial room, Kurt and health 100, introductory dialogue.
- Up held for 64 batches, released, then three batches: Kurt moved forward
  from the platform edge toward its center at 27363; floor/platform geometry
  shifted relative to him and the movement tutorial appeared.
- Space held 16, released, then 67 further batches: the tutorial dialogue
  disappeared at 27446; this is not counted as sniper mode.
- Space held 32, released, then 32: first-person reticle and **Sniper Bullet**
  HUD at 27510 establish actual sniper entry.
- The next Space sequence coincided with another tutorial dialogue at 27574;
  the view still showed the sniper frame. A subsequent Space advanced that
  dialogue at 27638. Neither capture is called a completed mode reversal.
- Space held 32, released, then 96: third-person Kurt restored at 27766.
  Capture names `sniper-off-27574` and `third-person-27702` were intended
  outcomes, not conclusions: inspected pixels still showed sniper mode there.
- Down held 64, released, then three: Kurt moved backward toward the platform
  edge at 27833. Before/after platform geometry and player displacement were
  inspected; this is complementary movement, not input queue acceptance alone.

The final Down sequence was issued in one sequential controller invocation;
its preceding capture was inspected immediately afterward alongside the final
capture. Earlier Up/sniper decisions used captures inspected before the next
input. No shooting or jumping was attempted.

All frozen requests are sequential and individually acknowledged, with at most
64 completed batches per request. Browser keyboard events are ordinary trusted
DOM input, with separate queued input and subsequent game-response evidence.
The software CLI control result `081a33477` was not rerun as a substitute.

Validation: `node --check lib/apps.js`,
`node test/test-local-proprietary-demo-dropdown.js`,
`node test/test-app-selector-options.js`, `node tools/callback-ownership-census.js`
(414 entries), and `flock /tmp/wine-build.lock bash tools/build.sh` passed.
The first build correctly rejected the old catalog seal before its reviewed
update; that failure log is preserved alongside the passing build log.

The transcript verifies 449 completed step requests, maximum 64, totaling
27833 completed batches; all 28 observed keyboard events were trusted.
Every key had a browser key-up at the terminal capture, but the final window
WM_KEYUP for Down remained queued after three settling batches. This is not
claimed as complete terminal message drainage. Movement and sniper response
are established by the inspected before/after pixels and completed steps.
The compatibility module was recovered and build-checked, not executed as a
second original-game browser run.

The immutable timer closed Chrome normally at 01:10:24.478Z, exit 0, signal
null, immediately after the last capture. An ordinary quit command submitted
at the deadline received no reply because cleanup had begun; its missing-reply
failure is retained and was not retried. Final state and cleanup receipts were
recovered independently; no ordinary-quit acknowledgement is claimed.
All 29 original media hashes matched again locally and on the runtime.
Recovery includes 740 files (13,502,945 bytes): each unique failed-attempt
log/capture, the active browser transcript, final state and both runtime
modules, all verified by full SHA-256.
No public deployment occurred. The bounded result does not establish complete
visual correctness, shooting/jumping, WebGL2 original-game coverage, or the
historical corpus's unresolved exact 27-ID membership.
