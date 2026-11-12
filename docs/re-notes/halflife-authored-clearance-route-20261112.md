# Uplink: authored wooden back is a separate breakable; native route gated by disk

Run: `scratch/runs/20261112-halflife-authored-clearance-route-1800/`, with
`-control/` for the refused allocation and `-control2/` for the fresh caller.

Read-only inspection of the **original hldemo2 BSP** resolves the wooden
structure into separately authored breakable panels. The justified next target
is its **four-unit-thick back, model *45 / entity147, health50**, approached
through the damaged open front. This supplies a different target/alignment
from pushing into the face or attacking the tall structure from outside.
Static standing-hull samples support passage south after that panel is removed,
then east of the second crate into the neighboring corridor.

The first allocation POST and read-only inventory GET returned HTTP500. After
independently checking the coordinator's recovered inventory, a **fresh caller**
passed the actual blank control and original whole12 fresh VFS/menu startup.
The disk guard then refused resolution selection **before publication**, at
1493065728 available bytes. Native Load, fresh gameplay movement and the route
attack were not dispatched. Destruction of this back, passage, encounter and
a successor save remain unverified. The fresh box is normally archived.

## Original bytes and offsets

All paths below are relative to
`test/binaries/candidates/half-life-uplink-installer/installed/`.

| Asset | Bytes | SHA256 |
| --- | ---: | --- |
| `valve/pak0.pak` |79150544|`c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`|
| `hldemo.exe` |737280|`e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`|
| `valve/dlls/hl.dll` |849408|`1a9679ee01ebeb747df43ac9e735fa4ab102d42d727451cb5de70cdce28048f3`|
| `valve/default.cfg` |1905|`b625391874c7beca74b9d2f643dfbc5343062bd52c7d5c8780289fee2072666b`|

PAK directory: offset79025616, length124928. Its `maps/hldemo2.bsp` entry
starts at27101664, length3164812, SHA256
`5799f516b1d0a35756dcb347b996554f3df18e9a586d0d86835256841983aa22`,
BSP version30. Selected lump offsets are relative to that BSP:

| Lump | Offset | Length |
| --- | ---: | ---: |
| entities |1737788|99045|
| planes |124|249040|
| textures |1836836|1327976|
| nodes |449848|104880|
| faces |632768|140140|
| clipnodes |772908|122224|
| models |1109160|11200|

`authored-inspection.json.gz` records all15 offsets, including absolute PAK
offsets, selected entity properties and model bounds. The in-memory reader
checks directory bounds, record divisibility, exact hashes and counts:
677 entities,175 models,7007 faces. `crate-faces.json.gz` retains only selected
derived panel geometry. No BSP, entity-lump, texture, source-tree or media
archive was extracted. All616 predecessor pins and65 original installed media
files still match after the inspection; original files were not opened for writing.

## Matching the actual structure

The match uses inherited native full frames from the
[qualified1730 run](halflife-native-crouch-clearance-20261112.md), especially
`review/webgl/d15-readyview.png`, `d26-opposite-edge.png` and
`d27-crouch-under-frame.png`. Their hashes match the original capture records;
all three full PNGs decode with CRC validation and were inspected. These are
prior native evidence, not fresh captures in this run.

The combined evidence is the open-front, tall `crate10` shell with an uneven
front lintel, its torn/slanted side edges, a separate rectangular rear face,
and the authorized-personnel/system sign immediately beside it. Original
world faces4368/4370/4371 place `c3a2sign03` on x=-368, y=-304..-240,
z=232..256. The shell lies just east of that wall; viewing south places this
sign on the right, as in d26. Model43's lintel runs from x=-316,z288 to
x=-224,z264 at y=-208..-212; its side has the distinctive jagged vertex at
y=-242.15,z243.71. Model46 supplies the complementary roof and torn side.
The frame's back is at y=-300..-304. The small foreground object originally
occupied x=-272..-208,y=-206..-142, immediately in front of this assembly.

This combination distinguishes the local assembly from the similarly textured
models17..21 farther east at x280..376,y=-70..0. Entity names alone do not
identify the current target. There is no fresh pose query, live ray/entity hit
identity or new gameplay frame in this run; the exact struck panel still needs
confirmation from the next fresh original gameplay frames.

