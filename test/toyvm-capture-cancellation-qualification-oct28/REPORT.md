# Capture cancellation diagnostic, unchanged ToyVM

**Resource-rejected diagnostic; full acceptance and integration are not justified.**
The one authorized browser differential produced the missing trusted capture-loss
observation on the original production launcher and actual Machine INT33. Its
supervisor nevertheless rejected the run when a Chrome profile temporary file
vanished during accounting. No second invocation was attempted. Natural mouse
pointercancel remains unseen. No candidate defect was established or repaired.

## Inputs and exact boundary

Read-only donor HEAD `928d23d437c6d657f9309b6c05085ee6aa9ca369`.
Reuse the coordinator's verification of 199 payload identities and the original
118-input/44-embedded-module closure from canonical predecessor receipt
`scratch/usage-watch/toyvm-browser-pointer-qualification-oct28/receipt.json`,
SHA256 `b245855ecdd6b0ea4e8540dd5be9832ac803dfdedd8d09297085cfdc23243f6f`.
Only the four required production web files were staged and rechecked locally.
The loaded bundle remains
`2532ba8014bb426b3ae1b5423bc628e9447e94c73fe9d12c5fed7895a76096ec`.
The fixture server serves those original bytes. Harness instrumentation forwards
original native capture methods, bindPointer, and LiveRun.start. It records the
actual binder canvas, run canvas, document, focus, pointer ID and event trust.

Fresh original dashboard loader/start ran first, including production VM
initialization and its real Machine. No historical/manual runner substituted for
the production boundary. The same retained tiny COM fixture was used. Sealed
ordinary delivery, second launcher, mode13 geometry, focus, teardown and
replacement groups were reused without replay. No Wine build or commercial
guest/gameplay execution occurred.

## First loss and differential

The retained predecessor command was mouseMoved with buttons1 and no separate CDP
button field. Its capture query was false immediately after that move; there was
no independent got/lost capture event. Missing buttons was not the cause assumed
here: buttons1 was present in both old and new sequences.

On the new minimal DOM control, native setPointerCapture on the actual trusted
mouse pointerdown returned capture=true for active ID1/buttons1. The very next
mouseMoved with buttons1 and omitted button changed capture to false, while
document focus stayed true. No got/lost event was emitted. This is the first
observed state-loss boundary. The paired control adding button:'left' retained
capture and emitted trusted gotpointercapture, then trusted lostpointercapture
after native release. This isolates a CDP-command difference in this Chrome
environment; it does not identify a Chromium internal cause or candidate defect.

The production sequence used the active mouse button explicitly. It recorded:

| Boundary | Capture | INT33 button | Press count | Release count |
| --- | --- | --- | --- | --- |
| Trusted pointerdown | true | 1 | 1 | 0 |
| Held move, button:left/buttons1 | true | 1 | 0 | 0 |
| Native releasePointerCapture(1) returned | false | 1 | 0 | 0 |
| Next move, trusted lostpointercapture | false | 0 | 0 | 1 |
| Stale held move | false | 0 | 0 | 0 |
| Stale pointerup | false | 0 | 0 | 0 |

Actual canvas was `screen`, identical to the binder argument, connected, owned by
the current document and focused. Trusted gotpointercapture preceded trusted
lostpointercapture; both had pointerType mouse, ID1 and buttons1. Original binder
cancel called original releasePointer from tools/toyvm/live.js; its native release
forwarder found capture already false. Release count was additionally consumed
to zero. No synthetic dispatchEvent, touch/pen replacement, or pointercancel
qualification is claimed. The production events and native caller stacks are in
production-events.json, with command order in cdp-commands.jsonl.

Chrome151.0.7922.108/V8 15.1.206.16 on Linux x86-64, headless desktop mouse,
viewport1000x850/DPR1. Chrome reports an all-zero revision; no stronger identity
is asserted. Existing old screenshots remain in the predecessor archive and were
not copied or recaptured. New capture count is zero; one of the original eight
remains available. Canvas backing320x200/display640x400 is unchanged.

## Rejection, verification and remaining gate

Exact rejection: accounting check failed, ENOENT on
`chrome-profile/Default/.org.chromium.Chromium.hbL1Tj`. The harness wrote its raw
success result before final cleanup, but guard stopReason overrides that result.
Do not promote raw result.json to accepted qualification. Stop occurred on the
first substantive accounting failure; controls were not raised or reset.

Offline verify.cjs checks the observed production path, trusted capture event
order/ID, real canvas identity, one consumed release and stale-input negatives.
Six mutated evidence controls reject untrusted loss, wrong ID, wrong canvas,
double release, stale re-press and stale up press count. The independent
qualification predicate explicitly rejects the actual guard receipt. All seven
rejecting checks pass without replaying the browser. No natural mouse
pointercancel occurred. The next acceptance gate needs coordinator authorization
and a correct transient-profile accounting wrapper within the retained allowance;
this task authorizes no retry and proposes no production changes.

## Resources and cleanup

One new browser tree used4.978826 accounted CPU seconds and1.584359649 wall
seconds. With inherited49.667991CPU/16.920089657wall, cumulative usage is
54.646817CPU/18.504449306wall. Remaining35.353183CPU/101.495550694wall;
capture usage remains7/8. Runtime ledger reserves one invocation before launch.
The unchanged trusted supervisor observed peak tree RSS1500811264B below
1536MiB. Sampled RSS is an observed lower bound, not proof against peaks between
samples; cleanupComplete is true. Distinct browser/server/Chrome stdout/stderr
files were opened at process creation. Output2MiB, artifact24MiB/file controls
were retained. Exact remote Node24.22.1 executable/heap320MiB/environment startup
receipt records CPU90/FSIZE24MiB and unlimited DATA/AS. Git alone receives
DATA256MiB. Local offline Node24.18.1 has its own startup receipt. Canonical mount
parser receipt binds actual empty mount argv plus an enumerated comma-bearing
tree-mount control. No filesystem mount arguments were supplied to runtime.

Fresh aggregate disk admission reserved320MiB including this task128MiB with
16MiB reserve, maintaining host floor2982150144B. Admission records Codex client
RSS, session/event files and a conservative full standing WAL charge25,436,160B;
final receipt records positive WAL growth separately. Standing read-only donor
bytes are not copied/charged as new allocations. No dependency installation,
SSH runtime, denied resume, credentials change or public deployment occurred.
Initial combined policy reads exceeded the8192B terminal gate; that incident is
retained rather than represented as compliant output. Subsequent reads bounded.

Fresh small Boat bx_266epr5b had finite expiry21:29:39.589Z, earlier than the
authoritative21:32 expiry. API exec only. Explicitly delegated snapshot-stop
completed21:07:05.338Z, stoppedAt21:07:05.309Z; final info reports stopped and
snapshotVerifiedAt21:06:41.598Z. The latest reported snapshot predates evidence
archive packaging; complete packaged evidence is independently preserved locally.
No box remained running during publication; coordinator is ultimate owner.
Root/donor Git metadata, index, refs and files stayed read-only; only the required
shared append-only messageboard was written. Claude and laptop HeroesII untouched.

See canonical delta receipt and RECOVERY.md for hashes, publication and cleanup.
