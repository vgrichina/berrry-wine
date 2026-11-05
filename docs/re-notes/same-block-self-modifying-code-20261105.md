# Same-block self-modifying code — 2026-11-05

Task: CPU-SAME-BLOCK-SELF-MODIFYING-CODE-20261105. Requested input:
`cf88c61398426806580cef776ecc50029dc8b59d` plus shared main. Reproduction baseline:
`681702a73dd3abd04a17afb34a6dee421e746203`.
Evidence: `scratch/runs/20261105-cpu-same-block-smc/`. Git is the source archive;
the run holds exact SHAs, relevant binary diffs/new-file patches, small harnesses,
unique logs and tested modules, without source/media archives.

## Reproduction and cause

The generated PE initializes the production loader and address space; no guest
application entry executes. A generated x86 MOV stores `0x22222222` into a later
`MOV EAX,imm32` in its own decoded block. Baseline guest bytes change, but EAX
finishes at the stale `0x11111111`. REP MOVS and STOS reproduce the same failure.
`baseline-{mov,movs,stos}.log` record these failures through production decoding,
store helpers, dispatch and `run`, with no substituted handlers/test exports.
Baseline module: 2,168,690 bytes, SHA-256
`184018de88a74cbb20a2379af03ec5140bbd09bd1d4cda13a152234720f01e09`.

Stores already invalidate before writing. `$page_retire_at` replaces the decoded
entry header and clears its guest-byte ownership. That prevents another entry
through the header; it cannot move an executing `$ip` that already passed it.
The copied block-executor descriptor has the same continuation problem.

## Repair

The decoder emits H501 at the next complete instruction boundary after a
potentially writing handler. Proven read-only handlers avoid the checkpoint;
unknown handlers conservatively receive one. EA producer/consumer pairs and
nonfaulting REP instructions remain whole. Existing blocks retain their shape.

Invalidation records whether it retired any decoded code, including whole-page
drops. A checkpoint checks ownership of its successor byte, including internal
COVER entries. If that byte is no longer decoded, it transfers through the
existing retired-block continuation and decodes fresh guest bytes at that PC.
Other-block writes leave a valid current continuation running. The existing
continuation refunds the artificial block entry, preserving forward progress.

All three block executors recognize the checkpoint, publish all architectural
registers and EA state on exit, and settle their step/block counters. The
checkpoint carries its original native prefix cost across splitting and
optimization. Register-move elimination preserves values observable at an SMC
exit; flag liveness treats that exit as a reader of all flags.

Writing scalar fusions also need original instruction boundaries inside their
handlers. Unary/ALU, contiguous store spans and PUSH runs execute only their first
original instruction when their destinations can touch code, then use the same
checkpoint to resume from its successor. Ordinary data destinations stay fused.
PUSH/CALL, memory-ALU/Jcc and DEC/JNZ terminators transfer directly to the relevant
original successor when necessary. Static absolute-store and pointer-variable
fusions decline code destinations. The optional byte COPY_RUN retains a relative
copy of its checkpointed original stream and uses it before code-page writes;
ordinary data copies still fold. Census changes review existing control producers;
no callback/invocation identity mechanism was added.

REP restart bodies from `b786b78da` / `eadf70fd5` are unchanged. Faulting REP still
publishes only completed ECX/ESI/EDI progress and resumes at its REP prefix. A
successful REP completes before the next-instruction checkpoint.

## Validation

The new regression passes 268 cases against both shipping tail-call and compat
modules. Coverage includes scalar MOV widths 1/2/4, RMW ADD, fused/unfused SIB,
REP MOVS/STOS widths 1/2/4 and both DF directions, immediate/opcode/instruction-
length rewrites, same-block/explicit-other-block/non-overlap controls, cold and
repeated cached executions, run grants 1/1000, fault modes 0/3/5, both block
executor entry styles and genuinely entered installed uop programs. Wide 608-byte
REP writes exercise page-drop invalidation. State/flag checks expose lost
pre-store register values and flag elimination. Fusion cases rewrite a later
store destination, a CMP immediate, a short/near Jcc, a later PUSH/CALL, and the
next cursor bump inside a genuinely entered byte-copy fold. Baseline fails the
five added scalar fusion reproducers as well as MOV/MOVS/STOS.

Commands and final logs:

- `flock /tmp/wine-build.lock bash tools/build.sh`: `build-07.log`, PASS.
- `node test/test-same-block-self-modifying-code.js --wasm=build/wine-assembly.wasm`
  and `--wasm=build/wine-assembly.compat.wasm`: final production/compat matrix logs.
- `node test/test-rep-movs-fault-restart.js`: `rep-restart-03.log`, 182 restart cases
  plus zero-count and code-write controls, PASS.
- `test-block-exec`: 368 checks; `test-block-chain`: 62 checks; `test-uop-compiler`:
  both clocks, 654 compiled/154 declined, PASS.
- Fused-entry overlap, dispatch macro, store32 base span, reserved-page crossing,
  reserved-page sync and native fault latch: `final-test-*.log`, all PASS.

Two existing fixtures failed when run more broadly: `test-store32-span-fixed-work`
counts retired H348 instead of the production packed H468 (0 versus 4112), and
`test-perf-block-accounting` fails a mocked JS-only ThreadManager accounting
assertion (0 versus 3). The former fails identically against the recorded baseline;
the latter does not execute CPU code, and its implementation is unchanged. Logs
are retained; neither unrelated implementation was edited. Two baseline native
PUSH coverage assertions in `test-block-exec` also failed because its default stack
fusion concealed the native opcode. Those fixtures now explicitly disable stack
fusion for the native PUSH cases. The region SMC assertion now proves a real
multi-block region exits at the writing instruction, replacing an expectation
that it continues through an invalidated descriptor's stale tail.

Exact final module identities and publication SHA are in `result.json` and
`module-identities.json`. Validation is generated x86 and the named regression
suites; no browser, game/media analysis, box, performance qualification or general
cross-thread code-coherence claim is included. Arbitrary self-rewriting bodies of
other specialized loop super-ops are outside this regression matrix.
