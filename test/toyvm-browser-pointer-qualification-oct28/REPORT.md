# Retained ToyVM pointer candidate: partial real-browser qualification

2026-10-28. Worker session `01a1843d-c791-7b41-ac68-755370e1a621`.

**Full acceptance is not justified.** Both original production launchers delivered
real browser mouse input into actual Machine INT33 state. Explicit capture-loss
cancellation and mouse `pointercancel` remain unqualified. No production defect
was established, no candidate source was changed, and no repair is proposed here.

## Exact production boundary

The retained candidate is
`scratch/runs/20261014-dos-pointer-candidate/`, with provenance and limitations in
its original REPORT.txt. All 110 baseline/candidate entries in source-hashes.json,
plus eight delivery/report files, were independently checked for size and SHA256.
All 44 modules embedded in the loaded browser bundle were decoded as JSON and
compared byte-for-byte with the retained candidate source files. See
`input-closure.json` and `embedded-source-identity.json`.

Loaded unmodified production payloads:

| File | SHA256 |
| --- | --- |
| docs/dos-corpus/live/toyvm-bundle.js | 2532ba8014bb426b3ae1b5423bc628e9447e94c73fe9d12c5fed7895a76096ec |
| tools/toyvm/live.js, embedded | 85725793f35211f893480e57af4f01b92e33adf6730cfedbed3c28eceb0c74b5 |
| tools/toyvm/dos.js, embedded | 1cebbc098e467054eb363a0b8eff5bc6f5d0b7ee4c5ff5842a1d1c1704d8bf59 |
| ops/toyvm-live/live.js | a0db97e34dea2f0d38fcf1095ee09141c7712540e97b284b7abe08e7b35c2cbd |
| docs/dos-corpus/site.js | 24a611661b65e2af73239f13993850353056cf1cad4dadd7f92c3f3feb05bdca |

The dashboard's original HTML and original launcher JS ran against a loopback
fixture API. The demo's original generated site.js ran against minimal harness
markup containing its normal lightbox controls and a packed fixture script.
Production LiveRun.start, VM compilation/initialization, Machine, bindPointer and
bindKeyboard all executed. A 25-byte harness COM sets BIOS mode13, fills VGA memory
with a solid color, and waits on INT16. There was no full Wine build, original
commercial game execution, public deployment, or Constructor gameplay claim.

observe.js forwards original binder/start/capture methods, records their callers
and instances, and reads actual Machine INT33 through its register interface.
It does not substitute an input model. A property observer follows the demo's
second bundle assignment. Tests use Chrome DevTools Input mouse/key operations;
recorded pointer/key/focus events are browser-generated and marked isTrusted.
DOM focus(), disposer calls and the replacement close-button click are explicitly
scripted lifecycle operations, not claims of physical user input.

## Observations and limits

Chrome `151.0.7922.108`, V8 `15.1.206.16`, Linux x86-64, headless desktop mouse,
1000x850 viewport, DPR1, Node `v24.22.1`. Browser revision was reported as all zeroes;
no stronger revision identity is claimed. No Playwright/Puppeteer install occurred;
Node's built-in WebSocket client controlled the owned Chrome endpoint.

Passing observed groups, retained individually in checkpoints.json:

* Dashboard loader/start and first real press: INT33 buttons1, x320/y100; release0.
  The recorded binder caller is original `/toyvm/live.js`.
* Original demo launcher: first press, x638/y199 at the lower right, press count1
  consumed once then0, edge position320/100 preserved, release count1. This is the
  standard mode13 virtual640x200 contract over the real320x200 backing canvas,
  displayed at640x400 CSS pixels. Binder callers include original `/site.js`.

The historical checkpoint name `demo-capture-release-mode13` labels the attempted
sequence; it does not qualify capture ownership. Release via the window fallback
is observed, and the default lightbox background click also stopped that run.

* Primary/right chord transitions1/3/2/0 and an unowned release negative control
  passed before the canvas-blur checkpoint. Actual canvas focus loss released the
  pointer and a held ArrowDown key; a key release created no retained held key.
* Creating/activating a second actual browser target made document.hasFocus false
  and cleared the guest button through real window focus loss.
* Original binder disposers released the button. Subsequent pointer movement and
  release left Machine.mouse unchanged (teardown negative control).
* Original demo close/stop/restart released the old run. Stale held-button movement
  and release did not press the new run; its next new press/release worked.

