# TuxRacer retained cooperative mutex handoff acceptance — 2026-10-30

The exact retained candidate passes independent mutex-boundary tests. One actual
original-game execution consumed native Enter and rendered the main menu.
Practice and race were not reached; no gameplay screenshot is claimed.
This qualifies the historical retained library only, not current main.

## Exact inputs and independent tests

Parent `65d3f211cb2394fc7511e8057fe09fb1d0877618` and its five requested candidate
artifacts were independently read through exact Git paths and checked against
the retained files. The previous task's remote ref was independently verified
using the coordinator's exact trusted SSH command. The report in that parent
was also read. The actual retained library is 227988 bytes, SHA256
`92a5671ad712d9ac943559a009496000e28a7fe98f34e66c2f453ba8fc9bac3d`.
The original recovered from the exact closed archive is pinned by the tests to
`f4ba190b2dbf5e2cf2dac82398577bedfb13aa26d332fb7480b4d9d7e4ea2f78`.
Neither is silently identified as the historical a998bf36 Git library.

`acceptance.cjs` loads these actual complete libraries and exercises their real
`releaseMutex`, `waitSingle`, `checkMainYield` and `_completeWait` methods.
The fixture supplies main register accessors and a return-address reader;
ordinary wait completion itself is not stubbed. The tests cover final release,
recursive acquisition/release, wrong owner, invalid handle, worker backend,
unrelated sync records, different main wait, multiwait pointer and stack shape.
Main's EAX/EIP/ESP/yield and completion count are checked. No interpreter is run
recursively. The original control reproduces same-slice reacquisition; removing
only the candidate's handoff call rejects at owner0 versus expected owner1,
after the exact source pin, without any title prerequisite.

Inspection of the exact retained methods found the candidate confines the poll
to a successful final cooperative non-main release matching an already parked
plain main wait. The ordinary completion updates main's register context and
acquires the released mutex through `waitSingle`; it does not execute main.
No unsafe counterexample was found in this bounded scope. Prior unchanged
preload-forwarding tests are reused; broader scheduler integration is unqualified.

## One original rendering/input execution

App `tuxracer_original_061a`, Node v24.22.1, software GL and cooperative guest
threads used the unchanged 692809-byte runner SHA256
`f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d`
and 1881806-byte module SHA256
`5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb`.
Canonical `lib/app-files.validateLocalManifestSync` validation enumerated all157
actual files before execution, including a check for comma-bearing names.
The exact 512MiB-heap Node/preload startup succeeded with unlimited DATA/AS,
CPU60 seconds and generated-file limit12MiB. The independent tests used256MiB
heap. These heap values are not total-process memory limits.

The revised controller accepts a personally inspected rendered title instead
of demanding the obsolete frozen-title hash. Its optional JPEG helper then
failed because `skia-canvas` was not installed. That original error is retained.
The original PNG remained valid. During this same live execution, the worker
retrieved and inspected it: Tux Racer and PRESS ANY KEY TO START were visible.
Through supported API execution, the worker reopened the existing runner's
stdin pipe at `/proc/9796/fd/0` and sent one ordinary `keydown:13`, then
`keyup:13`, then an ordinary PNG capture. No guest state was edited.

At batches14420/14451 the trace records both renderer dequeues, focus routing
to hwnd0x10001, and both DispatchMessageA calls. The second inspected frame at
batch14468 displays Enter an event, Practice, Credits and Quit. This is actual
main-menu progression, not a claim inferred from command acknowledgements.
The original PNG hashes and JPEG derivative recipes are in `media.json`.

The runtime ended with SIGKILL at11:37:33.071Z, after60.430 seconds wall time.
It inherited CPU60 hard, and the supervisor recorded no wall/RSS/capture reason;
the exact kill source was not separately observed. Peak group RSS337858560
bytes was below the2GiB enforcement threshold. The later inspected-menu
Practice-click attempt failed opening the vanished stdin fd, before writing any
click. It was not retried. Thus precisely two native key commands were sent,
consumed and dispatched; zero Practice clicks were sent. No race/gameplay or
final post-input yield/thread snapshot is available. The retained title snapshot
contains real thread/yield/counter state; it is not relabeled as terminal state.
No second execution, resume, forced unlock, audio suppression or synthetic
callback was used. The controller dependency consumed time inside the one-run
budget, so this is a bounded partial runtime result rather than race acceptance.

## Preservation and lifecycle

Box `bx_hmzwkfyr` was the sole TTL1800 fork from freshly verified stopped source
`bx_7t9jk37y`, snapshot11:11:52.422Z. Before the first API exec, an independent
watchdog was armed with cutoff20/retrieval22/handback23/shutdown25 minutes.
Explicit task delegation authorized all-path snapshot-stop. Snapshot completed
and verified11:39:26.560Z; stopped11:39:26.871Z. Expiry was12:03:53.882Z.
The box is stopped, with no live guest and no remaining lifecycle ownership.

Raw runtime, original PNGs, canonical file enumeration, exact executed supervisor,
tests and original errors are preserved in the stopped snapshot at
`/home/user/tuxracer-render/accepted-handoff-native-input-closed-oct30.tar.xz`,
410588 bytes, SHA256
`40c33510ecba671f000fa00053a42bd6632a5a9850f99dff174f9a4c70341171`.
Retrieve only needed members under separately authorized execution. An attempted
post-stop transform/source read received machine_not_running409; no resume or
unchanged retry followed. The executed supervisor was recovered byte-exactly
from the already captured source plus the deployed main fragment instead.

Selected published JPEG media totals110349 bytes; the two original remote PNGs
total351400 bytes. Selected input/error/test log text remains below8192 bytes.
Full physical allocation counts all inherited roots, directories, Git objects,
this actual rollout and launcher, plus8MiB work and8MiB publication reserves.
Own closed command captures were losslessly archived with per-member SHA256
readback before removal. No inherited history/root omission or limit increase.
Git DATA256MiB and Python DATA128MiB are child-specific; Node inherits neither.
Generated FSIZE12MiB is distinct from512KiB capture/4MiB aggregate. The unchanged
passing wrapper receipt is reused. RAM admission is off; actual limits remain.
Shared root, main, Telegram and public deployment were untouched. The coordinator
owns append-only messageboard delivery of the supplied completion note.
