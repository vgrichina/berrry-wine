# MDK2 native pending context and synchronous admission

Implemented on shared main after D3Dqueued0432 FINAL `f1dc763eb372ad69f4f8a5226056b8b9ccf72172` and fresh independent normal-cleanup/free-lock checks. Evidence: `scratch/runs/20261105-mdk2-native-pending-context/`. No original game, browser, box, worker launch, deployment, source archive or module/media copy.

## Native contract

`pending_context_version() == 1` exposes a separate bounded relevant-call ledger; the diagnostic 64-return ring is never absence evidence. Arm exactly once with a nonzero owner epoch before the first native run or exported compilation. Instance-local globals bind the epoch, owning thread1, validity, depth and a unique saturating shared-memory lease. Sixteen leases are never recycled or overwritten. Each stores at most64 live `{actual target, returnPC, entryESP}` records; record65 invalidates permanently. Returns compare the actual destination and pre-pop ESP; a matching return alone removes its frame. Nested unrelated returns below that entry cannot pop it. Entry checks reject missing relevant CALL coverage and abandoned tracked stacks.

Ordinary relative/register/memory CALL, RET/RET-imm, fused stack-run CALL/RET and actual compiled uop CALL/RET carry the same observations. Uop metadata is emitted only when armed. Tracking never enables the old ring, tracing or the debug scheduling guard. Disabled execution retains its ordinary tier choices. An aborted native run leaves an active bit that makes subsequent absence queries invalid.

The v1 relevant target set matches the observer's pending contexts: `4522d0` poll, `44f4a0` finalizer, `444f80` buffer loader, `443070` GC, `42ae70` dispatch, `46cb20` timerSet, `42b0c0` handler, `40daf0` Lua callback, `442370` timerLua, `42bbe0` NewGame, `42cc80` store, `42c990` level loader and `44fc40` demand. This is a relevant-context proof, not a complete x86 call-stack API; decoder `47d980` is intentionally allowed to remain active at the supported seam.

Unsupported paths **invalidate sticky**, rather than reconstructing history: invocation/COM and multimedia callbacks, SEH context restoration/fault delivery/walk and RtlUnwind, 16-bit/segmented/far transfers, host EIP/ESP/thread replacement after execution, direct exported raw uop execution, arbitrary range installation, and arbitrary/stale uop installation. Exported installation immediately following this instance's native compilation is checked against its PC, EIP and generation and consumes that permission. Later small depth or restored thread cannot repair invalidity. A future workload using any unsupported path needs an explicit native model before it can supply absence evidence. No general callback/unwind completeness is claimed.

## Live admission

The authenticated instance is armed before the instantiate wrapper exposes it to Worker/loader code. At each successfully completed native `run()` boundary, the same wrapper synchronously checks actual `PC=47d9c8`, owner/thread/image and unchanged caller positions `6/14/22/39/42/45/47 = 47ca7e/47a928/47b393/47c012/47c626/451546/402176`. Only version1, valid current epoch, depth0 can attach the observer before the wrapper returns. Missing old exports, late arm, overflow, wrong owner, pending frames or any gap reject. No retained startup row supplies history.

The later reviewed driver adopts that same observer without resetting its frames or deadline. Native coverage remains checked during observation. Genuine continuous `443070` entry and `40218c` return at entryESP+4 remain mandatory. The50M boundary /360s whole window /512 record caps remain unchanged; no past GC or CALL record is invented.

## Validation and limits

Both-module native fixtures use actual guest instructions on ordinary, stack-run and uop tiers. They cover exact frame fields and returns, RET-imm,65-frame overflow followed by real unwinding, mismatched PC/ESP, late/foreign/rearm, callback/nonlocal gaps, abandoned execution, raw/stale uop programs, lease exhaustion and disabled architectural/tier/output parity against retained historical controls. Live fixtures execute the original decoder to actual `47d9c8`, preserve all seven guards, attach synchronously, and execute the unchanged real GC body with explicit fixture heap data through its actual CALL/RET. Each wrong guard, pending context and coverage loss rejects. These are synthetic native fixtures, not an observed new original-game checkpoint or gameplay qualification.

The initial full integration regression found stale current-module binding failures; its historical fixtures remain preserved. Exact source/module amendments and final regression results are recorded in this note's publication update and the run logs. The existing input paths and SHA-256 are recorded without copying their bytes. Git commit plus relevant binary diff/new-file patches are the source recovery recipe; generated binaries are rebuilt with `flock /tmp/wine-build.lock bash tools/build.sh`.

Runtime box ID/state/expiry: NA. No boxes allocated; coordinator retains shutdown ownership.
