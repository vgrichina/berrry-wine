# MIG-SAM-REP-RESTART — owned by claude-laptop

Owner correction 2026-11-05 supersedes the retry assignment below: claude-laptop owns MIG and the review/acceptance of DLL-CONCURRENT-MAPPING-20261009. Do not start, resume or retry MIG from the coordinator. SAM-PRODUCTION-FOLLOWTHROUGH waits for the laptop's MIG result. The coordinator terminated its source-only retry process tree before shared edits, executable tests or runtime; preserved artifacts remain in scratch/usage-watch/mig-sam-rep-restart-owner-retry-nov05/. Other six authorized retry lanes may proceed one at a time.

Owner authorized one retry on 2026-11-05, superseding the previous no-retry boundary. Reconcile against current main, validate documented x86/Win32 semantics, fix our emulator and add regressions. Guest programs remain unmodified test evidence. If flagged again, stop and record the exact operation and UTC timestamp; notify the owner on Telegram. No additional retry or rewording. The older account below is historical evidence, not a current stop instruction.

Worker `codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f`, 2026-10-02 UTC.
Coordinator directed documentation-only stop after reporting an automated
cybersecurity-risk flag. No execution was retried or rephrased following that
instruction. Current source, original failures, corrected fixture and logs are
preserved. **Do not mark this integration complete or remove private diagnostic
transforms.** ContinueSearch and final static/ownership review gates remain.

Last known owned execution state, without polling or process checks after the
stop: test exec33835 was reported running when launched; its existing log now
ends PASS, but terminal exit status is unconfirmed. Board watcher exec33192
was also last known live. Prior test executions are terminal. Root now owns
confirmation/cleanup and scheduling; this worker will launch no further jobs.
Root subsequently reported its33835 poll returned `Unknown process id`;
the written PASS evidence stands, but no tool-confirmed exit is claimed.

## Implemented scope and ownership

Six narrowly granted production files plus the owned new fixture changed:

* `src/05b-string-ops.wat`: REP MOVS carries prefix PC; zero count returns
  without probing. Valid full affine spans retain the old bulk/overlap helper.
  Otherwise source then destination are preflighted over the complete element
  and the first absent byte becomes the AV address. Successful elements publish
  ECX/ESI/EDI; a failed element raises once and returns immediately.
* `src/05-alu.wat`: only MOVSW handler now uses the same restartable helper.
* `src/07-decoder.wat`: H82/H83/H186 operands carry `insn_start`, including
  prefixes. No per-instruction NOP instrumentation.
* `src/07b-loop-match.wat`: separately granted TU_REP_STR operand preservation
  in existing `tu_imm` plus adjacent comments. No descriptor/layout expansion;
  STOS retains its zero operand.
* `src/07c-block-exec.wat`: all three REP executor arms pass that PC and return
  immediately after SEH redirection before stale locals can overwrite handler
  state. Original final blank line restored.
* `src/11-seh.wat`: explicit access-kind/address parameters through exception
  entry, walk and raw record creation. Existing generic entry defaults to read;
  ContinueSearch obtains metadata from the saved record rather than a stale
  global. Existing nested-Delphi hunks preserved. No classifier change.
* `test/test-rep-movs-fault-restart.js`: owned new decoded guest regression;
  original baseline/observation copies remain separately frozen. Added explicit
  block descriptor checks, runtime path counters, uop entry transfer, unmapped
  zero-count cases and a not-yet-run ContinueSearch variant.

No `03-registers`, header, memory policy, region/layout, launcher, `07d` or
`07e` source changes. No canonical build, gameplay, remote job or commit.

## Completed tests and exact limitations

All logs below are under `scratch/mig-sam-rep-restart-20261002`.

| Gate | Result / evidence |
| --- | --- |
| Default MOVSD and independent MOVSW mode3 | PASS, exit0; `default.log`, `word.log` |
| Threaded80-case absent-page matrix mode3 | PASS, exit0; `matrix-mode3.log` |
| Same80-case matrix mode0 | PASS, exit0; `matrix-mode0.log` |
| Unmapped-pointer ECX0, widths1/2/4 × DF0/1, mode3 | Six PASS, exit0; `zero-count.log` |
| General block executor, MOVSD mode0 | PASS, exit0; descriptor458 with exact REP PC; blockRuns2; `block.log` |
| Pure leaf, MOVSD mode0 | PASS, exit0; descriptor463 with exact REP PC; leafRuns1; `leaf.log` |
| Fallback leaf, MOVSD mode0 | PASS, exit0; descriptor464 with exact REP PC; leafFbRuns2; `leaf-fb.log` |
| Initial cached uop case | **FAIL coverage gate**, exit1; uopEnters1, bulkDeopts0; `uop.log` retained |
| Corrected cached uop MOVSD mode0 | Existing `uop-entry-transfer.log` ends PASS; uopEnters2, bulkDeopts1 plus semantic assertions. Session33835 terminal status **unconfirmed** after stop. |

The matrix covers source/destination holes, k0/3, cold/cached blocks, both DF
directions, widths1/2/4, aligned elements and unaligned page straddles for2/4.
Assertions require precise exception/context prefix PC, correct read/write
kind and first absent byte, failed-element mapped bytes unchanged, accurate
progress and flags, successful guest VirtualAlloc repair and exactly-once
pre/post markers. Handler mutates previously copied source to detect recopy.
Fully absent destination bytes cannot be read before repair and are not
claimed as observed. Width2 fault/restart coverage remains **threaded only**.
Block optimized checks cover one cold MOVSD destination case per descriptor;
uop covers one cached MOVSD destination case, subject to terminal confirmation.

