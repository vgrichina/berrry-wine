# Northern aperture sightline guide and fresh disk stop, 2026-11-08

The northern aperture remains **unqualified in the current native view**. No
onward threshold, living target or gameplay consequence was reached. This fresh
authorized run stopped during ordinary Easy loading when disk breached the
owner floor; it was not restarted. A new tested lightweight BSP sightline guide
now makes the next inspection more precise. No source repair or remote run was
performed. Evidence: `scratch/runs/20261108-quake2-northern-aperture-1910/`.

## New route/view mechanism

`sightline-guide.py` reads the existing exact PAK/BSP by path, offset and hash
from the previous map inspection, without extracting or copying media. BSP SHA
is `ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457`.
It clips point segments recursively through the original BSP planes to find
the first world SOLID leaf, producing `sightline-guide.json` and an SVG plan
view with initial/northern view fans. This adds exact point sightlines to the
previous sampled hull-route preparation.

Six analytic/original-map controls and 181 independent point-leaf stepping
comparisons pass. Each ray's first solid entry agrees within one world unit.
At the **assumed** normal eye `(128,-320,54)` (spawn origin32 + viewheight22,
not private guest observation), upper-aperture points `(112,128..160,54)` have
world-clear point sightlines at bearings 91.91–92.05 degrees: approximately
43 degrees toward decreasing yaw from the normal initial 135 degrees. With a
90-degree horizontal view this would put the aperture near the initial right
edge; that FOV is a conditional interpretation, not a current measured camera.
The lower targets `(112,176,-10)` and `(112,288,-10)` are occluded by the floor
or lip; the eastward target `(304,288,-10)` is also occluded from spawn.

This explains why the upper opening should be inspected before looking for
the lower chamber. It is **preparation only**, excludes entity brush models,
dynamic actors, rendered faces and a swept player hull, and provides no timed
movement instructions. A future authorized native inspection should turn in
short independently released ordinary increments and review each view before
moving. No static target class or sightline authorizes a shot.

## Fresh native execution and storage blocker

Selection Git was `c3ae03e79aa25f7e93d3198a7aa247973a3393d5` with 701 path/hash
pins, empty relevant tracked binary diff and a retained small recovery patch
for the untracked boot dependency. Executing guest and renderer modules match
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`, referenced
by existing selected path/hash without a new module copy. Historical cc438/f965
results remain distinct. All 180 served read records were checked against pins.

Reviewed `local/startup.png` and `local/game.png` show the native main menu and
ordinary Easy selection. Two 100 ms Enter holds have independent release
receipts. The first command ACK succeeded; the second lost its capture/ACK
when the disk monitor closed the browser. Its outcome is **UNKNOWN**, never
replayed. No gameplay movement or attack occurred. No Easy gameplay screenshot
was captured. No corpse/flame/wall was treated as a target.

Preflight free space was 1,550,098,432 bytes. The one-second runtime monitor
observed **1,496,027,136 bytes** at 19:09:12.635 UTC and immediately requested
normal browser close. Chrome exited zero, signal null, at 19:09:13.259 UTC;
its disposable profile was removed. Free space recovered to about 1.54 GB.
No old run, peer file or archive was deleted. The owner floor could not sustain
this runtime even with compact evidence; no further local launch was attempted.

## Evidence and lifecycle limitations

Custody was gzip-written from the outset; only the journal sink differed from
current `tools/native_kernel_custody.py`. A real `/bin/true` control passed the
terminal wait and independent decompression/hash check before Chrome launch.
The run supervisor tool nevertheless ended **143** before its final drain
receipt. Cause is unestablished. The retained gzip lacks its final trailer;
its 297,654-byte recoverable prefix has 1,824 complete records, 172 custody
registrations and 161 actual terminal reaps. Both Python zlib and independent
`gzip -dc` yield the same prefix hash, with gzip correctly returning failure.
This is partial custody, **not** proof of complete original journal recovery or
full drain. No absent PID or ESRCH is substituted for a terminal wait.

All 172 recorded PID/start identities and supervisor/driver are now absent;
both ports 44525/45529 are closed, profile absent and local heavy lock free.
There is no complete kernel-drain or supervisor terminal-zero receipt. The
prior run's accepted 278/278 drain remains historical and is not reused for
this run. CLONE_UNTRACED/nonleader-exec coverage is not claimed.

`verification.json` verifies bound screenshot hashes/PNG CRC+inflate, served
reads, module identities, current absence/ports/profile/lock and explicitly
records the custody uncertainty. Existing media/module are path+hash references;
Git SHA, relevant binary diff and small owned helper patches provide recovery.
No tree/media archives, guest state writes, binding/config/backend/clock/seed
changes, public deployment or subworkers were used. Box ID **none**, state
**NOT_ALLOCATED**, expiry/stop receipt **N/A**. Full27/parity/audio/FPS remain open.

Next: sustained disk headroom and a separately authorized fresh native opening
inspection, using this sightline guide only to orient reviewed inputs. A local
verified transition would suffice without a remote. This worker stops.
