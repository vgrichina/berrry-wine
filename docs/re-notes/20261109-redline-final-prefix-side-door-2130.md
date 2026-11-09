# Redline: final durable prefix sealed and tested natively

**The exact final every-CONT adapter failed native startup at the unchanged port-publication boundary. Gameplay remains unverified.** One fixture ran; the conditional original side-door route did not start. Evidence is retained in `scratch/runs/20261109-redline-final-prefix-side-door-2130/`.

No production code or shared provider was changed. The tested adapter is exactly `eb97ea8a4353fe5008f22c6c2ced5363caaa81dd:tools/redline-bounded-custody.py`, SHA-256 `c929ff48d2d404287ebc18e4da3dddb1cddd9abc7c729c93429a140aae47239d`. Its central durability barrier remains outside the ESRCH catch and covers both direct EXIT paths. Bounded diagnostics, sticky errors and startup deadlines were preserved. Preparation used main `c367007f7cba9c6aabf142b28eea275e57683a68`; exact Git identities and small patches retain source recovery without source/media archives.

## Preallocation checks

The final native manifest was sealed **before allocation**, SHA-256 `cf81517cb53796bb36edbdb29ceaeb032af31e8486aeeef60ee934368d91dec5`. The separate offline generation was `64fef9e12b34d28210c4b0072576f462b2c43ec66048334f43b6390f7bb94b27`. Independent rereads checked both phase-local manifests, their copies/seals, all 904 providers per phase, generated caller/bridge paths and Git-recovered GL bytes. The native manifest was never replaced after allocation. A second remote reader verified all 904 staged providers and the exact final adapter immediately before launch.

The three historical GL files came from exact authenticated `c6094c4ed^` Git bytes. Their existing pins were retained; shared checkout files were untouched. Offline read seams and native retrieval provenance are explicit in the evidence.

Passed checks:

- Four startup-journal tests: actual full durable prefix before CONT, both EXIT coverage and actual first-observed unlinked EXIT, bounded/sticky/final-sync controls, and slow storage. This run measured 117 versus 65 fsync calls, 2.116 versus 1.158 seconds, with 13/13 tasks reaped in each control.
- Six bounded-custody controls, including actual late fork/exec after diagnostic exhaustion and cancellation.
- The actual generated remote parent, staged production controller and owning caller with DRIVER_PREFLIGHT: expected missing ACK, seven actual reaps, parent wait and separate stdout/stderr EOF. No browser ran in this control.
- Current-startup and startup-boundary controls, including unchanged 100 × 100 ms polling, terminal behavior, missing/changed pins, and incomplete inherited streams.
- The small conditional-original caller's actual production composition with DRIVER_PREFLIGHT, before any server or browser launch.
- `flock /tmp/wine-build.lock bash tools/build.sh`, exit 0.

Initial local harness failures are retained: one startup test omitted the exact-pinned preload, and the first conditional-original input generator produced a syntax error. Both were corrected and passed offline before allocation. The deliberate final-sync negative control retains its ResourceWarning. A later local retrieval reader initially expected an uncompressed drain, while the retained collector had compressed it; the stop gate refused before any stop API call. The corrected reader verified the retained bytes before the sole stop request. None of these controls was a native retry.

## New native failure

The sole changed fixture recorded its first browser failure at **2026-11-09T21:36:33.899Z**:

`DevToolsActivePort unpublished after 100x100ms poll`

The actual readiness consumer recorded 100 polls over **10,038 ms**, last read `ENOENT`, Chrome PID 7267, with no observed browser exit or wait error at that boundary. The bounded startup diagnostic retained 306 rows with zero drops. The controller then observed the terminal browser record. No native input, capture, retry, quit request or original-route launch followed it. No image was returned for review.

Existing shutdown evidence subsequently observed a port publication during terminal cleanup. It does not admit a late continuation or establish startup cause. Shutdown records Chrome SIGKILL and **browser streamEOF=false**; both browser gzip streams are incomplete and retained as invalid EOF evidence. The controller's independent process watchdog joined with code 1, a retained cleanup error. These are distinct from the task's UUID box watchdog, which joined successfully.

The actual fixture parent exited 1 with separate stdout/stderr EOF. The custody drain is complete: **97 owned, 97 reaped**, no remaining identities, no unreaped tasks and no custody failure. Independent filesystem/socket checks found the profile removed, no profile processes or writer locks, and both observed ports closed. The first failure is discriminating evidence for this exact final generation; no cause is assigned to this or an older startup failure.

## Retrieval and box closure

Unique evidence was downloaded and independently reread before the normal stop: **73 references, 71 distinct hashes, 353,007 stored bytes**. SHA/size checks passed; gzip CRC checks explicitly retain the two incomplete browser streams. Parent/controller EOF is not substituted for browser EOF. `independent-retrieval-verified.json`, `evidence-summary.json` and `final-exact-state.json` retain the details.

- Box: **bx_94j9nfsm**.
- Immutable UUID: **37683482-ed2b-444f-ad5e-eef74cbfe01e**.
- Initial expiry: **2026-11-09T21:59:07.320Z**.
- Prearmed independently observed watchdog deadline: **2026-11-09T21:59:07.543780Z**.
- Exactly one delegated normal stop: **stop_d7a3a48207acf3f3**, completed **forced:false**, **2026-11-09T21:38:25.092Z**.
- Independent final API state: **ARCHIVED**, `archiveAfter=null`; final `expiresAt` was not returned.
- Actual UUID watchdog wait: **0**, separate stdout/stderr EOF, immutable configuration hash unchanged.

No second box, stop, resume or delete was issued. Free `/home` remained above 1.5 GB. Next work, if separately assigned, is an investigation of this retained final-generation startup failure; the original side-door route remains conditional on a passing fixture. This single task is stopped with no live owned box.
