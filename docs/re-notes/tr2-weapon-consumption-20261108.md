# TR2 weapon consumption after Action — 2026-11-08

The closed 1810 original proves native Control → successful keyboard poll →
Action EBX `0x40`. It does **not** show whether that mask reached the weapon
update, which weapon state ran, whether an arm reached its firing frame, or
whether target/aim/ammo gates admitted a shot. The observer removed itself at
that Action pair, before those reads. Repeating a blind hold cannot distinguish
these cases. This change adds an opt-in, bounded, read-only continuation through
one linked weapon update, supported by offline exact-byte causal fixtures.
No original, browser or remote box was started for this task.

Evidence directory (R): `scratch/runs/20261108-tr2-weapon-consumption-1832/`.
Starting Git SHA, relevant owned binary diff, small owned/helper patches,
provider hashes, test logs and static disassembly are retained there. Git is
the source archive. Existing media and module are referenced by path/hash;
there are no source-tree archives or media copies.

## What the retained original actually established

[Startup/Control report](tr2-startup-control-20261108.md) retains the sole
2000 ms Control interval at 18:18:40.817–18:18:42.817 UTC. At boundary 22,368,
PC `0x447206` returned HRESULT 0, DIK1d/9d were `[128,128]`, VK17/162 were down
and VK163 clear. Slot8 was configured156/default157/conflict0. Its paired
successor `0x44d3d4` recorded keyResult1, OR executed, EBX40 and Action true.
Two records were retained, qualified and removed. No downstream weapon
snapshot was taken. Lara was upright with drawn pistols before the hold;
the dog was close and health about three-fifths afterward. No reviewed flash,
hit, kill or effective aim was established. These are retained observations,
not evidence that an input binding repair is needed.

The earlier [input diagnosis](tr2-weapon-input-20261108.md),
[Action observer](tr2-action-observer-20261108.md) and
[coverage repair](tr2-observer-coverage-20261108.md) remain applicable. Their
historical manifests and results are unchanged.

## Exact original dependency map

All addresses below are original VAs in
`test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE`, SHA-256
`0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa`.
Numeric states and branches are established by this binary; descriptive
weapon names follow its familiar paired-arm behavior, not imported symbols.

| Stage | Exact bytes/address behavior | What this distinguishes |
| --- | --- | --- |
| Publish Action | `44dd55` loads the final local input mask; `44dd63` stores EDX to `51b178`. The alternate early exit stores EBX at `44d49f`. Returns are `41427f`, `411fd8`, `4220a7`. | EBX40 at slot8 precedes final mask publication. Later input assembly and demo/control code must not be assumed to preserve it. |
| Weapon update | `42e640`; exact call returns `4275ac`, `4275c2`, `431757`, `432111`. Decrements arm flash counters, reads Lara item `52173c`, HP at item+22. Nonpositive HP forces status0. | Whether the linked control flow actually reaches a weapon call and with what health/body animation. |
| Before dispatch | Alive path `42e949`; status4 path `42ea88`. Input20, requested type differing from current, and water/depth conditions can change status to3 before dispatch. Water0 permits the ready route; water4 also compares depth `52168c` to negative weapon-info height. | Draw/holster/request/water gates are separate from Action40. |
| Status dispatch | `42e68d`: signed word `521662`, range0..5, table `42eb28`: destinations `42e876,42e8e7,42e6a4,42e719,42e775,42e76b`. Status4 reaches `42e775`. | Drawn-looking pixels alone do not establish numeric ready status at the relevant call. |
| Ready Action/ammo | `42e7ba` tests input40; clear goes directly to type dispatch. Set selects ammo through `42eb80`; `42e803` requires signed ammo >0. Failure `42e807` clamps ammo0, plays empty sound and chooses requested weapon, then returns. | Ammo can block before arm animation. Type1 uses `52171c`; types2/3 use `521720/521724`. |
| Type dispatch | `42e83c`, tables `42eba4/42eb98`: types1–3 call `42d330` (return `42e860`); types4–7 call `42bc70`. | Paired-arm instrumentation cannot infer equivalent behavior for other weapon types. |
| Target/aim | `42d345` tests input40. Clear drops target `5216e0`; set calls `42ed30`. A null target causes acquisition `42eed0`. Then each arm is interpolated through `42f1a0`, before `42d452` calls arm processing `42d4c0`. | Target existence, lock and arm angles can differ even while Action is set. |
| Arm gate | Right: `42d4df..42d500`; left: `42d688..42d698`. Lock permits raise/fire branch. Without lock, Action+null target also permits it; an existing unlocked target enters lowering branch. | A target is not a universal prerequisite to firing; an existing unlocked target can suppress it. |
| Firing frame | Right `42d54a..42d56a`; left `42d6d7..42d6f4`. Frames0–3 raise; frame4 additionally requires Action40. Frames24 onward wait for weapon-info cooldown before resetting to4. | Action consumed for raising/cooldown is not yet a shot. |
| Shot | Right call `42d595` / return `42d59a`; left `42d71f` / return `42d724`; callee `42f270`, arguments type,target,Lara,angle-pair. | Exact entry/return separates attempted shot from arm motion. |
| Ammo inside shot | Type1/default path `42f2f9` resets `52171c` to1000, then `42f308..42f315` checks and decrements it. Types2–5 select other counters, with cheat-byte `51fd96` reset behavior. Nonpositive ammo returns0 at `42f5c1`. | The pistol reset does not bypass the **earlier** ready-state ammo gate. |
| Return consequence | `42f505` calls target damage `42f5e0`, then returns1. That primitive subtracts HP at target+22 (`42f605`), with a separate kill-counter threshold. Alternate collision/miss routes return FFFFFFFF. Both nonzero returns trigger arm flash/sound; zero skips those writes. | A nonzero shot result is not equivalent to target damage or kill. Raw result and same-target HP must be interpreted with the exact path. |

