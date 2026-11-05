# MDK2 native pending context and synchronous admission

Native implementation is published through `06491f25371eea98cbc54c9217cd0a4d5e01a09d` on shared main (earlier repair commits `0265956f9`, `9ac81b952`). Exact runtime binding preserves the historical, accepted and previous-current inventories and names only the changed source dependencies, region map and rebuilt module pair. It carries forward the previously published D3D7 `f1d62b136` dependencies required by that combined build; this task made no D3D source edits. Evidence: `scratch/runs/20261105-mdk2-native-pending-context/`. Work began after D3Dqueued0432 FINAL `f1dc763eb372ad69f4f8a5226056b8b9ccf72172` and fresh independent normal-cleanup/free-lock checks.

## Native contract

`pending_context_version() == 1` exposes a separate relevant-call ledger. The old64-return diagnostic ring is never absence evidence. Arm once with a nonzero owner epoch before the first native execution or exported compilation. Instance-local globals bind epoch, thread1, validity, depth and a unique shared-memory lease. Sixteen leases saturate and are never recycled; each holds at most64 live `{actual target, returnPC, entryESP}` records. Record65 invalidates permanently without overwriting ancestors.

The initialized native invocation process epoch and root are bound at the first execution/coverage check, after initial loader/thread setup. Checks compare the instance identifiers and shared epoch/root slot, so another instance cannot replace the lifetime while leaving an apparently matching thread1. Post-execution process/thread replacement invalidates. Foreign epoch/thread/root, late/repeated arm, overflow, mismatched return/ESP, abandoned stack and aborted native execution remain invalid even after depth becomes small or the apparent context is restored.

Ordinary relative/register/memory CALL and RET/RET-imm, fused stack-run CALL/RET and compiled uop CALL/RET record the same actual fields. Returns compare destination and pre-pop ESP; nested unrelated returns below a tracked entry cannot pop it. Entry checks reject a missing relevant CALL or abandoned tracked stack. Direct raw uop execution and arbitrary/stale installation cannot supply coverage; native compilation grants a single matching PC/EIP/generation installation.

Uop metadata is emitted only when armed. Tracking does not enable the old ring, tracing or the debug scheduling guard. All276 pre-existing region rows retain their exact offsets/sizes; the new ledger is appended in unused allocated space. Disabled ordinary, stack-run and uop execution preserve tested state, output and tier choices.

The v1 relevant target set matches the observer's pending contexts: `4522d0` poll, `44f4a0` finalizer, `444f80` buffer loader, `443070` GC, `42ae70` dispatch, `46cb20` timerSet, `42b0c0` handler, `40daf0` Lua callback, `442370` timerLua, `42bbe0` NewGame, `42cc80` store, `42c990` level loader and `44fc40` demand. This is a proof about those relevant targets, not a universal x86 stack API. Decoder `47d980` may remain active at the supported seam.

## Unsupported paths

These paths invalidate sticky; none reconstructs or silently clears pending history:

| Path | Native invalidation boundary |
| --- | --- |
| Invocation/COM callbacks | `src/04-cache.wat:$invocation_enter`, including exported COM ownership entry |
| Multimedia callbacks | `src/09a-handlers.wat:$mm_callback_begin` |
| Import-driven nonlocal EIP change | `src/09b-dispatch.wat:$win32_dispatch`, when destination differs from both import entry and saved return |
| SEH/context restoration/unwind | `src/11-seh.wat:$seh_load_context`, `$seh_fault_sync`, `$rtl_unwind_begin`, `$seh_walk_from` |
| 16-bit/segmented/far transfers | `src/05-alu.wat:$th_call_rel16`; `src/05c-seg16-ops.wat:$th_ret16`, `$th_ret16_imm`, `$win16_far_transfer`, `$th_retf16`, `$th_call_near16_r`, `$th_call_near16_m`, `$x32_far`, `$x32_call_near` |
| Host context replacement after execution | `set_eip`, `set_esp`, `set_current_thread_id`, `init_thread`, `load_pe`; common `$invocation_process_begin` / `$invocation_thread_begin` also cover native lifetime entry |
| Uncovered uop diagnostic paths | Exported `uop_run`, `uop_add_range`, arbitrary/reused/stale `uop_install`; pre-arm exported compilation prevents subsequent arm |
| Interrupted native run | Active execution bit survives trap/abort; a boundary status query rejects it |

