# Outlaws original first-launch handoff

## Settled fade clears with full health (2026-10-18)

The single registered run `20261018-outlaws-fade-discriminator-observation`
completed the packet below. Reviewed ordinary Main Game and GOOD selections
used independently released 250-ms mouse holds; no keyboard input followed.

| After GOOD release | Frame | Callback hits | Placement / transition arms | Signed countdown | Fade last time | Tint | Health |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| 3 s | Loading | 0 | 0 / 0 | 0 | 0 | 0 | 10 |
| 5 s | Sepia town | 14 | 1 / 0 | 356 | 112509 | 255 | 10 |
| 8 s | Full-color town | 31 | 1 / 0 | -3 | 113237 | 0 | 10 |
| 12 s | Full-color town | 31 | 1 / 0 | -3 | 113237 | 0 | 10 |

All four checked reads were known; health bits were `0x41200000`, loss and
gain counters both zero. The 5-to-8-second interval has 17 callback hits,
728 ms of fade-time advancement and countdown reduction 359, without rearm.
The callback then remains at 31 hits through 12 seconds, consistent with its
documented completion return. This run demonstrates fade progress and clear,
not an absent callback or persistent rounding stall. The earlier sepia/death
inference remains rejected. Forward movement remains separately verified;
live turning remains unverified because this run injected no keys.

`fade-samples.json` preserves host times, guest ticks, batches, raw state and
bounded classifications. Samples and PNGs are adjacent commands, not atomic
snapshots; scheduled times are relative to GOOD release, not level readiness.
Counters alter optimization, so this does not establish normal cadence or
individual callback deltas. A future ordinary turning check should wait for
a reviewed settled full-color frame and measured positive health, rather than
assume a fixed three-second delay identifies gameplay readiness.

Exact module `fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`
and map `a6869fe091c02854ac8f6cc71dd8e37b4f1156be616dd2dbaa0cc012c37bf9fa`
were unchanged. Physical source pin metadata is
`11bda5ee322f3c6e9ad67e48381bb004e721941e`; postflight HEAD advanced only
through coordinator docs integration to `4f0b239ca3b5fa54db064c68c0fcba87a08eae7f`.
All 3,149 physical pins and 31 original records verified unchanged. Child
2407515 and controller 2407497 exited 0, both absent with empty owned group;
terminal was 20:03:52.412Z after 126.164 seconds. Minimum free space was
2,317,287,424 bytes, log 2,181,939 bytes; no guard fired. The 180/185/210-second,
2-GiB-plus-margins and 8-MiB limits held. Artifacts, reviewed four frames and
partial `result.json` are retained; no retry, build, browser or guest write.

## Source-only settled fade packet

`scratch/runs/20261018-outlaws-fade-discriminator-prep/PLAN.json` is tested
was prepared before the single run above. It retains the registered
real-time route, module and guards. Four read-only samples with PNGs are
scheduled at **3/5/8/12 seconds after GOOD release**, with no keyboard input.
Each includes checked health/counters/tint, countdown `0x532038`, last fade
time `0x532034`, direction `0x531df0`, and passive hit counts. The exact CLI
flag is `--count=0x4359a0,0x429a34,0x435a62`: callback function entry plus
the two actual arming block entries (explicit conditional-branch targets).

Interpretation requires measured callback advancement. No advancement with
remaining fade is distinct from advancement with countdown progress. If the
callback and last-time advance but countdown does not, with direction 1 and
unchanged arming counts, the source rounding mechanism is supported; four
aggregate snapshots still cannot prove each callback's delta or exclude all
intervening writes. Any rearm interval is flagged as confounded, unsupported
reads are unknown, and a nonpositive countdown with zero tint records clear.
Counters affect interpreter optimization, so this is not a performance run.

Pure tests passed exact four settled sample/capture pairs, independent
normal/early-close releases, read-only synthetic memory, invalid pointer and
nonfinite handling, exact count/clock flags, missing-grant refusal and six
classification cases (absent, progressing, cleared, rounding-supported,
rearmed, unknown). Physical pins/originals verified; no runtime/build was
started. Source packet/fixtures occupy only small JS/JSON files.

## Tint clearing belongs to an original timed transition

Source-only follow-up maps both arming sites, not just the matching color.
`0x429620` creates/places a player object; its `0x429a1e` path arms tint only
with a nonnull placement argument and unless direction `0x531df0` is already
nonzero with countdown `0x532038 <= 0`. `0x435a50`, called at `0x4357be`,
arms the same transition without that placement argument. The matching
color therefore does not uniquely identify which caller executed.

Both sites select color `0x4e8ca8` (or zero when flag `0x5d5a1c & 0x800`
is set), set tint 255, initialize countdown **637**, record time in
`0x532034`, set direction `0x531df0=1`, and activate task `0x532940` with
delay zero. Initialization at `0x4294d8` registers callback `0x4359a0`.
The callback obtains elapsed game milliseconds through `[0x509e28]+0x2c`;
`0x428aaf` initializes that table and `0x42d9eb` binds it to `0x405fc0`.

For each nonzero delta, `0x4359a0` computes integer
`trunc(delta * 510000 / 1000000)`, subtracts from the countdown for direction
1 (adds for direction 0), updates the timestamp, and passes the countdown
clamped to 0..255 to the tint setter. Direction 1 completes at countdown
<=0 and returns -2; task scheduler `0x49f67a` recognizes that as disabled.
Until completion, return zero schedules another callback at the current
game time. This deliberately keeps full tint while countdown exceeds 255;
the first town frame with tint 255 is compatible with an early transition.
Other state changes also explicitly clear tint and countdown, for example
`0x42aa6a`/`0x42aa80`.

Pure arithmetic checks reproduce a concrete rounding susceptibility: 2,000
successive 1-ms deltas leave countdown 637 because each decrement truncates
to zero while the timestamp still advances; 2-ms or 16-ms steps progress.
This is original game arithmetic, **not a demonstrated runtime defect**.
Retained samples lack callback counts, countdown and last-time values, so
they cannot distinguish an ordinary initial plateau, stopped callbacks or
rounding-related delayed clearing. If another discriminator is needed, use
bounded read-only health/tint plus these three fade fields and a known
function-entry counter at `0x4359a0`; do not repeat the four loading-only
samples or alter guest timing/state to force the result. Exact excerpts and
arithmetic checks are in `scratch/runs/20261018-outlaws-tint-fade-source-audit/`.
No new runtime/build was started. The measured full-health correction below
supersedes prior visual death assumptions, while live-turn proof remains open.

