# TR2 original stopped on death before weapon observation — 2026-11-08

The single fresh original ended on the assigned **death stop before Control**.
Lara was visibly down with an empty health bar at `face-dog-fresh.png`.
**Zero Control intervals were sent.** The requested downstream weapon trace
was not obtained; `consumptionQualified`, linked weapon status, ammo, target,
LOS, locks, arm frames, shot result and target HP are **unobserved**. There was
no restart, replay, additional gameplay after death, or production repair.
This is an incomplete weapon investigation with a concrete gameplay blocker,
not a qualified consumption result.

Evidence directory (R): `scratch/runs/20261108-tr2-observed-weapon-1858/`.
Starting checkout SHA is `eb064c3c26ced4cef7a6a8f222fb6d7470b6a28d`;
`relevant.diff` is empty. Git and small run-helper patches provide source
recovery. Existing media/modules are referenced by exact path, size and hash;
no source archive, media copy or peer WIP was retained.

## Selection and fresh startup

The explicitly selected manifest is
`scratch/runs/20261108-tr2-weapon-consumption-1832/runtime-pins.json`, SHA-256
`ab9355dd50d0057c2541d910c6d35f0cf61060054086c2505633f6f730b76bb2`,
published by `aadf4012e`. Normal relocation keeps 615 providers/29 physical
helpers and all 586 non-helper providers unchanged, including the weapon
observer, shell guard `6de923cb8`, and CPU `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
The helper retains explicit `weaponObserver:true` only with
`actionObserver:true`; neither flag was exercised because death came first.
Custody history alone uses individually appended gzip members from startup.
The installation deadline, record cap, actual-retired accounting and
independent native release code are unchanged.

The cheap exact resolver, physical closure validation and actual driver
preloader passed **before allocation**. The reviewed 95 references/7,418,690
bytes were independently rehashed unchanged. The prior 126 weapon/32 Action,
direct/RPC, closure and locked-build proofs were reused without fixture churn.
Historical manifests are immutable. No new production build is claimed.

Personally reviewed `review/webgl/startup.png` and `startup-reviewed.png`
show the readable original Graphics property sheet before normal Enter:
Primary Display Driver, Hardware 3D Acceleration selected, Full Screen,
640×480 High Color, and visible OK. Read-only fresh window inspection records
main HWND65537 z2, dialog HWND65538 visible/unowned z10, and Graphics child
HWND65545 under that dialog. The original input list was empty. One ordinary
100ms Enter accepted these settings. This actual shell is 945×889 and
single-app=false; it does not independently reproduce the earlier single-app
startup failure or establish new guard causality.

Fresh Chrome 151.0.7922.108/V8 15.1.206.16, OS, targets, SystemInfo and command
lines are retained in authority/custody records. Owning D3D target
`035DC1190F507A8AE75DBA2AD762A960`, endpoint1, requests
`{api:legacy,backend:webgl}` without failure. Its observed context is WebGL2,
640×480, and actual owning CPU/renderer modules both have the d8fac hash.
The owner-returned ANGLE Intel UHD620/Mesa23.2.1 string disagrees with fresh
SystemInfo SwiftShader/SwANGLE and appended SwiftShader command-line flags.
Both surfaces are preserved; physical Intel GPU use remains unresolved.
No backend, flag, viewport, clock, seed or binding experiment occurred.

Normal observe established ARM generation1, `process:1000:endpoint:1`, and a
non-null live initial journal containing one raw record without failure,
verified before any gameplay command. The first local confirmation attempt
lacked its downloaded publication file; a read-only retrieval and corrected
three-command check verified it without resending an observe or input action.

## Reviewed approach and failure

Ordinary Space drew pistols. Reviewed turn/movement captures show upright
Lara, drawn pistols and initially full health. `align-left-two.png` first
shows a small dog down the alley; Lara faces the shuttered wall rather than
the dog. The later `align-right-two.png` already shows the dog close beside
her. The subsequent advance request's review text incorrectly calls it
"distant". That was a review error: the retained pixels already showed an
immediate threat, and the next movement did not achieve the required safe
dog-ahead setup. No emulator or Control defect follows from that error.

`advance-path-one.png` shows Lara upright near the left wall with the dog
beside her and health roughly three-fifths. A turn request then refused as
stale **before dispatch, zero effects**. Fresh `dog-ready.png` still shows
Lara upright, but the health bar is already empty; its review text incorrectly
carried forward the preceding health estimate. A single released ordinary
right turn followed. `face-dog-fresh.png`, captured at **19:00:26.300 UTC**,
shows Lara lying on the ground with an empty bar and the dog still standing.
That is the death stop. The next and last command was ordinary quit.

No Control was sent, so there are no poll/Action/weapon observer records to
interpret. Drawn pistol pixels do not establish numeric status4, ammo, arm
readiness or targeting. No reviewed muzzle flash, bullet hit, kill or effective
aim was established. The [exact offline dependency map](tr2-weapon-consumption-20261108.md)
remains applicable but supplies no missing runtime values for this original.
Internal WAT reentry and other threads remain unobserved; missing trace rows
are not evidence of absent execution.

## Evidence audit, compact custody and stop

`python3 R/audit.py` passes independent artifact reread, startup stack,
fresh owner/module selection, ARM-before-gameplay, zero Control commands,
balanced release receipts, final sampled physical keys clear, PNG CRCs,
raw accounting, observed drain and final stop verification. There are
**20 commands/20 ACKs**, one zero-effect stale refusal, zero transport UNKNOWN
records, 13 released gameplay/startup holds, and 19 valid PNGs. Audit failures
from initial overly exact command-dictionary and wrong final-sample assumptions
were corrected to inspect the actual transport timing field and after-release
capture; no runtime input was repeated for these local audit corrections.
Raw accounting is **393 = 60 qualified retained + 333 discarded**
(330 coalesced, three shutdown), without publication failure. This is not FPS
or weapon-consumption qualification. Full27/parity/audio/FPS remain open.

Before delegated normal stop, **286 references/259 unique hashes/98,023,045
referenced bytes** were retrieved and independently reread. Only 178 unique
files/15,016,196 transport bytes needed downloading; matching reviewed images
and existing modules use same-hash path references. Large JSON/logs are
individually gzip-compressed. The custody log was gzip from its first record:
11,656,864 compressed bytes independently stream-decompress to **144,125,578
bytes**, SHA-256 `36864b831ecf3f8958e331afabdf1b7298a9335718db27616bf25091001ca241`.
There is no uncompressed local duplicate. `retrieval-verified.json` maps every
remote original path/hash/size to its local bytes or gzip; `RECOVERY.md`
describes streaming recovery. No old run was deleted. Own observed free-disk
samples and download guards exceed 1.5GB; the shared board independently
reports a transient host floor violation at 18:59:27 during the peer's local
Chrome, followed by that worker's shutdown. Continuous host-floor compliance
is therefore not claimed. The final local sample is about 1.52GB free.

Chrome has an actual exit0/signal-null receipt at **19:00:42.383 UTC**.
Drain verifies 30 observed remote PID/start identities absent, including
adopted children/bootstrap/custodian; ports46709/42285 closed, profile/writers
absent, held inputs released and remote lock free. Seven direct/adopted
children have durable before-reap identity plus actual terminal wait receipts.
Other Chrome-owned descendants have observed absence, not individually
retained terminal waits. This selected custody uses a 50ms census, subreaper
adoption and WNOWAIT registration; it is not exhaustive kernel history.
CLONE_UNTRACED and nonleader exec remain unaudited. No ESRCH exit inference
or stronger lineage claim is made.

One persisted UUID preceded one create. Three independent observable local
lifecycle PID/start identities were armed before allocation with an immutable
25-minute cap. Box ID and initial expiry **19:20:39.030 UTC** were persisted
before runtime. All three lifecycle roles subsequently exited, supervisor
empty. No local heavy Chrome/runtime lock was used by this task.

Box **`bx_h9dqjgej`** is **ARCHIVED, expiry null**. Normal stop
**`stop_b0aaa2aaee36c2b8`** completed **19:01:49.757 UTC**, forced=false,
error=null. The lifecycle's first archived receipt still showed pending;
the separately retained final API inspection proves completion. No box remains
billing idle. No old-box resume/delete, public deployment or subworker occurred.

The downstream weapon question remains open. A separately authorized fresh
attempt would need to reach the reviewed setup and act before the close dog
exhausts health, with accurate current-pixel review; this task performs no
additional original, hold, repair or gameplay. Single-task worker stops.
