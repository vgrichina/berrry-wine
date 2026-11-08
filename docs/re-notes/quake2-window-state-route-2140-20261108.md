# Quake II explicit window state and conditional clearance, 2026-11-08

The checker now accepts an explicit, BSP-pinned destroyed-breakable assumption.
Removing only entity **328 / model *20** gives a continuous standing **and**
crouched clearance route through the north opening at x=96, including an
18-unit geometric step over its 16-unit sill. Every other authored solid
entity and all world brushes remain. This is conditional static clearance,
not proof that the pane is currently destroyed or that a native player crossed.
The intact-window noPassage certificate remains valid. Retained native death
has damage source **UNKNOWN**; Full27, parity, audio and FPS remain open.

Implementation and regression tests are `tools/quake2-bsp-route.py` and
`tools/quake2-bsp-route-test.py`. This includes the released, tested but
uncommitted continuous-hull correction from
[the preceding note](quake2-swept-hull-route-2125-20261108.md).
Evidence: `scratch/runs/20261108-quake2-window-state-route-2140/`.

## Explicit state contract

Save this small caller input as `state.json`:

```json
{
  "bsp_sha256": "ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457",
  "destroyed_breakables": [
    {"entity": 328, "model": 20, "classname": "func_explosive"}
  ]
}
```

```sh
python3 -B tools/quake2-bsp-route.py --state state.json info
python3 -B tools/quake2-bsp-route.py --state state.json step 96,96,24.125 96,160,24.125
python3 -B tools/quake2-bsp-route.py --state state.json --hull crouch step 96,96,24.125 96,160,24.125
python3 -B tools/quake2-bsp-route.py --state state.json trace 96,96,40.125 96,192,40.125
```

No state file retains the intact authored scene. An empty destroyed list also
retains it. JSON null, wrong BSP hash, unknown fields, wrong class/model/entity,
boolean or fractional indices, out-of-range indices, duplicate identities,
world geometry, shared brush/model ownership, rotated models, initially
disabled or target-activated explosives are rejected. Validation precedes
scene construction; failure emits no clearance result. State cannot be
combined with the diagnostic world-only policy. An inventory explains the
exclusion; every CLI result echoes the assumption and explicitly states that
live state is NOT verified. The scene is rebuilt per call; nothing mutates
the original BSP, files, game, or default scene.

The only eligible class is `func_explosive` with unique original inline-model
ownership. Health zero/missing follows the native default at spawn, whereas
negative health is refused. The original pane has positive health 10. There
is no arbitrary brush deletion interface. The validated change removes exactly
brushes **1678–1684**, reducing the authored scene from **1721 to 1714** brushes;
all **1641** world brushes and all other included model brushes remain.
Moving entities still have authored transforms, not measured current ones.

## Exact route and edge controls

Coordinates are player origins. Standing box is ±16 in x/y, z=−24..32;
crouched z=−24..4. Feet are origin z−24. Both hulls pass:

1. `(128,-320,24.125)` → `(96,-320,24.125)` → `(96,96,24.125)`.
2. Lift to `(96,96,42.125)`; sweep to `(96,160,42.125)`.
3. Geometric landing downtrace stops at `(96,160,40.03125)`, normal `(0,0,1)`, world sill brush **239**.
4. Sweep to `(96,192,40.03125)` beyond the window.

