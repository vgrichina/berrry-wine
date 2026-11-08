# TR2 early healthy Control stopped by observer read failure — 2026-11-08

The one fresh original reached **healthy, upright Lara with drawn pistols at
the unchanged starting position**, before approaching the dog. Exactly one
Control interval followed, with explicit `actionObserver:true` and
`weaponObserver:true`. Successful polling and Action40 were retained, but
the observer stopped **unobservable: `Error: TR2 unmapped read`** before
retaining any input-publication or weapon-state row. `consumptionQualified`
is false. This is a concrete observer blocker, not a readiness/null-target,
shot, hit, kill, or aim result. No second interval, restart, gameplay after
the failure, or production repair occurred.

Evidence directory (R): `scratch/runs/20261108-tr2-early-weapon-1914/`.
Starting Git SHA: `2702eadf2af918a494ce137cd69dd20bba682e52`;
`relevant.diff` is empty. Git plus small owned helper patches provide source
recovery. Existing media and module are referenced by path/hash. There are
no source archives, media copies, peer WIP snapshots, or historical edits.
The preceding [death/stale-review report](tr2-observed-weapon-20261108.md)
and [exact weapon dependency map](tr2-weapon-consumption-20261108.md) remain
unchanged, including the earlier incorrect distant-dog and stale-health reviews.

## Exact selection and pre-gameplay evidence

The selected historical manifest is
`scratch/runs/20261108-tr2-weapon-consumption-1832/runtime-pins.json`, SHA-256
`ab9355dd50d0057c2541d910c6d35f0cf61060054086c2505633f6f730b76bb2`.
Normal relocation uses 615 providers/29 helpers; all 586 non-helper providers
are unchanged. The observer, direct/RPC transport, independent native release,
2500 ms installation deadline, 32-record cap and actual-retired-block debit
are unchanged. The actual driver preloader exits before Chrome. The exact
resolver, helper closure, 226 accepted-control references, 23 media pins,
49 repair artifacts and 95 weapon-preparation references were checked before
allocation. The unchanged 126 weapon/32 Action, direct/RPC, helper and locked
full-build proofs are reused by hash; no new build or fixture run is claimed.

The first preflight failed its final disk-floor assertion, before allocation;
the later read-only check passed at 1,544,290,304 free bytes. The shared board
also records the peer's 19:09 disk-floor breach and shutdown. Continuous host
floor compliance is not claimed. This task ran no local Chrome/heavy CLI and
never held the local heavy lock. No RAM gate was used.

Personally reviewed `review/webgl/startup.png` shows the readable original
Graphics property sheet: Primary Display Driver, Hardware 3D Acceleration,
Full Screen, 640×480 High Color, visible OK. One ordinary 100 ms Enter accepted
it. No configuration, binding, viewport, backend, browser flag, clock or seed
experiment occurred. Fresh authority records preserve Chrome151.0.7922.108 /
V8 15.1.206.16, OS, SystemInfo, targets and command lines.

Fresh owning renderer target `166DE8AD30F3D82B077FD1D9D899EF05`, endpoint1,
requests legacy/WebGL without failure. The passive owning-context observation
in `armed-current-state.json` is WebGL2, 640×480; owning guest and renderer
module bytes both match
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
The adapter facade's `.gl` inspection is null; that is distinct from the
retained actual-context observation. The Intel UHD620/Mesa string versus
SystemInfo SwiftShader/SwANGLE and appended command-line flags remains
unresolved. No physical-GPU qualification follows.

Normal observe armed generation1, `process:1000:endpoint:1`, before gameplay.
Its immediate publication snapshot was non-null/live/failure-null but had zero
records; the first assertion requiring a raw record failed and is retained.
No observe or input was replayed. A later ordinary capture and read-only
retrieval established **76 raw records**, live/failure-null, with the same
ARM, before any Space or Control dispatch. HTTP resolver hashes and owning
module/context authority were reviewed before gameplay.

## The single interval and exact retained result

The first Space request was stale and **refused before dispatch, zero effects**.
After a fresh image review, one released Space1500 ms drew pistols; one settled
capture was needed because the immediate image still showed the transition.
`draw-settled.png`, at **19:12:17.777 UTC**, shows upright Lara with both
pistols drawn and a full, nonempty health bar; no dog is visible. No forward,
approach, turn, combo or orientation input was sent. The Control review used
that current image at approximately 10.5 seconds of age.

The only Control request specified **2000 ms**. Its unchanged independent
release receipt spans **19:12:29.561–19:12:31.562 UTC: 2001 ms**. The 1 ms
timestamp overrun is retained explicitly; this does not establish a strictly
≤2000 ms measured interval. The receipt completes its keyUp path; no extension
or retry was attempted. Final physical key-clear state was not separately
sampled after Control: the last passive sample is still during the hold.

At **19:12:29.749 UTC**, the observer retains:

