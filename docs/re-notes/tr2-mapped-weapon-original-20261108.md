# TR2 fresh original: first mapped linked weapon return — 2026-11-08

**One fresh original captured its first linked weapon return while healthy.**
The sole requested1900ms Control interval measured **1900ms**, independently
released. Fourteen observer records link successful DirectInput polling and
Action40 through full input publication, weapon/paired-arm execution and the
exact saved weapon caller return. The observer stopped there, qualified and
removed. Both arm frames changed0→1; Lara HP remained1000. Target was actually
null, locks/flash remained0 and no shot call/return was observed. This proves
bounded input consumption and an early weapon-state consequence; it provides
no effective aim, shot, hit or kill proof. No further gameplay followed review.

Evidence R: `scratch/runs/20261108-tr2-mapped-weapon-original-1940/`.
`python3 R/audit.py` independently verifies the recovered bytes and assertions;
`final-audit.json` records its result. Source is the exact Git SHA in
`source-head.txt`, relevant binary diff and small owned helper patches. No source
tree archive, media/module copy, historical-run deletion or peer WIP snapshot
was made. Existing media/module paths and hashes, with published Git fallback
for selected source providers, remain in the manifest.

## Exact runtime and pre-gameplay qualification

The task selected `20261108-tr2-mapped-snapshot-1925/runtime-pins.json`, SHA256
`29936ea4df1988c828c04906b2c0aca74b4db3cf20bb3f23226e2fba8a78b075`.
All615 providers resolve exactly; relocation explicitly rehashes all29 helpers.
All586 non-helper providers are unchanged from that selection, including the
repaired observer and CPU/renderer module
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
`verify-prelaunch.py` checks615 pins,226 accepted references,23 media pins and49
repair references. `proofs.py` separately verifies the mapped repair's50
references and95 reused weapon-preparation references, all five compressed
test/build logs and the actual browser-driver preloader. The preloader exits
before Chrome. Weapon150/Action32/closure13/generation8 and locked-build PASS
are reused by hash; no new production code change, build or fixture run is
claimed. The new manifest is SHA256
`fb7fcc4a59f46ff9765baece6d6c9fbe0da5fc0159f82d70ebb6730b6a59f9d6`.

This exact615 selection uses its accepted subreaper/census custody helper, not
the optional ptrace kernel. Therefore e1a413983f's kernel gzip option was not
needed or selected, and no kernel source-text rewrite occurred. The accepted
custody helper already writes gzip from its first record. Local command-result
and lifecycle journals also start compressed. Individual remote evidence files
are losslessly compressed for transport; the custody gzip receives an additional
gzip layer to reduce local storage while preserving its exact original bytes.

Personally reviewed `review/webgl/actualgraphics.png` shows the readable original
Graphics sheet: Primary Display Driver, Hardware3D Acceleration, Full Screen,
640×480 High Color, visible OK. The first Enter request was stale and refused
before dispatch with zero effects. After a fresh capture/review, exactly one
ordinary Enter100ms accepted that sheet. No defaults/configuration were changed.

Fresh authority identifies owning renderer target
`B269653F345A506F8AE1B5AD49A11532`, endpoint1, legacy/WebGL. The passive actual
context observation is WebGL2,640×480. Both owning guest and renderer modules
match d8fac. Nine HTTP resolver proofs have matching hashes/status200. The
adapter facade's `.gl` remains null; it is distinct from the retained actual
context observation. Chrome151.0.7922.108/V8 15.1.206.16, OS, target and command
authority are retained. The Intel UHD620/Mesa string versus SystemInfo
SwiftShader/SwANGLE and appended flags remains unresolved; no physical-GPU
qualification follows.

Observation armed generation1, `process:1000:endpoint:1`. Before any Space or
Control, `armed-current-publication.json` is non-null, live, failure-null, with
**51 raw records**; `pre-gameplay-qualified.json` records this check. One
released Space1500ms drew pistols. Later settled/current pixels show upright
Lara, both pistols drawn and a full, nonempty health bar at the original alley;
no dog is visible. No forward, approach, orientation or combo input occurred.

## The sole interval and first linked return

Current `pistols-current.png`,19:43:38.813Z, was personally reviewed before the
only Control dispatch, approximately10.8s later. The explicit command requests
`holdMs:1900, actionObserver:true, weaponObserver:true`. The release receipt
runs **19:43:50.940–19:43:52.840Z:1900ms**. No overrun, extension, retry or
additional Control occurred. A post-release physical sample at19:43:54.080Z
shows Control/leftControl/rightControl and all four arrows clear.

| Boundary | Observed original execution |
| --- | --- |
|5421,447206|HRESULT0; DIK1d/9d128/128; VK17/162 down, VK163 clear; configured156/default157/conflict0.|
|5594,44d3d4|keyResult1, OR executed, EBX40/Action true, linked to poll0.|
|5729,41427f|Full input100040; exact saved input caller/stack accepted; first complete weapon snapshot.|
|6289,42e640|Weapon entry, full mask unchanged, saved caller4275ac.|
|6311,42d330|Paired-arm entry/type1 and exact saved arm caller/stack accepted.|
|6357,42d4c0|Arm update boundary observed; target0, lock0. The row name `aim-updated` does not establish effective aim.|
|6360/6371|Arm gates42d54a/42d6d7; second arm frame advances0→1.|
|6383,4275ac|First linked weapon return; both arm frames1; witness STOP/removal.|

