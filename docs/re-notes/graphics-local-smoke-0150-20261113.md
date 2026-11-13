# Local GLTron software-GL smoke, 2026-11-13

One original-app execution reached the original main menu, GAME menu and
640×480 arena with a yellow cycle, grid, minimap and `GAME IS PAUSED`.
No production crash was reproduced in these observations. No runtime source
was changed. Later movement and unpause remain unproved.

Evidence: `scratch/runs/20261113-graphics-local-smoke-0150/` (ignored).
The tested Git base is `8ca2c377d` (full SHA in `source-pins.json`), plus the
recorded relevant tracked binary diff and untracked `lib/wininit-boot.js`
addition patch. All 1,617 source paths have by-path SHA-256 pins. The existing
2,189,863-byte module is SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The 92 existing GLTron media paths were hashed without copying or staging;
all registered sizes and SHA-256 pins matched. Node was v24.18.1.

## Selection and reused results

The [native16 edge investigation](native16-roof-edge-20261111.md) identifies
its earlier white roof as a fixture lacking texture selectors; its actual COM
route regression, native16 snapshots and focused renderer checks already passed.
It also records a separate malformed SetSurfaceDesc fixture, without proving
a production defect. The [MW3 notes](mechwarrior3-demo.md) record completed
shared-writer attachment repair `29f6295a2`, synchronous Flip witness
`2aa8833a4`, later composition admission repair and native16 error-query repair
`b54b1cbf8`, including focused regressions and locked builds. Those results were
reused without matrix reruns. The later Forsaken unsaturated whitening trace
in the corpus status matches the sampled actual GL/native565 transition;
it does not justify a speculative blend repair. Heretic II guest internals
were not inspected. No reproducible open local production case emerged from
these notes, so the task's single-smoke fallback was used.

## Exact local route and observations

`smoke.py` launches the existing production `test/run.js` with:

```sh
node test/run.js --app=gltron --no-build --no-threads \
  --gl-renderer=software --real-ticks --batch-size=200000 \
  --max-batches=1000000000 --max-seconds=90 --quiet-api \
  --quiet-blocks --gl-census --control-stdin --png-canvas --png=RUN/final.png
```

An independent GNU timeout process was prearmed for 110 seconds, with TERM
and a five-second KILL fallback. `deadline-armed.json` and `launch.json`
record its exact command and PID. No private API, browser, box, media staging,
guest memory/configuration writes or synthetic clock adjustments occurred.
Real ticks follow the previously exercised local GLTron route.

* `menu.png`, batch336 / guest-ms4808, is an initial black frame.
* `scene.png`, batch468 / guest-ms12793, shows the original main menu.
* Enter down at batch606 and up at665 opens GAME; `game-menu.png` at774 /
  guest-ms32005 shows START GAME selected. This first manually released pair
  was longer than the later timed pair; no precise held-duration claim follows.
* Enter down at902 and up at906 selects START GAME. The independent release
  timer was armed before down; `start-pair.json` retains its timestamps.
* `arena.png`, batch943 / guest-ms47550, shows the paused original arena.
  All four captures were visually inspected. Menu navigation is demonstrated;
  gameplay motion, steering and round outcome are not.

## Harness failure and cleanup

The new run-local supervisor used a polled `request.json` file. A later
publisher opened that file before writing its JSON; the supervisor read the
empty intermediate file and exited1 with JSONDecodeError. This is a concrete
evidence/control harness defect introduced in this run, not a guest or GL
runtime fault. Later A down/up and moving-capture requests have no ACK and
were not replayed. Future use must publish requests by atomic rename and retain
supervision on malformed requests. This run was not repeated.

After inspecting the failure, the worker checked the exact owned runtime
command and sent SIGTERM to PID860886 at 00:19:27Z, before the independent
deadline. The last acknowledged capture remains the paused arena. The runtime
had become orphaned when its supervisor exited; its actual exit status and
separate stream EOF are unknown. `supervisor-failure-and-stop.json` preserves
that limitation. A subsequent process check found timeout860885, runtime860886
and board watcher860884 all absent. No final PNG or full GL census was obtained.

Box ID: none; state NOT_CREATED; expiry null; box stop receipt N/A.
No preexisting box was touched. Only this note is committed; evidence retains
the exact executed helper as an addition patch, source diffs, hashes, raw logs,
input ACKs and inspected captures. No source or media archive was made.

Next: correct atomic request publication before reusing this local helper.
A separate future original-app investigation should start from a reproducible
production failure; this smoke provides no basis for a rendering change.
