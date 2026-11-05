# MDK2: earlier ordinary GC attachment

A concrete earlier seam exists: activate in
`tools/mdk2-construction-driver-integration.cjs:createTraceDriver.begin()` before
ordinary command65, the existing16-step menu observation after the reviewed
`startup-3584` capture. This checkpoint is inside main-loop maintenance **before**
the periodic GC call, with a decoder context the existing observer can sample.
This is a source-supported repair proposal, not a witnessed earlier GC trace or
proof that a newly traced original will reach Medium within its unchanged caps.

Inputs: implementation `3dafc52d07f404c42ede112e0e6c62d8725f9a20` and
[the published original report](mdk2-post-medium-timer-onward-20261105.md)
(`3c003570163ff597451548fada77bf3b6a098625`). Read-only audit evidence:
`scratch/runs/20261105-mdk2-earlier-gc-attachment-cause/` (RUN).
The three named implementation files and focused test source match3dafc52d0
byte-for-byte. RUN/audit.json records Git HEAD and30 existing input paths/hashes;
relevant-uncommitted.patch is empty. Git remains the source archive.

Installation and activation are distinct. `preloadSource()` is injected into the
page before navigation and into each owning guest Worker at the instrumentation
pause before its first script. `installBinding()` authenticates the compiled,
transferred slot0 Module and wraps `host.log_block` before native instantiation.
The wrapper remains dormant. Local `install()/start()/translate()` compose the
accepted driver and finite lifecycle; they do not activate the observer.
`compose()` calls `traceDriver.begin()` immediately before each ordinary
`WineFrozen.step(n)`. Currently begin ignores pre-Medium scenes until difficulty
or post-medium-construction; it requires the NewGame/Medium attempt ledger and,
at difficulty, a trusted Medium input receipt. Only then does Worker
`invoke('start')` attach, sample, arm `set_trace_esp(1,0,0)` and start the single
fixed deadline. First-script installation therefore does not preserve earlier
native history. Subsequent quanta checkpoint/resume the same observer; reviews
consume its wall deadline without renewing it.

All following original evidence paths are relative to
`scratch/runs/20261105-mdk2-post-medium-timer-onward/`:

| Retained observation | What it establishes |
| --- | --- |
| `browser/startup-3584-native-main.json`: thread1, PC47d9c8, ESP074ffcd8; stack indices6/14/22/39/42/45/47 contain47ca7e/47a928/47b393/47c012/47c626/451546/402176 | Supported decoder/stream/maintenance saved-return chain reaches main's maintenance continuation. Saved returns are frozen evidence, not recorded return events. |
| `browser/startup-3584.json`, matching `-owner.json`, `review-startup-3584.json`, `observation-review-startup-3584.json` | Reviewed New Game label/highlight; native startscreen/title, freeze nil, selected0, pending scheme nil; command62 phase/raw/previous/active0; empty queue/null active input/mouse0. File thread2 and main have identical frozen16ms steps/ticks/time. The approval precedes command65. |
| `browser/commands.jsonl` and `step-65/69/72.json` | Existing sequence is observe16 to3600, New Game keydown68, press16, keyup71, full-rest32 to3648, then Medium keydown76 and step77. Earlier attachment adds64 ordinary pre-difficulty steps to the trace; it requires no additional execution command. |
| `browser/native-selector-67-native-main.json`, `bounded-trace-start.json`, `console.jsonl` | At3648, PC449096 has saved44308f at ESP+16 and40218c at ESP+40. Command77 starts with zero observed boundaries and only a sample; later GC return40218c is rejected for missing history. |

Original bytes, also retained in `gc-call-static.txt`/`gc-inner-static.txt`, show
44308a calling449050 and returning44308f. RUN/main-maintenance-gc-static.txt
shows main402171 calling451540, returning402176, incrementing/testing the
periodic counter, and conditionally calling443070 at402187, returning40218c.
Thus the3584 chain places this maintenance invocation before that conditional
GC. It does not tell how many iterations intervene or reconstruct the missing
entry in the later3648 history. The3600 snapshot at45f274 is nearer, but its
192-byte stack does not reach main; absence of40218c there alone does not prove
that all enclosing tracked calls are known. Prefer the3584 chain.

