# Comanche Gold (demo) -- PARKED

NovaLogic, 1998, software voxel renderer. Fixture:
`test/binaries/win98-games-a-d/Commanche Gold-DEMO-SW.EXE` (InstallShield
self-extractor, an IS5 Disk1).

## Install (works, headless)

- `7z x` the SFX; run the 16-bit `SETUP.EXE` with `--vfs-include='*'
  --capture-launch=cap --tick-ms-per-batch=5`. At the default 200 ms/batch
  its splash WM_TIMER (id 0x3e9) fires before `_INST32I.EX_` is expanded,
  the launcher posts WM_QUIT and reports "Setup is unable to decompress and
  copy all of the program files".
- Stage 2: `_ins0576._mp` from the capture (`--exe-guest-path` +
  `--vfs-tree=cap`), Next, Next, it copies, "Installation ... complete",
  Finish. Installed tree (8 files, 17 MB: demo.exe, cgold.pff, netsock.dll,
  msvcrt.dll, wsetup.cfg, ...) kept at
  `Commanche Gold-DEMO-SW/installed`; it must mount at
  `C:\Program Files\NovaLogic\Comanche Gold Demo\` (the game changes into its
  install directory and opens CGOLD.PFF relatively; `netsock.dll` is a static
  import).

## Game

Boots to the Pilot Roster -> Duty Roster -> Gold Operations -> Swift
Justice -> Delta Patrol briefing (keyboard Enter). The briefing never
advances, because the main loop busy-waits on a tick counter
(`exe+0x4bb8a4`: `cmp ebx,[0x4e76f0]; ja` -- 4 ticks) that only the 33 ms
`timeSetEvent` callback (`exe+0x4d95a0`, periodic) advances.

The callback dies after 7 ticks, the same way on the winmm timer thread
(default) and injected on the main thread (`--no-mm-timer-thread
--async-mm-timer`): EIP=0 from a `ret` at `exe+0x40c414`, ESP ~0x37A00 above
the thread's stack top. Every 4th tick it calls `exe+0x4d11d0` (DirectSound
streaming: IDirectSoundBuffer::GetCurrentPosition, then a mixer); the
routine `exe+0x40bfd5..0x40c414` is generated code (`exe+0x40be5b` stores
into `0x40bff0`, rewriting a `mov eax,[0x40a0c8]`) and keeps registers in
globals (0x40a0a0..0x40a0c8). Not the uop tier (`--no-uop` same), no
code-write retirements (`--trace-code-writes`: the patch lands before decode).
Mounting a wsetup.cfg with MMX=0 or sound=0 (`--vfs-mount`) did not change
it either (override not verified to take effect).

**Next step:** an instruction-level ESP trace across one 4th-tick callback
(`--trace-at` on `exe+0x4d11d0` and the mixer's entry) to find where ESP is
repointed and why it is not restored.


## Root cause of the callback crash (claude:202b4b39, 2026-10-06)

**Not a stack or SMC bug: a startup race in the game that our slower CPU
loses.** The "ESP ~0x37A00 above the thread's stack top" is the timer thread
executing an invalid instruction head the mixer was patched with.

- The mixer `exe+0x40bfd5..0x40c414` is generated per channel. Its patcher
  `exe+0x40be48` (entered through `0x40be40`, called only from the DirectSound
  stream routine `0x4d11d0`, i.e. on the timer thread every 4th 33 ms tick)
  writes each channel's 2-byte head: `eb 3a` (skip) for an idle channel, else
  the 16-bit immediate at `0x40be4c`, `0x40be62`, ... In the file those
  immediates are the placeholder `0x7fff`; `exe+0x40c74c` (called once from
  `0x401ac7`) fills them with the real head `a1 c8` (`mov eax,[0x40a0c8]`).
  The channel flags at `0x40b6f9..` start as `0xff` (active).
- So the mixer is only valid once `0x40c74c` has run. `timeSetEvent(33)` is
  set at API #243 and the primary buffer is playing, so the first mix comes
  at the 4th tick, ~132 ms later. Main reaches `0x401ac7` only after
  ~2.76M blocks, half of it in `0x4d8650`: a linear scan of the CGOLD.PFF
  directory (32-byte entries) calling the static `_stricmp` at `0x4e0be0`
  ~95,000 times, one block per character. A Pentium does that in a few tens
  of ms. We take ~0.15 s at full speed (`--real-ticks`), or 138 batches of
  the default 200 ms/batch clock, so the first mix writes `ff 7f` (an FF /7
  head, invalid) and the timer thread runs off into garbage.
- Confirmed: `--watch-word=0x40be4c` shows `0x7fff -> 0xc8a1` at batch 139,
  while `0x40bff0` becomes `ff 7f` between batches 2 and 3. A watchpoint is
  checked on the main instance, so T1's write is attributed to main's current
  block (`0x4d867f`); the only code storing `0x7fff` there is the patcher.
- Pacing proves it: `--tick-ms-per-batch=1` (or 10 with `--batch-size=200000`,
  ~20M blocks per guest second) keeps T1 alive and the game reaches the
  briefing. `--no-mm-timer-thread` (callbacks only from the message pump) also
  avoids the crash but then deadlocks in the briefing's tick wait
  (`0x4bb8a4`), because that loop never pumps. `--real-ticks` and `--no-uop`
  still lose the race.
- Second CLI-only cost: in the briefing the main loop redraws the whole frame
  with GetDC/SelectPalette/RealizePalette/StretchDIBits/ReleaseDC on every
  pass while it waits for the tick (~10,000 per batch at tick 10). On the batch
  clock a host call costs no guest time, so this runs ~0.4 s of wall clock
  per batch. On real hardware and in the browser the time spent in the call
  paces the loop.

**What would fix it** (none done): make the pre-init work fast enough. Either
a decode-time fold for the byte-compare `_stricmp` loop (a two-stream scan;
`0x4e0bfc..0x4e0c08` is a SELFEXIT loop the matcher cannot see today), or a
per-app guest-clock dilation. The browser has not been tried: its clock is
real time, so it should behave like `--real-ticks` and lose by a hair.

Status 2026-10-06: parked again (claude:202b4b39) with the root cause above; TODOS NEW-GAME-COMANCHE-GOLD-DEMO-20261006.

## The `_stricmp` fold, tried (claude:202b4b39, 2026-10-06 evening)

Built and measured on branch `claude/crt-stricmp-fold` (051a901e): handler
501 folds a whole C-locale `_stricmp` call at `0x4e0be0`, handler 500 its
loop. It is exact (unit test: every register, flag and stack slot) and 18x
faster per call in bench-loops (61 vs 1094 ns). **It does not win this race.**

- The pre-init is ~200,000 `_stricmp` calls (`--count=0x4e0be0`), most of
  them ending at the first byte -- so the loop is not where the time goes;
  the per-call blocks and the caller's scan at `0x4d8678` are.
- The margin is not "a hair". Under `--real-ticks`, both arms keep T1 alive
  at `--time-scale=0.5` and lose it at 1 (0.7 is noise, either way). With
  browser-sized slices (`--batch-size=100000 --real-ticks`) T1 is dead by
  batch 5 and the patch lands at batch 14 (19 unfolded): main needs ~3x less
  work before its 4th timer tick, not a few percent.
- `--tick-ms-per-batch=1` alone does NOT survive at the default 1000-block
  batch (dies by batch 119, patch at 2435); the earlier survival was with
  `--batch-size=200000`.
- How to mount it on the CLI: every installed file with
  `--vfs-mount=<installed>/<f>=C:\Program Files\NovaLogic\Comanche Gold Demo\<f>`,
  `--exe-guest-path` to the same dir and `--cwd` there. `--vfs-include='*'`
  does not put them under the install directory, and the game then fails to
  open CGOLD.PFF and idles after 159 API calls.
- Under the default batch clock, once T1 has died, a run without
  `--real-ticks` stops returning from a batch (the 100 s harness kill hit at
  under 150 batches). Not chased.

What is left: make the game's timer wait for main (a per-app guest-clock
dilation for startup, or start the mm timer thread's clock at the first
`timeGetTime`/mixer call instead of `timeSetEvent`), which is a design call,
not a fold.

## Solved: startup clock, then flight (claude:202b4b39, 2026-10-10)

Design call made (user): option (a), a startup-only clock dilation
(d4006e932, `lib/startup-clock.js`). The registry entry `comanche_gold_demo`
sets `startupClock: { factor: 0.01, maxMs: 30000, endOn:
'firstPresent:directdraw' }`: guest time runs at 1/100 until the first
DirectDraw present, then at real speed (continuous, never backwards).

- The pre-init is much cheaper than on 2026-10-06: the mixer patch
  (`--watch-word=0x40be4c`) lands at batch 7 of 100k blocks, ~0.7M blocks.
- Order, with 1000-block batches: `timeSetEvent` at API #243, patch at batch
  742 (raw 1484 ms), first DirectDraw present right after (raw 1486 ms =
  guest 15 ms), then the first `SetDisplayMode` (#1003). So the present is a
  correct end event; the window is NOT (ShowWindow is API #234, before the
  timer is even armed).
- Control `--no-startup-clock` (same flags): T1 exits, game stalls.
- Factor: 0.1 is not enough on the CLI batch clock (patch at raw 1400 ms ->
  140 ms > the 4th tick's 132 ms); 0.01 works on both hosts and costs nothing
  visible because the dilation ends right after the patch.

**Route to flight (CLI, `--app=comanche_gold_demo --batch-size=100000`):**
Enter at batches 410/500/600/760/880 (Pilot Roster -> Duty Roster -> Gold
Operations -> Swift Justice -> Delta Patrol briefing -> map page), a *held*
click on NEXT (604,407; mousemove, mousedown, mouseup 10 batches apart) at
1000 (loadout) and 1120 (launch). "Downloading Mission Parameters..." then
takes ~1500 batches of compute (`0x4170e5..0x41711a`, registers changing --
not a hang); the cockpit is up by ~2900 on the pad with the mission clock
running. A plain `click` does not press NEXT; Space does nothing in the
briefing.

**Flight keys** (from the help text in CGOLD.PFF): `1`..`0` set collective
0..100%, `-`/`+` momentary min/max, `*` nominal. Key `8` at batch 3000: ALT
2 -> 172 and V-STAB 80 by batch 3450 (lift-off over the river). `A` and the
arrow keys did nothing on the pad. Evidence
`scratch/runs/20261010T1000Z-comanche-gold-startup-clock`. Page not checked yet.
