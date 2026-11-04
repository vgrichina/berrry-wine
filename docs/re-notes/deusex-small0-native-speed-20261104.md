# Deus Ex: native speed diagnosis and one running jump

The previous 36.3055 units/s was a standing-start airborne result, not a
native movement speed cap. Fresh count14 loads exactly on Small0. Native
reflection shows healthy standing running state, GroundSpeed320,
AccelRate1000 and AirControl0.05. Safe grounded comparisons and one running
jump establish substantially higher speed. The farther Z96 wood remains
**unreached**. The result is incomplete because the new native save was not
exported before browser cleanup; the original immutable count14 survives.

Evidence: `scratch/runs/20261104-deusex-small0-native-speed/`. Input handoff:
`334eacb19076a573fcb2cc99fe4acc4217b42198` and
`deusex-small0-reload-onward-20261104.md`. No production code changed, no
build/rebuild ran, and no second jump or prior floor route replay occurred.

## Runtime and exact reload

Retained `bx_2t2b9xah` was checked before use: APIstate idle, healthok,
RUNNING, expiry2026-11-04T03:02:57.823Z, shutdownOwner=coordinator. These were
recorded on the board before execution. No boat allocation, resume, stop or
delete occurred. All browser/game execution was on that box.

Historical runtime remains `a504fa248caaecbbb042b65e9ae5384a340ade26` plus
the authoritative nine-file patch at
`scratch/runs/20261104-deusex-supported-stack/historical-source.patch`, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
All451 inherited runtime inputs outside helpers/checkpoints matched their
manifest. Actual canonical module SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
(1,898,260 bytes) was recovered. **Historical second module ABSENT**; no
substitution or rebuild. Chrome151.0.7922.108, original SoftDrv/default
guestWorker and three original guest workers were retained. Game media are
referenced by existing paths/hashes, without copies or source archives.

The first startup attempt used an insufficient inherited fixed delay. Captures
show the splash, and installing the player observer failed with `route envelope`.
The guard closed that browser without traversal. Its evidence is preserved in
`first-startup-failure/`; no unchanged retry was made. A longer startup wait and
separate inspected Load-dialog gate repaired that dependency on the same box,
within the same bounded runtime window.

Inspected `03-count14-load-dialog.png` displays count14/time01:17:23. Ordinary
Enter loads unique JCDentonMale0 at exactly
`(7026.70458984375,-1707.887939453125,109.60284423828125)`, yaw250640,
Physics1, height43, zero velocity and native Base=CrateUnbreakableSmall0.
`06-restored-small0.png` contains gameplay. Input checkpoint remains the preceding
run's read-only `recovered/native-save-export/{0.bin,1.bin,manifest.json}`:

| File | SHA256 |
| --- | --- |
| saveinfo.dxs | `4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6` |
| 00_training.dxs | `ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730` |

## Movement cause

`original-configs.json` records original user.ini, defuser.ini and deusex.ini.
Actual user.ini has bAlwaysRun=True, bToggleCrouch=False, Shift=Walking,
CapsLock=ToggleWalk, X=Duck, Up=MoveForward and Space=Jump. No config was edited.

The read-only observer selects typed UProperty objects from Core's object array,
checks their owning class, and reads their reflected offsets and Boolean masks.
Location, Velocity, Acceleration, CollisionHeight, Physics and Base independently
anchor the reflection layout. Reads occur on the original owning worker after
its JS/Wasm stack returns. No guest-memory writes or injected game calls occur.

Initial state: bIsWalking=False, bIsCrouching=False, bDuck=0, bRun=0,
bAlwaysRun=True, bToggleCrouch=False, health/torso/both legs100, GroundSpeed320,
WaterSpeed300, AirSpeed4000, AccelRate1000, JumpZ300, AirControl0.05. Physics1
and BaseSmall0 establish grounded movement, rather than swimming. bRun is the
Shift input byte; its zero value does not mean Always Run is disabled.

Two150ms inward Left pulses stayed Physics1/BaseSmall0 throughout. With Shift,
the maximum sampled speed was53.69834; without Shift it was135.00457. These
are brief-pulse measurements, not terminal walk/run speed measurements. Native
walking state toggled as expected; both releases settled before the next action.
The player remained on Small0 at `(7003.581543,-1719.570557,109.602844)`.

The original Engine.dll `AActor::physFalling` export thunk at0x1030303a leads
to0x103d0a20. Inspected disassembly reads reflected AirControl at+0x38c and
multiplies it by reflected AccelRate at+0x380 (0x103d0ba0/0x103d0bc0 and
0x103d0d1f/0x103d0d22). This establishes the native low air-acceleration scale
of50. The prior jump pressed Space and Up together from zero velocity; its
36.3055 therefore does not measure ordinary ground running speed. The present
grounded comparison and approximately300-unit running takeoff confirm that
distinction. No emulator speed repair or movement-mode change was needed.

The first movement observer's Region.zoneNumber used a32-bit read over a byte;
that diagnostic field is not used in the diagnosis. The onward observer corrects
it to a byte. Zone name, Physics and Base readings are unaffected.

## Exactly one onward jump

Ordinary Down250ms, released and settled, moved within Small0 to
`(6985.255371,-1683.304199,109.602844)`. Native BaseSmall0/Physics1 and zero
velocity were verified before jumping; inspected12 shows gameplay.

One sequential request held Up300ms, then Space80ms, released Space, continued
Up450ms and released Up. No capture or remote roundtrip extended either hold.
The last sampled grounded state is `(7009.096191,-1730.488281,109.602844)`
with horizontal speed300.98;40 airborne samples follow, with maximum horizontal
speed306.43787, sampled positive Vz245.84821 and centerZ156.96031.

During flight, Y velocity falls sharply from approximately-274 to-19 near
Y=-1770, while X velocity remains positive. This is consistent with an
obstruction/deflection, but no specific collision face is established. It is
not evidence of a renewed36-unit speed cap.

Inspected14 and16 show the lower area. Two settled native readings agree at
`(7138.4638671875,-1790.91455078125,15.79999828338623)`, Physics1, zero
velocity. The movement observer identifies Base=LevelInfo0. The inherited
farther wood bounds are X7024–7088,Y-1872–-1808,topZ96; the player is below
that top and outside its X range. **Target unreached.** No further traversal ran.

## Native-export blocker and handoff

Ordinary Escape → Save Game selected the new-slot row (inspected17). Enter
returned to gameplay (inspected18). However, the repaired evidence directory
omitted `export-save.cjs`. The export failed with `MODULE_NOT_FOUND`, then the
queued quit closed Chrome. This worker error is preserved in
`native-export-blocker.json`. No output pair was recovered; final native save
count/time and reloadability are **unverified**. The in-memory observation and
captures must not be represented as an exported native checkpoint. The original
count14 pair and earlier saves remain unchanged. Further work must begin from
that retained count14, with the export dependency verified before cleanup;
this task launches no successor.

Cleanup completed02:19:42.842Z, within six minutes of first launch and before
02:50Z. Browser/driver13954/13942 absent, port8123closed, held keys empty.
The box remains RUNNING/APIidle with the same expiry and coordinator shutdown
ownership. Current and first-failure unique logs/captures plus the actual
canonical module are recovered with full hashes. Git/source references and
relevant binary diffs are in `source-record.json` and `owned-new-files.patch`.
No FPS, game-exit, completion or successful-checkpoint-recovery claim is made.
