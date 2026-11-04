# MDK2 poll-history repair and unresolved Chrome termination

The observed poll-history failure has a tested observer repair. Chrome894623's
termination cause remains unproved, so this assignment launches no new original
continuation. The two failures remain distinct. This is an offline repair and
diagnostic handoff, with no gameplay claim.

Evidence: `scratch/runs/20261104-mdk2-poll-history-lifecycle-repair/` (RUN).
The prior handoff is `mdk2-startup-timing-onward-20261104.md`, published in
7bd2cd305eca803c3463ac0bd10fc174b8a4e9e8. RUN/analyze-prior.cjs verifies every
one of its1364 sealed files,16597901 uncompressed bytes, including retained gzip
forms. Its seal SHA256 is
688091c2ee3d14904b7336e6110b91f1eadc6ca2e0ad9e2cf26ac71f00b92546.
Historical evidence/helpers are untouched; initial failure logs are retained.

## Actual attachment ordering

The original owning Worker was slot0/endpoint1/thread1, with file Worker
slot1/endpoint2/thread2. The full frozen main.link identity, lifecycle and queue
barriers pass before and after command101. The canonical Module binding and
installed-before-instantiation audit pass. Installation creates a dormant
wrapper; the observer and native tracing start only at the construction command.
Those are different times, as the installed source explicitly specifies.

At attachment, step3312, main EIP is4515cd and ESP074ffc24. Its first four
stack words are4522d7,10,44fb84,005e3840; the last is the actual level1 request.
The resource is active, type10, incomplete, size192320. The original instructions
in RUN/original-instructions.txt establish this exact chain:

| PC | Original instruction / observation |
| --- | --- |
|44fb7e /44fb7f|push request; call4522d0|
|4522d0 /4522d2|push10; call4515c0|
|4515c0–4515c7|call SleepEx with the original arguments|
|4515cd|ret; this is the attachment point and first delivered boundary|
|4522d7|read completion; second boundary, old observer rejects here|
|4522dc /4522df|add esp,4; ret to44fb84|

The first two boundary addresses are reproduced by the actual native producer;
the historical report itself retained the count2 and failure, rather than a
complete raw boundary list. The sealed initial registers/stack, original decoded
instructions and queued-producer reproduction establish the ordering. We do not
claim a historical raw trace that was never recorded.

This is attachment in the middle of a native poll, with its prefix unobserved.
It is not evidence of a wrong hook/owner/correlation or an unsupported x86
instruction ordering. Command101 requested and ran16 slices, reaching3328,
before its assertion rejected. Missing poll history was UNKNOWN, never a guest
stall. Frozen file output advanced8192→61440 bytes, compressed read2048→8192;
completion remained0 and no Level table or original gameplay was established.

## Repair and rejection boundaries

The observer can now recognize only this exact initial Sleep-return suffix.
It additionally pins the Sleep wrapper and original request call bytes. Its
first sample must show the original return address,10ms argument,44fb84 caller,
and the same active type10 request. The first native boundary must match that
sample. The next must be4522d7 with ESP advanced4 and the same remaining stack;
the following must be44fb84 with ESP advanced12, the same request and the actual
completion return value. A mismatch is terminal.

It emits `poll-prefix-unobserved`, `poll-suffix-read`, and `poll-suffix-end`.
It never creates a poll-entry record, seeds `poll`, emits `poll-return` for the
partial call, or promotes unknown history into known history. The original
`poll history missing` assertion remains for every unqualified completion-read
boundary. Future fully observed polls use the existing entry/return checks.
Deadline, record/boundary bounds, missing history, foreign instance/thread,
loader, bytes, request, completion/finalizer and script-buffer checks remain.
This repairs the evidenced poll suffix, not every possible attachment scope.
An earlier demand-load call is also outside this observed interval; no history
for it is invented. A later missing demand/finalizer/buffer history still stops
observation. No complete resource-to-Lua sequence is established by this repair.

Both retained canonical/companion modules execute the actual original
RET/MOV/ADD/RET sequence in the pinned shipped Worker through its ordinary queue
and exact composed preload. The old observer fails after2 boundaries; the repair
passes, with completion0 throughout. Full-memory hashes and registers agree at
the identical poll endpoint; guest-image memory, registers and command sequences
also agree after delivering the caller boundary. A whole-memory comparison
after that extra caller slice was initially attempted and is preserved as a
failed test: the old rejection had already disabled tracing, so that comparison
does not have identical trace configurations. Existing complete normal/observer
full-memory parity guards still pass in both modules.

Bad initial stack, stale stack after sampling, changed request and skipped
initial boundary reject. Existing generic missing-history and all real composed
Worker lifecycle/owner negatives still reject. The fixture executes no game and
creates no Lua state or callbacks. Integration keeps the original de6 observer
pin and adds the exact repaired observer SHA256
341f705e65d292ab014146af0594cc0531913428f14b0f47a125f7fba4acf0cb.
All111 helper/four Git dependency guards and432 actual-filesystem/full-HTTP pins
remain. No historical helper is patched. The standalone observer test now reads
compressed historical seal/inventory inputs without restoring or overwriting
them; its native qualification fixture remains byte-identical to de6.

## Chrome termination: mechanism available, attribution unknown

