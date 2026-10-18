# Barrage 1.0.5 Win32: original source readiness

2026-10-18: original source verified; one passive CLI run reaches the animated
main menu. No input, gameplay, build, browser, installer, or registration run.

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
