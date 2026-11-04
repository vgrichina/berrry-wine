# MDK2 startup timing and one original onward attempt

Evidence: `scratch/runs/20261104-mdk2-startup-timing-onward/` (RUN).
This assignment explicitly renews one fresh local original attempt: at most720
browser seconds plus180 cleanup seconds; aggregate bootstrap60 and command40
seconds remain unchanged. Chrome hard cutoff20:00Z, cleanup20:03Z. Admission
requires the full720+180 before the Chrome cutoff. This renewal is not evidence
about guest progress and never reuses the previous release or nonce.

Offline timing reads only actual sealed prior commands/replies, release,
captures and HTTP records from the published a8c158016 investigation. Every
consumed byte is checked against its original seal. RUN/analyze-timing.cjs and
prior-startup-timing.json preserve the calculation and input hashes.
All56 ACKs passed. The48 startup64-step commands total3072 and57.446 seconds,
maximum12.709 seconds. Seven capture commands total2.923 seconds. Quit costs
0.346 seconds. The160.469-second initial-shot-to-quit-ACK span contains99.754
seconds between ACKs and subsequent commands. Those gaps include capture
recovery, personal review and operator scheduling; they are not measured pure
inspection CPU.91.713 seconds of gaps follow capture ACKs;8.041 seconds follow
step ACKs. Guest clock advances49.152 seconds from0 to3072.

The206 HTTP responses span53.108 seconds, with199 status200 and7 status403.
Response timestamps lack request starts/durations and overlap execution;
their span must not be added to command time. All203 served-body records match
their pins, including preflight. This evidence supports the observed useful
checkpoint exhaustion; it does not identify a guest fault or prove why the
visible title timing differs from an older attempt.

The finite contract retains host/boot/PID/start ticks, canonical checkout/run,
candidate hashes, fresh nonce, exclusive inherited flock, one launch, absolute
close, original180-second orderly-quit reserve, original review/input and
ownership guards. The test suite reverses every explicit source translation
to the original composed bytes, preserving the quit checkpoint. The dated
assignment rejects the prior release; boundary tests cover720+180 admission,
hard20:00/03 bounds and the unchanged useful-window minimum. No TTL extension
is inferred from these tests.

The integration test had three hardcoded historical output destinations,
including truncation of sealed ownership-negatives.jsonl. Its explicit
MDK2_TEST_EVIDENCE override confines this assignment's test outputs to RUN.
Without an override, the suite creates a fresh test run rather than writing
over an already sealed investigation.
No construction ownership or trace guard is changed. Offline inspection of
the exact run entry also demonstrated its hardcoded prior assignment would
reject this new local release before launch. Local admission now invokes the
complete renewed local validator; nonlocal admission keeps its prior dated
assignment check. A direct actual-entry test proves the old release rejects
and the fresh local release reaches the original deadline seam without any
bootstrap or browser.
The first integration run also exposed compressed historical seal/inventory
inputs: the test opened only their removed plain paths. It now reads retained
gzip bytes when necessary and keeps the same SHA verification. The initial
failure log is preserved; no historical artifact is restored or overwritten.

Before runtime, RUN/launch-command.sh and launch.cjs specify candidateResolver,
createResolver/installAdapter, local.install and original entry run. The NEW
main GitSHA and relevant binary patch, plus new note patch, are separate from
retained cffc/580f module references. All111 helpers, observerde6, four Git
dependencies and all432 actual filesystem/full HTTP pins remain mandatory.
No media/modules/source archives are copied. Existing path/SHA references and
Git plus relevant patches are the recovery recipe.

Runtime requires BOTH gl-process-factory-composition-nov04 and
stronghold-choosetype-recognition-onward-nov04 normal heavy releases before
the soleLOCAL flock. One original attempt only; personally view each fresh
capture before dependent input, including original measured Escape, NewGame
and Medium. Preserve slot0/endpoint1/thread1 and observer-before-first-script,
full frozen/lifecycle/queue ownership fences and input-free16-slice construction
quantum. Capture the first concrete fault, unexpected scene, cap or deadline,
then STOP. No forced state, Level/Lua/native install, bypass or retry. No
gameplay claim without personally visible original gameplay.

Box ID/state/expiry: NA. Normal owned process closure is delegated; coordinator
owns future boxes/shutdown. Validation and the single runtime outcome follow.