The run's `route.json` contains these waypoints. `--state state.json path
route.json` reports all continuous segments clear for either hull. The
`step` command separately establishes the supported landing. An arbitrary
waypoint path alone does not prove floor support, motion dynamics or survival.
Beyond-sill settling is not simulated here.

The direct ground sweep fails at y=**111.96875**, fraction **0.24951171875**
for y=96→160, brush239. The lift and across traces have fraction1 with no
startsolid. Landing fraction is **0.058159722222222224** over the 36-unit
downtrace, stopping 1/32 above the sill. Step height15 fails, 18 passes;
heights ≤0, >18 or nonfinite are refused. The intact scene still blocks the
same step with both hulls.

For a straight north sweep y=96→192, world geometry at the opening imposes
strict origin bounds **−48 < x < 112**, **40 < z < 80** standing, and
**40 < z < 108** crouched. These are local aperture constraints, not a global
navigation theorem. Exact boundary controls at x=−48 hit brush240; x=112
hits brush1603; z=40 hits sill239; z=80 standing or108 crouched hits lintel1586.
All stop at y=111.96875. Interior controls x=−47.875,111.875 at z40.125,
and x96 at z79.875 standing/107.875 crouched, pass the complete authored
scene with only the validated pane removed. At z80 standing fails while
crouched passes. Steps at both x boundaries fail even after destruction.
Thus destruction does not repair the old x≈112 route.

## Independent inspection of installed native bytes

Opened read-only, never executed:
`test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/baseq2/gamex86.dll`,
**385024 bytes**, SHA-256
`11fd73be2887a6c567517dbbf74c2f5040c3636e4863befd1ade9f4537e52d60`.
PE preferred base **0x20000000**. Addresses below are preferred-image VAs,
not observations of a loaded module or callable runtime APIs. The DLL is
stripped; function names are semantic inferences from byte/data flow.

The spawn table at **0x200427e0** pairs the `func_explosive` string at
**0x200431c4** with **0x2000c410**. Original field descriptors bind `health`
to edict+**0x1e0** and `dmg` to edict+**0x204**. Independently parsed original
BSP entity328 is exactly model*20, target`t78`, dmg`0`, health`10`, mass`800`,
classname`func_explosive`, with no targetname/spawnflags/origin/angles.
`target` is distinct from `targetname`.

The inferred explosive spawn code sets solid=3 at +0xf8, preserves nonzero
health (defaults zero to100 at **0x2000c4ec**), installs death callback
**0x2000c0c0** at +0x1c8 (**0x2000c4f6**), and sets takedamage=1 at +0x200.
Spawnflag1 instead initially hides/disables the solid. A targetname installs
the use callback **0x2000c3b0**, bypassing that damageable setup. The pane's
original fields select the solid/damageable branch, conditional on ordinary
spawn and no subsequent state changes.

The bolt creator **0x20017060** labels the projectile `bolt`, installs touch
callback **0x20016f70** at +0x1bc, stores owner at+0x100 and supplied damage
at+0x204. Touch rejects owner/sky, tests the hit object's takedamage at
**0x20016fb0**, then passes the projectile's stored damage to inferred
`T_Damage` **0x20004590** via the call at **0x20016fef**. This inspection does
not establish the player's current weapon, damage amount, shot count,
trajectory, impact or any actual hit.

`T_Damage` tests takedamage, applies intervening policy/protection logic,
then subtracts effective damage from health at **0x2000490c..0x20004916**.
Health ≤0 calls inferred killed handler **0x200041e0**, whose
**0x200042d8** indirect call invokes the object's +0x1c8 death callback.
For this explosive the callback disables takedamage at **0x2000c135**;
it tests dmg at **0x2000c130..0x2000c13f**, skipping the radius-damage call
**0x20004d10** when dmg=0. It makes debris and uses targets, then with dmg0
calls inferred entity-free **0x20016400** at **0x2000c396**. That helper calls
an engine import slot at **0x200622cc** before clearing the edict. This is
consistent with unlink/free removing its solid collision. A nonzero dmg
uses the alternative explosion helper branch.

This establishes a native conditional damage→death→removal mechanism in
installed bytes, distinct from authored health10/dmg0. It supplies neither a
live entity index mapping nor a present collision-state observation. Target
effects and debris are not simulated. Dmg0 is no radius damage from this
callback, not a general safety or death-cause conclusion. The checker accepts
a caller assumption; it never derives destruction from pixels, old inputs,
health10, a visible gap, or these code addresses.

## Validation, custody and publication

**25 focused tests pass**, including 2000 independent analytical brush
interval comparisons, retained intact whole-aperture certificates, original
EXE collision constants/conventions, original DLL hash/instruction/field pins,
exact route/step/edge controls, unchanged world and other entity membership,
state identity/ownership failures, and actual CLI positive/negative cases.
Both CLI waypoint routes and steps also pass as retained run evidence.
An initial fixture typo expected two trailing NULs on a native string;
its failed test log is retained before correction.

The first required locked build failed on concurrently owned
`host.js:host-file` lifetime-census SHA freshness. Its log is retained;
the owner was notified on the messageboard. No peer file was edited.
The subsequent `flock /tmp/wine-build.lock bash tools/build.sh` passed
(canonical 2184500 bytes, compat 2187146 bytes). The publication SHA is in
this run's result.

Before modifying the prior publication statement, all 21 nonself entries in
its inventory were independently verified against compressed SHA/size and
decompressed original SHA/size with gzip CRC. Its patch and disk-floor
failure remain unchanged. The prior worker really stopped uncommitted below
1.5GB; this successor continues those files after headroom restoration.

Evidence logs use gzip from their first stored bytes. Small state/route inputs
are ordinary JSON. Git SHA plus a small patch of the four owned source files
provide recovery; existing PAK/BSP/EXE/DLL and built modules are referenced by
path/hash, never copied. Final inventory independently rereads every regular
file, verifies original SHA/size and gzip CRC, and excludes only its own
recursive hash. No archive, old-run deletion or peer change occurred.

No game, Chrome, original retry, input, remote runtime, box or agent was
started. Native configuration, bindings, backend, clocks and seeds unchanged.
Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop receipt **N/A**.
The local append-only board watcher has an observable 3600-second deadline
and is stopped after publication. Next work requires separately scoped
current native-state evidence before treating this conditional route as a
live route. No unchanged intact-window retry is supported. RELEASE STOP.
