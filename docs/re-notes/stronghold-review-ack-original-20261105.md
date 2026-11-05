# Stronghold review then ACK, 2026-11-05

This assignment follows published `9ac356cab12a5417487fa86a434c45cac4d3e7ff`
and `3d7ab1734d73e35c27dede0a6d01ab2df733a23e`.
Evidence: `scratch/runs/20261105-stronghold-review-ack-original/`.

The previous original stopped because the operator tried `route-review-choose`
while `install-route` command 8 still awaited its capture-bound review. The
production guard correctly refused and wrote no command 9. The operator plan
now explicitly selects personal view/review, then waits for successful ACK,
then permits consideration of the next existing command. A rejected ACK is
terminal. The existing mailbox and production review guards are unchanged.
The local contract tests reproduce command 8 through pending review, review
receipt without ACK, successful ACK and rejected ACK. No fixture sends controls.

The new assignment requires both final code/build releases before runtime
admission, plus the prior exact MDK heavy/file release and ancestor-held
exclusive `/tmp/wine-local-runtime.lock`. Chrome cutoff is 2026-11-05T01:20Z,
cleanup 01:23Z, with unchanged 720s runtime, 60s bootstrap, 40s command/review,
and 180s cleanup reserve. Box ID/state/expiry: NA; coordinator owns shutdown.

The historical 2,429-row manifest remains authenticated and preserved. Only
named final corrective source/module and passive helper amendments are allowed;
all 1,856 media rows remain unchanged. Final legacy publication is
`17e09475ecaeaa47de76684df0a0518124a6e387`, superseding the initial packing
error in `8808ec112`. The run's binding ledger records exact historical and
prior-binding old/new SHA-256, published provenance and reasons. Shared modules
are used at existing paths and are never restored or copied.

The remedy was published as `54add0d4a307cd7eb3645a17c4bcf75ef62e34cb`
before the original. Both final dependency releases and exact prior normal
cleanup were independently verified before acquiring the exclusive runtime lock.

Git is the source archive: exact commit SHA, relevant binary diff and new-file
patches are retained. Existing game/media/module inputs are referenced by path
and SHA-256. No snapshots, tars, module copies, npm, subworkers, boats, public
deployment or other games are used.

The explicitly admitted final identities are:

| Path | Prior `9ac356cab` SHA-256 | Final corrective SHA-256 |
| --- | --- | --- |
| `src/09ab-handlers-d3dim-core.wat` | `5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07` | `dbcf489a787b4f399eadc926e13336976d6eb0cc30ffed5c8c360af5b496a75a` |
| `build/wine-assembly.wasm` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` | `e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412` |
| `build/wine-assembly.compat.wasm` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` | `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8` |

All three come from the named final corrective publication: anchored subpixel
RGB placement with the original literal SIMD packing policy. The unchanged
passive observer remains from `a6d78555b`; the local helper is the published
`9ac356cab` implementation plus this assignment's review/ACK plan, final-release
checks and finite authorization. Its exact old/new hashes are in the ledger.
The MDK2 validation tools do not occur in the preserved Stronghold manifest or
its sealed retained-helper closure; their release serializes the shared build.
No unrelated JS file is silently admitted or rehashed.

Both final dependencies are now released: legacy `17e09475e` and MDK2
`2c8c7cc1fd353af2df2f7c1b3d3240bb40c69c1b`. This worker's subsequent required
locked full build passes and reproduces both literal final module hashes.
The local, route-recognition and passive-observer suites pass; the full
composed local entry checks all 2,429 filesystem rows and actual HTTP responses
with plain Puppeteer and independent public/native spawn prohibitions, zero
Chrome. Nine public-entry stale-manifest, prior-pair and changed-byte negatives
reject before launch. The final-input local test uses the actual current
release rows and an explicit private fixture flock. This is offline evidence,
not original presentation or gameplay evidence.


The one original ran from 00:48:34Z to 00:53:10Z. Every one of its 25 fresh
checkpoint PNGs was personally viewed before further control, with hashes in
`personal-capture-inspections.jsonl`. Command 8's existing capture-bound review
was submitted at 00:51:35.216Z; its successful ACK arrived at 00:51:35.343Z;
command 9 was issued at 00:51:39.256Z. Thus the previously failing operator
sequence is corrected in an actual original, without weakening review guards.
ChooseType and Custom Game hover reviews, and the balanced ordinary gesture,
also completed their existing ACK paths.

