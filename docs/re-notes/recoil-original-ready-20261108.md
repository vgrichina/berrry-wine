# Recoil original startup and independent census repair, 2026-11-08

The sole new runtime reached a new independent-clock startup failure before
original-game navigation. The first substantive integration repair is tested;
no original was replayed. Software qualification, current native Resume, M and
visible movement remain unperformed. This completes the permitted repair
stopping condition, without claiming gameplay success.

Evidence R: `scratch/runs/20261108-recoil-original-ready-1621/`.
Starting Git SHA: `83d6b743334c7b65eb3d5599f35ade21b92a73de`.
Recovery uses Git, R/owned-code.patch, the small owned operational inputs and
their patches, selected manifests and existing provider paths/hashes. No source
tree/media archive or peer WIP was collected.

R/position-runtime-pins.json is a new immutable selection through normal
`tools/native-runtime-generation.py`, based on the production 979-provider
generation. It explicitly replaces only the shared kernel pin with exact
published `275dd018aad23b8e2988a78033cddaa2e25d8df3` bytes and appends 29
relocated helpers: 1,008 providers. The original 851 rows remain verbatim;
historical 979/947/916 manifests remain in their recovery locations. The
checker stays `43f27bb4…`; the shared supervisor, five-input bootstrap and
bounded endpoint helper remain selected. No private supervisor is launched.
Original decoder/compositor identities remain 204938B /
`f468ffce84da0f517df009682c111bbcb955b67f8b5a122350abbe5abc49e1d8`
and 227919B /
`cb21daaf7c0ce2b2cf80436c192bda4ed78930b1b07eaf21a20eb9adb7ce7b51`.

Cheap normal-production provider resolution and nested helper closure passed
before allocation, with 1,009 joined callback uploads and hermetic preloader/
decoder import. This callback check claimed no remote publication. Actual
provisioning subsequently joined all 1,009 transfers, content-verified all
1,008 providers and published the normal barrier. Queue and parent rechecks
passed; actual startup admission validated 1,008 providers before atomic
request consumption. Existing JOIN/content/parent tests were accepted rather
than rerun. No fixture, generated guest or bypass was selected.

The actual shared-kernel journal now accepts SIGTERM terminal retirement at
sequence1203, PID7258/start16623/TGID6929. Normal kernel drain completes with
exit0 and no remaining tasks. Its one unresolved lineage stays explicit:
`kernelForkLineageComplete:false`. This does not establish exhaustive lineage;
CLONE_UNTRACED and nonleader-exec limitations are unchanged.

The new failure is the first independent clock census. The journal registers
PID6929/start15378 at 16:22:24.646Z and parks its initial autoattach stop. The
parent's fork lineage arrives at 16:22:35.179Z; the child release follows at
16:22:35.202Z, about 10.4 seconds after parking. The census process is reaped
with SIGTERM at 16:22:39.584Z without a successful proof response. The unchanged
producer used `execFile` with a two-second timeout encompassing Node startup.
That timeout is the inferred signal sender; the journal does not identify the
sender. R/first-new-causal-failure.json binds the exact rows to the independently
hashed actual journal. The driver records sticky UNKNOWN at 16:22:39.709Z.

`tools/native-clock-process-proof.cjs` now prearms one independent producer at
verifier construction, which the actual driver executes before Chrome startup.
After readiness, every request sends a new random challenge and performs a new
complete census in that independently identified PID. There is no stored-proof
response. Module/request hashes, exact PID/start, boot/namespaces, driver/Chrome
identity, listener FDs, profile endpoint and wall/monotonic brackets remain
required. The two-second response budget begins after readiness. Both producer
and verifier freeze the original runtime deadline; changed deadlines and reused
challenges fail. Producer loss, timeout or sink failure remains sticky UNKNOWN.
Idle handles permit normal driver exit, whose exit hook terminates the owned
producer; explicit close and kernel descendant drain remain available.

