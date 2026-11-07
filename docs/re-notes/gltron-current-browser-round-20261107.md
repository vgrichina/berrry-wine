# Current-main original GLTron browser rounds, 2026-11-07

Original GLTron reaches its menu, ordinary START GAME, a living cycle and
native steering on both requested **software GL and WebGL**, run serially in
one fresh box. Both routes acknowledge a live S turn: direction **3 → 0** and
trail offset **0 → 1**, with winner -1, pause 1 and speed 8.5 before and after.
Personally reviewed after images show the yellow trail bending beside the
cycle. This establishes bounded browser round gameplay after `ac1bcecee`;
it does not establish renderer parity, physical GPU performance, FPS, audible
quality or full 27-title coverage.

Evidence: `scratch/runs/20261107-gltron-current-browser-round/` (ignored).
No production source was changed. This was one bounded worker task, without
nested workers, guest-state/configuration edits, forced rounds, clock changes,
private game handlers, frozen stepping or counter arming.

## Runtime and actual ownership

The tested source is main **`f676b9335b432a8e0e21b35d6ce836360819c2c8`**,
which contains `ac1bcecee`. `relevant-source.patch` is empty; the existing
untracked `lib/wininit-boot.js` is preserved separately as a new-file patch.
The actual browser compilation and instantiation both report module SHA-256
**`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`**,
2,182,500 bytes. The identical retrieved module is retained.
`lib/host-audio.js` is SHA-256
`e2ae7f782e7fbeb246471acfb3a93d7ae80eec9b195e44f02072310e81373d15`;
`host.js` is
`f8611a65d9f216c1c8c3c2a185715badd9442b273d770b156fef55e42a565766`.

Both ordinary registered `APPS.gltron` launches use all 92 original files
(4,968,893 bytes), with the original EXE SHA-256
`85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec`.
Media paths, sizes and hashes are in `media-refs.json`; media was not copied
into evidence. Every one of 234 served file reads per route matches its pins,
including all 92 originals. Production/media pins are unchanged after both
runs. The software seal has 720 files; the WebGL seal adds three run helpers.
One external WebGL reader helper was revised to include device ownership
fields after page launch; its exact old/new hashes are explicitly recorded in
`retrieved/postflight.json`. No production/media file changed with it.

Chrome is **151.0.7922.108**, Node **v24.22.1**, Puppeteer **24.37.2**.
Both pages have `WINE_THREADS=false`, no guest Worker, cooperative thread
backend, actual CPU thread 1, visible/focused screen, `frozen=false` and zero
host steps. Normal production elapsed-time scheduling and audio were used.
The diagnostic frozen-status tick field does not mean frozen mode was enabled.

| Requested route | Actual owning renderer/context | Round evidence |
| --- | --- | --- |
| Software GL | Main `GLRenderHost.Bridge.local` / `OpenGLHostBridge`; owning exports match actual CPU exports; context 1 has `software=true`, `gl_sw_enabled=1`; no WebGL context | Reviewed main/GAME menus, paused arena, living cycle/trail, native live S turn, crash/winner and ordinary Enter restart |
| WebGL | Main `OpenGLHostBridge._webglBackend` is `WebGLBackend`; its `.gl` is the observed WebGL context; current context 1, owner/context map `[[0,1]]`; owning exports match CPU, `gl_sw_enabled=0` | Reviewed main/GAME menus and confirmed paused arena, native unpause and live S turn, changed yellow trail, original PLAYER 3 WINS result |

The WebGL context reports WebGL 1.0 / OpenGL ES 2.0 Chromium and
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
This is browser-reported context identity. The toolbar's WebGL label was also
visible during the software run and is not used for GL backend attribution.
The additional empty, nonmatching bridge belongs to the cooperative sibling;
it is not substituted for the matching main render owner.

## Reviewed gameplay and ordinary controls

Software captures `retrieved/software/startup.png`, `game-menu.png` and
`arena-paused.png` establish the main menu, GAME/START GAME and the original
paused arena. Each dependent Enter followed personal review of the preceding
scene. `living-before-turn.png` shows the moving yellow cycle and its new
straight trail, without the pause message.

