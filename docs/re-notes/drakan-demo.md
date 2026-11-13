# Drakan: Order of the Flame demo (Surreal / Psygnosis 1999)

Registry id `drakan_demo`. Riot Engine, Direct3D 6 (DX6 HAL through D3DIM),
DirectInput keyboard and mouse, DirectSound. Fixture:
`test/binaries/win98-games-a-d/DrakanOrderOfTheFlameDemoD3D` (InstallShield 5
Disk1); the installed tree lives beside it in
`DrakanOrderOfTheFlameDemoD3D-installed/drakan demo` (65 MB).

## Install (headless)

The Driver recipe (docs/re-notes/driver-demo.md) unchanged:

1. `run.js --exe=.../SETUP.EXE --vfs-include='*' --tick-ms-per-batch=5
   --capture-launch=cap` -> `c:\windows\temp\_ins5176._mp`.
2. `run.js --exe=cap/windows/temp/_ins5176._mp
   --exe-guest-path='c:\windows\temp\_ins5176._mp' --vfs-tree=cap
   --tick-ms-per-batch=5 --control=PORT --frozen --save-vfs=inst
   --save-vfs-prefix='c:\program files'`: Next (410,394), Next, Next, Next,
   step ~550k batches of copying, untick README (238,202), Finish.

No emulator fixes were needed for the install or the game.

## Running it

- **Mount with `--vfs-tree`, not `--vfs-include`.** The engine builds every
  path from the directory of `drakan.exe`
  (`c:\program files\psygnosis\drakan demo\dragon.rrc`). `--vfs-include`
  mounts companions relative to `C:\`, so `dragon.rrc` fails to open and the
  game sits in its frame loop on a black screen forever -- a plain
  `PeekMessageA` loop with no rendering, which reads like an activation or
  D3D bug and is neither. The registered app gets the right paths from its
  manifest's `vfsPath`s.
- **First run opens "Riot Engine Options"** (a property sheet) and writes
  `HKLM\SOFTWARE\Surreal\Riot Engine\Settings100` (REG_BINARY, 92 bytes:
  primary display driver, 640x480x16, dithering, shadows, bilinear) on OK.
  The app's `startupRegistry` carries that value, so launches skip the sheet.
  [Original reader/writer inspection](drakan-original-startup-dialog-route-20261113.md)
  confirms `0x5c` bytes and corrects the earlier 84-byte description; the seed
  does not prove successful current device enumeration.
- A **"Drakan Beta Demo Warning"** message box comes up first every launch
  (`--input=40:dlg-cmd:1`).
- dragon.rfl is the game-logic DLL (base 0x10000000), loaded with LoadLibrary
  by the engine; dragon.rrc / music.rrc are the resource containers.
- Input is DirectInput: menus need `relmousemove` + `di-mousedown`/`di-mouseup`
  (window mouse messages do not move its cursor), and play uses
  `di-keydown`/`di-keyup` (37 Left turns, 38 Up flies forward).

Route (CLI, cooperative, default tick): Direct3D intro logos by ~30k-60k
batches, main menu by ~90k, New Game is `relmousemove:-6:-75` from the menu's
starting cursor, Normal is `relmousemove:-2:69` from there, level 1 (riding
Arokh in the rain, an enemy walks up) ~230k batches later.
Evidence: `scratch/runs/20261006T1600Z-drakan_demo-gameplay`.

## Named addresses (drakan.exe, base 0x400000)

- `0x410a97` main loop: PeekMessage keyboard range, mouse range, then any;
  calls the frame `0x4078b0` every pass.
- `0x4078b0` frame: `[0x476fd0]` is a state word (0 at WinMain init,
  `0x407bf0` sets it, shutdown `0x410cf0` clears it); with it 0 the frame only
  draws a resource image through `0x40f990` when `[[0x47b660]+4]` is set.
- `0x407bf0` set-state; `0x410cf0` shutdown (set-state 0, PostQuitMessage).


## October 7 browser Threads ON/OFF lazy-read correctness acceptance

The owner-side ReadFile-family destination/count fence repair (`c87a2ea1`,
integrated as `a1710870`) preserves freshly read file bytes when an armed GPU
surface later materializes. The earlier page-shadow bypass (`d3ec2640`) is
unchanged. Actual-WASM/VFS before-control failed on overwritten file bytes;
the candidate and existing lazy-surface fence regression passed, followed by
all production build gates. This does not claim real GPU coverage from the
mocked-GL regression.

Both ordinary browser modes subsequently reached the rainy outdoor dragon
level with enemies and HUD through beta OK → New Game → Normal. Worker and
root personally reviewed these screenshots and matching mode/running state:

- Threads ON: `scratch/drakan-host-write-20261007/browser/threads-on-attempt2/story-wait.png`.
  `worker:true`, `threadsWanted:true`, `running:true`. Browser/server closed
  08:28:03.697Z, Chrome exited 0, no retained processes.
- Threads OFF: `scratch/drakan-host-write-20261007/browser/threads-off-attempt1/story-wait-3.png`,
  captured 08:52:19.802Z. `worker:false`, `threadsWanted:false`, `running:true`.
  Browser/server closed 08:52:42.892Z; Chrome exited 0 at 08:52:43.137Z;
  cleanup errors and pending streams were empty and both PIDs were absent.

Both used frozen source `c87a2ea192f912f19a7f7114b58d1c37e21e091e` and the
full-gated private production module
`0db725dd0c7cd4a2826159b9802e586f8fe97c70028cc1521416d76e095a2a08`
(1,719,323 bytes). Actual served-module hashes match. No canonical build or
public deployment was changed by these browser runs. The first ON attempt
was a preserved setup-only allowlist failure, not a guest regression.

This completes the narrow both-mode level acceptance for the lazy-read
correctness repair. It is not a new title qualification: October 6 already
has controlled CLI gameplay. The ON scene later returned to a menu before
movement inputs, with cause unknown; OFF stopped after level review. No new
movement, FPS, sound-quality or PBO-warning-resolution claim is made.
`ops/handoffs/drakan-threads-acceptance-20261007.json` records source/run
receipts and the immutable artifact inventories.