The initial uop fixture installed the program at an interior REP but launched
at an earlier prologue without a transfer into that head. Its recorded entry
could occur only after SEH repair, so zero COPY deopts was not accepted as
coverage. Coordinator authorized one discriminating adjustment: a real guest
JMP from prologue to the installed REP head. Assertions remained strict;
production code and `07d`/`07e` were unchanged. Corrected log records the
required entry/deopt and accurate fault/restart observations.

Nine relevant existing regression invocations all exited0; exact commands
and exits are in `regression-results.json`:

* `test-bw-rep-copy.js`:16 ordinary cold/cached cases.
* `test-string-ops-sparse-boundary.js`: mapped noncontiguous backward copy.
* `test-fault-null-raise.js`: generic diagnostic miss policy compatibility.
* `test-seh-continue-execution.js`, `test-seh-unhandled-terminates.js`,
  `test-delphi-seh-mutated-chain.js`.
* `test-uop-compiler.js` selected with `UOP_CASE=rep-oracle`, `rep-sparse`,
  `rep-code-write`. These are selected correctness cases, not timing runs.

The existing oracle covers ordinary copies, both-direction overlap, exact
alias, zero count, one element and page seams across widths, with real compiled
entry assertions. The selected `rep-code-write` uses REP STOS: it proves that
existing shared invalidation behavior remains compatible, **not a new direct
REP MOVS code-write regression**. Do not overstate this gate.

## Module, source and patch identity

Production private module (no test-only exports):
`production.wasm`,1655108 bytes,
SHA256 `5155cf8cc1d4ced48fcf233faacdee10eedb0a22c5ced9ab643c17d77e9e54aa`.
It was compiled in memory then written only to the owned scratch directory;
existing tests used explicit module overrides to avoid canonical autobuild.

Initial focused/matrix fixture module with setup exports:
`38d03f9e9d6c4d95f69c43bf86a3c27876ca1b19fab6e78715a94efc8e21121d`.
Extended zero/path fixture module with extra observation exports:
`528ead9bfc5e89f39be26598523d383ee9c73b5eda3db6ab547ddf2cdc289c4c`.
Both original and corrected uop cases report this latter hash; guest code is
constructed by JS, so the entry-transfer fixture correction does not change
the compiled WASM bytes.

`before/`, `before.json`, `preexisting.patch` preserve all seven initial file
states and pre-existing dirty hunks, including nested Delphi. `owned.patch`
is a before-to-current delta, not the aggregate git diff.
Its SHA256 is `a42b86f94b6410df70c7bb920defc974af8c7a739fe64ccc6e07a78f5ba0ff58`.
`after.json` holds exact current sizes/hashes. `evidence-summary.json` contains
existing log hashes and parsed observations. `identity.json`, `manifest.sha256`
and `frozen/` preserve165 implementation-stage source/compiler/host inputs;
final review hashes are in `identity-final-review.json` and
`manifest-final-review.sha256`. Since that freeze only the owned fixture and
07c's restored trailing blank line changed; no production behavior changed
after the successful matrices/regressions.

| Current file | SHA256 |
| --- | --- |
| `05b-string-ops.wat` | `35d5c977e9acb33dd3511e1529985cadc546a4c06b4c9cfe8c46176c9aea7a47` |
| `05-alu.wat` | `2e3d1abfc796bf7e126db0918287cf81e6d0dccdc50501e18b25bb66e3504dae` |
| `07-decoder.wat` | `81b85fa4d32e805eae28de4c0c56b7648aba5fc0c9fdb11c8dc563cd9722071b` |
| `07b-loop-match.wat` | `ebf1d254d2b4d4780aaf434ee916134aa3303cda54d25ed6b3886fed1915c621` |
| `07c-block-exec.wat` | `4bbe35ce8a9bfa0e332b570c43d8389a26b7476b53230b0ab92a3caf1e3a5306` |
| `11-seh.wat` | `62c8f2fbff37646f357fb9bf1564fd186be3cf54d980252ca1f105cf4f1ae184` |
| New fixture JS | `dd1cb1ccc3e64f20b81adb1e6bf8f1895e1f46276125a76afc2b6e03047be019` |

Read-only `07d` hash:
`09bfc4f06119924b3f547f5cd6b327cf37edb7531ac60e640903b71f1463f237`;
read-only `07e` hash:
`1f49e72395d68866b431b9eefff7d07db223f15d3bf0e2cb8e39d89c2c7c7bb6`.

## Unfinished gates / review boundary

1. Root confirms terminal status of33835 and handles owned watcher33192;
   no worker polling or cleanup was performed after the documentation-only stop.
2. The added `--continue-search` variant has **not run**. Its intended gate
   compares both handlers' saved code/PC/access-kind/address/register state,
   with only the second handler repairing and continuing execution. Existing
   SEH tests do not replace this specific AV metadata preservation check.
3. Final static paren/label, logical-AND and tier membership gates have **not
   run**. Earlier `git diff --check` and fixture syntax checks passed before
   later test-only extensions; successful later compiles are not a substitute
   for recording final required static checks. No tier file was edited.
4. Review the owned patch against preserved dirty hunks and decide whether a
   direct REP MOVS code-write invalidation fixture is required before acceptance.
   Do not broaden into the full uop/x86 suites by default.

Boundary: absent mapping,32-bit-address REP MOVS only. No PAGE_* protection
enforcement, global miss-policy or raw/C++/CRT classifier change. Existing
uop bulk `n*w`/backward-extent wrap limitations remain pre-existing and
unmodified; no all32-bit-count proof. No nested-fault completeness, generic
load/store precise-PC, code16/address16, timing, game/menu/input or final
production integration claim. Private Serious Sam diagnostic transforms and
all prior reference artifacts remain intact.
