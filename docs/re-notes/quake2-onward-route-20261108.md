# Quake II original BSP route preparation and disk stop, 2026-11-08

The ordinary onward threshold/outgoing living-target goal remains incomplete.
This task inspected the original map bytes and found a concrete northern
route candidate before starting the current native module. Local `/home`
free space then fell below the owner's 1.5 GB floor, so the browser was
stopped normally before any route movement or attack. No remote was allocated.
This is a measured storage blocker, not a repeated failure of the prior
alcove route or an established emulator defect. No source repair was made.

Evidence: `scratch/runs/20261108-quake2-onward-route-1858/` (ignored).

## Exact offline map preparation

The existing original media was opened read-only, without guest console,
map command or state writes:

- PAK: `test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/baseq2/pak0.pak`,
  49,951,322 bytes, SHA-256
  `cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`.
- Actual maps are `demo1.bsp`, `demo2.bsp`, `demo3.bsp`. The PAK's original
  `default.cfg` newgame alias selects `*ntro.cin+demo1`; no `base1.bsp` exists.
- `maps/demo1.bsp`: PAK offset 1,264,679, length 1,991,772, IBSP version 38,
  SHA-256 `ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457`.
  Its worldspawn names **Outer Base**, with nextmap `demo2`.
- The normal untargeted start is entity 641, `(128, -320, 32)`, angle 135.
  Entity 388 is a different, named `base2` return start.
- Entity 345 is `monster_soldier_light`, `(348, -348, -64)`, angle 315,
  spawnflags 1. Entity 62 is explicitly `misc_deadsoldier`,
  `(744, -336, -96)`. Neither record establishes a CURRENT living target.

`map-inspection.json` retains all entity fields, lump offsets and model bounds.
`map-slices.png` shows world SOLID leaf slices at z=32, -32 and -112 with
entity indexes. `static-route-check.json` finds a sampled connection from
the start floor north along approximately x=112, through y=128–160, then
down to the chamber floor near z=-64 at y=176, continuing north to y=288
and east toward x=304. This gives a concrete aperture and change of floor
to inspect instead of circling the support/ribbed alcove.

That check uses a 16-unit XY grid, five footprint samples at offsets 0/15,
vertical clearance samples through 55 units, and step up/down limits 16/128.
It excludes entity brush models, a continuous swept player hull and dynamic
actors. It is preparation only: no static coordinate, class name or sampled
connection counts as native movement, a new-room transition or a target hit.
The initial northwest view must be reoriented and reviewed in a later
authorized run; these coordinates are not a blind timed input script.

## Current native execution and concrete blocker

The fresh 701-path selected closure uses the prior released normal driver
and input helpers, byte-identical after run-path relocation. Original
67-path media and 642-byte controls remain unchanged. Git at selection was
`eb064c3c26ced4cef7a6a8f222fb6d7470b6a28d`; the relevant tracked binary diff
is empty, and the untracked boot dependency patch is retained. No source
tree, media copy, bulk snapshot or source archive was created.

Live recovered guest and renderer modules both have SHA-256
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
This differs from the prior guard-route `cc438f72…` and accepted pickup
`f9650607…` modules; those historical results are not relabeled as current.
All 176 successful served reads match selected path/size/hash pins.

Reviewed `local/startup.png`, `game.png` and `easy.png` establish ordinary
**Game → Easy**, then the same starting diagonal support and 100-health HUD.
Only two 100 ms Enter holds and ordinary quit were sent. All three numbered
ACKs succeed; both holds have independent release receipts. There is no
gameplay movement, attack, UNKNOWN, replay, restart, config/binding/clock/seed
change or private guest handler call. No corpse, flame, wall or ambiguous
humanlike shape was fired upon.

Free `/home` space before preparation was 1,564,332,032 bytes and before
launch was 1,553,661,952. Runtime samples fell to 1,496,633,344 and then
**1,490,481,152**, below the required 1,500,000,000. The owned run occupied
about 9 MB at that point. Normal quit was dispatched immediately after the
confirmed breach; it removed the disposable profile. A subsequent sample
was 1,540,370,432. Older runs and peer files were untouched. Recovering the
floor after shutdown does not authorize replaying/restarting this run.

The owning render Worker endpoint 1 reports `api: gl`, backend `webgl`,
adapter present and no failed endpoint. The live provider context/string
was not separately queried before the disk stop. No physical-GPU,
fallback-count, FPS, parity or audio claim is made.

## Verification and drain

`verification.json` passes the three bound capture hashes and executing
module identities, all three exact ACKs, two balanced independent releases,
and CRC/IDAT checks for all four PNGs (three native captures plus the offline
map figure). The native key/type/combo preflight controls also passed.

The actual local heavy lock was `/tmp/wine-local-heavy.lock`, held only for
this browser runtime. Current kernel custody helper SHA-256
`f778d0e4d05959c0bd35850533faaf0cfaa4983acee0d5718c50dbc576066429`
records **278 observed identities and 278 terminal reaps**, root exit zero,
with remaining, unreaped, pending ESRCH and unresolved lineage lists empty.
Chrome exited zero at **18:59:28.324 UTC**. The supervisor's terminal wait
also completed zero. Both ports 42167/40213 are closed; profile and writer
lock are absent; the local heavy lock is free. ESRCH/absence is not used as
a replacement for terminal waits. `CLONE_UNTRACED` remains unaudited, and
unsupported nonleader exec remains fail-closed; this is an observed-census
claim, not exhaustive process-history coverage.

Unique module/custody bytes are individually gzip-retained with independent
streamed decompressed SHA/size verification and recovery instructions.
Box ID **none**, state **NOT_ALLOCATED**; expiry and stop receipt **N/A**.
No box was created, resumed, stopped or deleted.

Next work needs sufficient sustained local disk headroom before one new
authorized current-view route qualification of the BSP aperture above.
Review a native threshold or unambiguous living target before allocating
any watched remote; a local verified transition would already satisfy the
gameplay goal. Full27, parity, audio and FPS remain open. This worker stops.