| Entity / model | Authored function | Bounds / relevant properties |
| --- | --- | --- |
|83 / *16|`func_pushable`|x[-272,-208],y[-206,-142],z[160,224]; health15, material5, spawnflags128, `bcrate02`, custom `models/med_crategibs.mdl`, spawnobject2|
|145 / *43|`func_breakable`|damaged front/side; x[-316,-220],y[-286,-208],z[160,288]; health25|
|146 / *44|`func_breakable`|remaining thin side at x[-224,-220],y[-304,-242.15],z[160,288]; health25|
|147 / *45|`func_breakable`|**back** x[-316,-224],y[-304,-300],z[160,288]; **health50**|
|148 / *46|`func_breakable`|roof and other torn side; x[-316,-224],y[-300,-212],z[160,288]; health25|
|149 / *47|`func_breakable`|four-unit base x[-312,-224],y[-300,-212],z[160,164]; health25|
|155..157 / *49..51|`func_breakable`|second assembly x[-372,-280],y[-400,-304],z[160,288]; each health25|

All eight tall/second-assembly entities above have material1, explosion1,
delay0 and `crate10` faces. They have **no authored spawnflags, target,
targetname or master key**. They are not authored as doors, static func_walls
or the pushable small crate. The back is not assigned a use/target chain.
Raw absent keys are preserved as absent rather than misreported as explicit
values. This is authored breakability, not proof of current remaining health,
successful damage, indestructibility or a runtime defect.

Original loose default.cfg binds CTRL/+duck, SPACE/+jump, ENTER/+ATTACK and
TAB/+use. Historical and current native notes establish that active E can
operate doors; the loose default alone does not establish an active binding.
No config was changed. The old2256 route remains guidance only; its images
were unavailable and were not substituted or reconstructed.

## Neighbor route and exact remaining witness

`clearance-witness.json` evaluates original model0 and the original solid
wall/breakable/pushable/door hulls. It excludes *16 only as the already-observed
small-crate destruction hypothesis and compares with/without *45. It does not
modify any game/save/map bytes or supply coordinates to gameplay.

At x=-260, y=-200→-432, z201,233 samples at at most one-unit spacing hit only
*45 at36 samples. With that back hypothetically excluded, all233 are empty.
z201 places standing feet just above the four-unit base. Another121 samples
south to y=-552,z196 and461 east to x200 at y=-552,z196 are clear in the same
static comparison. The second crate ends at x=-280; this route passes its
**east side**, without requiring destruction of all its parts. These are
clearance samples, not a swept movement/support simulation or live passage.

Original `monster_headcrab` entity164 is at (20,-542,182), beside the eastward
segment; entities167..169 are farther northeast near the guard corridor.
Those origins identify authored neighboring encounter space, not active
enemy positions or a proved encounter. A farther northward sample intersects
original model136, a door with flags33; its live placement is unverified.
The initial attempt to assert clearance through that unmoved door failed;
the corrected witness explicitly retains its48 colliding samples. It does
not turn the static doorway into a proved open route.

Next native work: after whole12 fresh Load and fresh owner-bound movement,
use full frames to enter/aim inside the damaged shell and direct ordinary
crowbar attack at the separate rear panel. Confirm a fresh visible destruction
or other consequence before proceeding south and around the second crate's
east edge. Do not repeat unchanged crouch/face pushing or assume the earlier
outside strike hit this back. Qualify an entire native successor save only if
meaningful passage/encounter/consequence is earned.

## First refusal, fresh caller and actual disk gate

The prepared browser, requester, emitted consumer, capture/binding/readiness,
independent per-key release and delivery helpers are byte-identical to1730.
`reused-controls.json` records their hashes and existing control reports;
the expensive unchanged controls were not rerun. New staged import and syntax
checks pass. The fresh caller verifies646 runtime files plus the manifest;
all185 HTTP pins pass before original Chrome. Its actual blank endpoint/CDP/
full-PNG/clean-close control passes, with130/130 custody tasks reaped and
actual outer wait0/both EOFs, before the original starts in the same box.

The original1635 whole12 export independently re-verifies unchanged:
649713 compressed bytes, SHA256
`f523dfeaf57ef0f4d4c470965d4f036b3e67affde4498f203f55650db204d809`,
12 strict-base64/size/SHA-checked files totaling2006166 decoded bytes. Fresh
original VFS verification matches every member before native Load. The closing
read-only whole12 export has the **same compressed size/SHA**. No older
floor/pistol save, historical input stream or mixed auxiliary set was used.