## Correction: sepia town sampled with full health and explicit game tint

`scratch/runs/20261018-outlaws-health-tint-observation/` supplies the missing
numeric discriminator. All four read-only samples returned inventory
`0x083fdd10`, health bits `0x41200000` (**10.0**), health-lost counter 0,
health-gained counter 0 and no unknown reads. The first three frames show
loading, with tint amount/color zero. At three seconds the frame shows sepia
town with revolver and hearts, while health remains 10.0 and tint changes to
amount 255, color `0x004e8ca8` (enable 1 throughout).

**Earlier references in this historical log to “sepia/skull/death” were
visual interpretations, not measured death. Sepia does not establish
depleted health: this run directly demonstrates sepia with full health.**
Do not promote prior turns to verified live control retroactively: those
runs did not sample health, and their postrelease behavior still needs
separate evidence. Original forward-motion evidence remains valid.

| Target | Batch | Last guest tick | Health | Lost/gained | Tint amount/color |
| --- | --- | --- | --- | --- | --- |
| 0.5 s | 23607 | 53186 | 10 | 0/0 | 0 / 0 |
| 1 s | 23648 | 53662 | 10 | 0/0 | 0 / 0 |
| 2 s | 23822 | 54685 | 10 | 0/0 | 0 / 0 |
| 3 s | 24065 | 55681 | 10 | 0/0 | 255 / 0x4e8ca8 |

Host sample times were 1792352956179/6679/7680/8677 ms. Sample/PNG commands
are adjacent, not atomic; last ticks can be stale. Exact samples are in
`health-tint-samples.json`. Source caller `0x429a4c` pushes the same color
to `0x4984e0`, then `0x429a5e` sets amount 255 through `0x498450`; identifying
that caller's mode/state predicate is the next source question, not an
established emulator rendering defect. No health/tint state was written.

Pure tests covered checked translation, null/high/unmapped/noncontiguous
pointers and nonfinite health becoming unknown, synthetic memory unchanged,
four timed samples and early-close balanced release. Runtime used the same
real-time registered original route and guards; only Main Game/GOOD mouse
holds, no keyboard/forward/retry. Launch HEAD
`67a22dd9424b7aa6b7b4eb2dde910b216955ccb9`; module `fd1613e2…`, 3,149 pins
and 31 originals unchanged. Child 2392292/controller 2392275 exited zero at
19:49:43.678Z after 80.743 seconds, both absent/group empty. Log 3,780,911
bytes; minimum free disk 2,296,963,072 bytes; no guard fired. Reviewed partial
`result.json` was published last and runtime explicitly released.

## Mapped health and palette predicates; retained pixels do not settle death

Bounded source/resource audit now identifies the original health field.
Inventory constructor `0x43b8d0` initializes `+0x20` to IEEE float 10.0 at
`0x43b918`; its returned pointer is stored at `0x5d67f8` by `0x42a973`.
Health gain `0x43f660` adds to that field, clamps at 10.0 and updates the
`Health Gained` counter `0x5d66fc`. Damage `0x440240` subtracts from it,
clamps at zero, updates `Health Lost` counter `0x5d66f8` and writes the field
at `0x4402e8`. The counter names are grounded in original string references,
not inferred only from arithmetic. Constructor health is not a measurement
of health when the retained town frames were captured.

HUD code `0x465c41` reads this float, converts it to an integer and updates
ten heart sprites in pointer array `0x53492c`. At `0x465ceb` it tests the raw
field with signed `test/jg`: nonpositive selects alternate indicator pointer
`0x534954` while withdrawing the normal heart container `0x5348e0`; positive
does the reverse. `0x468067` constructs ten `INTHEART.NWX` elements and
`0x468118` constructs the alternate element using frame/sequence argument 2.
The original LAB directory validates 504 bounded entries, including this
resource, `INTERFAC.NWX`, `INTERFLR.NWX` and `cidjames.itm`. The latter names
`SND_DIE=jadie.wav` and `DIE_CHOR=21`; no retained sound/animation state was
sampled. The alternate resource image has not been decoded and matched to
the observed skull, so this is a mapped health-dependent indicator, not yet
pixel-level proof of the earlier death classification.

Palette tinting is independently implemented: `0x498450` accepts amount
0..255 into `0x51dfc4`, `0x4984e0` sets color `0x51dfc8`, gated by enable
`0x51df9c`. Both regenerate a 256-entry palette through `0x498bb0` and the
display callback. That transform uses channel-weighted intensity and tint
state; it does not read health. Therefore a sepia frame alone cannot prove
death. This does not establish a renderer defect or rule out actual damage:
the retained observations contain neither health nor tint-state samples.

The concrete next discriminator is a bounded read-only sample of current
inventory pointer `0x5d67f8`, its checked `+0x20` raw bits/float, both health
counters and tint enable/amount/color, paired with the existing screenshot.
Positive health with sepia would reject the visual-death inference; zero
health would support depletion but still require locating when/how it fell
from the constructor value. No guest writes or change to original assets is
needed. No runtime/build was used for this audit. Original SHA verification,
LAB entry bounds and float decoding passed; exact disassembly/resource
evidence is retained in `scratch/runs/20261018-outlaws-hud-source-audit/`.
Earlier forward success remains valid; live-turn qualification is unchanged.

## Early transition: loading to sepia town with continuous sampled ticks

`scratch/runs/20261018-outlaws-early-transition-observation/` completed the
distinct four-sample real-time registered run. Ordinary Main Game/GOOD mouse
holds were the only guest inputs. Reviewed 0.5/1/2-second frames show level
loading; the three-second frame shows sepia/skull town with a visible
revolver. This does not capture an alive-to-dead transition, identify numeric
health, or resolve whether the visual state reflects an initialization,
damage or rendering problem. Prior death classifications remain visual
observations rather than a mapped guest death-state variable.

| Target after GOOD release | Host sample ms | Batch | Last guest tick ms |
| --- | --- | --- | --- |
| 500 ms | 1792352353478 | 20961 | 49625 |
| 1000 ms | 1792352353980 | 21000 | 50124 |
| 2000 ms | 1792352354979 | 21170 | 51109 |
| 3000 ms | 1792352355977 | 21409 | 52123 |

