# MDK2 post-comic continuation, 2026-11-04

**A small original-driver continuation is runnable and tested offline. Original post-comic gameplay remains unobserved.** The fix adds finite, input-free observation after one acknowledged, natively sampled comic cancel. It preserves `skipAttempted`; it never sends another Escape, calls Lua, forces a scene, or treats resource completion as playable readiness. No production runtime defect was established or production source changed.

Evidence and executable inputs: `scratch/runs/20261104-mdk2-post-comic-continuation/` (RUN). Git identity, relevant binary diff, owned new-file patches, dependency hashes and test logs are retained there. Git is the source archive; no source/media/module archive or copy was made. The small original-instruction test reads 438 bytes directly from the existing PE and deletes its temporary native fixture after execution.

The predecessor [long-loading run](mdk2-long-native-loading-20261104.md), commit `ec59bc929249c8a79eb39160c3cc2685c837867e`, completed resource699228 at step3984, reached original comic panels at13776, and sent one Escape down16/release32 to13824. Its last request was6146816/type6/size50739/prepared1/completion0. That run did not observe native COM_PAUSE consumption. Its historical JSON and ledger are unchanged; a legacy `skipAttempted:true` alone cannot authorize the new action. The stopped snapshot is reference only, not a resumable authorization.

## Original source and instruction boundary

The original PE is `test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`, SHA-256 `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`. The scripts archive at the same installation's `data/scripts.zip` has SHA-256 `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`. `inspect-original.cjs` decodes selected scripts in memory and verifies the predecessor's decoded identities, retaining selected lines rather than a script tree.

`menuinit.lua:51–57` dispatches COM_PAUSE through `comfuncs.game`, provided pause is enabled, death handling does not take precedence, and `Save.movietocancel` exists outside a minigame. `script.lua:160–169` sets that target for movies with Done. `StopScript` clears it at203 and invokes Done at215; natural ScriptUpdate also reaches StopScript. `level1.lua:4500–4508` registers IntroMovieADone, which starts PlayIntroMovie. Those source facts do not prove a live callback, absence of death handling, or successful transition.

**CON_BUTTON_FALL's numeric value4 dispatches on the positive native edge in this PE.** The name must not be used to infer a release-only callback. Original `0x46cfc0` tests mask5 and calls `0x42ae70`; release `0x46d0b2` tests mask2. The earlier comic-controls note's release-edge wording is too strong. A balanced release remains mandatory, and the target may already change during the down16 interval.

`test-original-consumer.cjs` executes the exact unmodified438-byte consumer at `0x46cf30` in a tiny static Linux i386 ELF. Input scalar (`0x454cd0`), clock (`0x4516f0`) and callback sink (`0x42ae70`) are explicit fixtures. It verifies one flag4 positive-edge callback, zero additional hold/release callbacks, native rest, and one flag2 release callback. This tests original instruction dispatch into a sink; **no original Lua callback, PE runtime, WASM or game executes**. The fixture requires x86-64 Linux with IA32 support and `as`/`ld`. Its instruction SHA is `bf6a1b6f903c5e6ed441a5933ac08a7268cc4f064e456eb0688de10f3ca94438`.

The original resource pump/worker/request/SleepEx byte/import checks also pass. The loader interpretation remains [the resource cause note](mdk2-resource-loader-cause-20261104.md): a stable pointer with completion0 permits work in flight, while a frozen inspection without credits permits no execution progress.

## Controller change and limits

`native-opening.cjs` preserves outer selection-v2 and scene-transition-v1 identities and adds `scene.movieCancel` version `mdk2-movie-cancel-observation-v1`. It reads COM_PAUSE's actual index/record, applied game scheme, Save's cancel target/disable/minigame fields, movie-player state, game pause handler and Level.IntroMovieADone identities. Target values remain opaque and are never dereferenced. The serialized observer is tested over original-layout synthetic Lua memory, with a whole-memory hash proving no writes.

`comic-control.cjs skip-comic` retains the single balanced input and reserves its full allowance before submission. Its eight acknowledged commands are:

```text
state-before, tick20, Escape-down, step16, state-press,
Escape-up, step32, fresh-shot
```

The added press sample must show positive native raw/previous COM_PAUSE values. The final shot must show raw/previous/active zero, an empty native input list, balanced trusted browser history and clean renderer input. Native Lua/Level identity, game scheme, original callback values and pause record must remain consistent. The original target must exist before input; target changes during the press are accepted. A witness is persisted only after the complete envelope, exact steps, ACKs and fresh shot pass. Missing press/release consumption ends with the first-error latch; no compensation input is offered.