The Software gate itself is unchanged: six complete uncached WASM/JS responses
per probe through allSettled, current contexts/pipeline owner, independent
challenged census before/after, final PNG freshness through decode/save at
250ms, changed timer/living temporal pair within the immutable five-second
transition, lifecycle retirement and no replay. No deadline or identity pin is
weakened. The independent driver/Chrome watchdog is unchanged.

R/clock-kernel-ready-final/ tests actual Chrome, the actual extracted driver
binding and the shared kernel supervisor while holding the local runtime lock.
A real observer exec stop is deliberately held 2.3 seconds before CONT: startup
passes and subsequent fresh challenged censuses use the same independent PID.
A later real stop is held to prove fresh-response timeout and sticky refusal.
Only scheduling is injected; census results, identities, clock and listeners
are actual. Controls cover observer death, challenge replay, producer deadline
mutation, wrong PID start/listener owner, durable sink failure, stale source/
pixel timing, immutable transition, lifecycle retirement and post-exit refusal.
Natural driver exit also retires the observer, including failure before its
first census. Final kernel drain is empty. An earlier test attempt assumed
SIGSTOP would remain stopped under the supervisor; that assumption was false
because its existing policy suppresses SIGSTOP. The failed test and corrected
real-stop scheduling harness are retained separately. Kernel policy is untouched.
The locked full build passes in R/build-final.log.
All 2,371 previously accepted evidence references (705,157,488 bytes) were
independently rehashed in place; unchanged Software/owner/HTTP/watchdog fixtures
were not rerun. The modified clock binding has the fresh real-Chrome tests above.

R/repaired-ready-runtime-pins.json explicitly selects the repaired producer
through the same normal generation mechanism. All 1,008 providers and 29
physical helpers resolve with the current nested checker; hermetic import of
the repaired module and original decoder succeeds. R/repair-selection-final-check.json
records producer SHA-256
`68ea2f56c8c509faa9833758990c46efe285700dc017db91d7dc89c246f61318`.
The actual-run manifest remains unchanged. Earlier local selection candidates
remain evidence, not additional runtime attempts. The repaired generation was
not remotely run: no second original is authorized by this task.

The one UUID-idempotent allocation is **bx_p9mj8t7q**. Its ID and initial expiry
**2026-11-08T16:46:32.930Z** were durable before runtime. The independently
observed outer watchdog was armed before allocation; immutable browser and
normal-stop deadlines were 16:44:02.730Z and 16:45:32.730Z. The remote runtime
lock covered bootstrap through owned drain. The bound pair watchdog independently
observed both processes absent and profile removed, without firing its deadline;
its receipt makes only that scoped claim.

R/normal-runtime-drain.json independently verifies all 160 recorded remote
task/supervisor PID/start identities absent, adopted descendants drained, ports
42237/35659 closed, profile absent, no runtime cmdline/FD writers, and runtime
lock free. No guest input was sent or held. The first retrieval raced a changing
custody log and correctly refused a hash mismatch; the partial retrieval remains
retained. After drain, all **42 unique outputs / 20,631,762 bytes** were retrieved
and independently reopened/hash-verified before requesting normal stop.
The box is **ARCHIVED**, current expiryNULL, stop receipt
**stop_573e96c10f80b6ce**, completed **2026-11-08T16:23:40.297Z**,
forcedFALSE/errorNULL. Both local lifecycle roles exit0 and their supervisor has
no remaining children. R/local-identity-drain.json audits local test/lifecycle
identities and removed profiles separately. The heavy local runtime lock was
used only for actual local Chrome controls, never for the remote original.

Runtime startup from launch to terminal failure was about 79.5 seconds. Guest
loading was not entered; MENU and active gameplay were not entered. There are
no current Resume pixels to review, no Software arm, no M, no movement and no
observed health or game timer. The historical Software196457/health100/timer09
image is not current proof. No private guest writes, configuration/clock/seed
changes, old-box resume/delete, public deployment or subworkers were used.

Next is a separately authorized original attempt with the published producer
repair selected explicitly. Keep the compound gate, personally review current
native Resume before clicking, qualify actual Software before/after with the
argument-free post-Resume proof, then review native M's consequence before any
bounded movement. Full27, parity, audio and FPS remain open. RELEASE and stop.