`42ed30` clears both locks/target angles when target is null. With a target it
computes relative angles (`42f0f0`, `401250`), calls LOS `415a60`, and tests
weapon-info bounds. The post-LOS return is `42edec`; LOS0 clears both locks
through `42eea3`. The primary window sets both locks; outside it, `42ee40`
applies separate retention windows per arm. Type1's primary yaw/pitch bounds
are ±10920; one yaw retention range extends to30940, the other to−30940.
Thus authored yaw30000/pitch0 retains one arm and clears the other. This
explains a possible mechanism, **not the cause of the 1810 result**: its actual
angles, LOS, target, ammo and animation state were not retained.

State addresses: type/request/last `521664/521666/521668`, water `52166c`,
target yaw/pitch `5216e4/5216e6`. Arm structures are `5216f8` and `52170a`,
stride18: frame+4, lock+8, yaw+10, pitch+12, flash+16. Item animation/frame are
+14/+16, body state+0e and yaw+42. Ammo snapshot covers `52171c..521734`.

## Observer contract and tests

`tools/tr2-action-observer.cjs` defaults to the existing Action-only behavior.
Explicit `weapon:true` continues from the first paired poll/Action. It matches
the saved input caller and exact stack displacement +6c, records the stored
input, requires the same full mask at weapon entry, and matches the four
known weapon callers. Exact fixture calls establish nested stack displacements
−24 (paired arms), −40 (arm processing), −80 (shot), and their return addresses.
It records status/type/request/water/depth, target/HP/angles, each arm's
frame/lock/angles/flash, all seven ammo counters and Lara HP/animation/frame.
Optional observed post-LOS/gate boundaries retain raw LOS result and state;
shot returns retain raw EAX and the actual argument target's HP. It stops at
the first linked weapon return. It does not repeat input updates looking for
a better result; a superseding input update ends unqualified.

`consumptionQualified` means a successful Control/Action pair reached a
completed, linked weapon update. It does **not** mean status4, shot, damage,
kill or effective aim. The raw gate/shot records make those distinctions.
Clear Action can still produce a complete diagnostic trace but cannot qualify
Control consumption. Out-of-hold returns do not qualify the native correlation.
Internal WAT reentry and other threads remain unobserved. No row is absence
proof; a missing required call link, changed input, unmapped read or incomplete
shot fails closed. A complete status0 trace can explain the observed branch
without claiming readiness or firing.

The original **2500 ms installation deadline and 32-record cap** remain.
Activation follows native keyDown without resetting the deadline. Independent
native release remains in the unchanged hold helper. The facade debits actual
retired blocks, including fold overshoot, preserves aggregate reporting and
forwards the remaining caller budget after removal/expiry. No extra guest
budget, setter, translator/materialization, tracing flag, clock, seed,
binding/backend change or guest write is added. A Worker timer cannot preempt
an in-progress WAT call; external lifecycle bounds remain necessary.

`tools/tr2-weapon-consumption.test.cjs` passes **126 checks**, including exact
original pin comparisons; immutable instruction slices on production CPU
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`;
status/type dispatch, positive/negative target/lock/Action/frame/ammo branches,
post-LOS primary/retention windows, exact call-stack links, input publication,
and damage subtraction/kill threshold. Registers, stack, geometry/LOS results
and data are authored fixture inputs; ballistics stop before RNG/dependencies.
No PE loader or game loop runs. Observer state fixtures cover both arms,
zero/clear states, wrong caller/code/input/stack, missing aim, unmapped target,
pending return, supersession, expiry, overflow, removal and unchanged guest
state. Serialized opt-in orchestration tests activation after native keyDown,
in-interval correlation and independent release despite stalled arm response.
The unchanged 32 Action-observer checks cover retirement/deadline contracts;
production direct/RPC input path and helper-closure tests also pass. The locked
full build passes with identical d8fac module bytes.

## Prepared selection and next assignment

`R/prepare.py` relocates the normal **615-provider / 29-helper** closure from
1750 SHA-256 `d47d09a5520ce6bc4d2321c90f9e4b45446f5bed182fd3fd3248912bcd4bd72d`.
Only `tools/tr2-action-observer.cjs` changes among non-helper providers; the
other585 remain byte-for-byte selected. The relocated browser helper passes
`weaponObserver:true` only with explicit `actionObserver:true`, preserving the
single ordinary Control ≤2000 ms admission. Relocation also applies the
current owner disk-only 1.5GB rule. All615 source providers resolve by hash,
all29 physical helper targets validate, and the actual driver preflight exits
before Chrome. Existing85 retained coverage artifacts are independently
hash-checked and reused. Historical614 and prior615 selections are immutable.

Next is **one separately assigned original**, using this explicit selection,
fresh owning context/module/HTTP authority, reviewed gameplay and the same
single independently released Control interval with both observer flags.
Inspect the linked status/gate/frame/target/lock/ammo/shot records before
assigning another action. No original or remote allocation is authorized or
performed by this preparation task.

Fresh owning WebGL2's Intel string versus SystemInfo SwiftShader/SwANGLE is
still unresolved; no physical-GPU claim. Full27, parity, audio and FPS remain
open. Task box ID/state/expiry/stop receipt: **N/A (none created)**. No public
deploy, old resume/delete, archive removal or subworker. Single-task worker
stops after tested commit and immediate authenticated publication.