Command101 failed18:23:32.831Z. Shot102 failed with detached Frame at18:24:42.934Z,
70.103 seconds later. Quit103 began18:24:59.485Z and cleanup recorded SIGKILL,
exit null, at18:24:59.490Z:5ms later. The detached-frame failure preceded quit
by16.551 seconds. These timestamps are observations/cleanup records, not the
time Chrome actually received SIGKILL. Quit ACK is operator handback, not proof
of orderly Chrome termination. Prior abnormal outcome remains unchanged.

The installed Puppeteer25.7.0 BrowserLauncher.closeBrowser tries CDP Browser.close.
On rejection it calls the installed browser-process close(); on Linux, a still
live process is killed using process.kill(-pid,'SIGKILL'), with a child.kill
fallback. Driver exit/SIGINT can also reach kill; SIGTERM/SIGHUP reach close.
The original driver calls browser.close during handback. Trace failure itself
stops tracing and saves the failed ACK; it does not call browser.close. The
40-second command timeout,60-second bootstrap limit and absolute browser timer
do not match the recorded successful bootstrap/short commands and early quit.

The installed launcher and process implementation were exercised with owned
Node children: graceful CDP completion exits0; rejected CDP close invokes the
actual Linux process-group SIGKILL path, with a captured stack through
BrowserLauncher.closeBrowser. RUN/lifecycle-mechanisms.json records both cases,
timestamps, actual PID/start identities, exact installed source paths/hashes and
kill stacks. These fixtures prove a mechanism exists; they do not identify the
sender or trigger of the historical Chrome signal. No OOM inference or rejected
security diagnostic is used.
These are the currently installed package bytes. The prior run did not seal
Puppeteer package hashes, so their exact identity with that process's dependency
bytes is not cryptographically established either.

Historical records lack an exit-event timestamp, root browser disconnect time,
page/target teardown sequence, close-request result and local signal-call stack.
The early detached Frame alone does not prove root browser death. A close
fallback during quit is compatible with the5ms cleanup interval, but remains an
inference, not established attribution. External signal attribution is also
unknown. No source-only inspection can recover those missing events.

## Executable diagnostic/recovery recipe

Offline reproduction, without Chrome or a game:

```sh
RUN=/home/user/wine-assembly/scratch/runs/20261104-mdk2-poll-history-lifecycle-repair
node "$RUN/analyze-prior.cjs"
MDK2_TEST_EVIDENCE="$RUN" node --test --test-name-pattern=mid-poll test/test-mdk2-construction-driver-integration.js
MDK2_LIFECYCLE_RESULT="$RUN/lifecycle-recheck.json" node --test --test-name-pattern='installed Puppeteer close path' test/test-mdk2-local-runtime.js
```

The new exported local.traceOwnedLifecycle records actual child spawn identity,
exit/close, bounded stderr, root disconnect, page errors/close/frame detach,
browser.close calls/results and owned process.kill/child.kill callers. It never
launches, closes or signals anything. Its profile/executable filter excludes
other launches. Test fixtures verify the actual SIGKILL caller is captured,
foreign browser admission and overwriting an existing log reject, and normal
closure stays distinct. The helper is not automatically installed by this
assignment and does not renew the prior release or grant a launch.

RUN/lifecycle-preload.cjs is a prepared diagnostic preload for a separately
authorized fresh owned diagnostic driver. It intercepts only that direct run's
CommonJS Puppeteer require, preserves launch arguments/results, and attaches
the recorder before spawn. It watches browser/pages after they are created.
Its no-launch smoke and actual run-local require/foreign-profile rejection are
tested; the initial immutable-ESM-export failure log is retained. For a newly
authorized diagnostic run with its own finite contract and launch script:

```sh
MDK2_LIFECYCLE_RUN="$FRESH_DIAGNOSTIC_RUN" node \
  --require "$RUN/lifecycle-preload.cjs" \
  "$FRESH_DIAGNOSTIC_RUN/diagnostic-launch.cjs"
```

This is a handoff recipe, not an executed or authorized new game continuation.
Use a Chrome-only diagnostic first, retaining lifecycle/stderr and close failure
logs. If a future original attempt is separately justified/authorized, preserve
all original view/input/owner/module/HTTP guards and install this recording
before launch; it cannot retroactively establish the old signal's cause.
No fresh original should be spent merely reproducing a known fault. Do not rerun
the old release, edit ACKs or sealed helpers, force Level/Lua/native installation,
relax guards, infer gameplay from file progress, or call SIGKILL normal closure.

Both requested resource releases were observed: GLTron18:36:33Z and Stronghold
route handoff18:39:17Z. This assignment did not start Chrome, a Node HTTP server,
or a guest, and did not reserve the runtime flock. The old Node894431 and
Chrome894623 remain absent; HTTP33021 refused and the runtime lock was available
at final verification. Box ID/state/expiry: NA; coordinator owns future boxes and
shutdown. No boat/API/SSH-box/npm/allocation/subworkers were used.

Final validation:31 local tests,94 integration tests, standalone observer
normal/observed full-memory/register/flags/trap parity in both modules, and the
locked full build. Evidence includes exact Git SHA, relevant binary diff and
new note patch; media/modules are existing path/SHA references, with no source
archives or media/module copies. Next: resolve the lifecycle attribution gap
with prospective diagnostic evidence before considering another original run.