Final prelaunch validation passes30 focused local tests and92 integration
tests, including actual entry renewal admission, actual Python children,
original pinned production classes, both retained compiled modules' real
Worker observer/lifecycle negatives and composed construction commands.
The mandatory locked full build passes. Original ownership/trace fences are
unchanged. Initial compressed-input test failures are preserved separately.

## Single fresh original outcome: live ownership passes, poll history missing

GL factory released normally18:13:32Z and Stronghold ChooseType18:18:08Z.
The sole attempt used main3075c796621511d92ca2ce3fa75b7216ecedbcc8 plus
RUN/attempted-relevant.patch and attempted-new-note.patch. The recorded driver
SHA256 is458f22e19b23e39b381cde19db63bc778105e0a3b4e8eadd1e40cc8609f991ce;
local SHA256 is4f9e0ccf76b7cd41a054e474543e9d12e6986e9f5d38d2c9b51ac55ad3cf489e.
These NEW candidate identities are separate from the unchanged retained
runtime modules in attempt-candidate.json. All432 actual filesystem/full HTTP
checks,111 helpers, four original Git dependencies and observerde6 passed;
all204 served-body records match their original pins.

Release18:18:20.144Z binds Node894431/start186350715, real host/boot and fresh
nonce, close18:30:20.144Z, cleanup18:33:20.144Z. The unchanged original quit
checkpoint is18:27:20.144Z. Chrome894623 reports151.0.7922.108 and loopback33021.
Bootstrap completed within60 seconds. All16 fresh successful screenshots were
personally VIEWED: desktop0, gray512/1024, black1536/2048/2560, visible MDK2
title3072; measured Escape followed by opening3120/3136/3152, readable highlighted
New Game3168, independently visible highlighted Medium3216, dark fade3264,
black/version3280/3296/3312. No historical pixels supplied fresh classification.

Original NewGame and Medium used their independent native input preflights,
balanced Enter edges and original callbacks. The pending route used original
input-free16-slice observations. At3312, native evidence classified
level-destruction-construction; pixels remained black/version, without loading,
comic panels, tutorial or gameplay. The original reviewed construction command
101 requested16 and actually ran16, reaching3328. No further guest work ran.

The repaired live ownership barrier passes: actual main slot0/endpoint1/thread1
and file slot1/endpoint2/thread2, full frozen/lifecycle/queue fences before and
after. bounded-trace-start.json and bounded-trace-correlation.json retain both
readbacks; the standalone ownership files contain the final stable readback.
The actual observer was installed before instantiation in the owning Worker,
bound to the canonical retained module. It attached at3312 with Level absent,
level1 request size192320 and no claim about earlier history. Two delivered
native boundaries then produced `poll history missing`. Observer status becomes
unsupported-or-unobservable. This is the first concrete failure, preserved in
reply101, first-failures, trace start/end/correlation and original controller
failure records. The command rejects after saving the16-slice result and
correlation; it does not mean the16 slices were prevented.

Independent frozen file readbacks show compressedRead2048→8192 and decoded
outputCopied8192→61440, a53248-byte advance. Resource completion stays0;
no completion/finalizer/Lua execution or Level creation is established. Missing
poll history remains unknown. There is no visible gameplay claim.

Continuation stopped immediately. The original ack-control helper rejects
all later actions after failed ACK101, including capture/quit. A first recovery
CLI quoting error submitted nothing. Corrected helper calls also submitted
nothing because of the same failed101. Recovery then submitted only the
original driver's explicitly permitted post-failure `shot` and `quit`, without
altering any ACK or guard and without guest work. Shot102 failed with detached
Frame; there is no post-fault screenshot. The last personally viewed3312 capture
and complete trace records are retained. Quit103 acknowledged operator handback.
All104 submitted commands have replies:102 pass,101 and102 fail.

Closure at18:24:59.490Z reports Chrome SIGKILL, exit null. This is abnormal;
its cause is unproved. Final-state capture also reports detached Frame. Neither
normal Chrome exit nor a guest fault is inferred. Node894431 and Chrome894623
are absent; HTTP33021 refuses connection and the soleLOCAL flock is available.
Resource release was announced18:25:36Z, explicitly recording abnormal Chrome
termination. Actual box ID/state/expiry remain NA; coordinator owns future boxes.

Next work, outside this stopped assignment: offline diagnosis of the concrete
poll-history rejection and separate investigation of Chrome termination before
any separately authorized fresh attempt. Do not rerun this release, relax the
observer guard, infer missing history or claim gameplay from file progress.