Startup baseline was 74 and elapsed offset, pause latch and depth were all
zero in every sample. Last guest ticks advanced 2,498 ms over a 2,499-ms host
sample interval: no jump is visible at these four points. Samples read the
last consumed tick, which can be stale; adjacent sample/PNG commands are not
atomic and scheduled host times are not exact guest render times. The next
blocker is mapping initial health/death or rendering-state semantics, not
another identical timing replay. No keyboard, forward, guest write, retry,
build or browser action occurred. Core forward evidence is retained and
live turning remains unverified.

Launch HEAD `19e0d9aab05a66f1e98113c1880a63a1fff9d136`, module `fd1613e2…`,
3,149 physical pins and 31 original records remained unchanged. Child
2380101/controller 2380083 exited zero at 19:39:33.674Z after 69.888 seconds;
both absent, owned group empty. Log 3,146,138 bytes; minimum free disk
2,348,400,640 bytes; no guard fired. Exact samples, reviewed frames and
limitations are in `clock-samples.json`, `review.json` and the last-published
partial `result.json`. Runtime was explicitly released to the coordinator.

## Source-only death/timing boundary audit

The real-time run's host-issued timeline narrows the missing interval:
launch 19:22:44.043Z; GOOD down 19:23:34.385Z (batch 20373); up
19:23:34.636Z (20469); released capture 20470 still difficulty; settled
capture requested 19:23:37.636Z (21070) already dead. Thus the captured
death predates subsequent human review, within the automatic three-second
settling interval after release. These are command issue times, not exact
guest rendering timestamps; queued delivery/capture work can lag. The menu
had consumed about 50 seconds of host time before GOOD, but that is not
established as 50 seconds of active gameplay.

Authentic `oldemo.exe` disassembly identifies the actual time abstraction:
`0x437bcd` calls `timeGetTime` and stores the startup baseline at `0x533414`;
`0x4396f0` returns `timeGetTime - [0x533414]`. `0x405fc0` returns that elapsed
value minus `[0x502cd4]`, or the latched `[0x502cd8] - [0x502cd4]` when
`[0x502cdc]` is nonzero. `0x405ab0` increments/decrements this pause-depth
value, latches time on the first pause, and adds paused duration to the
offset on final resume. `0x405b00` rebases the offset to make elapsed time
equal its argument. These semantics prevent treating menu wall time as
gameplay elapsed time without observing the offset/depth. No health
initializer, damage writer or death-state address was reliably identified
in this bounded audit; no numeric starting-health claim is supported.

The executed CLI flags select wall ticks, and the imported `timeGetTime`
handler reads `host_get_ticks`; original imports include `GetTickCount` and
`timeGetTime`, with no named QPC import in oldemo. Retained generic snapshots
do **not** sample guest tick values: their `frozen.tickMs=200` describes the
unused batch-clock configuration even under real-ticks. There is no retained
clock/health series that can distinguish initialization error, game-time
jump, rapid normal damage, or another simulation defect. Earlier verified
forward motion remains valid; full turning remains unverified.

A distinct next discriminator, requiring a coordinator runtime slot,
is a short passive transition capture after ordinary GOOD: at most four
early frames (0.5/1/2/3 seconds after release), with matching read-only samples
of exported `get_tick_count()` (last guest timer read), four bytes at
`0x533414`, and twelve bytes at `0x502cd4`. No timer getter should be invoked
to manufacture a guest read. This can reveal an alive-to-dead transition and
test elapsed-clock continuity; it cannot identify damage without subsequently
mapping health/death semantics. No movement, API polling log, forced pause,
state write or identical three-second-only replay is proposed. Original
clock import/xref evidence is retained in
`scratch/runs/20261018-outlaws-death-clock-audit/`. No runtime/build was used.

The source-only packet is now prepared at
`scratch/runs/20261018-outlaws-early-transition-prep/PLAN.json`. It retains
the real-time registered route and existing guards. After reviewed GOOD's
independent 250-ms release, exactly four timers issue a read-only CLI `eval`
sample immediately followed by PNG at 0.5/1/2/3 seconds. Each expression reads
the last tick export and the four documented original dwords; it never calls
a guest clock getter or writes memory. Keyboard actions are rejected. Sample
and frame commands are adjacent, not an atomic guest-state snapshot, and the
last consumed guest tick can be stale. Pure tests passed exact four-sample
timing, paired captures, unchanged synthetic memory, one last-tick read per
sample, independent release, early-close cancellation, keyboard rejection,
clock flags, syntax, missing-grant refusal and source/original pin checks.
No guest/runtime/build was started. The coordinator controls the runtime slot;
the user has already authorized these ordinary diagnostics.

## Real-time registered run: dead before planned turn

`scratch/runs/20261018-outlaws-realtime-turn-observation/` ran the prepared
registered route with `--real-ticks --time-scale=1`, retained calendar/UTC,
and unchanged canonical `fd1613e2…` module. Main Game and GOOD responded to
ordinary 250-ms mouse holds. `good-released.png` still shows difficulty;
the first `good-settled.png` town frame already shows sepia/skull death.
The alive-frame prerequisite therefore failed: **no Left or other keyboard
input, and no forward input, was sent**. The controller quit normally.

Real-time clock selection alone did not avoid this boundary. This does not
prove the death's cause, invalidate the earlier observed forward movement,
or establish live turning. No retry, respawn, forced state or source fix was
attempted. `review.json` and the last-published partial `result.json` retain
the reviewed frames, actual flags and limits.

Launch HEAD was `653ee12cb0ddbf6ae9eba342cdfa5958e2362692`; 3,149 physical
pins, 31 original records and the module remained unchanged. Child 2362717
and controller 2362689 exited zero at 19:23:52.662Z after 68.619 seconds;
both PIDs were absent and the owned process group empty. Log size was
2,999,249 bytes, minimum free disk 2,395,619,328 bytes. Existing time/disk/log
guards did not fire. Runtime was released for independent root postflight.

## Source-only clock audit and real-time turn preparation

The registered run used the CLI default **200 guest milliseconds per batch**:
`test/run.js` selects that default unless an app has `cliTickMsPerBatch`, and
`lib/apps.js` gives `outlaws_demo` no override. Its Left down/up batches
29224/29396 span 172 batches: **34.4 seconds of batch-clock advancement during
a 500-ms host hold**, before any additional charged sleep time. This is a
source-backed timing discrepancy, not proof that accelerated time caused the
observed death or that all gameplay advances proportionally to this clock.

