# TR2 original WebGL gameplay — 2026-11-07

**Reviewed original Venice captures establish forward displacement, a small
left turn, weapon draw and a visible firing response through the owning WebGL
Worker.** No emulator or driver defect was demonstrated; no production code or
guard changed. This is bounded single-title gameplay evidence, without a
full27, backend parity or release-quality claim.

Evidence: `scratch/runs/20261107-tr2-webgl-gameplay/`. One original on fresh box
`bx_hpyypnnr`, created with a persisted UUID Idempotency-Key. No old403 resume,
second original, UNKNOWN replay, nested worker, public deployment or original
guest/config/save modification occurred. Source and build access was read-only,
announced to Lords2 and Aranna; no local browser/emulator/build lane was used.

The production URL was
`index.html?debug&threads&d3d-renderer=webgl&app=tomb_raider_2_demo`.
Original launch began at 03:48:52 UTC. Native COMCTL32 Graphics options showed
Hardware 3D Acceleration, Z Buffer and Full Screen 640×480 High Color. The
ordinary OK click reached the textured Venice slope and lattice window.

Each scene-dependent input followed prompt personal inspection of its current
capture, passed the unchanged 12-second scene guard and received a complete
numbered ACK:

- `review/venice-idle.png` shows Lara in the initial arms-out falling pose.
  Left 1200 ms followed by 4500 ms produces `turned.png`, standing generally
  toward the slope. That first action alone does not establish turning.
- Up 1800 ms, then 5500 ms without input, produces `forward-settled.png`.
  Lara stands farther uphill: the left brick edge shifts left and the lattice
  is closer. The settled spatial change establishes forward translation.
- Left 1800 ms, then 4000 ms, produces `turned-settled.png`: a small leftward
  orientation change, visible in Lara's head/body profile and the lattice
  shifting right. No angle or turn speed is claimed.
- Space 1200 ms, then 5000 ms, produces `weapons-ready.png`, with visible dual
  pistols raised beside her head and a health HUD.
- Control 1800 ms, with no post-release wait, produces `fire-response.png`:
  an extended pistol, yellow muzzle flash and brighter nearby walls. The later
  `sustained-end.png` returns to the raised ready pose and darker lighting.
  This establishes firing animation/lighting response; no target hit, damage,
  kill, ammunition accounting or audio was evaluated.

All eight original commands, including the input-free capture and ordinary quit,
have complete ACKs. There were no stale refusals, terminal gameplay blockers or
partial/UNKNOWN actions. Generic cleanup text `pending:'UNKNOWN; never replay'`
is template wording, not an action outcome.

Before the original, nine atomic transport controls, seven executor/recovery
controls, production-renderer/DirectInput key controls, invalid-duration controls
and remote native COM ABI checks passed. Trusted browser keydown/keyup pairs
qualified Up, Left, Right, Space, Control, Enter and Escape. Invalid holds cause
zero events; valid holds remain 50–2000 ms. The generated native COMCTL property
sheet and its ordinary OK dismissal were personally inspected. Boids qualified
an actual healthy WebGL owner with advancing natural counters. All setup
processes, ports, profiles and writer locks were verified gone before original
launch, with a fail-closed launch assertion. Two premature setup capture reads
failed before their files existed; both records are retained. Neither dispatched
input, and no original had started. A later completed capture was inspected.

## Actual renderer, source and module

The actual render Worker target is `D012B8399766B9DD05BF0E97103E1A7A`, endpoint 1,
`{api:'legacy',backend:'webgl'}`. At the final capture its adapter is present,
failed=null, ready=1, error=0, completed sequence=958, batches=637 and
commands=55195. Returned owning-endpoint statistics report 54348 draw calls,
errors=0, fallbacks=0, software completions=0 and fallback-software completions=0.
These are sequential identity/counter samples, not atomic pairs.

The owning GL context reports WebGL 2.0 and:

`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`

Chrome is 151.0.7922.108; viewport 1024×768, game buffer 640×480. Both live guest
and render Workers supplied Wasm SHA-256
`2f9fd9f5fb1841afe68f47f61d9870ea617a73f2c45253cbf662c2479b723e55`
(2181694 bytes). All 23 executing JavaScript sources from those two Workers
match staged file bytes. Staged source commit is
`7d0f110dd67bbc80275b9b749bd2ecf455721a19`, with relevant dirty/new-source and
owned helper patches retained. Existing modules were reused; no fresh local
build is claimed. Git plus recorded patches is the source archive.

All 626 serving/helper pins match remotely before launch and after exit. All
173 successful original HTTP responses match pinned bytes; five non-200
responses remain in `http-audit.json`. Existing media paths and hashes were
verified, including:

| Path under `test/binaries/` | SHA-256 |
|---|---|
| `candidates/tomb-raider-2-demo/game/TOMB2.EXE` | `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa` |
| `candidates/tomb-raider-2-demo/game/DATA/DEMOPC.DAT` | `e1bdd5776e1946420e0eeb9e1a4da12f16ea2bbfb7c3909b414372b100ff51bd` |
| `candidates/tomb-raider-2-demo/game/DATA/BOAT.TR2` | `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e` |
| `dlls/comctl32.dll` | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4` |

Inputs were transferred individually for serving; no source/media archive or
repeated original media was placed in evidence. Upstream provenance and
historical native reference evidence remain unavailable.

## Sustained counters and cleanup

The input-free interval from 03:50:22.037 to 03:51:04.712 spans 42.675 seconds.
Natural snapshots show flip-enqueue records 92→157, GPU-to-DIB readback
completions 91→156, CPU/DIB-to-GPU uploads 92→157 and draw calls 31880→54348.
Errors and fallbacks remain zero. Flip records are counted before owner
completion; readbacks, uploads and Worker command completions do not identify
unique guest frames or browser compositions. **Unique guest FPS, displayed FPS,
logical update rate and frame-time distribution remain unknown.** No separate
measurement system or frame discriminator was installed.

All 162 inventoried remote artifacts were retrieved or matched to retained
identical bytes, with duplicate modules mapped to a unique retained file.
Chrome exited normally, code 0, at 03:51:12 UTC. The independent 03:51:25 check
confirms six tracked processes absent, six ports refusing, all three profiles
and writer locks absent. The local messageboard watcher was stopped; no local
runtime was launched. Observed free disk stayed above 2 GB.

Explicitly delegated normal stop `stop_9b62ebf25e35477b` completed at
03:51:47.699 UTC, forced=false, error=null. Box state is archived, active expiry
null; initial expiry was 04:47:15.673 UTC. Allocation through completed stop took
about 272 seconds, inside 35 minutes. No automated risk flag or held-risk retry
occurred. Publication and validation precede `result.json`, written last.

Next work, if separately requested, can assess longer traversal, targets and
qualified unique-frame performance. This worker stops after publishing these
findings; no implementation repair is warranted by this run.
