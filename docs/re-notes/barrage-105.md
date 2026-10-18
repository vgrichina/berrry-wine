# Barrage 1.0.5 Win32: original source readiness

2026-10-18: registered original CLI reaches the shooting range. Real-calendar
observations now show consistent clocks and a complete 36-round HUD; player
control and firing remain unverified. No build, browser, or installer run.

## Original source and recovery

The [official Barrage page](https://lgames.sourceforge.io/Barrage/) links the
installer-free `barrage-1.0.5-win32.zip` (advertised 1.5 MB). Acquired from:

`https://downloads.sourceforge.net/project/lgames/barrage/barrage-1.0.5-win32.zip`

- ZIP: 1,455,807 bytes; SHA-256
  `bc4f43d1bc67c7e0db8168083d5b901a6123bbc5ccc9c9346852e68c3dcbd080`.
- Payload: 45 original files, 4,256,910 bytes. All extracted bytes independently
  compared against their ZIP members; every original is SHA-256 inventoried.
- Original EXE: `barrage.exe`; SHA-256
  `63bf28057f05599d13aa34c148be439fe994b2786034168c06f52e7cbbd1855b`.
- Archive `COPYING.txt` is GPL version 2; `AUTHORS.txt` credits Michael Speck
  and SFont/fonts by Karl Bartel. No license prompt or installer was executed.

Evidence and binaries are ignored artifacts under
`scratch/runs/20261018-barrage-source/`, not backed up by this documentation
commit. `acquisition.json` preserves HTTP provenance; `archive-listing.json`
records expanded sizes; `original-hashes.json` and `source-manifest.json`
preserve the complete inventory. `original/barrage-1.0.5-win32/` holds the
unaltered payload. Recovery: reacquire the exact URL, require the ZIP hash above,
inspect member paths and total expanded bytes before extraction, reject absolute
paths/traversal/symlinks, then compare extracted files to the ZIP members and
regenerate SHA-256 inventory. Keep total retained artifacts below 32 MiB and
free disk above 2 GiB plus 64 MiB before and throughout acquisition/extraction.
This acquisition retained about 6.8 MB; free disk after inspection was
2,287,996,928 bytes.

No existing Barrage candidate, registry entry, qualification, or task was found
in `lib/apps.js`, corpus manifest, TODOS, messageboard, docs, or ops records.
No local Barrage payload was found before acquisition. Dark Colony's
`ANIMATE/BARRAGER.FIN` is unrelated. This is the LGames shooting-range game.

## Static dependency and data closure

`pe-closure.json` records all imported symbols for the EXE and eleven bundled
DLLs. All twelve images are i386 PE32. `barrage.exe` has image base `0x400000`
and entry RVA `0x14b0`; it imports KERNEL32, msvcrt, SDL, and SDL_mixer.
The eleven DLLs are byte-identical to the originals in the LTris 1.2.8 ZIP:
SDL, SDL_mixer, iconv, libFLAC-8, libgcc_s_sjlj-1, libintl-8, libmikmod-3,
libogg-0, libvorbis-0, libvorbisfile-3, and libwinpthread-1.

All eleven DLL import lists agree with independent `objdump -p` output.
GNU objdump rejects the unmodified EXE as unrecognized, as it did for LTris;
`file` independently identifies it as PE32 GUI Intel 80386 with 16 sections,
and the explicit PE header/import parser succeeds. This limitation is retained
in `verification.json` and `barrage.exe.pe.txt`; the EXE was not repaired.

Remaining DLL names are KERNEL32, ADVAPI32, GDI32, USER32, WINMM, dsound,
and msvcrt. The first six use the existing system API layer; actual semantics
remain untested. The existing original CRT is available at
`test/binaries/dlls/msvcrt.dll`, 278,581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
No other static non-system import is unresolved; dynamic loading is untested.

`data-path-strings.txt` records the EXE's `%s/gfx/%s`, `%s/sounds/%s`, BMP/WAV
names, and `barrage.hscr`. All 23 literal game BMP/WAV names exist in the
original payload. Preserve the whole archive tree, including documentation
and Makefiles, rather than selecting assets. No generated high score or config
file has been supplied.

## Proposed passive launch, awaiting root grant

`passive-plan.json` records all 45 exact original host-to-guest mappings and
twelve DLL seeds (eleven originals plus the pinned CRT). Guest EXE is
`C:\BARRAGE\barrage.exe`, cwd `C:\BARRAGE`, args `-w`. This follows the
archive's `barrage-window.bat` and README; do not execute the BAT or invent
configuration files. The original README documents fullscreen toggle `f`,
mouse aiming, left click large grenade, middle/Ctrl-left small grenade, and
right click/Space reload. These are documentation, not observed controls.

The next proposed run is passive only: existing canonical module with
`--no-build`, cooperative CLI, real ticks/time-scale 1, explicit pinned calendar
and UTC, no input, 60-second guest wall guard, 65-second soft stop, 85-second
last-resort hard stop, and 8 MiB log cap. Admit only above 2 GiB plus 128 MiB,
stop below 2 GiB plus 64 MiB. Capture at host seconds 5/15/30/45/58 and inspect
the original startup/menu. Fresh root exclusive grant, original/archive/CRT/
runtime/module pins, and admission checks are required before launch.

After the run, require child/controller/group absence, terminal exit records,
unchanged pins and guard accounting, then publish reviewed `result.json` last.
A visible menu would qualify startup only, with gameplay, audio, FPS, browser,
and complete-game compatibility still untested. No runtime controller was
started as part of this source-only task.

## Guarded passive preparation

`scratch/runs/20261018-barrage-passive-prep/` contains the source-only controller,
its pure checks, exact launch manifest, PLAN, and fresh runtime pins. It uses
the existing `test/run.js` in `/tmp/wa-recovery-20261014`, module SHA-256
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Four exact disk-boundary checks, 45 exact mount mappings, twelve DLL seeds,
windowed/no-build/clock arguments, and refusal without a grant before creating
output all pass. The preflight verifies 3,196 runtime/CRT files and all 45
original files plus the archive; the controller repeats those checks after
exit. Input remains empty. Root subsequently granted one passive execution
after reclaiming space from a finished, clean, pushed worktree.

## Passive original main menu observed

Run `scratch/runs/20261018-barrage-passive-startup/` started at
2026-10-18T19:56:38.323Z using source HEAD
`11bda5ee322f3c6e9ad67e48381bb004e721941e` and the pinned module above.
The exact invocation and environment are retained in `launch.json` and
`identity.json`. All 45 original mappings and twelve DLL seeds were used;
original `-w`, explicit `C:\BARRAGE` cwd, pinned calendar/UTC, real ticks.

Visual review of `sample-5s.png`, `sample-30s.png`, and `final.png` confirms
the Barrage title and original Enter Shooting Range / Receive Briefing /
Topgunners / Quit menu. Background entities visibly change between captures.
The 640x480 host capture clips the window at the right/bottom edges. This is
startup/main-menu evidence only. No mouse or keyboard input was sent; player
control, shooting-range gameplay, audio, FPS and browser behavior remain
unverified. Six captures preserve the passive progression.

Guest wall time was 60.005 seconds. Child 2401998 and controller 2401978 both
exited zero; independent postflight confirms both absent and their process
group empty. All 3,196 runtime/CRT pins, 45 originals, archive and module remain
unchanged. Minimum sampled disk was 2,345,414,656 bytes; log 842,653 bytes;
no early-stop/log/disk/hard-time guard fired. See `terminal.json`,
`postflight.json`, `independent-postflight.json`, and `review.json`.

The runtime lane is released. The candidate is not yet registered, so the
review is retained in investigation evidence without `result.json`, following
the ops capture protocol. Next: local registration preserving these exact
originals and route, then a separately granted ordinary menu-to-shooting-range
control attempt. No retry or configuration injection was performed.

## First-shot gameplay preparation (source only)

`scratch/runs/20261018-barrage-gameplay-prep/` contains PLAN, controller,
balanced input helper, pure tests, original briefing strings, and source hashes.
The original EXE's embedded briefing adds a measurable fact to the README:
large grenades cost **six rounds**, with a half-second fire rate; small ones
cost one round. The full gun holds 36 rounds. The proposed first shot therefore
has an explicit expected change, **36 to 30**, instead of treating background
animation or arbitrary image differences as control evidence.

Proposed ordinary route: inspect fresh menu, move to Receive Briefing and
left-click for 250 ms, review the rendered instructions and actual return
affordance, return normally, then select Enter Shooting Range. No briefing
return key or shooting-range coordinate is assumed before seeing that screen.
Review the fresh 36-round HUD and aim at two visible battlefield locations;
require the crosshair to follow. Then send one 250 ms left click, independently
release it, compare ammo and any visible projectile/cooldown effect, and inspect
a later idle capture to establish that shooting stopped on release. If clipping
hides the ammo or essential control evidence, stop and record that limitation.
No fullscreen/config change, guest-state change, or second-shot retry belongs
to this bounded route.

The helper requires a hash-matched local reviewed capture for each action,
explicit phase/reason, and a reviewed 36-round baseline before a gameplay shot.
It allows only one gameplay mouse hold. Normal and early-close releases are
balanced; repeated close cannot release twice. Six normal/early-close cases,
bad capture and ammo rejection, second-shot refusal, registered clock flags,
missing grant, and missing route verification all pass without starting a
guest. Before/held/released/settled captures accompany the action; the release
timer is independent of capture completion.

The proposed registered ID is `barrage_105`, subject to the separate registration
worker's result. The packet intentionally lacks `route-verified.json`, so even
a grant string cannot launch it yet. Before a separate root grant, verify the
final registered EXE, all 45 originals/44 support mappings, twelve DLL seeds,
CRT, cwd and `-w`, and refresh runtime pins after integration. The later route
record must agree with that pin HEAD and module. Proposed limits are 180-second
guest / 185-second soft / 210-second hard stop, 175-second input cutoff, the
same 8 MiB log limit, and 2 GiB plus 128/64 MiB admission/stop margins. No
gameplay runtime, registry, corpus, or verifier edit occurred in this preparation.

## Registered menu-to-briefing observation

Run `20261018-barrage-registered-gameplay` used registered `barrage_105` on
HEAD `5e449651db0931b39e82c42c9542d55d0f4277c9` and canonical module
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Before launch, the independent fixture verifier and direct inventory comparison
confirmed all 45 original files, 44 companion mappings, twelve DLL seeds, the
authentic CRT, cwd and `-w`. Fresh runtime/fixture/CRT pins numbered 3,243.

`initial-menu.png` shows the original menu. Ordinary mousemove to host canvas
(340,331) highlights Receive Briefing yellow (`point-briefing-after.png`);
one 250 ms left mouse hold with independent release opens the actual original
briefing (`open-briefing-settled.png`). The rendered text confirms six rounds
per large grenade, a half-second firing interval, and reload to 36 rounds.
This establishes ordinary menu interaction, not player control.

The lower briefing extends below the 640x480 capture; no return affordance was
visible. Following the prepared unknown-return/clipping stop rule, the agent
sent an ordinary host quit instead of guessing a key or clicking an unseen
control. There was no shooting-range entry, aiming, firing, or retry. This is
an incomplete route, not evidence of a guest input or rendering defect. Next
source task is to establish the original briefing-dismissal semantics or an
existing supported way to observe the full original window before proposing
another bounded run.

Child 2416289/controller 2416278 exited zero at 20:09:58.422Z, approximately
46.3 seconds after launch. Independent postflight confirms both absent, their
process group empty, and all 3,243 pins, 45 originals, archive, CRT and module
unchanged. Exactly one mouse-down/up pair was issued; no held inputs remain.
Minimum free disk was 2,302,341,120 bytes, log 526,526 bytes, and no disk/log/
time guard fired. Runtime released. `result.json` is reviewed with outcome
`unknown`, explicitly scoped to menu/briefing; own schema, containment and
missing-artifact checks pass (global checker retains the unrelated historical
Zuma containment error). No player-control, audio, FPS or complete-game claim.

## Direct shooting-range route prepared

Root approved a simpler next route: start a fresh registered game and choose
**Enter Shooting Range** directly. The previous run already rendered and
verified the original firing instructions, so reopening Receive Briefing is
unnecessary. This avoids needing to infer its dismissal action; that action
remains unknown. No window geometry or original binary change is proposed.

Fresh source-only packet:
`scratch/runs/20261018-barrage-direct-range-prep/`. Its PLAN preserves the prior
packet and evidence and removes the briefing detour. Review the fresh menu,
move onto Enter Shooting Range, confirm its highlight, then use one 250 ms
left-click/release to enter. After reviewing the actual shooting-range scene,
require an unobscured full 36-round baseline, verify crosshair response to two
reviewed battlefield points, and attempt one independently released 250 ms
large-grenade click. Expected ammo is 36 to 30, then stable at 30 during a
separate released idle capture. Unreadable HUD, ambiguous control response, or
no ammo change produces a recorded limitation, never a second-shot retry.

The helper now rejects all keyboard actions and briefing phases. Four normal/
early-close move/mouse cases, repeated-close release balance, bad screenshot/
ammo rejection, second-shot refusal, forbidden key/briefing actions, exact
clock arguments, and missing-grant/missing-route refusal pass without a guest.
The fresh packet deliberately has no `route-verified.json`: recheck final
registration and refresh pins before another explicit root grant. The grant
token differs from the earlier attempt. Existing 180/185/210-second guards,
175-second input cutoff, disk margins and log cap remain. No runtime, build,
browser, registry, corpus or verifier action occurred in this preparation.

## Direct range scene reached; game ended before aiming

`20261018-barrage-direct-range` used the registered original route on source
HEAD `ffd06bd9bec32eddaee06a7324f811ab5c5916c9`, canonical `fd1613e2…`
module, and 3,243 refreshed runtime/fixture/CRT pins. The exact unchanged
registration, 45 originals, 44 companion mappings and twelve seeds verified
before launch. Real ticks, time-scale 1, pinned calendar and UTC are explicit
in the retained command; no clock cause is inferred from those flags alone.

The highlighted Enter Shooting Range entry was clicked at
20:20:53.266Z for 250 ms with independent release. `enter-range-settled.png`
shows the actual range, green crosshair, score 000000 and left-side ammo icons.
The upper-right timer reads `2:4…` with its last digit clipped; the earlier
messageboard shorthand `2:45` should not be treated as an exact measurement.
The bottom ammo rows are also clipped, so the full 36-round count was not
visually established.

At 20:21:07.598Z, `aim-upper-before.png` already shows “The time is up” and
zero points. The following mousemove to (220,180) and `aim-upper-after.png`
therefore cannot establish crosshair response: the game had ended before that
input. The scene used to select the point was about thirteen seconds old.
This is a stale scene baseline, not a failed movement control. No second aim,
shot, reload, or retry was attempted; ordinary host quit ended the run.

Child 2429151 and controller 2429141 exited zero at 20:21:18.503Z;
guest wall time was 44.982 seconds. Independent postflight confirms both
absent, process group empty, and all pins/originals/archive/CRT/module unchanged.
One balanced menu click and two pointer moves were issued. Minimum free disk
was 2,349,252,608 bytes, log 372,258 bytes, with no guard firing. Runtime released.
The reviewed `result.json` has outcome `unknown`, retaining the actual range
scene and game-over comparison, with own schema/containment/missing checks
passing (only the historical global Zuma error remains).

Next source investigation: trace the original game timer and how it consumes
elapsed time, and determine a supported way to observe the complete ammo HUD.
Any next input must use an immediately checked live scene, rather than assuming
the earlier capture still depicts the current game. No timing repair, geometry
override or additional runtime is included in this evidence update.

## Countdown and full-HUD source audit

Evidence: `scratch/runs/20261018-barrage-clock-hud-source/`, with original
disassembly, pinned runtime-integration source excerpts, pure clock checks,
a read-only observer and its tests, and the proposed discriminator PLAN.
No guest or build was started. Source paths below refer to the actual runtime
checkout `/tmp/wa-recovery-20261014`, whose runner differs from the shared
worktree in unrelated cleanup changes; the relevant runtime source is pinned.

The original countdown is **calendar based, not frame based or SDL-tick based**:

- Original import IAT `0x55832c` is `msvcrt!time`. At `0x40332f`, the game
  calls `time(NULL)`, stores start seconds at `0x41c02c`, adds 180, and stores
  the deadline at `0x41c028` (`0x403349`).
- HUD code `0x402d7c` loads the deadline, calls `time(NULL)` at `0x402d89`,
  and formats the difference as minutes/seconds. The expiry check at
  `0x40303f` calls the same import and enters the time-up path when now is
  at least the deadline. It does not decrement one unit per frame.
- SDL_GetTicks is a separate import (`0x558424`, trampoline `0x40af08`).
  Changing only its clock does not change the calendar countdown.
- The retained run log confirms the EXE's msvcrt imports were patched to the
  authentic seeded CRT. Its original `time` export at `0x780271c9` calls
  GetLocalTime (`0x78031234`) and GetSystemTime (`0x7803123c`), then converts
  calendar fields to epoch seconds. It also queries timezone information.
  Both system-time handlers use `wall_clock`, whose host implementation reads
  `ctx.wallNowMs()` when defined, otherwise `Date.now()`.

The previous controller explicitly passed `--wall-clock-ms=928238400000`.
Runtime `test/run.js:4441` therefore sets the calendar to
`CALENDAR_ORIGIN_MS + batchClock.batchTicks()` even with `--real-ticks`.
The real guest elapsed clock instead uses Date.now through
`lib/guest-clock.js`. Thus this invocation selects two different elapsed rates.
At the default 200 ms/batch, 900 batches advance the pinned calendar by three
minutes regardless of host time. A pure simulation using the actual clock
modules proves 900 batches over ten simulated host seconds give +180 calendar
seconds and +10 real-tick seconds. This establishes the source mechanism;
paired live calendar/tick samples were not taken in the old run. It does not
establish an SDL defect, and no production timing change is proposed here.

The next proposed discriminator removes the explicit calendar pin, adds
`--real-calendar`, and retains `--real-ticks --time-scale=1 --tz=UTC`.
Registered Barrage has no `wallClock` override. Existing runner logic then
leaves the calendar on Date.now too. The real date may change the random seed;
old/new screenshot equality is not an acceptance criterion.

Full-HUD observation already exists without moving/resizing the window:
`--dump-backcanvas` plus the **scheduled** control command
`{cmd:"png:<run>/<label>.png"}`. This uses the runner's scheduled PNG branch,
which saves the desktop, each available `_back_<hwnd>.png`, and each available
`_dxlayer_<hwnd>.png` at its own canvas dimensions. The previous
`{action:"png",path:...}` path calls `controlPng` directly and only saves the
desktop, bypassing those dumps. Inspect both layers; a blank back canvas alone
does not mean the guest failed to render. The original ammo HUD draws from
`0x41c030`: initialization at `0x4032e2` writes 36, and the drawing loop at
`0x402e5c` groups six ammo icons per row, ending around client y470. The desktop
client offset explains why those low rows fell outside the desktop capture;
actual full-layer visibility must still be checked in a run.

Proposed next bound: 60-second guest / 65-second soft / 85-second hard stop,
same disk margins and 8 MiB log cap, one reviewed menu click into the range,
then four read-only samples at 0.5/2/5/8 seconds and host quit. Sample state,
deadline/start, ammo, score, actual time IAT pointer, host/calendar/guest-peek
clocks and batch; take full-layer captures with each sample. Require live
state 3, stable start/deadline separated by 180 seconds, elapsed clocks matching
host deltas within one second, and numeric 36 rounds corroborated by the full
HUD. Unknown/unmapped/noncontiguous reads remain unknown. No firing, freezing,
guest execution calls, state writes, resizing, or repeat entry belongs to this
discriminator. The observer's pointer checks, no-write property and six clock/
scene classifications pass pure tests. Fresh pins and a separate root grant
are required; no runtime acceptance follows from this source audit.

## Real-calendar/full-HUD discriminator observed

Run `20261018-barrage-realcalendar` used original registered `barrage_105`,
`-w`, source HEAD `9c68e38d820e47f61ccf25cdb3e3f7dcc6f8ea5b`, and the
unchanged canonical `fd1613e2…` module. It retained real ticks, time-scale 1
and UTC, removed `--wall-clock-ms`, and explicitly selected `--real-calendar`.
The same 45 originals, 44 mappings, twelve DLL seeds and CRT verified; fresh
runtime/fixture/CRT pins numbered 3,243. Pure checks verified exact arguments,
four scheduled observations, normal/early release balance, no samples after
close, rejection of gameplay clicks, and grant/route refusal before launch.

One reviewed menu click entered the shooting range; four automatic read-only
observations followed at 0.5/2/5/8 seconds after release. Sample 0 caught
initialization: state 3 and ammo 36, but start/deadline still zero. It is retained
and explicitly excluded from elapsed-clock comparisons. Samples 1/2/3 all have
state 3, ammo 36, score 0, start `1792355832`, deadline `1792356012`, and
time-IAT pointer `0x140c1c9`, matching the loaded authentic CRT export.

| Pair | Host elapsed | Calendar elapsed | Guest tick elapsed |
| --- | ---: | ---: | ---: |
| 1 → 2 | 2,997 ms | 2,997 ms | 2,997 ms |
| 2 → 3 | 2,995 ms | 2,995 ms | 2,995 ms |

The deadline minus start is 180 seconds; observed remaining seconds are
179/176/173. `clock-1_back_65537.png` and `clock-3_back_65537.png` show the full
646x507 window backing canvas, including all six rows of six ammunition icons,
and timer 2:59 then 2:53. The 640x480 client is fully visible in these captures.
Only `_back` captures were needed for this actual run; no DirectDraw layer was
present. The source `--dump-backcanvas` path works as intended with scheduled
`cmd:png`, without a window resize or guest-state write.

Be precise about coordinates in a future control test: the backing canvas
starts at the window origin, while normal mouse commands use desktop pixels.
The retained geometry is window (20,20), client (23,43), client size 640x480.
Use the actual current geometry and fresh captures rather than treating a
backing-canvas point as a desktop coordinate.

The controller quit normally after its four samples; no aim or fire input was
sent. Child 2447578/controller 2447568 exited zero at 20:37:21.433Z after
29.240 guest wall seconds. Independent postflight confirms both absent,
group empty, and all pins/originals/archive/CRT/module unchanged. Minimum free
disk was 2,318,000,128 bytes; log 383,548 bytes; no guard fired. Runtime released.
`samples.json`, `review.json`, `input-balance.json` and reviewed `result.json`
preserve the evidence. Its `passed` outcome is scoped to this clock/HUD
discriminator, not player control. Own schema, containment and missing-artifact
checks pass; only the unrelated historical global Zuma error remains.

Next gameplay attempt may retain this observed real-calendar/full-capture
route and require a fresh fully initialized live scene plus a visible 36-round
baseline before the single-shot check. The first zero-deadline sample is a
reminder that state 3 alone is insufficient as an initialization gate. No
further attempt or production timing change was performed here.

### Final gameplay preparation after real-calendar proof (source only)

The next bounded attempt is prepared in
`scratch/runs/20261018-barrage-final-gameplay-prep/`: `PLAN.json`,
`controller.js`, `control-inputs.js`, `readonly-observer.js`, `issue.js`, and
`pure-checks.js`. No runtime was launched during this preparation. The copied
`current-pins.json` is deliberately stale: after the `_fpreset` build/native
work releases its slot, regenerate integration/module/fixture pins and rerun
the registered-route verification before recording `route-verified.json`.
The latter must match `barrage_105`, the new module hash, and the pin HEAD.
A new explicit root grant is required; do not reuse the clock-run grant.

Recovery recipe: reuse the prior registered direct-range controller's
180/185/210-second guest/soft/hard limits and 175-second input cutoff, detached
process-group cleanup, 8 MiB log cap, admission above 2 GiB + 128 MiB, and stop
at 2 GiB + 64 MiB. Replace the calendar pin with `--real-calendar`, retaining
`--real-ticks --time-scale=1 --tz=UTC`; enable `--dump-backcanvas`. Keep the
original registered `-w` route, 45 originals, 44 support maps, and 12 DLL seeds.
Use tagged read-only `observe` samples from the prior clock audit and scheduled
`cmd: png:<path>` captures, preserving complete back canvases and desktop
screenshots. Each observation contains host/calendar/guest time and the
original state/start/deadline/ammo/score addresses already documented above.

Choose Enter Shooting Range directly from a freshly reviewed menu. Before
**each** of two ordinary aim moves and the single 250 ms left-button shot,
require a reviewed full back-canvas capture paired with its hashed observation:
state 3, start greater than zero, deadline minus start exactly 180, remaining
more than 10 seconds, and ammunition exactly 36. Observation age must be at
most five seconds and screenshot time within two seconds of its observation.
The zero-deadline initialization sample is therefore rejected. Requests bind
both files by SHA-256 and explicitly record the current desktop coordinate
mapping; back-canvas points cannot be passed directly as desktop coordinates.

After validating the reviewed evidence, issue another read-only gate sample
and send no input until it confirms the same initialized round, live state,
and 36 rounds within 1.5 seconds. Unknown, expired, changed, or missing replies
stop the controller. Use two distinct reviewed aiming points and compare the
cannon response. Only then allow one 250 ms left shot, with held, released,
and settled full captures. Check the actual 36-to-30 ammo change plus the shot
effect, followed by released idle evidence. Background animation alone does
not qualify. Button release is idempotent and occurs on normal completion or
early stop. No second shot, guessed control, state write, or retry is allowed.

Pure checks pass for initialized/live36 freshness, zero-deadline rejection,
wrong ammunition and stale/hash/coordinate rejection, exact calendar flags,
read-only observer, no input before the gate response, changed-state rejection,
gate timeout, two-aim limit, shot prerequisite and repeat-shot rejection,
normal/early balanced release, and missing-grant refusal. Controller/helper
syntax checks pass. These tests use mock observations/captures and fake timers;
they do not prove gameplay or test the upcoming module. Capture fresh actual
baseline/aim/shot/idle evidence and unchanged pins/process cleanup in the next
authorized run, then publish the actual outcome. No additional diagnostic or
production timing change is proposed.

### Final gameplay attempt: freshness workflow stop (2026-10-18)

The single authorized attempt is preserved in
`scratch/runs/20261018-barrage-final-gameplay/`. Fresh integration HEAD
`53fe5c2132b4b4295189db262c18b329d83c1949`, module
`0c617764e036d0422ab19bc0d97477ff68ba5eb8fa7c247833b7519e8060e5f7`,
3,244 physical pins, original archive/45 files, and exact 44-map/12-seed
registered route passed. Admission free space was 2,287,988,736 bytes,
above the unchanged 2 GiB + 128 MiB threshold.

The menu click entered the range normally. Reviewed full back-canvas images
`baseline_back_65537.png` and `fresh-left_back_65537.png` show the entire
six-by-six ammunition display, with timer 2:55 then 2:43. Paired observations
confirm initialized state 3, ammo 36, and deadline minus start 180 seconds.
However, the five-second reviewed-observation age limit rejected both local
attempts to issue the first aim request after image review. Neither request
was queued; no aim or fire input reached the guest. This is a capture-review
workflow failure, not evidence of broken guest controls. The limit was not
relaxed and the run was stopped without a second runtime attempt.

Only the menu button was pressed/released (251 ms). Child 2463483/controller
2463474 exited zero, terminal 20:49:53.135Z, after 45.566 seconds. Independent
postflight verifies both absent, process group empty, and all 3,244 pins,
originals/archive/CRT/module unchanged. Minimum free space 2,274,897,920 bytes;
log 567,266 bytes; no disk/log/time guard fired. `review.json`,
`input-balance.json`, `independent-postflight.json`, and `result.json` preserve
the actual evidence. Outcome is `harness-error`, not gameplay qualification:
there is no aim response or 36-to-30 shot evidence. Runtime released.

A future source-only adjustment should separate the human visual-review
budget from the immediate execution-state freshness gate, while retaining
same-round/live36 checks immediately before ordinary input. It requires a
new plan and runtime grant; this attempt did not change its approved limits.
