# Original registered Mad Bomber: catch and score qualified

On exact main `72e7a30d6e36df896eb25007b6139d750e715720`, the ordinary
registered `--app=madbomber` route reaches One Player, drops bombs, moves
buckets with mouse input, catches a bomb with a visible blue splash, and
advances the score from 0 to 1. No runtime blocker occurred in two bounded
60-second runs. This qualifies the requested bounded gameplay/catch/scoring
behavior, not full-game completion, sustained play, browser, FPS, or audio
quality/synchronization.

## Observed behavior

Run 1: 2026-10-21 16:31:20.773–16:32:21.091 UTC (Boat command
`cmd_l0hcin8zdr4w`). The 3-second capture shows the menu, 5 seconds shows
the score-0 playfield after Enter, and 8 seconds shows multiple falling
bombs and buckets moved from the left edge to the center. The predetermined
mouse path misses the bombs, loses a bucket, and stays at score 0. No scoring
acceptance is claimed from this run.

Run 2: 16:32:34.163–16:33:34.523 UTC (`cmd_ld480wv6ceuc`). The second
ordinary input plan places buckets at x=532 before Space starts the bombs.
At 7.8 and 8.2 seconds, the score is 0 and bombs descend toward the buckets.
At 8.5 seconds, blue splash pixels appear above the top bucket beneath the
bomb previously visible near x=546. At 9 seconds, the score is visibly **1**
and the buckets have moved to x=408; at 10 seconds they are at x=346 with
score 1. Other bombs were missed, and Game Over appears by 30 seconds.
The controller's 8.5-second move and capture are adjacent asynchronous
commands; the image still shows the previous bucket position. The image and
acknowledged input log are the evidence, not an assumed instantaneous move.

Both processes exit 0 through the normal CLI bound, without controller guard
termination. Postflight confirms both process groups absent. Inputs are only
ordinary balanced Enter/Space key pairs and mouse moves. No guest memory or
state edits, patches, replacement EXE, bypass, or stubs were used.

## Source, build, and assets

All 7,451 exact-main Git blobs verified before and after execution, with a
clean remote Git status. Module SHA256:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`
(1,878,508 bytes). The preserved canonical module was reused, not rebuilt.
Its build source `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`, source
manifest, successful canonical build log/exit, and module match prior seals.
Complete build-source/current-source manifest comparison proves identical
production and build inputs. Differences are docs/evidence/status and the
unrelated Army Men observer/test files; neither is loaded by this route.

Fresh cheap canonical gates pass: CLAUDE size, WAT manifest, fragment balance,
and WATX compiler provenance (23 required files). The three Mad Bomber corpus
registration tests pass. These are source checks, distinct from the observed
gameplay. One initial invocation mistyped the provenance script name and
failed MODULE_NOT_FOUND; the correct canonical script then passed. Both logs
are retained. No failing source gate was repaired or bypassed.

All 168 staged pins verify before and after: 140 original files, the original
support MSVCRT, and 27 boot assets. No closure item is missing or substituted.
Original archive SHA256:
`b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef`
(3,069,702 bytes), retained at the supplied local path without redownload.

| Asset | SHA256 |
| --- | --- |
| madbomber.exe | `72ad26d11ddabf72c668b69eda0c7c1daa634f5cade631303ba4e05eb5f5cc09` |
| SDL.dll | `55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410` |
| SDL_mixer.dll | `e48583f82cd4a503e6ed9097da51399b05e4c5b92e66566e3b180321c6647165` |
| msvcrt.dll | `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1` |

Environment: assigned Boat `bx_jh469zy9`, Linux x64, Node 24.18.1,
CLI headless renderer, cooperative `--no-threads`, 640×480, real ticks and
calendar. Remote lockfile installation and 2,395 actual dependency-file
hashes are retained. No browser, FPS, or audio quality claim is made.

## Evidence and handoff

Run folder: `scratch/runs/20261021-madbomber-current-main-gameplay/`.
`evidence.tar.gz` holds 63 sealed artifacts, including all screenshots,
timestamped launch/input receipts, logs, terminal/postflight records,
source/build/dependency manifests and tested module. Archive SHA256:
`22121970add638c66203d278b55ee734f668abf36a389cdec2c9c901298d673c`.
`verify.py` checks archive/seals, source equivalence, module, closure counts,
normal exits and ordinary input acknowledgements. `RECOVERY.md` gives exact
recovery paths and commands. Inspect `run2/sample-8.2s.png`,
`run2/sample-8.5s.png`, and `run2/sample-9s.png` for the catch/score sequence.

Remote source `/home/user/madbomber-source` and evidence
`/home/user/madbomber-evidence` remain intact. The SAME assigned box is left
RUNNING (API idle, health ok), expiry **2026-10-21T18:26:26.518Z**.
Coordinator owns shutdown and any subsequent task. No additional worker,
runtime owner, deployment, shared source/status/index/config edit, or main
merge occurred.

Local work used a sparse evidence-only task worktree, with full source and
dependencies remote. Shared free-space dips temporarily blocked local writes;
work resumed after actual recovery, without deleting unrelated data. A tiny
transport-helper write followed one failed admission check due to tool
sequencing; this deviation is disclosed, and subsequent writes used explicit
reserve guards. API transfer once returned 502; exact partial-byte readback
allowed continuation, then the complete archive hash verified. Neither event
was a guest runtime failure. Total task allocation remains below 64 MiB.
