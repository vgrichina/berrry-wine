# TR2 bounded passive target and damage observation — 2026-11-08

The existing observer now retains the shot argument's native target pointer,
object-number discriminator and signed health at entry and exact return. It
also watches the synchronous damage call inside that invocation, storing its
evidence in the existing shot-return row. No extra records, guest calls or
writes, observation flags, runtime/input/config/clock changes were introduced.
The 2500ms/32-record bounds and actual-retired debit/remainder forwarding are
unchanged. Code: `tools/tr2-action-observer.cjs`; focused controls:
`node tools/tr2-target-damage.test.cjs`.

## Independently inspected native boundaries

Installed original: `test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE`,
SHA256 `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa`.
The run's `input-path-hashes.json` gives independently read size/CRC/SHA and
existing CPU module paths. No media/module copies were made.

Native acquisition at `42eed0` walks short item indices, resolves them through
the item-array pointer at `527270` with stride72 (`42ef5d..42ef6f`), rejects
nonpositive signed health at offset22, tests geometry/LOS and selects the
pointer stored at `5216e0`. This is a native ITEM pointer, not a renderer ID.
Offset0c is the discriminator tested against35/36 by the damage routine.
Pointer and discriminator are evidence, not a lifetime-generation handle.
The observer captures target presence; it does not newly qualify acquisition
geometry, LOS, lock effectiveness, object names or successful aim.

Existing causal links remain poll → Action → published input → weapon caller
and stack → paired arms → shot `42f270`, with exact shot returns `42d59a` or
`42d724` and ESP entry+4. The shot prologue reserves254 bytes and saves four
registers. At `42f4f0..42f505` the original pushes damage, position and the shot
target argument, then calls `42f5e0`. Its entry ESP must be shot-entry ESP−274,
saved caller `42f50a`, target equal to the nonnull shot argument. Return must
be that exact caller and entry ESP+4. New literal instruction pins are checked
against the installed original by the focused test.

`42f605` subtracts the low damage word from signed target health at+22, then
sets a flag at+46. The observer records damage-entry health, amount, return
health, exact boundary numbers and signed16 expected result. Positive damage
requires that linked call to return, unchanged object discriminator across
shot/damage boundaries, a matching subtraction, positive amount and decreasing
health. Shot-wide health delta is retained separately: **delta without the
linked damage boundary is not qualified damage**. Raw EAX1/ffffffff, ammo
decrement and target presence alone establish none of this.

Missing damage entry/return boundaries are unknown, including internal WAT
reentry, other threads, damage after this return, or later projectile paths.
A seen entry without its exact return refuses shot completion. Same-pointer,
same-discriminator recycling cannot be detected. Crossing zero is not a kill
claim. No ordinary original was launched to qualify the new fields.

## Retained original and new checks

Run: `scratch/runs/20261108-tr2-target-damage-observer-2131/`.
The actual retained2116 observer stream was decompressed and independently
checked against its recorded original size/SHA, including gzip CRC. Its26 rows
still show shot-entry24/return25, type1, target0, EAXffffffff, ammo1000→999,
Lara HP1000 and pendingWeapon true/pendingShot false. It proves an attempted
shot only. The historical result is unchanged; new fields are not backfilled.

Focused real-x86 controls use existing accepted CPU d8fac by path/hash and
immutable original shot-call/damage/epilogue slices. Stacks/data are authored;
the blood dependency is explicitly an authored RET. No geometry/RNG/AI/game
loop is executed. Controls cover positive/zero/negative damage, health crossing
zero, stale object discriminator, target0, native exact−1/0 returns, wrong
damage target/caller/stack, unlinked or pending returns, wrong shot return
stack/caller, stale publication generation, wrong owner, and delta without
damage. Whole512MB hashes check active observation boundaries for zero writes;
record overflow and deadline removal remain bounded. The locked
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Unchanged historical
proof suites were not repeated.

Evidence inventories every regular owned-run file, including extensionless
files if any, with independently reread gzip CRC and original SHA/size. Git
SHA plus small owned patches preserve source recovery; no tree archive or
peer WIP is captured. Preparation exception: the first disassembly/head streams
were initially written through a subprocess file descriptor that bypassed the
gzip wrapper; their unique bytes were losslessly compressed afterward. All
focused/build/watch streams used pipe-to-gzip from their first stored byte.
No old runs were deleted. Prepublication disk samples were above1.5GB. The
final shared-tree sample fell to1,499,463,680 bytes during concurrent writes;
the owned run holds about26KB. No unauthorized cleanup was attempted. No
continuous floor claim or RAM gate is made.

Box NONE, state NOT_CREATED, expiry NULL, stop receipt N/A. Offline only:
no Chrome/game/original/remote/native input/new workers/public deployment.
Full27, parity, audio, FPS and renderer limits remain open. Next is a separately
authorized ordinary original using the new observer identity, current target
evidence and these exact bounded links; this task authorizes no such run.