Existing `--real-ticks --time-scale=1` selects wall elapsed milliseconds in
`lib/guest-clock.js`, with no per-call increment. `test/run.js` assigns that
source to main `get_ticks`, cooperative-thread `ctx.guestNowMs`, worker clock
publication and renderer input timestamps. It does not throttle execution or
guarantee frame pacing. Explicit `--wall-clock-ms=928238400000 --tz=UTC` retains
the prior 1999-06-01T12:00:00Z calendar origin and UTC; real-ticks otherwise
changes those defaults too. No guest state is forced and no production code
changes are proposed. The generic CLI guidance about short timer-driven
16-bit captures does not establish Outlaws behavior under a wall-time run.

Fresh source-only packet `scratch/runs/20261018-outlaws-realtime-turn-prep/`
retains the registered route, original files and exact `fd1613e2…` module.
Its controller adds only the four clock flags above. `PLAN.json` requires
reviewed Main Game/GOOD choices, a fresh alive town frame, then Left 500 ms
with independent keyup and before/held/released/three-second-settled captures.
No forward input is planned. A dead immediate-before or held frame ends the
discriminator as contaminated; there is no respawn or retry. Same-life
orientation and postrelease idle must be reviewed before claiming turning.

Pure `test/test-guest-clock-source.js` and `test/test-batch-clock.js` passed.
Preparation syntax, exact clock flags, missing-grant refusal, unchanged
3,149 physical pins/31 original records and normal/early-close mouse releases
passed. Existing 180-second guest wall limit, 185-second soft/210-second hard
stop, 8-MiB log cap and 2-GiB disk margins remain enforced. No runtime or build
was started; a fresh sole-runtime grant and pin verification are required.

## Registered route validated; live-turn evidence still contaminated

`scratch/runs/20261018-outlaws-registered-turn-observation/` is the first
observed `--app=outlaws_demo` route in this lane. Its registry executable plus
29 companion mappings match the prior 30 authenticated guest names and bytes,
cwd `C:\OUTDEMO`, empty arguments. Ordinary held Main Game/GOOD choices reach
the original town. The registered route therefore passes startup/menu/level
rendering, but this is not a successful live-turn observation.

No forward input was sent. `good-settled.png` was reviewed as full-color alive
with weapon/health, but `live-left-before.png`, captured immediately before
Left injection, already shows sepia/skull/death. The balanced 500-ms Left hold
was acknowledged at batches 29224/29396 and dequeued with correct scan payloads.
Later rotation and `live-turn-idle.png` are death-contaminated, so live turn
and release-to-idle control remain unverified. No respawn, retry or forced
state followed. The next source-only question is the CLI's default 200-ms
guest tick per batch versus real-time pacing during screenshot review; this
is a timing hypothesis, not a new runtime authorization or an emulator fix.

Canonical module remains `fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Launch HEAD was `7eb6eff3bc517e2d07a3e77220efbc0c52785669`; all 3,149 physical
source/fixture pins and all 31 original records remained unchanged. Child
2351815/controller 2351796 exited zero at 19:15:09.646Z after 107.642 seconds;
both PIDs were absent, owned group empty. Log size was 4,764,200 bytes;
postflight free disk was 2,427,518,976 bytes. Existing 180/185/210-second and
disk/log guards remained unchanged and did not fire. `review.json` and
`result.json` retain the actual registered route and partial outcome.

## Forward movement after Peek/Get repair, 2026-10-18

The normal rebuilt module after the reviewed Peek/Get selection repair now
shows ordinary player forward movement. The unchanged original direct route
reached Main Game, GOOD and the town; an Up hold of exactly 500 ms moved the
view from the street entrance, through the street in the held frame, toward
the HOTEL in released/settled frames. Fixed world landmarks changed markedly,
unlike the retained pre-fix 500-ms no-motion observation. This supports the
repair affecting original input, together with its separate API conformance
tests; this run alone does not prove every internal causal step.

Evidence is `scratch/runs/20261018-outlaws-peek-fix-observation/`:
`good-settled.png`, `level-up-before.png`, `level-up-held.png`,
`level-up-released.png`, `level-up-settled.png` and the complete receipts.
**Live turning remains unverified.** The reviewed Up-settled frame was alive,
but the immediate `level-left-before.png` was already sepia with a skull/death
indicator. Left was then held/released for 501 ms; subsequent camera motion
and `level-idle-after-release.png` cannot isolate a live-player turn or stopping
after release from death behavior. These captures are preserved, with no retry
or respawn. Combat, audio, FPS and sustained/full-game qualification remain
unestablished. `result.json` records partial forward-control success and the
turn limitation explicitly.

Tested canonical SHA-256:
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Region mirror is unchanged from below. Launch HEAD:
`3c6b9ff695e7cdf060d6357ec95925c68417c2a4`; all 3,118 source pins and all 31
original records remained unchanged. No passive counters or API polling logs
were enabled. Child 2340686/controller 2340663 exited zero after ordinary host
quit at 19:05:21.873Z (124.654 seconds); both PIDs were absent and owned group
empty. Coordinator independent postflight passed. Log size was 5,450,526 bytes,
postflight free disk 2,458,820,608 bytes; no guard fired. Existing 180/185/210 s,
8-MiB log and 2-GiB margin limits remained in force. No build occurred inside
this observation, and no browser, guest patch, forced state or licence answer
was used.

A source-only follow-up is prepared at
`scratch/runs/20261018-outlaws-registered-turn-prep/PLAN.json`. Its pure route
proof verifies `--app=outlaws_demo` resolves the same executable, 29 companion
mappings, `C:\OUTDEMO` cwd, empty arguments and original hashes as the prior
30 explicit mounts. Fixture verification passes, and 31 added fixture/manifest
pins bring admission to 3,149 physical pins. This is preparation, not registered
runtime evidence. After reviewed Main Game/GOOD, review a fresh alive level
frame and test Left/release/idle **before** moving forward into the hostile
street. Inspect the immediate before/held frames for death contamination; stop
once the boundary is clear. No follow-up runtime is authorized yet.

## Original town level reached; controls unverified, 2026-10-18

The ordinary direct route now advances through Main Game and GOOD difficulty
to a rendered first-person town with revolver, ammunition/health HUD and
chickens. Each visible menu choice used a separately reviewed 250-ms held
left mouse press with an independent release timer. Captures three seconds
after release establish both transitions. This is partial level-rendering
evidence, **not player-control or sustained-gameplay qualification**. A later
Left-arrow hold of 250 ms was acknowledged at host batches 26311/26361, but
the before/settled frames show no clear viewpoint change.

Evidence: `scratch/runs/20261018-outlaws-held-route-observation/`, particularly
`main-game-held-settled.png` (difficulty), `good-difficulty-settled.png` (town),
`level-left-turn-settled.png`, `issued.ndjson`, `review.json` and `result.json`.
The dashboard record uses candidate `outlaws-demo`, app `outlaws_demo`, outcome
`unknown` and an explicit partial/not-qualified summary. The actual route was
direct `oldemo.exe`, not a registered-app launch: cwd `C:\OUTDEMO`, empty args,
30 unique original mounts, unchanged archive and all 31 original records.

Canonical module remains
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`, region mirror
`a6869fe091c02854ac8f6cc71dd8e37b4f1156be616dd2dbaa0cc012c37bf9fa`.
Launch HEAD was `6300b350b3006be25482e48abfde911db44718c3`; physical source
identity is the retained 3,118-file manifest, verified before/after and by the
coordinator. The cooperative CLI kept 180/185/210-second guest/soft/hard
limits, 8-MiB logs and the existing 2-GiB disk margins. Only input routing was
traced; no API polling logs or API-return claims. Host quit ended the run
after 95.845 seconds at 18:13:07.644Z. Child 2281006 and controller 2280993
exited zero, both absent with an empty owned process group. Log size was
3,529,709 bytes; postflight free disk was 2,590,367,744 bytes. No guard fired,
licence was answered, guest byte was changed, build was made or retry occurred.
Audio, combat, FPS and browser/Worker behavior remain unknown.

