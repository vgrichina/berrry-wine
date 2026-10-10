# Delta Force (demo, NovaLogic 1998, software renderer)

`test/binaries/win98-games-a-d/Delta Force-demo-SWonly/` — the InstallShield 5
`SETUP.EXE` + `data1.cab` distribution; `installed/` is the tree that setup
wrote in the emulator. App id `delta_force_demo` mounts it at `C:\DFDEMO\`
(`dfdemo.exe`, `netsock.dll`, `df.pff`, `df.cd`).

Imports: KERNEL32, USER32, GDI32, ADVAPI32, WINMM, DSOUND, DDRAW, DPLAYX,
WSOCK32, ole32 and NovaLogic's own `netsock.dll`.

## Route to gameplay (CLI)

```sh
node test/run.js --app=delta_force_demo --no-build --quiet-api --quiet-blocks \
  --no-close --stuck-after=0 --max-batches=860000 \
  --input=400000:mousedown:318:438,400100:mouseup:318:438,\
600000:mousedown:320:162,600100:mouseup:320:162,650000:tick-ms:5 \
  --png=out.png
```

- ~400k batches: CHOOSE SOLDIER (Blackhawk); `ACCEPT SOLDIER` at (318,438).
- ~600k: MAIN MENU; `SINGLE PLAYER GAME` at (320,162).
- ~750k: mission 1, first person, HUD (`WP: CP ALPHA (76m)`, M4 burst mode).
- Mouse-look is WM_MOUSEMOVE relative to the window centre: every pass of the
  main loop peeks the mouse range and calls `SetCursorPos(320,240)` to
  recentre. `mousemove:320:330` repeated looks down; Up/W (both `keydown` and
  `di-keydown`) walks forward. Within ~70k batches the player passes CP ALPHA
  (waypoint becomes CP BRAVO) and is shot.

Evidence: `scratch/runs/20261010T0310Z-delta-force-demo-gameplay/`.

## The in-game freeze is the headless clock, not the emulator

At the default 200 ms of guest time per batch the first in-game frame never
changes. The main loop is a fixed-timestep simulation: each pass polls
(`PeekMessageA` remove, `PeekMessageA` mouse range, `GetClientRect`,
`ClientToScreen`, `SetCursorPos`), then runs ~7 batches of simulation
(hottest blocks `0x4329c3`, `0x431bf9`, `0x4485fa`), with no clock read and no
draw in between -- 1465 passes over batches 780k..790k, nothing else. One
simulation step costs about one batch, the batch grants 200 ms, so the
simulation never catches up and the frame is never presented. Switching the
clock to 5 ms/batch once the mission loads (`tick-ms:5`) and the game draws
every frame. On real time (the browser) this is a speed question, not a hang.

Not the cause, ruled out:

- The sound thread T1 (a self-patching mixer at `0x48c1xx`, placeholder
  immediates `0x12345678`/`0xfedcba98` in the file) is patched by 300k
  (`dump-mem` shows real immediates) and keeps alternating between the mixer
  and its API thunk -- unlike Comanche Gold, the same engine family, whose
  first mix ran before the patch (comanche-gold-demo.md).
- The 2026-10-06 logo-loop stall under the empty-PeekMessage spin detector no
  longer reproduces on main: with and without `--no-spin-park` the run
  reaches CHOOSE SOLDIER in 90 s. The WIP branch
  `claude/deltaforce-20261006` (spin work threshold) is not needed.
- The 6.7M code-page invalidations at exit come from T1's per-mix patching;
  they cost time but drop few blocks (3825 retired).