The independent watchdog was armed and observed alive before the one POST.
At18:04:25Z the provider refused allocation with HTTP500. The requested name is
`halflife-authored-clearance-route-1800-f5408782-6965-4585-a328-8322d8797561`,
requested TTL7199 seconds. The following GET `sandboxes` also returned500.
There was no returned box ID, actual state/expiry or stop receipt. The failed
POST's historical server-side effect remains UNKNOWN. At18:09:30 the coordinator
recovered inventory; an independent in-memory recheck of that2387703-byte
snapshot finds1767 boxes, hasMorefalse and **no exact name match**. Snapshot SHA
is `34c0e574540f55ad25575cf7602aa67e538cac1dcbff33d4183fefb9e0c3ec8f`;
`recovered-provider-inventory-check.json` references its existing path without
copying the inventory. The failed request was not replayed.

The actual manager parent waited1 with both stdout/stderr EOFs. Because the
manager exited before joining its watchdog, that actual child wait is missing.
The watchdog's PID/start ticks/cmdline were checked, SIGTERM sent, and its
process absence observed. This is local failure cleanup, not a normal sandbox
stop or a substitute for the missing join. The recovered snapshot shows no
matching box; it does not prove the POST's historical effect.

After that changed provider condition and a new above-floor sample, a fresh
caller prearms/observes its own independent two-hour watchdog and allocates
`bx_zytz5j25`. Initial expiry20:11:41.646Z. Its original startup/menu frames
show Sierra, the native menu, Configuration, Video and the driver advice dialog,
then OpenGL/Default's resolution list. A partly populated Video menu is followed
by a passive fresh capture before choosing Video modes; menu coordinates are
chosen from each new reviewed frame, not replayed as an old route stream.

At18:16:37 the local prepublication disk check records1493065728 bytes and
raises before `n7-640` reaches delivery. There is no n7 API attempt or capture.
The prior accepted menu action sampled1508126720. No native Load, gameplay
binding, movement, crouch or attack follows. Ordinary quit `n8` is dispatched
only after a fresh above-floor sample1506787328 and acknowledges at18:17:07.
This is a real disk-floor breach; **continuous floor compliance is not claimed**.
No filesystem reserve was changed or approval inferred.

`terminal-verification.json` independently checks108 recovered references,
7 new full PNGs/CRC and all22 fields within each capture,185 HTTP pins, all12
fresh VFS and unchanged close-export files,5 balanced acknowledged pulses,
14 trusted events and7 ACKs. There are **zero gameplay anchors**. The actual
guest module is04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17;
no owning gameplay renderer/SoftwareGL or fresh Load/movement is qualified.

Original Chrome exits0/signalnull; its actual outer parent waits0 and both EOF
threads join. Custody reaps344/344 with no remaining/unreaped tasks, cancellation
or missing command EOF. All unique original and blank evidence is SHA-verified
before delegated normal stop. **bx_zytz5j25 is archived, expiry null**, stopped
18:18:03.108Z. Receipt **stop_04bdaf7ae3b00dfc** completes18:18:03.128Z,
forcedfalse/errornull. The fresh local manager and watchdog actually join0 with
both EOFs. No box is deleted or resumed. The first caller's missing watchdog
join is still explicit rather than replaced by these fresh joins.

**Concrete remaining gate:** enough actual available disk to keep /home above
1500000000 bytes through unique recovery, followed by a fresh caller/watchdog,
actual blank control, unchanged whole12 native01:48 Load/crowbar/actual
SoftwareGL04/fresh movement, and strict22 owner/full fresh PNG/no-replay gates.
Then obtain the missing **visible back-panel destruction and onward passage**
witness using the authored alignment above. Do not repeat the unchanged crouch
or face-pushing probes. No further original attempt is made in this task.

Initial available disk was1502638080 bytes; the first preallocation sample was
1518518272 and the second1518329856. Source freezes are Git
`9bae6e1815a41455f66aecca813d5270e56b2140` and fresh-caller
`73b8b8314e686ac289ca3341fef84e2c6a3d34db`, plus recorded relevant binary
diffs and final helper patches. Exact gzip journals retain raw/compressed hashes
and roundtrip checks; Git is the source archive. No production code changed,
runtime repair, production build, deployment, workers, parity, FPS, audio,
full27 or new gameplay claim. Parent full review remains pending.