### Keyboard boundary audit after the town capture

The shorter positive-control run,
`scratch/runs/20261018-outlaws-menu-pump-observation/`, resolves the earlier
counter uncertainty. On a reviewed menu, one ordinary Up hold lasted exactly
500 ms. Before/settled counts advanced `0x438980` from 458763 to 459237
(+474) and `0x4389d8` from 460052 to 460755 (+703); all four key-path counts
remained zero. Correct keydown/up scan payloads were dequeued for focus
`0x10001`; main queue snapshots before/held/released/settled were all empty.
The menu did not change. Neither the polling thread nor final owner delivery
is established by those observations. Child 2309360/controller 2309341 exited
zero at 18:38:35.598Z after 60.181 seconds; a quit request queued after the
55-second input cutoff was not issued. The guest time limit ended the run.
All 3,118 pins/originals remained unchanged, both PIDs absent, group empty,
and coordinator postflight passed. Log size was 769,431 bytes, postflight free
disk 2,304,499,712 bytes. Launch HEAD was
`348febabcb2baef4632f1e30eb2aa9f18b631833`, with unchanged module/region hashes
above. `result.json` preserves this partial, unqualified control observation.

Source comparison now identifies a smaller candidate than another original
run: `handle_PeekMessageA_fetch` scans pending NC_FLAGS (WM_NCCALCSIZE/WM_NCPAINT)
**before** hardware input, whereas `handle_GetMessageA_fetch` reads hardware
input **before** NC_FLAGS. With a pending NC message and an already queued key,
an unfiltered PM_NOREMOVE peek can expose `0x85`, followed by GetMessage removing
`0x100` instead. The original inspects keys before GetMessage, so this ordering
asymmetry can bypass its key path even with correct host dequeue and no queued
residue. The source ordering is verified; its causal role in Outlaws is still
unproven. Foreign-thread theft is not required by this hypothesis. Current
foreign-owner routing already forwards input-origin records to the owning
shared USER queue and retains input if that queue is full.

Next use a small isolated API conformance case: one plain HWND, one thread,
no redraw or events between calls. Establish input-only and NC-only controls,
then cross NC bits 1/4 with queued KEYDOWN/KEYUP. Compare exact HWND/message/
wParam/lParam from PeekMessage(PM_NOREMOVE) and immediate GetMessage, host
dequeue count and pending flags; also compare Peek(NOREMOVE)/Peek(REMOVE).
Require one preserved delivery and consistent selection while state is
unchanged. Only if those pass add a foreign polling thread and filtered peeks.
The canonical exports `nc_post_paint`/`nc_post_calcsize` plus ordinary API thunks
can support a test without rebuilding; `bootRenderHarness` would compile the
full tree and needs a separate build grant. Relevant ownership is
`src/09a5-handlers-window.wat`, queue helpers in `src/10-helpers.wat`, and tests
`test-nc-flags-message-wake.js`, `test-peek-message-filter.js`,
`test-message-extra-info.js`. Source-only recipe and comparison are retained in
`scratch/runs/20261018-outlaws-peek-get-source-audit/audit.json`. No runtime or
production fix was performed during this audit.

The earlier longer counter run is retained at
`scratch/runs/20261018-outlaws-keyboard-count-observation/`. It repeated the
ordinary menu/GOOD/town route, then held Up and Left separately for exactly
500 ms each, with independent releases and three-second settled captures.
No clear world-landmark movement or turn appeared. Four counters at
`0x438a60`, `0x438a00`, `0x43aaa0`, `0x493ab0` remained zero before, during,
and after both inputs. They were armed, but no known-executing control site
was selected, so this does not establish a lost event or a production defect.
Host key acknowledgements were batches 12885/12936 and 15268/15325.
Child 2293523/controller 2293504 exited zero at 18:25:40.617Z after 144.053 s;
both PIDs were absent, group empty, all 3,118 pins/originals unchanged, and
the coordinator independently verified cleanup. Logs were 2,223,518 bytes;
postflight free disk was 2,543,853,568 bytes. No guard fired. Module and region
hashes remain those above; launch HEAD was
`7931dc7486c94a68949e019956ea87a4bd14a60d`. The dashboard result remains partial
and not qualified; this failed player-control observation is preserved.

Closer review found useful host dequeue evidence already in that log:
Up down/up carries lParam `0x01480001`/`0xc1480001` at lines 11899/11955;
Left carries `0x014b0001`/`0xc14b0001` at lines 14227/14289. Each following
`check_input_hwnd` reports focus `0x10001`. The ordinary renderer FIFO was
therefore drained with correct scan-bearing payloads. Main and the cooperative
helper share this callback, so these records do not identify the polling
thread or prove subsequent owner-queue delivery to the game's keyboard path.

