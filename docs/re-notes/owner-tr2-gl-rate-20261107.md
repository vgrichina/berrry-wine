# Owner TR2 WebGL release check — 2026-11-07

**TR2 renders the Venice scene through its actual WebGL Worker, but this
attempt does not qualify ordinary gameplay, sustained rate, or release
suitability.** A fresh-capture review error ended the single original. No
emulator defect was demonstrated; no implementation or safety guard changed.

Evidence: `scratch/runs/20261107-owner-tr2-gl-rate/`. Owner Telegram172 requested
GL checks beginning with TR2. GTA2 and TR3 were not launched in this task.

## Terminal blocker

The production direct URL was
`index.html?debug&threads&d3d-renderer=webgl&app=tomb_raider_2_demo`.
The original began at 02:53:05 UTC. The personally reviewed initial capture
showed Graphics, Hardware 3D Acceleration, Full Screen 640×480 High Color and
Z Buffer. There was no render endpoint yet.

The first ordinary OK request was refused before dispatch: stale scene,
effects=0. A separate capture completed at 02:53:40 UTC. That fresh
`review/options-fresh.png` shows only the teal desktop, without the Graphics
sheet or OK. The operator nevertheless submitted an ordinary click with an
incorrect inherited description saying that Graphics and OK were visible.
This mismatch invalidates the input evidence. The original records remain
unchanged and `capture-reviews.json` explicitly corrects the description.
Whether the missing dialog in that capture reflects transient composition or
another cause is unknown; it is not an established emulator defect.

The complete click ACK produced `retrieved/original/venice-idle.png`, personally
reviewed after stopping input: Lara stands idle in the textured Venice alley,
with the slope and orange lattice visible. This establishes scene rendering.
No forward, turn, weapon toggle, combat or further gameplay input was sent.
No controlled stepping, second original or retry followed the blocker.

All four original queue commands have complete ACKs: one zero-effect stale
refusal, one refresh capture, one balanced click, and ordinary quit. There was
no partial or UNKNOWN action outcome and no ID replay. A complete ACK does not
repair the false review description or establish gameplay quality.

## Actual renderer and rate limits

Direct CDP inspection identifies render target
`C41962E58582DE9864B63032CA5B2722`, endpoint 1, legacy/webgl, adapter present,
failed=null, ready=1, error=0, completed sequence=140, batches=93 and commands=7816.
At the Venice capture, naturally returned owning-endpoint counters report
7439 draw calls, 9863 triangles, errors=0, fallbacks=0, software completions=0
and fallback-software completions=0. These samples are sequential, not atomic.

The browser GL renderer string from that endpoint is:

`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`

Version: `WebGL 2.0 (OpenGL ES 3.0 Chromium)`; Chrome 151.0.7922.108.
This reports the owning context, rather than inferring acceleration from a
toolbar. No separate GL-call instrumentation or physical-display measurement
was installed. Adapter statistics are closure-private; the generic direct
`adapterStats` field is null, while natural endpoint responses supply counters.

**Wall-clock sustained presentation rate, logical update rate and frame-time
distribution are unknown.** The attempt ended before a qualified sustained
sample. Draw totals and 21 reported transport flips are not FPS. TR2 has no
registered logical-frame marker in the staged app entry. No rate is calculated
from launch duration, scheduler slices, browser rAF or these cumulative totals.
The idle capture alone does not establish rendering parity or release quality.

## Qualification and identities

Before the original, nine atomic transport cases, seven actual executor/recovery
cases, seven production direct-initializer cases, production-renderer physical
key state and invalid-duration controls passed. Native CDP trusted balanced
Up/Left/Space/Enter/Escape pairs passed on a generated blank page. The unchanged
scene guard requires a current reviewed capture within 12 seconds; holds remain
50–2000 ms, with invalid durations rejected before effects.

On this fresh boat, production direct launch of Boids established a real guest
Worker and actual healthy legacy WebGL owner. Its naturally returned draw-call
counter advanced 335→469 and direct completed sequence advanced 40→49, with
fallbacks=0 and the same Intel renderer string. These are qualification counters,
not a Boids performance measurement. A separate generated PE loaded pinned
native COMCTL32, DllMain returned EAX=1, and the personally reviewed ordinary
tabbed property sheet dismissed with a balanced OK click. Both qualification
sessions were fully cleaned before the original.

Staged source commit: `0daaddf62c8013e57fdb94756d630f4acda349d7`.
Relevant dirty/new-source patches and owned helper patches are retained. Git
remains the source archive. Both actual original Workers yielded Wasm SHA-256
`07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e`
(2,181,179 bytes). This existing module was reused; staging HEAD is not asserted
to be its fresh build provenance. All 23 executing JavaScript sources from two
original Workers matched staged file bytes.

All 626 serving/helper pins match remotely before the original and after exit;
all 172 successful original HTTP responses match pinned bytes. Non-200
responses remain in `http-audit.json`. Fixture identity matches retained TR2
evidence, including the following existing files under `test/binaries/`:

| File | SHA-256 |
|---|---|
| `candidates/tomb-raider-2-demo/game/TOMB2.EXE` | `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa` |
| `candidates/tomb-raider-2-demo/game/DATA/DEMOPC.DAT` | `e1bdd5776e1946420e0eeb9e1a4da12f16ea2bbfb7c3909b414372b100ff51bd` |
| `candidates/tomb-raider-2-demo/game/DATA/BOAT.TR2` | `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e` |
| `dlls/comctl32.dll` | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4` |

No media/config/save file bytes were edited. Upstream provenance and historical
native reference evidence remain unavailable; local hash agreement does not
recover them. Individual serving inputs were transferred without source/media
archives. No local browser/emulator/source/build lane was used; only offline
helper controls and identity preparation ran locally. COM ABI qualification was
compiled and tested on the separate boat.

## Retrieval and completed stop

All 122 inventoried remote run files were retrieved or matched to retained
identical bytes; module duplicates share a retained file with explicit mapping.
The original Chrome exited normally, code 0, signal null, at 02:54:07.692 UTC.
The first cleanup sample caught its controller finishing exit; the independent
02:54:33 check confirms all six tracked controller/browser PIDs absent. All six
ports refuse connections; all three profiles and writer locks are absent.
The cleanup template's `pending:'UNKNOWN; never replay'` is generic wording,
not an UNKNOWN command outcome.

Fresh boat `bx_6fupqmmb` used a persisted, fsynced UUID Idempotency-Key.
Explicitly delegated normal stop `stop_c438906cecc10c99` completed at
02:54:38.459 UTC, forced=false, error=null. Box state is archived, active expiry
null; initial expiry was 03:50:38.331 UTC. Allocation through completed stop took
about four minutes, within 35 minutes. Observed local disk remained above 2 GB.
No automated risk flag, held-risk retry, old403 resume, nested worker or public
deployment occurred.

The next authorized TR2 attempt needs accurate fresh-scene review before every
ordinary action and a separately qualified sustained collector with explicit
counter semantics. This run supplies no release recommendation. Publication,
corrections and validation precede `result.json`, written last, then stop.