A workload encountering these paths cannot provide this absence proof. Their complete callback/unwind semantics and general native equivalence remain unqualified. The authenticated owning instance/module/endpoint binding is required; this API does not defend against a privileged host rewriting arbitrary interpreter memory.

## Live admission

The authenticated instantiate wrapper arms before exposing the instance to Worker/loader code. After each successfully completed native `run()`, the same wrapper synchronously checks actual `PC=47d9c8`, owner/thread/image and unchanged caller positions `6/14/22/39/42/45/47 = 47ca7e/47a928/47b393/47c012/47c626/451546/402176`. Only version1, valid current epoch and depth0 can attach before the wrapper returns or forwards another run. Missing old exports, late arm, overflow, pending frames, wrong ownership and gaps reject. No retained startup row supplies history.

The reviewed driver adopts that same continuous observer without resetting frames or deadline. Native coverage remains checked during observation. Genuine `443070` entry and `40218c` return at entryESP+4 remain mandatory. The50M boundary /360s whole window /512 record caps are unchanged. No past GC/CALL record is invented.

## Validation

All final checks pass in the owned run directory:

- Native both-module contract/live fixtures:88/88, `native-lifetime-final.log`.
- Full integration regression, including current Workers and continuous real GC:191/191, `integration-lifetime-final.log`.
- Immutable resolver/current dependency, historical inventory and HTTP tests:43/43, `resolver-history-final.log`.
- Uop compiler regressions:PASS, `uop-lifetime-final.log`.
- Both-module observer full-memory/GPR/lazy-flags/commands/trap parity:PASS, `observer-lifetime-final.log`.
- Required locked full build:PASS, `build-final.log`; byte identity rechecked against the exact tested pair.

| Existing build path | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` |2154315| `8605f6c4800e0286e9d863c599618d7d97cde67936f4b4e6c1528897576aa611` |
| `build/wine-assembly.compat.wasm` |2156930| `ac64ace417f0af22b904213bf2f739b97a2132f7f631c261eccd855fae18c970` |

The88 both-module native fixtures exercise actual guest CALL/RET on ordinary, stack-run and uop tiers; exact frame fields; RET-imm;65-frame overflow followed by real unwinding; mismatched PC/ESP; late/foreign/repeated arm; actual callback/nonlocal gaps; aborted execution; arbitrary/stale uop programs; lease exhaustion; and real foreign process/root replacement through a second instance sharing memory. Uop entry counters plus ordinary-handler histograms establish actual compiled CALL and RET execution while permitting natural fallback at slice budgets.

Live fixtures execute original decoder instructions to actual `47d9c8` with explicit fixture caller/heap inputs, attach synchronously, and execute the unchanged real GC body through its actual CALL/RET. All seven wrong caller guards, pending contexts and coverage loss reject. Root traversal actually marks the nil Level global and the real sweep resets it. These are synthetic native fixtures, not a new observed original-game checkpoint or gameplay qualification.

Legacy JS-observer/control fixtures arm native tracking equally before loader exposure and compare complete memory including ledger storage, GPRs, lazy flags, commands and traps. Disabled native parity is tested separately against existing retained historical module controls on all three tiers. Previous-current manifest bytes are independently reconstructed from the pre-task published resolver and compared exactly. Current canonical/compat modules, every named source amendment, corruption/wrong-pair/source negatives and439 full HTTP bodies are verified without Chrome.

Initial build/census, fixture and stale-binding failures are preserved in run logs. The first pre-binding integration run retained open handles after failures and was stopped with recorded SIGTERM; later bounded runs use the explicit Node test-force-exit option and normal exit statuses. No failure log or historical archive was removed.

Recovery uses exact Git SHA plus relevant binary diffs/new-file patches, existing input paths and SHA-256, and `flock /tmp/wine-build.lock bash tools/build.sh`. No source snapshot, module/media copy, original-game retry, browser, box, Codex subworker or public deployment was used. Box ID/state/expiry: NA; coordinator retains shutdown ownership.