Counter audit: `src/13-exports.wat` compares the configured address with guest
EIP at run-loop block boundaries; it does not take an RVA or count every
instruction. The executable's original base is `0x400000`, and retained main
EIP samples agree with these absolute addresses. The key branches are jump
targets and the translation/consumer sites are call targets. Totals live in
shared memory; cooperative instance creation inherits each `set_count` and
re-arming the same address does not reset totals. The pure inherited-global
test passes all 74 setters. Thus an obvious base error or main-only counter
explanation is unsupported. Counters enable the debug tier and are not
performance evidence. The log records one helper starting at `0x01118890`.

The next discriminator can be shorter and menu-first: retain the same four
sites and add `0x438980` (pump entry) and `0x4389d8` (message-selection block),
both positively sampled in the retained main-thread startup/menu log. After
reviewing a fresh menu, take counts, hold ordinary Up 500 ms/release, and
capture counts plus existing `dump-msgq` before/held/settled. The latter reads
the main instance's queue without consuming it; an empty queue does not rule
out transient consumption or another thread's queue. Stop on that boundary
within 60 seconds guest/85 seconds hard rather than repeating level loading.
If the positive sites themselves remain zero, fix the measurement before
inferring game input behavior. If they advance while key sites do not, retained
scan-bearing dequeue and queue records separate ownership/queue availability
from original scan translation. A later level-specific run could add
`0x4d2ab3`, positively sampled during both failed holds, as a rendering control.
No runtime is authorized for this proposal. No API polling log, hidden input,
forced state, production patch or build is needed. The existing pure keyboard
message-ordering test also passes; it cannot establish the live owner path.

The original executable processes keyboard messages **before DispatchMessage**.
At original VA `0x4389bc` it calls PeekMessageA with PM_NOREMOVE. Its switch
maps WM_KEYDOWN to `0x438a60` and WM_KEYUP/WM_SYSKEYUP to `0x438a00`.
The down path requires LOWORD(lParam) == 1, extracts the scan code from the
upper word, and calls `0x43aaa0`; that routine maps the scan-code byte through
the table at original VA `0x533418` (with special virtual-key handling).
Nonzero results feed `0x493ab0` at `0x438a98` for down and `0x438a35` for up;
release sets the internal 0x80 bit. Only afterward does GetMessage remove the
message. A matching main-window WM_KEYDOWN can deliberately skip
TranslateMessage/DispatchMessage. Therefore absence from dispatch tracing
does not establish missing delivery. These are static original addresses,
not new guest-state writes or observed execution of those paths.

The four inspected original PE import tables (`oldemo.exe`, `Olkbd.dll`,
`Olmouse.dll`, `olhook.dll`) contain no GetKeyboardState/GetKeyState or
DirectInput entry imports. GetAsyncKeyState occurs in the executable's mouse
polling path and Olmouse. Olkbd identifies itself as the keyboard configuration
DLL; its message/subclass imports alone do not establish gameplay consumption.
Dynamic resolution elsewhere is not excluded by this import inspection.
The retained live snapshots report focus/main HWND `0x10001`, visible Outlaws
640x480; this does not prove every queued key reached the game.

CLI `keydown`/`keyup` use renderer.handleKeyDown/Up, updating physical state
and queuing scan-bearing ordinary messages. Numeric arrow fallbacks use Set-1
scan codes; the pure keyboard-message regression passes. PeekMessage's source
path preserves `pending_input_lparam` in the returned MSG. No production bug
has yet been demonstrated. Disassembly and import evidence are retained at
`scratch/runs/20261018-outlaws-keyboard-source-audit/`.

A next separately granted observation should retain route-only logging and
the proven menu holds, then capture a level idle baseline, ordinary Up hold
500 ms/release, settled frame, and separately reviewed Left/Right holds with
release and idle frames. Compare stable world landmarks, not animated chickens
or weapon pixels, and stop after a clear boundary. Existing passive
`--count=0x438a60,0x438a00,0x43aaa0,0x493ab0` plus explicit `hit-counts` requests
before/after each action can distinguish arrival in the original key branch
from later processing without high-rate API logs. Counters are diagnostic
observations, not movement proof; no raw-message injection, DirectInput-state
injection, focus override or guest-memory write is proposed. Keep the same
time/disk/log guards and independent key release. No runtime was started for
this audit; another lane owns execution until the coordinator grants it.

## Original main-menu validation, 2026-10-18

The authentic demo now reaches its visible main menu through ordinary
`C:\OUTDEMO\oldemo.exe`, cwd `C:\OUTDEMO`, empty arguments and all 30 unique
original VFS names. No input, installer answer, licence response, replacement
DLL or guest patch was used. This establishes startup and menu rendering only;
gameplay, navigation, audio and browser/Worker behavior remain untested.

The reviewed captures and complete receipts are retained under
`/home/user/wine-assembly/scratch/runs/20261018-outlaws-original-fixed-lifecycle-observation/`.
`sample-0.png` is black startup, `sample-1.png` shows the Outlaws title,
`sample-2.png` shows the menu by approximately 30 seconds, and `final.png`
shows the menu at 60 seconds. Main Game, Multiplayer, Historical Missions,
Load, Options and Exit are visible. `review.json` was published after artifacts;
there is no dashboard candidate association because Outlaws is not registered.