Across the state rows: input`0x100040`, gunStatus4, gunType/requested/lastType1,
water0, waterDistance32512; ammo`[1000,0,0,12,0,0,0]`; target0, targetHealth
explicitly null; target angles0/0; both locks/yaw/pitch/flash0. Actual Lara item
pointer **`0x7ed1a454`** lies outside the direct window and DIB arena. Its mapped
health read succeeds with1000; animation103/bodyState2/yaw−32768, body frame
1667→1668. The repaired read-only mapping path therefore handles an actual
original's high item pointer. No failed read became zero/null, and no translator,
materializer, private guest write or handler call supplied these values.

The trace contains14 records,6383 observed JS boundaries, a2500ms installation
deadline and ends about159.44ms after installation. Native correlation retains
one in-hold poll, one Action and one consumption, qualified=true. The unchanged
32-record cap, actual-retired-block debit, caller remainder forwarding, saved
caller/stack checks and full-mask checks remain in force. Audit initially used
the successor Action row's ESP as the pre-call ESP; that offline assertion was
corrected using the unchanged source: publication ESP equals poll.updateEsp+6c,
whereas the successor Action row is poll.updateEsp+4. No runtime was replayed.

First linked rows were read before the next and final command, ordinary Quit.
Reviewed held and after-release images remain upright/full-health; no pixel
claim supplies an unobserved shot or hit. The initial arm-frame advance is the
bounded consequence captured, with null-target/readiness limitations intact.
The [prior1914 failure](tr2-early-weapon-20261108.md)'s address remains
unrecoverable. Authored12000022 fixtures in the
[mapping repair](tr2-mapped-snapshot-20261108.md) remain offline causal evidence,
not reconstruction of that earlier original.

## Evidence recovery, disk limitation and shutdown

Independent reread verifies **159 remote references /144 unique hashes /
44,407,878 referenced bytes**, including ten PNG CRC/decompression checks.
Only103 unique remote files/**4,044,844 transport bytes** were downloaded;
reviewed images and existing modules use exact path/hash references. Custody
streams to **98,911,815 original bytes**, SHA256
`57be2dc7bddd633b2d600c9e000eaa719d791007d5eb83cb88151c5e9ac8bd70`.
Both gzip layers and original SHA/size are independently verified. Bulky logs
and command results have no local uncompressed duplicate. Small review JSON
metadata and manifest inputs are retained directly. `retrieval-verified.json`
maps every remote reference to exact local bytes or compressed representation.

The shared disk floor was breached during this task: sampled free space reached
1,499,267,072B after a settled capture, and a compression check had already
sampled1,499,852,800B. Thus continuous compliance is **not** claimed. Gameplay
paused with zero Control while the coordinator freed regenerable caches and a
peer released its hash-recoverable checkpoint copy. After restoration above the
floor, fresh current pixels preceded Control. No local Chrome/heavy lock or RAM
gate was used; no old run, archive or peer WIP was removed. The own-file patch
compression happened after initial creation and is explicitly recorded in
`owned-compression.json`; it does not retroactively become from-outset writing.
After runtime shutdown, another free-space sample was1,499,836,416B. Lossless
outer compression of this task's already-gzipped lifecycle journals restored
some headroom; exact gzip bytes and decoded-stream hashes are retained in
`heartbeat-lossless-compaction.json`. Selected small metadata compaction is
recorded separately; no unique evidence was discarded.

Chrome exits **code0/signal-null at19:44:15.140Z**. Seven direct/adopted children
have durable before-reap PID/start identities and actual terminal wait status0.
All28 observed identities are absent, both ports36139/34267 closed, profile and
writer.lock absent, held-input release receipts complete and remote lock free.
No surviving observed owned process can retain a writable FD. A separate
exhaustive FD census was **not** retained. Other descendant terminal waits are
not established by absence/ESRCH. The50ms census/subreaper is not exhaustive
kernel lineage; CLONE_UNTRACED and nonleader exec remain unaudited. No stronger
all-descendant wait/FD claim follows from the helper's summary wording.

One persisted UUID preceded one idempotent create. Independent observable
watchdog/supervisor/normal roles and PID/start identities were armed before
allocation, with immutable25-minute deadline. ID/initial expiry were persisted
before runtime. Unique evidence was retrieved and independently hash-verified
before the delegated normal API stop. Normal/watchdog supervised terminal
receipts are exit0; supervisor has an empty child set and all three identities
are absent. The board watcher's own terminal receipt is recorded separately.

Box **`bx_favr7jd8`** is **ARCHIVED, expiry null**. Initial expiry was
**20:05:05.832Z**. Stop **`stop_2c0e066f5b16d356`** completed
**19:44:39.621Z**, forced=false, error=null. No billing-idle box remains.
No old box was resumed/deleted; no public deployment or subworker occurred.

The assigned bounded original is finished. Any later targeting/firing work
requires separately assigned fresh current evidence; no further gameplay is
authorized by this result. Intel/SystemInfo backend qualification,
Full27/parity/audio/FPS remain open. Release owned paths and STOP.