The first human-paced A/S attempts were acknowledged but their subsequent
captures show crashes. They are not claimed as surviving steering. Ordinary
Enter restarts are retained, including the original WINNER: 4 result. A final
prompt native Enter/S sequence then samples only the existing original player
layout through `guest_to_wasm`, reusing `readLiveState` from
`tools/gltron-logical-fps.cjs` without importing or arming its counter code.
The original executable/layout controls are reused unchanged.
`native-steering-result.json` proves the live direction/trail transition.
`steer-live-after.png` visibly shows its yellow corner. Old crash/winner text
persists across software restarts, so text overlays alone are not used to
identify player liveness. The external Puppeteer connection changed the
software viewport from 1200×900 to its 800×600 default; this is recorded in
the captures and is not a rendering comparison.

WebGL `webgl-startup.png` and `webgl-game-menu.png` establish its separate
ordinary launch. The first capture named `webgl-arena-paused` still showed
old menu pixels; no dependent input used it. The later personally reviewed
`webgl-arena-confirm.png` shows GAME IS PAUSED and the yellow cycle. A native
Enter/S sequence unpauses and turns only after the read-only live-player
guard passes. The before capture still retains pause pixels despite its
live guest sample; the after image visibly shows an unpaused cycle and bent
yellow trail. `retrieved/webgl/native-steering-result.json` supplies the
matching live transition and actual WebGL device/context identity.
`webgl-round-result.png` was personally reviewed and shows PLAYER 3 WINS.
This connection preserves the existing 1200×900 viewport.

All 10 software and four WebGL native key pairs have trusted screen-targeted
DOWN/UP events, with no held keys at termination. Both helpers release keys
in `finally`; the route owners also perform normal physical release during
closure. Every actual command ACK succeeds. Neither original route has an
UNKNOWN command or runtime first-fault record; no uncertain input was replayed.
No five-second measurement handoff or rate interval was used.

## Setup boundaries and verification

Two pre-Chrome pin checks caught npm replacing a staged CLI dependency and
the package lock. Their failures are preserved. Browser dependencies were
isolated outside the staged runtime and all staged pins restored before
Chrome. The first Chrome attempt then exposed a helper mistake: GLTron was
absent from the local selector, selection silently fell back to Notepad, and
that unrelated load failed. Its selector, logs and zero-exit normal closure
are preserved under `pregltron-picker-failure`; no GLTron executed there.
The helper now exposes the existing registered GLTron entry as a local DOM
option and asserts its selection before clicking the ordinary Launch button.
No app registration or guest configuration was changed.

A subsequent corrected-pin launch wrapper failed while writing its metadata
after spawning the driver (`selector` was undefined). That exact exception
is retained; the driver was observed running and was not launched again.
The resulting single software GLTron launch and later serial WebGL launch
are identified by their own browser identity records. These known setup
failures are distinct from input outcomes.

Local helper syntax and structural original-registration checks pass.
`unchanged-controls-verification.json` confirms **301 source/module pins**
identical to the preceding passed clock/audio/callback investigation; those
controls and fixture hashes were reused rather than repeating the CLI census.
The existing module is unchanged and no code commit/build is required for
this documentation-only result. Git SHA, relevant diff, untracked source
patch, owned helper patches and dependency/media/module pins provide recovery
without a source-tree or media archive. GLTron has no candidate-manifest entry,
so this remains an investigation note rather than an unrelated dashboard card.
Own-scope evidence and whitespace checks pass. The global evidence checker
reports seven existing containment errors in other runs, none in this run.

## Retrieval and shutdown

All **150 artifact references / 143 unique contents / 12,750,040 referenced
bytes** were retrieved and size/SHA-256 verified before requesting normal
box shutdown. Both guest browsers exited zero with null signal: software
Chrome **20791**, WebGL Chrome **23907**. Both PIDs are absent, their HTTP
ports **40135/34299** refuse connections, no owned browser-driver/profile
process remains, and the owned profile was removed after those checks.

The detached independent 25-minute watchdog and normal-stop delegate were
armed and observed before allocation, with durable heartbeats and immutable
deadline records. Both delegates exit zero, the supervisor has no remaining
children, and maximum watchdog heartbeat gap is 0.782 seconds. The local
messageboard watcher is stopped. Launch disk exceeded 5 GB locally and remotely; there was
no RAM gate. Normal stop followed verified retrieval promptly, without idle
handoff. Box **`bx_xqjv9b99`** is **archived**, current expiry null; original
expiry was **2026-11-08T00:04:54.488Z**. Stop
**`stop_65b0a62f9f1a65d6`** completed **2026-11-07T23:50:22.632Z**,
`forced=false`, `error=null`. No resume, delete, source archive or public
deployment occurred. This task ends with the two bounded gameplay cells;
any longer survival, visual-defect repair or broader qualification is separate
future work.