Tested canonical module SHA-256:
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`.
Region mirror:
`a6869fe091c02854ac8f6cc71dd8e37b4f1156be616dd2dbaa0cc012c37bf9fa`.
Runtime source is integrated commit
`83bbb77fdf7b9823359bdf8c927a02f2e878b34b`; later documentation-only HEADs
are recorded in the identity receipt. All 3,118 physical pins were verified
before and after execution. Original archive SHA-256 remains
`501f37aa475b6c27c87ce04e30b5207f91b81603cb376aaa9ffde1647a40e7b3`;
all 31 original records are unchanged. Exact arguments, pin list and controller
are in `launch.json`, `current-pins.json` and `controller.js` in that run.

The existing CLI used cooperative scheduling, 200,000-block batches, a
60-second guest limit, a 65-second host quit and an 85-second process-group
kill guard. Logs were capped at 8 MiB. Admission required 2 GiB + 128 MiB;
250-ms disk checks stopped at 2 GiB + 64 MiB. No guard fired. Child PID
2232312 and controller PID 2232304 exited zero; the child terminal receipt is
2026-10-18T17:27:44.499Z. CLI statistics report 23,298 batches in 59.999 seconds.
The minimum observed free disk, including postflight, was 3,218,223,104 bytes.
Owned-process inventory was empty; the coordinator independently verified
source/original identity and process cleanup before releasing the lane.

Earlier failures remain in separate `20261018-outlaws-original-*-observation`
directories: QT reached unimplemented KERNEL.184 GlobalDOSAlloc; the next
module exposed built-in dependency classification; the subsequent run stopped
at the deliberate KERNEL.95 nested-load boundary in WDIR62 LibEntry. The final
counted fixed-module lifecycle implementation passed these observed boundaries.
This does not establish general image-backed nested loading or reverse thunks.

The next ordinary action is Main Game, followed only by choices visible in a
fresh capture. The original README documents GOOD as novice difficulty,
Up Arrow as forward, Left/Right Arrow as turning, and Escape as the in-game
options menu. A level screenshot and balanced movement/turn input with
before/after captures are still required before claiming control or gameplay.

The separately granted Main Game attempt is preserved at
`/home/user/wine-assembly/scratch/runs/20261018-outlaws-main-game-observation/`.
The reviewed live menu remained visible after a click at (200,205), followed
by separately reviewed Enter and Down Arrow holds of 150 ms each. The hand
cursor moved, but no difficulty screen or level appeared. `issued.ndjson`
records balanced host keydown/keyup pairs; guest consumption is not proven.
The startup trace window ended at batch 500, before these inputs, so later
input/control diagnostics are absent. Review ordinary input delivery and its
diagnostic coverage before inferring an application defect. `final.png` and
`menu-input-boundary.png` show the unchanged menu. Host quit ended the run
after 139.650 seconds; child 2245472 and controller 2245447 exited zero, with
empty owned-process inventory and unchanged 3,118 pins/originals. Minimum
observed free disk including postflight was 2,866,331,648 bytes. No guard,
licence response, build or retry occurred. Gameplay remains unestablished.

### Source-only input audit

Authentic `oldemo.exe` imports GetCursorPos, GetAsyncKeyState, foreground/focus
queries and the normal USER message pump. Its mouse polling routine at original
VA `0x00439410` first compares the foreground HWND with its own window, then
reads cursor position. At `0x0043945f` and `0x00439479`–`0x004394a1` it polls
buttons 4/1/2 and tests `AH & 0x80`: the currently-down bit, not the low
pressed-since-last-query bit. These are static callsites, not observations of
the failed interactive run. `Olkbd.dll` imports message pumping and window
subclass APIs; `Olmouse.dll` additionally imports asynchronous button and cursor
queries. `olhook.dll` installs hook ID 10, so its name alone does not establish
a missing keyboard-hook dependency. Import identities and relevant disassembly
are retained in `scratch/runs/20261018-outlaws-input-source-audit/`.

The existing CLI `click` calls renderer mouse-down and mouse-up in one batch;
it explicitly disables the renderer's release-hold floor because scheduled
input owns timing. Consequently cursor motion may persist while a frame-based
GetAsyncKeyState high-bit poll misses the entire press. This is a concrete
hypothesis for the click result, not a demonstrated emulator defect. It does
not explain the separate 150-ms keyboard holds. Numeric Enter/arrow inputs do
carry scan-code lParams; the pure keyboard-message regression passed, as did
all 35 renderer button-hold checks. Neither test proves delivery to Outlaws.

Next bounded observation should omit `--trace-from/--trace-to`: the CLI wraps
`console.log` with that gate, which hid later control acknowledgements as well
as traces. Existing `--trace-input` reports mouse routing/drop branches;
`--trace-input-dispatch` reports keyboard/mouse messages entering DispatchMessage
with HWND, message, wParam and lParam. Add
`--trace-api=GetAsyncKeyState,GetForegroundWindow,GetFocus --trace-api-paused
--trace-api-dedup`, then use the existing `trace-api` control action for only
a short window around each reviewed input (at most 750 ms, retaining the
8-MiB log cap). Startup remains untraced; no host-import-wide logging is needed.

The distinguishing ordinary action is mouse-down at the reviewed Main Game
location, hold 250 ms, then mouse-up, each through the CLI's existing handlers;
record their acknowledgements and before/held/released frames. A high-bit
GetAsyncKeyState return during the hold plus matching foreground HWND separates
polled delivery from game logic. For Enter/Down, require actual keydown/keyup
DispatchMessage records with scan-bearing lParams before attributing rejection
to the application. A consumed or misdirected event instead identifies the
input ownership/routing path to investigate. Do not inject DirectInput state,
raw guest messages, focus overrides, menu commands or guest-memory writes.
No runtime, build or production-source fix was made during this audit.

Preparation caught a constraint on that proposed trace combination:
`--trace-input-dispatch` is an API-log consumer and prevents the CLI from
starting with API logging paused, despite `--trace-api-paused`. The first
held-mouse discriminator therefore omits the dispatch flag and retains
`--trace-input` plus initially paused selected GetAsyncKeyState/foreground/focus
traces. Independent timers release the ordinary mouse button at 250 ms and
turn API logging off at 650 ms; pure tests verify both and emergency release.
This tests the mouse polling hypothesis without broad startup logging; it does
not provide decoded keyboard dispatch evidence. A separate keyboard-focused
observation remains necessary if keyboard delivery is still in question.

The granted held-mouse run at
`scratch/runs/20261018-outlaws-held-mouse-observation/` reached the menu and
acknowledged ordinary mouse-down at (200,205), batch 16301. Routing reported
candidate/child HWND `0x10001`, `dispatched=1`. Mouse-up was issued exactly
250 ms later. The held capture still shows the menu; the released capture
shows black with the hand cursor, so the menu cleared, but no settled next
screen was observed. Selected API tracing produced 64,505 GetAsyncKeyState
entries and 21,504 GetForegroundWindow entries without return values and hit
the 8-MiB log guard after approximately 447 ms. Emergency trace-off/quit were
issued; child 2266213 received SIGKILL and controller 2266205 exited 1 at
2026-10-18T17:59:10.311Z. Mouse-up/trace-off acknowledgements were not retained.
Owned processes were absent and 3,118 pins/originals were unchanged; minimum
observed free disk including postflight was 2,643,148,800 bytes. Preserve this
incomplete diagnostic: it does not prove the high-bit return, completed menu
activation, difficulty selection or gameplay. No retry or production fix was
made. Reduce diagnostic volume before any separately granted observation.

Owner `/root/outlaws_original_startup`, task
`NEW-GAME-OUTLAWS-DEMO-20261015`. Source preparation only; runtime awaits an
explicit coordinator grant after Army Men acquisition releases the sole box.

`outlaws-demo-launch-manifest.json` maps all 31 verified original records to
30 Windows names. The identical `wdirnop.com` duplicate is recorded separately
and preserved in the original package; the VFS mounts `WDIRNOP.COM` once.
This nonpublic manifest is not a public app registration. Original README
requires extraction followed by `C:\OUTDEMO\oldemo.exe`, empty arguments,
cwd `C:\OUTDEMO`. No registry import, replacement DLL, config patch, installer
answer, or guest input is included.

The controller accepts `ROOT PAYLOAD NEW_OUTPUT`. The proposed payload is
`/home/user/outlaws-original-acquisition-20261015/payload-js-verified` and
proposed donor ROOT is `/home/user/jedi-knight-checkout` on `bx_9ef2wdsw`.
Neither donor suitability nor current runtime state has been checked in this
lane. The controller must first physically verify every compiler/source pin
and canonical module SHA-256 `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
The pins identify the exact main reference commit; this does not claim the
donor's historical host JavaScript equals current main. Every tracked physical
host file is hashed separately, and the index listing and HEAD are retained.
A mismatch blocks execution rather than causing a rebuild or donor mutation.

