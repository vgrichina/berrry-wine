# TR2 visible startup and one observed Control — 2026-11-08

One fresh original showed readable Graphics startup, reached drawn pistols and
a dog ahead, and completed exactly one native Control hold: requested and
recorded **2000 ms**. The repaired observer witnessed an in-interval successful
poll and paired Action successor. Reviewed after-release pixels show Lara
upright, the dog close beside her, and health reduced to roughly three-fifths.
No clear muzzle flash, effective aim, hit, kill or Control defect is established.
Gameplay ended without another hold, restart, replay or hold extension.

Evidence is `scratch/runs/20261108-tr2-startup-control-1810/` (R).
Exact starting checkout SHA is `f0ccbf82d87758460eb23f261e0ae5a44da7606c`;
`relevant.diff` is empty. Production code did not change. Provider identities
come from the explicit selected manifest, not the checkout HEAD or inherited
manifest's old `commit` field. Small owned helper/note patches and media
PATH/SHA references support recovery; no source archive or media copy was made.

## Actual startup and fresh environment

Personally reviewed `review/webgl/startup.png` and `startup-reviewed.png` show
the original Graphics property sheet, Primary Display Driver, Hardware 3D
Acceleration selected, Full Screen 640×480 High Color, and readable OK. The
read-only inspection before Enter records main HWND 65537 visible at zOrder 2,
unowned dialog root 65538 visible at zOrder 10, and visible Graphics child
65545 under 65538 at zOrder 9. The original input list was empty. One ordinary
100 ms Enter accepted the reviewed settings. The normal balanced native-key
preflight occurred on about:blank before original launch, separately retained.

This run used the published `6de923cb8` shell guard, but its actual shell log
says **single-app=false**, viewport 945×889, screen 1920×1080, DPR 1, coarse
false. Thus this verifies visible original startup in this fresh environment;
it does not reproduce the previous 780×437 single-app failure or independently
attribute this run's visibility to the guard. The authored before/after fixture
remains the causal evidence for the guard's single-app behavior.

Fresh Browser.getVersion records Chrome **151.0.7922.108**, V8 **15.1.206.16**,
Linux x86_64. The box reports Ubuntu 24.04.4, kernel 6.8.0-117-generic,
DISPLAY=:0, hardwareConcurrency 4 and deviceMemory 8. Full version, OS,
SystemInfo, targets, windows, GPU information and custody command lines are
retained in startup/post-Graphics authority JSON and remote custody records.
No flags, viewport, backend, binding, input policy, guest clock or seed changed.