**Cancellation blocker:** the production call to Element.setPointerCapture(1)
returned successfully and immediately reported hasPointerCapture=true, but capture
was absent after the next real mouse event. The fresh-page precondition check
timed out with hasPointerCapture=false. The isolated capture-cancellation group
therefore never generated the required lostpointercapture event and is marked
UNQUALIFIED, not passed or candidate-rejected. The window-up fallback did release
the guest. Browser-generated lostpointercapture during earlier canvas blur is in
the trace, but does not establish the independently requested cancellation route.
No real mouse pointercancel was observed. The evidence does not distinguish a CDP
input/capture limitation from another browser/candidate interaction; it does not
justify a speculative candidate fix. Ordinary release is qualified; guaranteed
capture ownership is not.

The concrete next gate is an independently observed native capture/cancellation
sequence on the same pinned payload, including real pointercancel if required.
Full candidate integration/acceptance is not justified by this task. Existing
fakeDOM, generated-shim and unchanged held-key passing groups are reused from
the retained test-results.json; they were not rerun or relabeled as browser tests.

## Harness incidents and incremental execution

Six bounded browser invocations consumed **49.667991 aggregate-accounted CPU
seconds** and **16.920089657 wall seconds**, below the original90/120 allowance.
Each continuation subtracted prior measured usage; no allowance was reset.
Earlier supervisor receipts and failure traces remain in the archive.

The first demo observation failed because its second bundle replaced the observed
module. A resource-load observer was too late for that launch promise chain;
observing ToyVM assignment corrected the harness. A later chord assertion used
coordinates after releasing on the lightbox background had legitimately closed
the original demo. The passing delivery/release group was sealed, and remaining
groups resumed on a new run. Capture cancellation then failed its observable
precondition; the final continuation records it unqualified and performs only the
remaining focus/teardown/replacement groups. No passing group was replayed for
packaging. Failed assertions without the necessary browser event are not evidence
of a production defect. The final harness retains the original sequence and
explicit --resume-demo / --resume-after-capture / --resume-after-blur modes;
default execution also retains the background-close reproducer. Do not treat its
default exit as a clean acceptance runner.

Initial read-only policy/manifest terminal output exceeded the8192-byte gate;
this is a recorded control incident, not a compliant-output claim. Subsequent
operations retained bounded output. The initial supervisor merged Node streams;
later invocations captured distinct suite stdout/stderr from process creation.
Chrome/server stdout and stderr were separate throughout. These limitations
remain visible rather than being erased by a rerun.

## Resources, preservation, lifecycle

Local incremental allocation128MiB including16MiB reserve; no donor objects or
refs were modified. The sparse task repo borrows the root object store read-only,
based on `6aaf65235f367beb610931be83b4b1268ef35ad7`. Git DATA/RSS controls apply to
Git children only. Local child RSS512MiB, Node heap320MiB; exact startup receipt
shows DATA/AS unlimited for Node. Canonical mount-parser control enumerated a
comma-bearing filename; actual runtime filename-bearing mount argv was empty.
Explicit HTTP fixture responses and JS mount operations are not filesystem mount
arguments. Source archive755428B/24 acknowledged chunks; remote evidence893458B.

The browser's largest observed aggregate RSS was1512386560B, below1610612736B.
All six supervisors report cleanupComplete=true. Seven bounded PNG files are
retained (largest33708B); the capture total is under8MiB and every image under1MiB.
The dashboard and replacement frames were visually inspected: both show the
fixture's solid-color actual mode13 framebuffer. This is not gameplay evidence.

Only fresh task Boat `bx_va5ee9q2` was created, small, TTL1800, expiry21:13:39.669Z.
API exec only; no SSH/resume/alternate credentials. Delegated snapshot-stop
completed at20:52:11.851Z, stoppedAt20:52:11.820Z; snapshot verified20:52:11.755Z.
No running box remains. Coordinator retains ultimate lifecycle ownership. Claude,
HeroesII, other games, root refs/index and all donors were left alone; the only
shared write is the explicitly required append-only messageboard claim/release.

Canonical output is
`scratch/usage-watch/toyvm-browser-pointer-qualification-oct28/receipt.json`.
The task output owns browser-evidence.tgz, lifecycle.json and a bounded source
archive; the isolated repo owns the run folder named in RECOVERY.md. No PNG,
archive, credential or binary is committed. Harness/report publication is a task
branch only; coordinator owns integration. See RECOVERY.md for recovery checks.
