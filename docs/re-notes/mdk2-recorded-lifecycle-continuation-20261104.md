# MDK2 recorded lifecycle continuation: diagnostic stopped before original

The single authorized Chrome-only diagnostic failed before Puppeteer returned a
Browser. The prospective recording identifies this diagnostic's actual SIGKILL
caller. No original MDK2 continuation was launched, and no Chrome retry was made.
Chrome894623's historical SIGKILL sender remains **UNPROVED**; the new evidence
does not establish its cause retroactively.

Evidence is `scratch/runs/20261104-mdk2-recorded-lifecycle-continuation/` (RUN).
The accepted input is6f1b503a0fc278ee3aff637c15ae271318f79e22. RUN's
`prior-seal-verification.json` verifies all503 prior sealed files,1034614 bytes,
unchanged. Historical helpers and the tested mid-poll observer repair are unchanged.

## The one diagnostic

GLTron's explicit19:05:41 heavy release and Stronghold's18:58:20 release were
observed before acquiring `/tmp/wine-local-runtime.lock`. The diagnostic used the
prepared, owner-filtered passive `lifecycle-preload.cjs` from the accepted run,
the real installed Puppeteer25.7 packages, and `/opt/google/chrome/chrome`.
`diagnostic-contract.json` binds its host/boot/PID/start identity, fresh nonce,
candidate hashes, direct run directory and30-second browser/60-second cleanup
bounds. `diagnostic-packages.json` hashes the installed package entries, metadata,
launcher/process implementation and actual Chrome executable; no package changed.

Node957902 (start ticks186636430) spawned Chrome957916 (start ticks186636495)
at19:05:55.714Z. Both are on the recorded host and boot. Launch options and the
observed actual command line are retained separately. The caller selected a
15-second launch timeout within the30-second diagnostic budget. It rejected at
19:06:10.719Z, before returning a Browser. Chrome printed its own loopback
DevTools endpoint at19:06:10.929Z,210ms after rejection.

The installed `BrowserLauncher.launch` catch invoked its close callback without
a CDP connection. Its `closeBrowser` path waited five seconds, then called the
installed `Process.close`. At19:06:15.722Z, the passive recorder captured
`process.kill(-957916, 'SIGKILL')` and the actual `Process.close` caller stack.
Chrome exited with code null/signal SIGKILL at19:06:15.736Z; its close event and
Node exit1 followed at19:06:15.737Z. Browser lifetime was20022ms. This is an
abnormal outcome, despite being within the time bounds.

The diagnostic caller's finally block had no Browser handle and did nothing.
An additional normal-close recovery program found Chrome already absent and
recorded ENOENT; it did not launch or signal anything. Ordinary page work,
page/frame teardown, root disconnect and Browser.close were never reached.
Their absence is explicit, so the required successful lifecycle diagnostic gate
did not pass. No full original FS/HTTP prerequisite run or original release was
issued. No guest/game/media, measured input, Level/Lua construction, or gameplay
claim follows from this run.

`local-closure.json` verifies both PIDs and the Chrome process group absent,
the DevTools port42809 refusing connections, and the runtime flock available.
There was no HTTP server. The explicit local heavy release was posted19:11:19Z.
Box ID/state/expiry are NA; the coordinator retains future box/shutdown ownership.

## Evidenced caller repair

`tools/mdk2-local-runtime.cjs` now exposes the installed run's passive recorder
and a separate active `closeUnreturnedLaunch` caller helper. The recorder also
retains the exact observed spawn executable/arguments and bounded stderr.
Recording itself still never closes, launches or signals a process.

On a rejected launch with no Browser handle, the new cleanup helper requires
exactly one recorded owned child, verifies its live PID/start/host/boot identity,
and waits within the explicit cleanup deadline for that child's single loopback
DevTools endpoint. It connects once, observes pages/disconnect and Browser.close,
requests normal closure, and requires actual exit0/signal null. Foreign or
ambiguous endpoints, replaced identities, expiry, duplicate cleanup and an
already abnormal exit reject. It does not suppress installed fallback signals,
retry launch, or relabel abnormal closure.

The run-specific diagnostic caller is repaired to use the remaining30-second
launch budget and invoke this helper immediately after a rejected launch, with
at most60 seconds of cleanup. Its initial and repaired new-file patches are
retained. This repaired caller has **not** been run against another Chrome.
The original release/expiry/observer/queue/module/input guards are unchanged.

The regression uses the actual installed `BrowserLauncher.launch`, its real
endpoint-wait timeout producer and close path, and an owned Node child that
prints a delayed endpoint. The old no-Browser cleanup leaves that child live.
The repaired helper consumes the actual recorded late endpoint and closes the
same child through a fixture connection; its child exits0 without signals,
before the installed five-second fallback. The connection is a fixture, not a
claim of successful Chrome recovery. Identity, endpoint, deadline, abnormal
outcome and duplicate-call negatives pass. No second browser was used to test it.

Validation:32 local tests,94 integration tests, standalone observer full-memory,
register/flags/command/trap parity in both modules, accepted111-helper/four-Git
dependency/both-module guards, and the locked full build. The already accepted
CDP-reject SIGKILL fixture was excluded from this rerun; its historical proof
is retained, while the new fixtures request only normal Node-child exit.

RUN contains exact Git SHAs, relevant binary diffs and new-file patches. Existing
module/media locations remain references; no source archive, media copy, module
copy, npm installation, box operation or subworker was used.

Next is a separately authorized fresh Chrome-only diagnostic using the repaired
caller. Its normal, fully recorded closure is still required before considering
another original construction attempt. The accepted mid-poll suffix retains an
UNKNOWN prefix; missing demand/finalizer/buffer history must still stop any
future construction observation.
