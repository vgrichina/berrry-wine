# Quake II north window: continuous hull correction, 2026-11-08

The old x≈112 northern aperture route is false for the original standing
player hull. A continuous trace stops at the sill, and the proposed elevated
crossing grazes world brush 1603. Moving left avoids that world edge but hits
the original window entity **328 / model *20**, omitted by the old leaf
sampling. With that entity intact, the entire opening blocks both standing
and crouched player boxes. This is a tested geometric correction, not an
explanation of the retained native player's death.

Implementation: `tools/quake2-bsp-route.py`; tests:
`tools/quake2-bsp-route-test.py`. Evidence:
`scratch/runs/20261108-quake2-swept-hull-route-2125/`.

## Original bytes, opened read-only

PAK path:
`test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/baseq2/pak0.pak`.
Size **49,951,322**, SHA-256
`cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`.
`maps/demo1.bsp` occupies offset **1,264,679**, length **1,991,772**;
SHA-256 `ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457`.
The loader verifies both SHA/size pins and the unique PAK directory entry
before parsing IBSP38. It never extracts or copies media.

The checker parses original planes, nodes, leaves, leafbrushes, brushes,
brushsides, models and entities. Each model's reachable BSP leaves determine
its brush membership: **1,758** original brushes, **1,641** world brushes,
**35** models. The authored solid-entity scene contains **1,721** brushes;
trigger brushes remain nonblocking. Model *20 owns brushes **1678–1684**,
none belonging to the world model. Its seven irregular convex brushes retain
all original bevel/side planes and WINDOW contents, not just SOLID leaves.

Player origin bounds are standing `(-16,-16,-24)..(16,16,32)` and crouched
`(-16,-16,-24)..(16,16,4)`. Thus feet are origin z−24, full width is **32**,
and heights are **56/28**. The player mask includes SOLID, WINDOW, PLAYERCLIP
and MONSTER; monsters themselves are not synthesized from entity records.

## Concrete comparisons

The following coordinates are world player origins, not native input targets.
Horizontal sweeps run from y=96 to y=192 unless stated otherwise.

| Check | Result |
| --- | --- |
| Standing `(112,-320,24.125)` to `(112,96,24.125)` | Clear approach on the start floor |
| Old path, corrected ground heights, first blocked segment y=96→112 at x=112, z=24.125 | Fraction **0.998046875**, stops y=**111.96875**, sill brush **239** |
| Elevated x=112, z=40.125, world only, native ±16 hull | Fraction **0.166341145833**, stops y=**111.96875**, brush **1603** |
| Same world sweep using old ±15 footprint | Clear: reproduces the omitted hull-width contact |
| Elevated x=96, z=40.125, world only | Clear |
| Same x=96 sweep, original entities, standing | Fraction **0.249674479167**, stops y=**119.96875**, brush **1679**, entity **328** |
| Same x=96 sweep, original entities, crouched | Same stop/fraction, brush **1681**, entity **328** |
| x=96 18-unit up/across/down step from z=24.125, y=96→160 | World-only succeeds over the 16-unit sill; original entity scene blocks both hulls |
| x=96 jump probe from `(96,96,24.125)`, velocity `(0,200,270)`, gravity 800 | Both original hulls hit entity 328 at **0.11984375 s**, y=119.96875; world-only clearance probe passes 0.6 s |

Brush 239 spans x=−192..128, y=128..152, z=0..16. Brush 1603
spans x=128..272, y=128..152, z=0..112. A centered ±16 hull at x=112
touches x=128. The old ±15 samples reach only x=127 and miss that contact.
The 1/32 collision epsilon stops a north-moving hull before its front reaches
the blocking plane; it does not shrink the hull to fit the aperture.

Entity 328 is authored `func_explosive`, model `*20`, health 10, dmg 0,
target `t78`, no spawnflags or origin translation. Model bounds are
x=−72..128, y=136..144, z=16..112. Its WINDOW collision contents are
**402653186 / 0x18000002**. These fields establish original brush geometry,
not a current actor, an enemy, a damage cause, or authorization to shoot it.

## Continuous obstruction certificate

At the opening's middle plane **y=140**, world geometry confines any hull
crossing this particular window to origin x=**−48..112**. The sill top z=16
and lintel bottom z=112 constrain standing origins to z=**40..80**, and
crouched origins to z=**40..108**. Boundary contact is already blocking;
including the boundaries makes this a conservative superset of admissible
positions.

`cover-plane` expands each original brush plane by the player-box support,
then proves obstruction of rectangular origin cells. All four corners of a
cell must lie inside **one** expanded convex brush. Convexity proves its
whole interior blocked; uncovered/subdivision-limit cells remain unresolved.
This is not a dense point grid. The intact window covers the entire standing
rectangle with **one cell**, brush 1680. It covers the crouched rectangle with
**nine disjoint cells**, brushes 1679, 1680 and 1681. Both certificates have
**zero unresolved area**. Tests independently enumerate hull corners, verify
each cell, check disjoint interiors, and sum the exact rectangle area.

Every continuous route through this opening must cross y=140. Consequently
walking, diagonal motion, stepping or jumping cannot pass a native box through
the intact authored opening. This conclusion concerns this aperture and entity
state; it does not rule out other routes through Outer Base or a changed entity
state. Omitting the window is retained only as a diagnostic counterfactual,
never described as a qualified native route.

## Original collision algorithm cross-check

