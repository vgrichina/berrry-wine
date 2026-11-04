# Deus Ex: supported preparation with saved bearing, before another launch

The unchanged original route guard **has a feasible intersection** with Small0
support and a horizontal route east of tall Brush1733 to Brush1765/node8270.
Prepare near **(7008, −1690, 109.602844), retaining yaw250640**. This resolves
the geometric prerequisite from `5c8f2e4b7`; it establishes neither a jump nor a
landing. No game, browser, guest execution/write, remote tool or box lifecycle
action was used. No production change or build was necessary.

Run-only implementation and evidence:
`scratch/runs/20261104-deusex-supported-bearing-plan/`. Execute from the checkout:

```sh
python3 scratch/runs/20261104-deusex-supported-bearing-plan/geometry.py
python3 scratch/runs/20261104-deusex-supported-bearing-plan/test_geometry.py
```

The first command exits0 for the candidate and1 for a rejecting position/yaw;
`--x`, `--y`, `--yaw` select another measured preparation. It reads and hashes
original inputs, decodes the exact count14 bytes with the retained read-only
Package decoder, then evaluates geometry. It has no input injection or runtime
connection. The tests independently intersect parametric rays with inflated
obstacle and target boxes; they do not import the previous run-jump guard as an
oracle. Positive fixtures, measured failure, support loss, wrong bearing, east
miss, eight uncertainty corners and4,836 grid cases are checked.

## Original geometry and exact state

Read inputs: `deusex-atomic-preparation-takeoff-20261104.md`,
`deusex-supported-short-runup-20261104.md`,
`deusex-small0-native-speed-20261104.md`,
`deusex-small0-aligned-jump-20261104.md`, and retained run-jump, hold, movement,
command and observer records. References are path/SHA256 entries in
`input-references.json`; relevant Git SHA/binary diffs/new-file patches are
retained. No source archive or media copy was made.

Original BSP:
`scratch/runs/20261031T1134Z-deusex-grounded/map-bsp.json.gz`, SHA256
`4a7c95d97d44d9c85839805f7bce5028e0c4d6ba7e6f582e2f1a95dd440448d0`.
Node8270 is Brush1765 topZ96, X7024–7088/Y−1872–−1808. Tall Brush1733
front node8301 is Y−1792, east node8305 is X7024; topZ160, X6960–7024,
Y−1856–−1792. The east plane's small coefficient/residual is retained in the
BSP; the vertex bounds give the existing guard's conservative axis bounds.
Radius20 inflates the tall front to Y−1772 and east to X7044. A monotone
southeast line already east of7047 at Y−1772 stays east of7044 throughout
both faces' Y ranges. Thus this line clears a square inflation, including
the circular corner region, without relying on jumping over the tall top.

