# MDK2 grenade transition: predicates and evidence limits — 2026-11-04

The retained run does **not establish why the first grenade instruction was
absent**. It establishes visible dummy breakup/disappearance and no instruction
in the sampled frames. The specific unverified transition predicate is
`l1_r1.TutFuncs["state 4"].tasks >= 2`, credited by death-animation callbacks,
with the tutorial dispatcher still active. No runtime defect or required extra
player action before state 5 is proved. No repair is justified by this evidence.

This offline review follows [the published observation note](mdk2-left-target-grenade-20261104.md)
at `d6f10e18c`. Analysis baseline is
`c66edc193102d3bde2588661833501a37e7faa6e`; original execution source is
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, canonical module
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
The predecessor's `accepted-to-execution-source.patch` remains in its run.
New analysis, reference hashes, relevant binary diff and owned new-file patches
are in `scratch/runs/20261104-mdk2-grenade-transition-cause/` (ignored).

Original media was read at
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/data/scripts.zip`, SHA-256
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`.
ZIP method 10 was decoded only in memory with the existing `tools/mpq.js`
`explode`; decoded `level1.lua` SHA-256 is
`7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe`.
No media was changed or copied, and no game, browser or sandbox operation ran.

The exact script chain is:

| Original `level1.lua` lines | Required behavior |
| --- | --- |
| 2217–2240 | State 4 initializes `tasks=0`, `statetasks=2`; both dummies receive `r1DummyOnDamage` and `r1DummyOnAnimLoop`. |
| 4554–4571 | Each damage callback increments `gob.hitcount`. At `hitcount >= 10` and `not gob.dead`, set `dead=1` and call `mdkDecoyDeeeeeeeeeeeestroy`. This function does **not** increment tutorial tasks. |
| 4544–4550, 3132–3137 | `r1DummyOnAnimLoop(gob, animid)` calls `TaskInc("state 4")` only when `animid == ANIM_DIE`. `TaskInc` adds one to that state's counter. There is no per-dummy deduplication here; the literal test is a total of at least two credits, normally one per dummy. |
| 4859–4876, 4883–4900 | Initialization installs `Level.TutorialOnUpdate`. On an update, `Save.intutorial` must be truthy, current tasks must reach `statetasks`, and `not l1_r1.holdstate` must hold. The dispatcher calls `EndState`, increments numeric `state`, then calls the new state's `InitState` in the same update. `scriptrunning` is not a dispatcher gate. |
| 2254–2258 | State 4's `EndState` plays `ANIM_DIE` on arrows 06/07 and assigns `statename="state 5"`. It does not wait for arrow animations to finish. |
| 2265–2285 | State 5 installs the explosion event, starts a script: preload `l1_tut8.wav`, display `strings.l1tut_dr21`, wait for `mdkDialogIsDone`, then clear `scriptrunning` and credit state 5. It also creates `OBJ_GRENADEITEM` at `l1_r1grengen` and spawns arrow 09. |

There is no facing, distance, jump, sniper toggle, extra shot, pickup, or grenade
explosion condition between state 4's completed counter and that first state 5
panel. The `<4` center-arrow distance test belongs to state 2 (2178–2182),
before the dummy stage, and is not checked again here.

Pickup is a **later** native action: state 5 requires two tasks (2263–2264).
One comes from its completed dialogue script. `r1SGOnPickedUp`, with
`id==OBJ_GRENADEITEM`, removes four items, kills arrow 09, clears the grenade
reference and starts a one-second timer (4584–4590); timer state 2 credits
state 5 (3012–3013). Only then can state 6 display `strings.l1tut_dr22`, the
throwing instruction (2295–2308). Pickup cannot explain a missing first state 5
panel. No retained pickup callback or inventory observation proves that action.

The reviewed existing PNGs `review/targets-settle-35488.png` and
`review/grenade-center-37360.png` show absent dummies, arrows visible in the
former and absent in the latter, health 100, and no dialogue panel. Their
JSON companions contain renderer/module/input observations, **no Lua state or
animation callback trace**. The 643 recorded commands include 591 step requests
totaling 37,360 steps and 22 trusted DOM key/button events. After the initial
ArrowUp hold (commands 565–567), the gameplay controls are mouse aiming and two
left-button firing holds; the final "center" action (639) is mouse motion to
`(440,500)`, not walking to the room center or grenade pickup. There are no
post-shooting movement commands. No Space/sniper-toggle event is recorded.

Thus neither ten callbacks per target, two `ANIM_DIE` callbacks, the task total,
`Save.intutorial`, `holdstate`, state 5 initialization nor its dialogue script
cursor was measured. Advancing another 1,872 steps does not measure any of
them, and sampled screenshots cannot exclude a panel appearing between samples.
Arrow loss is consistent with state 4 ending but is not unique proof: the
native `KillTutorial` path also kills those arrows/dummies, clears
`Save.intutorial`, removes `OnUpdate`, and stops a running script
(2854–2884, 2973–2979). Its sniper-damage trigger at `snipe1_01.OnDamage`
(3114–3123) was not demonstrated in this run. Neither cancellation nor a missed
death callback should be promoted from a possibility to the cause.

One concrete next ordinary-control attempt, if separately authorized: release
fire after both breakups, then use a short released ArrowUp pulse toward the
front of the room while keeping the floor and grenade dispenser in view; stop
on a visible grenade/arrow or pickup and record the instruction before and
after. This tests the unperformed approach/pickup route for the later throwing
instruction; it is not a claimed fix for absent state 5 initialization. Do not
re-shoot empty positions or equate another disappearance with a task credit.

Validation: the offline checker passed 16 original-line assertions, hashed 21
retained references, and checked command/step counts and final input release.
Its initial relative module-path typo was corrected before the passing run.
No production source changed, so no production build or gameplay regression
was run. No tutorial completion, grenade use, save or runtime repair is claimed.
No box was assigned or accessed in this task. The predecessor's last runtime
handoff was `bx_kbzzavgf`, RUNNING/API idle, expiry
`2026-11-04T03:06:56.554Z`; the coordinator subsequently recorded STOPPED at
03:00:40.620Z on the messageboard. That is reported history, not a fresh status
query. Lifecycle ownership remains with the coordinator. This task ends here.
