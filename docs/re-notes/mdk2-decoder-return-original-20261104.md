# MDK2 original decoder returns and Medium release consumption

Input: published `68f65b14306368979cbce4e280b8f4eadc70a605` and
[the pinned quiet decoder notes](mdk2-pinned-quiet-decoder-state-20261104.md),
following [the keyup diagnosis](mdk2-native-keyup-cause-20261104.md) and
[the prior original attempt](mdk2-medium-release-gameplay-20261104.md).
Evidence: `scratch/runs/20261104-mdk2-decoder-return-original/` (RUN).
Exactly one actual original ran. It stopped at the first selector-cap fault;
there was no actual retry. Native decoder returns, consumed Medium keyup and
callback effects are now established. Callback completion, new LuaLevel
construction and visible gameplay remain unproved.

The local assignment now explicitly names this run, requires Stronghold2248's
22:54:44 heavy release with actual Chrome exit/ports-refused/flock-free evidence
and its 22:59:05 file release, and enforces 23:30 close / 23:33 recovery cutoffs.
The existing 720-second browser, 60-second bootstrap, 40-second command and
180-second cleanup bounds remain. Missing, stale, foreign, superseded and
incomplete predecessor release evidence is rejected by focused tests.
No observer or driver production code changed in this assignment.

Before Chrome, the same fresh entry wrapper used for the original reached a
plain Puppeteer mock. Independent public/native child-spawn prohibitions were
installed. Actual caller resolution verified all 432 filesystem and HTTP rows,
recorded the manifest and proof, then closed both servers with both ports
refusing connections. No Chrome or profile was created. The initial preflight
caught an actor-name mismatch in the renewed admission check before bootstrap;
the corrected entry passed. The preflight outputs and generated native-test
outputs were moved into RUN after their processes exited; original locations
are recorded in `evidence-movement.json`.

The served runtime is still Git `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.
Only its explicitly manifested bridge amendment is applied: original SHA-256
`39c0d671833330c71964c2f7ca4e24b1fc841b79e8eb54027d7889a9d2d306a1`
to amended
`075388dd3e52b2b137c12111b34406be651467004333567a0be47e09c9f3763b`.
The exact historical resolver is retained; there is no whole-runtime replacement.
All 204 actual served requests matched their expected pins. Module references
remain `cffca869…` / `580f49f3…`, with full SHA/path rows in RUN.

Each fresh complete image was personally viewed before further controls:
startup 0/512/1024/1536/2048/2560/3072/3584, then native-selector-64 at
3600 and native-selector-67 at 3648. The first captures showed desktop/window
creation, then black; step3072 showed a dim title/legal overlay, and step3584
showed highlighted New Game. A separate 16-step observation and native readiness
check preceded balanced New Game selection. Its result showed orange Medium
in the difficulty dialog; Medium's visual and native preflight both passed.
No Escape was submitted. There is no post-Medium complete image: the selector
failed before its final shot, and no new shot/control was requested after fault.

The owning native trace recorded five returns from original decoder output
routine `0x47d980` to actual caller `0x47ca7e`, at boundaries 37424, 236319,
392659, 549118 and 705118. Each return has EAX=32768 and ESP equal to captured
frame ESP+28. The checked object is `0x0847a810`, destination `0x00daf064`,
requested bytes 32768. Output contexts preserve actual GPR/lazy flags, stack,
object, input and decoded/output windows (196 bytes maximum); return contexts
retain 164 bytes. The first observed output is already partway through its
request, so it is not represented as an observed routine entry. Return object
remainingWords values fall from 11083162 to 11017626 across the five returns;
decodedWords is zero at each return. These are repeated finite output requests,
not completion of the entire compressed stream.

Medium keyup command79 was ACKed. It remained queued through step4064; at
step4080 the frozen queue is empty, activeInput is null, command raw/previous
are 0/0 and command active is 1. Freeze changes from nil to 1 and showmenu
from 1 to 0. Those original Medium callback effects persist through step4128.
This establishes keyup consumption and callback progress, unlike the predecessor.
It does not satisfy the existing full-rest predicate, which also requires
active=0. At aggregate selector544 the next quantum is rejected before
submission. That is the first actual fault. No readiness guard was weakened,
selector cap raised, history reset or continuation issued.

The last PC is `0x4434a0`, outside the decoder interval. The existing Level
identity remains the startscreen table. There are no new demand/finalizer/
poll-return/script-buffer/new-Level records. Continuous observation retains
29 checkpoints, 762000 boundaries, 40 records at last execution and 41 at
terminal cleanup; no fatal or pending native frame remains. All 137 submitted
commands, including normal quit136, have successful ACKs.

Actual received slice budgets are retained: the first output/return occurs
within a 100000-budget slice, then checkpoints show budgets of 1000 or 2000.
Thus quiet execution progresses more than the predecessor's 577000 boundaries,
but still spends most host steps on small native slices. The repeated offline
65536-word discriminator separates observation cost from decoder work: both
modules execute the same 156 fixed slices and preserve guest/output/register/
flag/command/trap parity. Original bridge makes 156000 synchronous block-log
RPCs; quiet bridge and quiet tracing-only controls make zero. Median slice
wall times were 23.913/24.036ms original, 8.361/12.431ms quiet observer, and
0.081/0.116ms quiet tracing only (canonical/compat). The original host feedback
maps median next budgets to 1000/1000/100000. These local fixture timings
identify host observation overhead; they do not replay this live stream or
prove how many steps callback completion would require. Bounded windows lack
the full stream and external callback state, so no such replay is invented.

Offline exact-prefix replay reproduces every Medium command through135,
consumed release/callback effects, active1 and rejection at544 before another
submission. It retains the original active0 predicate. No additional runtime
repair was justified or made. All native owner/module/record/byte/input/ACK,
50M/360-second, frozen-review and 16ms pacing guards remain unchanged; code,
assets and configuration are authentic.

Validation passed 42 local tests, 150 combined observer/integration tests,
exact independent entry preflight, actual-prefix replay and
`flock /tmp/wine-build.lock bash tools/build.sh`. RUN contains bounded original
analysis with assertions and decoder caller disassembly. Git is the source
archive: exact launch SHA, relevant binary diff and new-note patch are retained;
media/modules remain existing path+SHA references. No source snapshots, tars,
media/module copies, npm, subworkers, boats or deployment were used.

Chrome PID1359508/start188059303 exited 0/null at 23:07:18.021 after ordinary
Browser.close. Node1359137 and external flock1359136 (start188058982) were
absent; HTTP44949/34579 and DevTools36547 refused connections. The exact profile
was removed after owned-process absence, and external lock freedom was verified
at 23:07:42.996. The early board summary saying keyup remained queued was
explicitly corrected after detailed readback: it was consumed by4080.
Box ID/state/expiry are NA; coordinator retains shutdown ownership.

Next dependency, if separately pursued: original callback-return/native
construction context beyond the consumed-release active1 state under the same
finite guards. This assignment ends with the concrete first failure and native
progress evidence; no further original execution is authorized here.