Exact immutable input:
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`.
`0.bin`/saveinfo SHA256
`4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6`;
`1.bin`/training SHA256
`ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730`.
Both are unchanged. Decoded count14/time4643 (01:17:23), Location
`(7026.70458984375, −1707.887939453125, 109.60284423828125)`,
Rotation`(0,250640,0)`, Physics1, BaseCrateUnbreakableSmall0, height43.
Native reflected radii player20/Small0 22.5 give horizontal support radius42.5
about `(6985.17919921875, −1700.6156005859375)`. Count14 starts only0.342616
inside that boundary. Radius reflection and prior loss at distance42.5952
support this overlap model; full player-footprint containment is not required
by the observed native support. Physics/Base/settled reads remain mandatory.

## Feasible region and bearing

For preparation `(x,y)` with y>−1772, southeast bearing define
`m = cos(yaw·π/32768) / −sin(yaw·π/32768) > 0`.
The original helper's unchanged two tests are exactly:

```text
x + (y+1772)m >= 7047
x + (y+1808)m <= 7088
```

Intersect these with `(x−6985.17919921875)² +
(y+1700.6156005859375)² < 42.5²`. For x<7047 in this preparation domain,
the admissible slopes are `(7047−x)/(y+1772) <= m <=
(7088−x)/(y+1808)`. Convert with unwrapped
`yaw = 245760 + atan(m)·32768/π`. This is a region, not a fixed timed replay.
The old failed point `(7003.402832,−1702.310059)` needs yaw at least251590.81;
its unchanged250640 projects X7038.615893 at the tall front and rejects.
Backward movement along that bearing preserves the projected line and cannot
repair this failure by itself.

At **(7008,−1690), yaw250640** (normalized54032, 296.806641°, or −63.193359°):

| Quantity | Value |
| --- | ---: |
| Direction (map X, Y) | (+0.450981, −0.892534) |
| Small0 radial support margin | 17.330973 |
| X at tall expanded front Y−1772 | 7049.433110 |
| X at target near edge Y−1808 | 7067.623256 |
| X at Y−1828 | 7077.728893 |
| Center over target top along straight line | Y−1808 through −1848.327482 |
| Original guard yaw interval at this point | 250390.522–251974.258 |
| Forward distance to Small0 support edge | 33.438507 |
| Forward distance until radial margin falls to8 | 22.793147 |

The last two distances are geometric, **not wall-clock runup guarantees**.
The inherited145ms Up and pre-Space margin8 checks are unchanged and untested
here. A positive preparation does not establish that those later checks pass.

A concrete tolerance box is X7007.5–7008.5, Y−1690.5–−1689.5,
yaw250620–250660 (±0.109864° around saved bearing). Across it the support
margin is16.665598–17.994010, front X7048.484486–7050.384524 and near-target
X7066.588063–7068.661407. The common original-guard yaw interval across the
whole position box is250467.257–251923.499. The smaller ±20 range is an
explicit assumed measurement/control tolerance, not a measured engine error
distribution; recompute from actual native readings instead of assuming it.

The radius20 target-overlap condition differs from a full disk inset. Here
the center crosses the actual target top polygon, with partial player overhang
near its east edge; at Y−1828 it is9.728893 east of the full-footprint inset's
X7068 boundary. Do not call this full-footprint containment. Requiring that
stronger condition at Y−1828, together with the unchanged front7047 guard,
forces m<=21/56=0.375 and gives at most9.680116 preparation margin on Small0.
That stronger geometry still has an intersection, but does not justify a
145ms runup either. We have not silently substituted either inset or expanded
target bounds for the actual7088 guard.

Vertical contact remains unmeasured: initial feetZ66.602844 must rise above
target96, by29.397156, before target-side collision; a flat near face can be
encountered once centerY reaches−1788 (radius20 before−1808). Prior sampled
jump peak centerZ156.96031 gives feet113.96031, below tall top160, so it does
not establish clearance over tall wood. This plan instead passes east of it.
Flight timing, descending top contact and any native collision tolerance are
not consequences of this horizontal solution.

## Ordinary-input preparation and native turn facts

Original installed `system/user.ini` and `defuser.ini` both hash to
`a276e5261238631a1def4ac769a35ff934f0a61877273f2d8ac331e0c478b531`;
`deusex.ini` hashes to
`9f6f065f58750f7830b1b02b5f4b3e5f87b365c5642d2ca1d2c3dbec6f99b3b0`.
All equal retained `original-configs.json` text. Bindings are C=TurnRight,
Z=TurnLeft, with aliases `Axis aBaseX Speed=+150.0`/`−150.0` respectively;
Left/Right are **strafe**, Up/Down forward/backward, Alt=Strafe, Space=Jump.
MouseX binds aMouseX Speed6, AlwaysMouseLook=True, but no relative-mouse turn
calibration is supplied by these runs. Keep original config/physics unchanged.

Native turn is supported by observations, not merely binding names:
aligned-jump's released lowercase z30 (trusted32ms) changes yaw250640→249105
at unchanged location. Short-runup's released lowercase c20 changes
250640→251561 at unchanged prepared location. Atomic-preparation's lowercase
c21/c31 trusted holds both leave250640 unchanged. Same key spelling has
previously worked, so neither a case mismatch nor a new key binding is proven.
These short holds give no reliable duration→yaw calibration; zero response
could involve guest input sampling, but that cause remains unmeasured.
Native reflected yaw after release, rather than trusted DOM events alone,
must determine whether turning occurred. No new turn is needed for this plan.

For the next authorized gameplay task:

1. Ordinary Load the immutable count14 once; inspect gameplay and verify exact
   native state, Physics1/BaseSmall0, settled velocity and original yaw250640.
2. Keep this yaw. Move inward with short released Left pulses first, then short
   released Down pulses toward the candidate. Ideal net displacements from
   count14 are Left8.627353 and Down24.401001 units. These are displacement
   targets, not milliseconds or promised pulse counts. Left30 previously moved
   6.077 units inward; later20–40ms movement pulses varied, including zero.
   Read actual position after every release/settle and choose the next pulse
   from its remaining offset. Never use the prior unsafe Down250 retreat.
3. Both ideal segments lie inside the support circle; the Left endpoint is
   about `(7019.005,−1711.779)` before the Down segment. Require positive
   radial margin and settled Physics1/BaseSmall0 before/after each pulse.
   Do not replay all ten earlier adjustments: those over-strafe relative to
   this candidate. If already at the failed prepared point in a future run,
   ideal Right9.654729 then Down8.913905 would translate to this same line;
   that is not the immutable saved starting state used here.
4. Evaluate actual `(x,y,yaw)` with the run-only check and unchanged native
   support/route guards before Up. Stop on rejection. This task supplies no
   authorization or evidence to bypass the145ms/pre-Space8 guard or repeat
   a failed attempt. Any turn measurement must occur separately while settled,
   with verified release and yaw readback; do not assume another c pulse turns.

Next measurements: preparation endpoint and yaw, guest-sampled response to
ordinary inputs, displacement/velocity versus remaining support during the
inherited145ms runup, and (only if all existing guards allow Space) positive
Vz/feet clearance at target approach, then actual contact/Base/settling. The
previous180ms run traveled26.28 units and left2.736 margin; releasing coasts,
so wall duration and key-up alone are insufficient safety evidence. This note
claims no jump, landing, new checkpoint or runtime repair.

All six offline test groups pass, including original configs, byte-exact saves,
observed turn/non-turn facts and independent geometry cases. The assigned task
uses no box. Predecessor handed bx_a9uvp4n2 back RUNNING/APIidle with expiry
2026-11-04T03:35:26.275Z; the coordinator subsequently recorded STOPPED at
03:29:33.532Z on messageboard.txt (03:29:41Z entry). These are attributed
historical observations, not a fresh remote query. Runtime lifecycle ownership
remains with the coordinator, without any lifecycle action by this worker.