The first surfaced command failure was command 13, `route-arrival`, at step
10,304: `first unexpected natural scene: unknown` (00:53:10.383Z). The fresh
`browser/route-native-boundary-8.png` was personally viewed: sword/shield
background, “Not available in the demo”, and red/yellow/blue numbered circles.
This partial setup frame grants no readiness. There was no command 14, preset,
Start, world control or second original attempt.

The same owning-worker history does contain actual native progress. In
`browser/preset-attachment-87.json`, the original callback argument 2 requests
scene 20, setup and callback return, then one complete draw proceeds through
entry `0x4292c0`, clock/update/late-clock/timestamp/epilogue, and actual saved
caller return at decimal PC 5149135. Sequence 38–47 spans native boundaries
32,262,225–35,434,368. Entry/late times are 162315/164315; the stored timestamp
becomes 164315 and refresh changes 1→0. Fade remains 32, direction remains -3;
this is not proof of a completed fade. A second draw is pending at stop.
All 85 retained native reports preserve their earlier record prefixes. The
final report has 36,763,512 boundaries, below the unchanged 50M/360s limits,
and no native observer fault. It contains zero surface events: source/target
and HRESULT, operation-to-upload and renderer completion remain unproved.

Offline analysis found an earlier passive host-observer failure that the
controller did not surface as a command rejection. Its first report,
`browser/host-presentation-0.json`, is `unsupported-or-unobservable`, fault
`stale/unknown host capture`, frame 0, sequence 0, with no records. The first
pre-gesture capture came before any observed normal renderer frame. The
production factory correctly rejected that capture and uninstalled its hooks;
the controller persisted the terminal report and unknown link without throwing.
Consequently later gesture/arrival ACKs did not establish host presentation.
This earlier fault was discovered only after the original had stopped; the run
must not be described as having stopped immediately upon that passive fault.

`host-first-capture-replay.cjs` reproduces the exact frame-zero fault through
the real controller and serialized factory in a plain page VM, with no Chrome
or game. A separate ordinary upload/repaint before capture passes the capture
bracket while granting no readiness. Both cases pass. Existing positive tests
had produced a frame before first capture; the composed entry mock stopped at
launch. This exposes a lifecycle/fault-propagation gap, not permission to relax
the frame or review guards. No production amendment was made after the original.
The next work is an offline repair of that lifecycle and terminal fault
propagation, plus examination of the exact unknown partial setup frame. Any
future original needs separate authorization.

`actual-evidence-summary.json` and `audit.log` verify 1,058 actually served
responses against exact pins, 161 contiguous 64-step transport ACKs, all 25
personal inspections, the command-8 review/ACK ordering, and no command 14.
The actual compiled and slot-0-delivered canonical module is the final
`e620f3ad…` module above. Final input is empty, active input null, mouse mask 0;
the frozen 16ms cadence and all continuous guards remain intact. No timer
drive, forced render, cap raise, reset or queued-input completion claim occurred.

Normal `Browser.close` followed the surfaced command failure. Chrome PID
1570178/startticks 188692357 exited with code 0, signal null at
00:53:10.640Z. Cleanup verification at 00:53:27.522Z proves that exact Chrome,
Node 1570155/startticks 188692178 and flock 1570154/startticks 188692178 are
absent; HTTP 34441 and DevTools 39957 refuse connections; the exact profile
has no users and is absent; the external runtime flock is available. Local
heavy ownership was released at 00:53:36Z. Box ID/state/expiry are NA; shutdown
ownership remains with the coordinator.

Final validation: focused local/release-contract (42 negatives), route and
observer suites; full actual composed entry 2,429 filesystem plus 2,429 HTTP
checks with independent public/native spawn prohibitions and zero Chrome;
nine public-entry negatives; full locked build reproducing the released module
pair; two host lifecycle replay cases; and the retained actual-evidence audit.
These pass with final inputs. Ordinary gameplay and completed presentation
remain unproved; this assignment ends at the concrete failures above.