The run uses the existing headless CLI, full-frame PNGs every ten seconds,
snapshots, complete stdout/stderr, explicit 120-second guest guard and
150-second final process-group kill watchdog. Snapshot/PNG/host quit commands
are observations and shutdown, not guest menu answers. Licence/crash text
triggers immediate capture and host quit; screenshots still require human
review because image-only licence text may not appear in logs. No initial
input means such a prompt cannot be answered accidentally. The fresh output
directory contains an exact copied VFS, controller, source/module/fixture
identity, command, terminal result and postflight hashes/process inventory.
The coordinator must independently inspect active processes before declaring
the exclusive slot released. Preserve failures and inspect full-frame images
before any further ordinary action.

`--no-threads` selects cooperative guest-thread scheduling, not the real Worker
thread backend; this is explicitly a headless cooperative startup probe.
It cannot establish browser or real-thread runtime compatibility. Process
inventory records command names only, and postflight rejects survivors in
the owned process group without collecting unrelated command arguments.

This source does not establish startup, menus or gameplay. After the first
observed boundary, select the next ordinary action from actual output. A
licence choice requires the user's decision; a crash requires its actual API
or fault diagnosis. Later gameplay proof needs idle, held/released Up and
Left/Right, visible attributable motion and full-frame screenshots. WASD is
not the documented default. Audio/FPS/combat remain separate unknowns.

Before execution: obtain explicit slot grant, inspect previous owner terminal
and clean postflight, take independent process inventory, then verify matching
source/module and all originals. No local build/VM/browser is permitted for
this lane. Recover compact receipts and screenshots into shared
`scratch/runs/20261015-outlaws-original-startup`; retain the remote original
fixtures and full copied VFS separately. Follow `ops/README.md` for dashboard
metadata, and do not attach evidence to an unrelated candidate if Outlaws has
not yet been added to the candidate corpus.

## Observed original startup failure, 2026-10-15

Coordinator granted the sole runtime slot after Army Men's explicit release.
Independent preflight at 14:17:38.933Z read Army Men's 14:15:59.849Z clean
postflight, found no active runtime, and physically matched all 142 compile
pins and canonical module `937466db…`. The frozen controller was commit
`61cf2cd835a1c1ee4977aebe73d074e51549f1de`, SHA-256
`7718d1f8c030bdc504b543028eed63f24a3551d87cdfef830a4af179af6371d1`.

Boat controller PID 153370 started 14:18:15.309Z; child PID/process group
153383 loaded the original PE entry `0x004f10d0` and reported working
directory `c:\outdemo`. It immediately hit the real fail-fast boundary:

```text
=== UNIMPLEMENTED API: OemKeyScan ===
EIP: 0x0043a8bb  ESP: 0x074ff9f4  EBP: 0x00000100
[0x074ff9f4] = 0x0043a8f1  <- return address
[0x074ff9f8] = 0x00000000  <- argument
*** CRASH at batch 0: unreachable
```

The original caller loads ESI from IAT `0x005da450`, starts a 256-entry
loop (`EBP=0x100`), pushes its index at `0x0043a8ee`, calls ESI at
`0x0043a8ef`, and would consume EAX at `0x0043a8f1`. This is the first
observed failure, not proof that later startup APIs work. `git grep` found no
existing `OemKeyScan` implementation or API-table entry in the pinned source.
The next step is a real keyboard-translation API implementation and focused
tests, followed by a fresh matching module and separately granted original
startup run. Do not substitute a silent-success handler or change guest bytes.

Child exit 1 was recorded at 14:18:15.992Z, controller API exit 1 at
14:18:16.181Z. Crash-text monitoring issued only host capture/quit commands;
there were no guest inputs. The failure preceded PNG capture, so **no
screenshot exists**. No menu, licence prompt, gameplay, audio or controls
were reached. No retry followed this unexpected failure.

The donor's Git HEAD was `03641536b256ec78527fee514ea2dfa4c31639e4`; this
is metadata, not its tested tree identity. Its historical indexed checkout
and all **6,527 physical tracked files** are recorded in `run/identity.json`
and `run/source-before.json`. Compiler closure matches reference
`32a28da07a355a2797efb8643d2fd8d7fa87ee1d`; host JavaScript is explicitly
the physically hashed historical donor, not claimed equal to current main.

Independent postflight at 14:19:27.170Z rehashed all 6,527 host source files,
all 31 original payload records, immutable package and module unchanged.
Command-name-only process inventory found no active runtime or owned
controller/child process group. The slot was released to the coordinator.

Evidence is recovered at shared
`scratch/runs/20261015-outlaws-original-startup/`: `run/output.log`,
`run/{identity,source-before,launch,child,terminal,stop-reason,postflight}.json`,
`run/controller.js`, `independent-postflight.json`, frozen manifests and API
receipts. Archive `evidence.tar.gz` is **578,651 bytes**, SHA-256
`241f8911ad2071909fcdeb368d9ff91bb98f76e950744d6abf6314ccc01285dc`,
verified after download. The identical remote archive and full copied VFS
remain at `/home/user/outlaws-original-startup-20261015`; original acquisition
payloads remain untouched in their separate directory. No dashboard
`result.json` was published because this lane has no corpus registration;
these notes preserve the startup failure without misattributing evidence.

Source checks passed: syntax, whitespace, complete manifest accounting and
missing/tampered original rejection. The runtime failed as documented.