No local `cmodel.c`, `pmove.c`, `q_shared.h` or `qfiles.h` was found under
`/home/user`, `/opt`, `/tmp`. Instead, the existing original `quake2.exe`
(beside `baseq2/`) was inspected statically with `objdump`, never executed.
Size **323,584**, SHA-256
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
It has no symbol table. The inferred box/brush clip helper at **0x4121d0**
matches per-plane box support expansion, entering/leaving fractions, outside
early rejection and `startsolid/getout` logic. At **0x41237b** it subtracts
the double **0.03125**, stored at file offset 0x40c00 / VA 0x442600; at
**0x4123a2** it subtracts −0.03125 for the leaving fraction.

Inspection corrected an initial checker convention: the original moving
allsolid branch at **0x4123e1..0x41240d** sets the flags without overwriting
fraction. The stationary test at **0x412595..0x4125b9** sets fraction zero.
The final checker and tests preserve this distinction. Consumers must check
`startsolid/allsolid`, not just `fraction == 1`. Tests hash-pin the original
EXE and relevant inspected instructions. Retained disassembly is an independent
static algorithm check, not an executed original-collision oracle. Python
double arithmetic versus x87 float spills is not bit-exact numeric parity.

The independent analytical oracle enumerates all eight hull corners for each
plane and intersects time half-lines, rather than calling the clipper. It
agrees on **2,000** varied traces against actual original convex brushes with
epsilon disabled; explicit analytical tests cover the fixed collision epsilon.

## Reuse and limits

```sh
python3 -B tools/quake2-bsp-route-test.py
python3 -B tools/quake2-bsp-route.py info
python3 -B tools/quake2-bsp-route.py trace 96,96,40.125 96,192,40.125
python3 -B tools/quake2-bsp-route.py --hull crouch step 96,96,24.125 96,160,24.125
python3 -B tools/quake2-bsp-route.py jump 96,96,24.125 0,200,270 --seconds .6
python3 -B tools/quake2-bsp-route.py --hull crouch cover-plane 140 -- -48,40,112,108
```

`path FILE` checks a JSON list of origin waypoints with continuous segments.
`--policy world` explicitly excludes entity models for comparison. Default
`initial` retains solid brush entities at authored positions, excludes triggers
and initially disabled walls/explosives, and inventories all choices. Moving
doors, trains and rotating models have unknown runtime transforms; authored
positions are not a reconstructed live scene. Explicit authored rotations
fail closed. The relevant window has no transform or mover uncertainty.

Up/across/down is a geometric step-clearance check with the native 18-unit
limit and a walkable landing normal ≥0.7; it does not implement full
PM_StepSlideMove, friction, acceleration or sliding. Jump clearance sweeps
continuous chords with upward inflation `g*dt²/8`, enclosing the intervening
parabolic arc. It can conservatively reject a near-ceiling arc; it never
infers free motion by sampling ballistic positions. Neither helper predicts
health, damage, AI, trigger effects or survival.

## Native evidence and validation

The actual retained `world-first`, `window-slide-right`,
`missing-section-forward`, `lip-angle-left` and `onward-right` PNGs from
`20261108-quake2-repaired-startup-opening-2052/remote/original/` were viewed.
They show start health100, pane/gap/sill, then health54 with red tint and
health0 with rolled death view. Their paths/hashes and observations are
retained without copying images. Exact native origin, crossing time and
damage source remain **UNKNOWN**. Static obstruction is compatible with the
failed approach but cannot register these pixels to world coordinates or
attribute death. The old claim is corrected on geometry independently of
those unknowns.

**18 focused tests pass**, including thin-wall tunneling with free endpoints,
grazing, startsolid escape/allsolid, stationary solid/free, hull width,
crouch clearance, collision masks, step height/headroom negatives, jump
ceiling/wall/apex negatives, original sill/window comparisons, exact aperture
coverage and the independent oracle. Required
`flock /tmp/wine-build.lock bash tools/build.sh` passed (canonical 2,184,500
bytes; compat 2,187,146 bytes). All unique logs were gzip from first stored
bytes; inventory independently rereads regular-file SHA/size and decompressed
original SHA/size with CRC, and records symlinks without following them.
Git SHA plus small owned patches provide source recovery, not a tree archive.

Historical publication failure (preserved): publication was blocked by the owner's disk floor: `/home` fell to
**1,499,435,008 bytes** free during final evidence preparation and subsequently
**1,499,049,984**, below 1,500,000,000. The completed three owned source files
remain **uncommitted** in shared main; no code commit or push is claimed.
This run occupies about **104 KB**, so reclaiming its files cannot restore
the floor. No older run or peer file was deleted. Source patches and the final
inventory are preserved; restore headroom before committing/publishing these
explicit paths. The build and focused test passes above preceded this blocker.

No game, Chrome, remote, box, original retry, input, worker, public deployment,
configuration/backend/binding/clock/seed change, private guest operation,
old-run deletion or peer edit occurred. Native configuration and prior proof
scope are preserved. Box **NONE**, state **NOT_CREATED**, expiry **NULL**,
stop receipt **N/A**. Full27, parity, audio and FPS remain open.

Next work should use this checker to assess a different route or an explicitly
established native change in the window's collision state. Repeating the old
intact-aperture movement is not supported by these bytes. Any new native run
requires separate authorization; this worker releases its files and stops.

Successor publication: the released correction is continued and published with
[the explicit window-state checker](quake2-window-state-route-2140-20261108.md).
The preceding disk-floor failure and original run inventory/patch remain intact;
the successor tests conditional clearance after validated entity328/model20
removal, without changing this intact-window obstruction certificate or the
retained death damageUNKNOWN. See the successor run for final build/publication.