The existing observer's `sample()` at47d9c8 validates original decoder bytes,
object/argument identity and its bounded context via `outputContext()`. It can
retain the current decoder suffix without inventing a decoder entry. Its GC
entry is independently delivered only at443070 with `[ESP]=40218c; return40218c
requires that frame and ESP=entryESP+4. The older special4434a0
`gc-prefix-unobserved` path does not cover449096 and is not a complete GC-entry
witness. Do not extend it as this repair.

The bounded repair belongs in `createTraceDriver` phase admission and input
correlation. Admit the existing reviewed main-menu observation using its
unchanged visual/native/rest predicates and the supported maintenance chain;
retain the hashed slot0 owner/all-Worker fences. Apply phase-appropriate ledger
checks before New Game rather than requiring the later Medium attempt flag.
Keep one start, then checkpoint/resume through ordinary New Game and Medium.
`scene()` currently lacks main-menu, and `noteInput()` currently ignores its
initial input then rejects it once tracing is consumed. Both must explicitly
correlate the existing trusted New Game Enter down/up and subsequent Medium
Enter down/up, with exact receipt-prefix/queue-suffix, review and ACK checks.
Changing only the early return in begin would fail these later guards.
Preserve correlation snapshots and unknown file suffixes; never seed GC frames.

Starting at the initial bootstrap is less targeted: startup0 has Lua uninitialized
and no established file Worker for the current capture barrier. It would also
charge all3584 startup steps and reviews to the fixed observation contract.
There is no retained boundary census proving that fits. Starting at3584 avoids
that startup expenditure. Its original capture-to-Medium-step interval was
about41seconds, but those pre-Medium steps were untraced. Per-boundary pin checks
can change host adaptive budgets and native work per frozen step. Therefore
neither64 steps nor41seconds proves counterfactual50M/360s/512record headroom.
The exact remaining prerequisite is a continuous, same-owner earlier-start
native regression, followed only if separately authorized by a fresh original
that reports cumulative boundaries/records/deadline through Medium full rest.
No restart, delayed cap accounting, deadline reset or larger allowance supplies
that evidence.

A meaningful real-Worker regression should extend the existing
`nativeOne()/workerMain()` shipped-Worker fixture in
`test/test-mdk2-construction-driver-integration.js`, separately for both accepted
module variants. Compile/hash/transfer the actual Module with the production
preload and execute through queued Worker slices. Use an explicitly synthetic,
valid minimal Lua heap, original PE instructions and an ordinary pre-GC caller
fragment. Run the actual PUSH/CALL402186/402187, collector body and RET back to
40218c uninterrupted, splitting only at queued slice/checkpoint boundaries.
Heap construction must satisfy real collector dependencies; do not stub the
collector, jump from entry to return, set registers between those boundaries,
or write observer history. Assert one delivered GC entry before one matching
return, preserved pending frame across frozen review, fixed traceEnd and
monotonic counts. Compare native registers and guest memory with an unobserved
control using the same inputs. Late-start449096 or an explicitly unobserved
prefix must still reject at40218c, preserve the first report and execute nothing
on the next queued slice. Include wrong caller/ESP, changed pins/owner/epoch,
review expiry and record/boundary-limit negatives.

Pair that native test with actual composed producer tests for reviewed
main-menu observe16 → trusted New Game press/release/full rest → freshly reviewed
difficulty → trusted Medium press/release/full rest. Verify attachment precedes
the first ordinary observation slice, all later quanta resume the same observer,
and stale reviews, foreign input, bad ACKs or unsupported pre-entry stacks stop
before execution. Synthetic producer scenes test admission; they cannot prove
original heap/scheduling or eventual gameplay. An exact retained3584 native
replay would additionally require the decoder/Lua/media state not present in
these bounded JSON snapshots; do not invent it from saved stack words.

Validation here: RUN/audit.py passes retained stack/native-rest/file-correlation,
activation-gate and published-source identity assertions, and hashes30 referenced
inputs. Narrow original disassembly was read; no Worker, Chrome, game, heavy CLI,
build or shared source/helper/test/module edit occurred. The completed terminal
report remedy is unchanged. All pins, missing-entry/native guards, frozen16ms,
full-rest/inputACK,50M/360s/512records and512/544 menu/113command caps remain.
No new original is authorized. Box ID/state/expiry: NA; coordinator owns shutdown.
Next is the bounded implementation/regression above under separate assignment.