The new `observe-post-cancel` accepts a new personal review of **still-visible original opening comic panels**. It rechecks the original witness artifacts, session, command envelope, successful receipts,16/32 execution records, final PNG hash, native samples and unchanged input history. It then issues **state → step64 → fresh-shot**, with no tick or input. Each result needs another personal review. Stable request/queue is allowed; completion and byte counters are reported without implying readiness. Unknown/later movie/tutorial pixels do not qualify. Native scene drift at the final shot is preserved and conservatively latches a controller boundary, not a claim of game failure.

Post-cancel observation is capped at **16 quanta /1024 slices**, each invocation at60 seconds. The original shared540-second start,12336 comic/loading/cancel slices,247 commands, recovery reserve and per-command64 cap remain. Construction counters remain separate and their original start is inherited; the clock never restarts. With the predecessor's19 loading quanta, the full route uses **10800 comic-ledger slices /246 commands**, plus its separately accounted construction688. Other histories can reach an aggregate cap earlier. No allowance promises completion. Retry count5, missing diagnostics, bad native identity, pending/held input, changed inspected state, missing/bad ACK, partial/timed-out execution, stale approval, exhausted cap or deadline stops and latches. Interrupted input can leave a held key; recovery belongs to the browser owner rather than another control attempt.

The witness reports `nativePressThenRelease:true`, whether the target changed, and always `callbackExecutionProved:false`. A changed target is a source-defined effect, not proof that Escape rather than natural completion caused it. A target still present does not prevent finite observation after measured native input consumption. Neither case claims IntroMovieADone execution.

## Reproduction and remaining live boundary

From the repository root, all commands below are offline:

```sh
RUN=scratch/runs/20261104-mdk2-post-comic-continuation
node "$RUN/inspect-original.cjs"
node --test "$RUN/test-original-loader.cjs" "$RUN/test-original-edges.cjs" "$RUN/test-original-consumer.cjs"
node --test "$RUN/test-post-comic.cjs"
# A fresh destination only; this prepares helpers, never a runtime release.
node "$RUN/prepare-inputs.cjs" "$RUN/another-fresh-inputs"
```

`RUN/final-inputs/` is the tested, self-contained small input set; `final-input-hashes.json` seals it. Preparation inherits the retained28-file input recipe, replaces the changed observer/controller/driver/fixture, adds movie-boundary and the actual-driver tests, and replaces the historical seven-command comic suite. Selection/readiness/opening/barrier helpers remain inherited. The current driver command implementation is unchanged; it serializes the changed read-only observer through its existing path. No owner release is supplied. The historical original runtime pins, canonical `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`, source `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, registered isolated selector and Puppeteer24.31.0 prerequisites still apply. Today's successful build is not substituted for that historical module.

Validation: **50 focused tests**, **134 tests against final staged inputs**, **seven original PE/observer edge tests**, **one native original-consumer callback-sink test**, selected original-script checks, and `flock /tmp/wine-build.lock bash tools/build.sh` all passed. Controller tests execute the actual driver command function, actual Spool and InspectionGuard against modeled page execution and the serialized original-layout observer. They cover progress and unchanged50739-byte type6 requests, one input pair, fresh review per quantum, shared accounting, last/next cap, deadline, missing witnesses, repeated skip, wrong source/module/selector, native drift and bounded failures. Their synthetic resource completion is not game execution.

For a future separately assigned original run, reach a fresh reviewed comic through the unchanged native route. Approve the explicit comic review with `INPUTS/inspection-guard.cjs BROWSER REVIEW`, then run `INPUTS/comic-control.cjs skip-comic BROWSER REVIEW` once. After personally reviewing its new still-comic capture and approving a new review, run `INPUTS/comic-control.cjs observe-post-cancel BROWSER NEW_REVIEW`. Repeat only that input-free action with fresh reviews while its guards and caps permit. Each review requires `screen:opening-comic`, `originalScene:level1-intro-a-comic`, panels true, loading/tutorial/unsupported false, selection none, transitioning false, matching capture/SHA/steps and named personal inspector. Stop at a different scene or first boundary. Never reuse the old13824 ledger as a native witness.

**First missing live evidence:** one measured original COM_PAUSE consumption followed by the fate of request6146816 and the resulting personally inspected scene. Lounge intro, its Done, later checkpoint12/1, tutorial and player control all remain unproved. No browser, box access, heavy runtime, guest call/write, lifecycle action, worker, successor, other game or deployment occurred. `bx_n78z26e7` is coordinator-reported **STOPPED, verified snapshot07:29:37Z**, reference only; historical expiry08:05:29.706Z was not queried here. No runtime custody was assumed; lifecycle remains coordinator-owned.