Before ARM/gameplay, the actual owning D3D Worker target
`5900E17E5ECD096969C0E638EE62A7EA` had endpoint 1, requested
`{api:legacy,backend:webgl}`, no endpoint failure, and a freshly observed
**webgl2** context, 640×480. Actual CPU and owning renderer module hashes both
equal `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
The fresh context returned WebGL 2.0 and the ANGLE Intel UHD Graphics 620/Mesa
23.2.1 renderer string. This was observed in this run, not copied from 1717.

There is a material environment discrepancy: fresh Chrome SystemInfo reports
ANGLE Vulkan **SwiftShader/SwANGLE 5.0.0**, and custody command lines contain
appended SwiftShader flags. Both surfaces are preserved. Neither appended
flags alone nor the owner-returned Intel string certifies physical Intel GPU
use. Their disagreement is unresolved; this result qualifies the requested
owning WebGL2 API/module and observed input path, not Intel hardware authority.
No backend experiment or corrective restart was attempted.

## Observation and reviewed consequence

Normal `observe` established ARM generation 1, owner
`process:1000:endpoint:1`, endpoint 1, with a non-null live initial raw journal
and no failure. Its initial one raw record and independent file hashes were
confirmed before the first gameplay command. Native Space drew pistols;
reviewed turns and forward holds reached `approach-one.png`: Lara upright,
full health, pistols visibly drawn, and a brown/black dog ahead in the alley.
Six stale scene admissions refused before dispatch with zero effects. Fresh
captures preceded subsequent new commands; no refused request was dispatched.

The sole `actionObserver:true` Control interval was
**18:18:40.817–18:18:42.817 UTC**. Independent native release remained
unchanged. Physical VK17 and VK162 were down wholly inside the interval;
VK163 was clear. The final passive sample records all seven sampled movement
and Control keys clear after release.

`input-observed-control-once-action-observer.json` records `status:witnessed`,
`qualified:true`, 22,368 boundaries, two retained records, no pending pair,
and `removed:true`. Activation was after native keydown. At 18:18:41.602 UTC,
poll-return PC `0x447206` has HRESULT 0, DIK1d/9d bytes `[128,128]`, and the
owning bitmap reports VK17/162 down and VK163 clear. Binding slot 8 reads
configured 156/default 157/conflict 0. The paired Action successor at
`0x44d3d4` records keyResult 1, EBX **0x40**, Action set and OR executed.
Correlation confirms one poll and one Action wholly inside the native interval.
These observations establish input/Action, not weapon or aim behavior. Bitmap
reads explicitly report `atomicSnapshot:false`.

Personally reviewed held and after-release pictures show the dog at close
range and Lara still upright. Health is approximately seven-tenths in the
held picture and three-fifths after release, versus full before the hold.
Small red pixels are visible near Lara/dog but do not establish bullet impact
or identify a muzzle flash. The dog remains upright; no kill is established.
There was no further gameplay command after the after-release capture, only
ordinary quit. No private guest writes or substantive code-repair claim.

## Selected closure, audit and shutdown

The explicitly selected input is
`scratch/runs/20261108-tr2-startup-presentation-1750/runtime-pins.json`, SHA-256
`d47d09a5520ce6bc4d2321c90f9e4b45446f5bed182fd3fd3248912bcd4bd72d`.
Normal relocation retained **615 providers/29 physical helpers**, with all
586 non-helper providers unchanged, including observer `8579c29a2` and the
guarded shell. Historical 614 and predecessor 615 manifests remain unchanged.
The exact resolver and actual driver's preloader passed before allocation;
all 85 coverage references/446,299 bytes were independently rehashed unchanged.
The 32 observer tests, exact-d8fac causal fixture, direct/RPC, helper, HTTP and
locked full-build evidence were reused unchanged. Fixtures are not original
or backend authority. This docs-only task claims no new production build.

`python3 R/audit.py` passes retrieval reread, staging barrier, startup stack,
fresh owner/module/source pins, ARM-before-gameplay, exactly one Control,
physical and poll/Action correlation, release, PNG CRC and observed drain.
There are **35 commands/35 ACKs**, six zero-effect stale refusals, zero
transport UNKNOWN records, and 30 valid PNGs. The generic cleanup receipt's
literal `pending:"UNKNOWN; never replay"` is retained; no actual transport
UNKNOWN or missing ACK exists. Raw accounting is **528 = 74 qualified retained
+ 454 discarded** (451 coalesced, three shutdown), without journal failure.
These are not FPS measurements. All five parsed host JS sources match pins.

One persisted UUID idempotency key preceded the single create. Observable
independent normal/watchdog/supervisor PID/start identities were recorded
before allocation. The immutable 25-minute overall deadline and initial box
expiry were approximately **18:34:58.6 UTC**. Remote custody held its runtime
lock from startup through drain; no local heavy runtime or runtime lock was
used. All **616 uploads** joined before verified staging publication and
parent consumption, manifest SHA
`ec0109d0b50b69c4804638216b056916a8944e74aa447bc9a11b485ad90c32bb`.

Before delegated normal stop, **421 artifact references/381 unique hashes/
457,279,589 referenced bytes** were retrieved and independently reread.
Chrome exited 0, signal null, at 18:19:11.191 UTC. Drain verified 31 observed
remote PID/start identities, adopted descendants, bootstrap/custodian, ports
36321/36653, profile, writers, held-input receipts and remote lock. All 615
provider hashes remained unchanged. Custody is a **50 ms census plus subreaper
adoption and durable WNOWAIT registration**, not exhaustive kernel history or
evidence of already reaped descendants. Observer internal WAT reentry and
other threads remain unobserved; missing records imply no absence of execution.
All three local lifecycle identities are absent, child roles exited zero and
supervisor ended empty. Free /home remained above 1.5 GB.

Box **`bx_9hdma9ab`** is **archived, expiry null**. Normal stop
**`stop_7250aad4c9efedb0`** completed **18:20:09.146 UTC**, forced=false,
error=null. No task box remains billing. No resume/delete/public deployment
or subworker occurred.

The assigned single hold and reviewed consequence are complete. Further
weapon/aim investigation and the contradictory GPU reporting require a
separate assignment; no additional original is attempted here. Full27,
parity, audio and FPS remain open. This single-task worker stops.