| Boundary | Exact retained observation |
| --- | --- |
| 30,876 / poll `0x447206` | HRESULT0, DIK1d/9d `[128,128]`; VK17/162 down, VK163 clear; binding configured156/default157/conflict0. |
| 31,049 / Action `0x44d3d4` | keyResult1, OR executed, EBX64/`0x40`, Action true. |
| End after 31,184 boundaries | `unobservable`, `Error: TR2 unmapped read`, removed=true, pending/pendingWeapon/pendingShot=false; zero linked weapon returns. |

The native correlation records one in-hold poll, one Action, physical Control
sample true, zero consumptions, qualified=false. Only those two observer rows
exist. Final published full input mask, weapon caller/status/type/request,
water/depth, ammo, target/LOS/locks, arm frames, shot return and HP are
**unobserved**. Drawn-looking pixels do not fill those values.

Source inspection narrows the failure but does not supply a missing runtime
address: the read helper accepts only the frozen direct window and throws
without recording address/length. After the Action row, the input-publication
path constructs a weapon snapshot before appending its row; that snapshot
dereferences current target and Lara-item pointers. Given the retained
pending=false/pendingWeapon=false flags and the source ordering, failure while
constructing that first snapshot is the relevant inference. The trace does
not identify which pointer/read failed, whether it was valid outside the
direct window, or whether guest data was corrupt. No translator, materializer,
private guest-state read, handler call, guessed state or guest write was used
to fill that gap. A causal repair requires identifying that read and testing
an appropriate read-only mapping/diagnostic path offline before any new original.

Personally reviewed `weapon-once-held.png` still shows upright Lara, full
health and drawn pistols at the original alley. It is an **in-hold** image,
not an after-release consequence. The helper asserted unqualified, closed
admission and automatically shut Chrome down before a final gameplay capture.
There is no reviewed after-release weapon consequence, muzzle flash, hit or kill.
No input or observer replay followed the sticky terminal failure/UNKNOWN.

## Recovery, independent audit and shutdown

`python3 R/audit.py` independently rereads all 143 remote references / 131
unique hashes / **33,122,607 referenced bytes**, validates eight PNGs including
CRC and decompression, exact command/observer flags, ARM/raw-before-gameplay,
selected module, sole interval, fail-closed result, drain and completed stop.
There are eight command records: seven ACKs including the zero-effect stale
refusal, followed by the terminal Control fault without a success ACK. The
audit initially assumed every adopted child exited0; it was corrected to
accept the retained controller exit1 caused by the observer assertion, without
rerunning anything. Six other adopted-child waits have status0.

Only 96 unique remote files / **6,643,719 transport bytes** were downloaded;
reviewed same-hash images and the existing module use path references. Bulky
retrieved logs are individually gzip-compressed. Custody history was gzip
from its first record and independently streams to **65,414,523 original bytes**,
SHA-256 `35104a579e13e0ad77cc81a7ce84b031706d30021446cf271f56068fb39ab887`.
`retrieval-verified.json` maps original hashes/sizes to exact local files or
gzip. Two exploratory local readbacks (the 1.79 MB armed-publication snapshot
and combined weapon-result inspection) initially materialized JSON; each was
then independently compressed/checked and its own uncompressed file removed.
Thus the from-outset compression instruction was missed for those readbacks;
the large custody history never had a local uncompressed duplicate. No old
run or archive was deleted. Final audited free space was 1,515,626,496 bytes.

Chrome has an actual exit0/signal-null receipt at **19:12:32.477 UTC**.
Drain checks all 27 observed PID/start identities absent, ports38627/38745
closed, profile/writers absent, release receipts complete, remote lock free,
bootstrap/custodian gone and all 615 pins unchanged. Seven direct/adopted
children have durable before-reap identities and actual terminal wait records
(six exit0, controller exit1). Other Chrome-owned descendants have observed
absence, not individually retained waits. The selected 50 ms census/subreaper
is not exhaustive kernel history; CLONE_UNTRACED and nonleader exec remain
unaudited. No ESRCH/absence-to-terminal-wait inference or stronger lineage
claim is made, even where a helper's summary field says all descendants absent.

One persisted UUID preceded one idempotent create. Observable independent
supervisor/normal/watchdog PID-start identities were recorded before allocation,
with an immutable25-minute cap; box ID and expiry were saved before runtime.
Normal/watchdog have supervised terminal exit0 receipts; supervisor's terminal
record has an empty child set and all three recorded identities are absent.
Unique evidence was retrieved and independently hash-verified **before** the
delegated normal stop request.
The generated stop-request reason says "first linked weapon result"; that
text is inaccurate and is corrected in `normal-stop-reason-correction.json`.
The result was an unqualified observer read failure. The local board watcher
was already absent when shutdown checked it; no terminal wait is retained for
that watcher, and its absence is not presented as one.

Box **`bx_5krvn687`** is **ARCHIVED, expiry null**; initial expiry was
**19:34:49.847 UTC**. Stop **`stop_85773d3776d8aa30`** completed
**19:13:08.510 UTC**, forced=false, error=null. No billing-idle box remains.
No old-box resume/delete, public deployment, subworker or further original
occurred. Full27/parity/audio/FPS remain open. This worker releases ownership
and stops with the observer read blocker preserved; no repair is claimed.
