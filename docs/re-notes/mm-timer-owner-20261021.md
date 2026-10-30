# Win32 multimedia timer retained return ownership

Base: exact integrated main `d550de85ae9b46d23314d164a932d66478894999`.
Original task branch: `task/mm-timer-owner-recovered-oct21`. The original task
left independent acceptance pending. The dated addenda below record subsequent
source acceptance, runtime qualification and integration; nonlocal jump APIs
remain disabled.

## Reproduction and correction

`MM_OWNER_REF=d550de85ae9b46d23314d164a932d66478894999 node
test/test-mm-timer-ownership.js --baseline` compiles the actual producer,
save/restore functions, token allocator and CACA000A return arm. After timer
entry, it enters an unrelated child invocation and executes the return arm.
The baseline accepts that wrong owner, clears the callback guard and restores
the interrupted caller. This is executed source evidence, not a census label.

CACA000A now retains the allocated child identity, root and expected return
ESP in emulator-owned records. Admission precedes producer stack, timer-slot,
wait and guard mutations. `fire_mm_timer` admits before due polling because
polling itself can consume and signal event timers. A poll without a function
callback cancels its provisional child; it still spends one monotonic identity.
Exhaustion traps without wrapping or consuming a timer. Production loaders
must already have established the invocation root; admission does not lazily
reattach an uninitialized or retired instance.

The 32 KiB appended region contains 64 records for each of 16 thread slots.
Its allocation leaves every existing region in place. Per-instance root/depth
and the shared invocation validator reject retired roots. Expected ESP rejects
a malformed return before restoration. The outer dispatcher checks CACA000A
before resource scopes, thunk hooks or other dispatcher bookkeeping; the return
helper checks again before popping the child. A rejected owner is not unwound.

## Producer / return matrix

| Producer | Continuation and retained state | Qualification |
| --- | --- | --- |
| `fire_mm_timer` | CACA000A; expected ESP = interrupted ESP − 40 | Admission before due poll/consumption; one-shot, periodic, no-due and event routes exercised |
| DispatchMessageA MM_TIMER arm in `09a5-handlers-window.wat` | CACA000A; expected ESP = API-entry ESP − 32, accounting for completed RET 4 frame | Admits before the handler changes ESP/EIP; message-carried callback/id/user survive already-retired one-shot slot |
| `fire_audio_callback_bound`, through wave/MIDI wrappers | CACA000A; expected ESP = interrupted ESP − 40; record marks audio ownership | Existing immutable registration, wait and saved-carry behavior preserved; no audio lifecycle redesign |
| `mm_timer_thread_step` | CACA003B; existing pinned loop ESP | Root validation and refusal to discard any live CACA000A record added, also at dispatcher entry. This does **not** claim retained child ownership for the dedicated thread's own CACA003B callback lifetime |

Nested DispatchMessage timers have separate records. Their returns restore the
prior active guard/resume reason and cannot restore an outer audio wait. Only
the record that admitted audio calls `wave_callback_restore_wait`. Audio may
interrupt a dedicated timer-thread callback, finish CACA000A, then allow that
thread to continue through CACA003B. Neither continuation can consume the
other's live save frame in the tested routes.

## Validation

- `node test/test-mm-timer-ownership.js --controls`: 55 production-slice cases.
  All four CACA000A producers return normally; mismatched child, same-depth
  child reuse, stale root/epoch/thread, duplicate return and malformed ESP
  reject. Depth, record and serial exhaustion plus uninitialized/retired
  admission preserve copied whole-memory and exported-global snapshots.
  Nested timer/audio, dispatcher preflight and cross-continuation cases pass.
  Removing the retained-identity check (including substituting the current
  child at leave) compiles and fails the wrong-child behavioral assertion.
- `node test/test-audio-saved-carry.js --mutations`: 29 compiled cases plus six
  detected corruption controls. Its extraction now includes real ownership
  helpers/allocator, while retaining the original carry/flags/stack assertions.
- Existing invocation-token, wave owner, queue and scheduler regressions pass.
- Census gate: 407 boundaries, all still labeled `pending`; nonlocal API lock
  remains enforced. Census mutation tests also cover unreviewed timer owner
  and depth resets. Only changed producers/helpers received renewed seals.
- Region declarations and generated mirror agree (268 regions); tier gate
  passes (2078 tests). The new regression is in the default unit tier.
- `git diff --check` passes. Shared root TODOS/STATUS/index/config hashes remain
  unchanged; laptop worktrees were not accessed.

The tests use real production WAT slices with identity guest translation and
modeled stdcall RET 20, not an x86 interpreter. The DispatchMessage test extracts
its exact MM_TIMER arm; admission snapshots start at that producer boundary,
not at the outer ordinary-API dispatcher bookkeeping. Return tests execute the
actual early dispatcher preflight and actual continuation arm separately, not
the entire dispatcher. Host queue/scheduler tests use their existing modeled
transport environment. Full-build/browser/game/Windows behavior, CACA003B's
independent retained lifetime, other deferred families and nonlocal jumps
remain unqualified. The two existing full-module timer tests were adjusted to
establish harness roots/owned frames but were **not run** under the no-full-build
constraint. The full-module wave-wait test was also not run.

## Evidence and recovery

Shared evidence: `scratch/runs/20261021-mm-timer-owner-recovered/`, including
admission, baseline/final logs, `result.json` and `publication.json`. The
read-only `git-source-overlay.cjs` supplies missing tracked files from exact
HEAD for canonical scanners on this sparse checkout; actual edited files take
precedence. It does not rewrite source or suppress a gate. Re-run on a complete
checkout without that preload, or use `NODE_OPTIONS=--require=<overlay>` for
the census test's child scanner.

The checkout uses a local Git object alternate to the verified source
repository. The published task branch, based on the stated main commit, is
the remote recovery source; no ignored binary or full build is required for
these source-slice tests. No boxes were assigned, started, resumed, stopped or
deleted; runtime lifecycle remains coordinator-owned.

## Independent source acceptance — 2026-10-22

**Scoped SOURCE ACCEPTANCE** of exact candidate
`ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c` against
`d550de85ae9b46d23314d164a932d66478894999`. No concrete source defect found
within this review. This is not permission to merge or runtime qualification.
Remote candidate matched; remote main
`bf99a428500d47ecacd3de2e86cc47cb0dfaacef` differs from the base only in
`ops/COORDINATOR.md`, `ops/README.md`, and `ops/TELEGRAM.md`. Those audit/policy
documents were reconciled read-only; no candidate source was replaced by main.

Reviewed the actual changed WAT and all CACA000A producers, including
DispatchMessageA and the outer dispatcher. The private record retains child,
root, expected ESP, prior guard/resume and audio ownership; invocation_leave
returns to the retained child's parent stack entry. Root/epoch/slot validation
precedes record access. Explicit loader/thread initialization establishes roots;
fresh slot reuse retires the old instance. Frame indexing is
`(tid-1)*2048 + depth*32` within 32768 bytes for 16 slots. The invocation stack
permits 63 live children (root consumes its first entry), tighter than the
64-record allocation. No guest-provided record pointer is trusted.

Admission precedes producer stack, timer consumption/event signaling and audio
wait changes. DispatchMessage admission is at its MM_TIMER arm, not before all
ordinary API dispatcher bookkeeping; the latter is not claimed transactional.
The separate CACA000A return preflight is before dispatcher effects and the
finish helper revalidates before popping/restoring. No-due/event polls release
their provisional child. One-shot and periodic consumption remain unchanged.
Nested DispatchMessage records restore outer guard/resume without restoring an
outer audio wait. CACA003B refuses a live CACA000A owner before its pinned-stack
reset; its independent callback lifetime is still outside this acceptance.

Validation on Node v24.18.1:

- Requested ownership replay: 55 cases and the wrong-child mutation detected.
- Requested saved-carry replay: 29 cases and all six mutations detected.
  Snapshot implementations copy memory (`Buffer.from` / `slice`), rather than
  retaining a live view; mutation checks require behavioral assertion failures.
- `node test/test-mm-timer-release-review.js`: seven independent cases. Four
  producer routes execute the exact production RET20, run-loop thunk routing,
  whole outer dispatcher and inner prefix through the continuation. Wrong-child
  outer dispatch rejects before prefix effects. Additional cases exercise actual
  shared-memory thread-slot reuse, thread 16 with 63 nested callbacks and region
  canaries, and observable event signaling after rejected/exhausted admission.
- Generated region mirror is current (268 regions). The appended allocation
  leaves old region placements unchanged. Census/mutation validation uses exact
  Git fallback for missing sparse files; raw sparse runs correctly rejected the
  absent `host.js` seal, and their failed logs are retained. No gate is suppressed.
- All 14 candidate source hashes and all 12 prior log seals match result.json.
  Unrelated token/host-owner/queue/scheduler, region-declaration and tier evidence
  is reused at that exact revision. Census changes retain `ownership: pending`,
  whole-function seals and the nonlocal API lock. No API jump unlock or broad
  SEH change occurred.

The independent fixture stubs resource cleanup, host services, thunk membership
and branch/cache dispatch; identity guest translation remains. It closes the
specific modeled-RET/separate-dispatch gap for these routes, **not** the complete
interpreter integration gap. Canonical/full-module timer and wave-wait tests,
full build, real guest translation/fault handling, browser/game/runtime tests,
and CACA003B's own retained lifetime remain outstanding. Coordinator owns that
qualification decision and any eventual integration; **NO MAIN MERGE** here.

## Canonical build and full-module qualification — 2026-10-22

**SCOPED ACCEPTANCE** of candidate `ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`:
the canonical build and the three previously unrun full-module regressions pass.
This addendum follows independent source acceptance
`f7cc26c5433859ebf986fff30ce4a28f7224e15a`; it does not repeat that source review.
No producer, canonical gate, existing test, or main branch was changed.

Evidence: `scratch/runs/20261022-mm-timer-canonical-qualification/` on the main
host and this task branch. `qualification-artifacts.tar.gz` retains both shipping
modules, the three instrumented test modules, logs, test fixtures and first
failed attempts. Archive SHA256:
`3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`.
See `RECOVERY.txt`, `result.json`, `source-manifest.json`, supplemental/fixture
manifests and `logs/`. The compressed artifact is explicitly committed, rather
than relying on ignored build files surviving the box.

### Source, build and loader identity

No reusable module existed in the candidate checkout, acceptance checkout or
main-host build directory; the preceding reports explicitly left builds unrun.
Exact candidate Git blobs were archived without Git history or the irrelevant
binary corpus. The remote staging repository retained the real candidate commit,
trees and API-table blob, so the append-only gate checked against actual `HEAD`.
Final verification checked 5,625 tracked files plus the existing ignored
`test/binaries/notepad.exe` fixture: zero SHA256 mismatches. The fixture was
copied from the main host, without downloading or restoring archived assets.

All compilation and execution used `/home/user/timer-qualification` on assigned
`bx_pfv6b6wu`, Linux x86-64, Node `v24.18.1`. Node binary SHA256:
`f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`.
Dependencies were installed with
`npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund`
(exit 0: `pngjs@7.0.0`, `wabt@1.0.39`). No WINE compiler/layout overrides were set.

`bash tools/build.sh` exited **0**, every canonical gate enabled, including
compiler provenance, layout checks, actual Wasm validation and compiled data
overlap checks. `logs/build.log` is the complete successful log. Layout hash:
`9a3bc9149d58209c`; 324 data segments, no overlaps.

| Module | Bytes | SHA256 |
| --- | ---: | --- |
| Shipping `build/wine-assembly.wasm` | 1,878,971 | `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7` |
| Shipping compatibility module | 1,881,544 | `9ad1d087170b755519a6b35f6dcb4fd5df3b729500a26deb3d0882f27cb691b7` |
| Timer callback test module | 1,880,090 | `6c8eec2c429be82d834a50bdf2a2585ba17adf4a636081b2bafb7326761bac1c` |
| Timer thread test module | 1,879,367 | `cd1a1505b4c61e329f855f4dba58d45c511f863d4307ea0d5fadcb768ab83e9d` |
| Wave-wait test module | 1,879,109 | `9e4cc591e8717ae8bf42d4af9ad0f7aefb136898fd1ed4da66e514542b1da3ff` |

The existing tests compile the entire `src/main.watx` closure through
`test/compile-src.js` and the canonical WATX compiler, appending test-only exports
to `13-exports.wat`; they do **not** load the shipping file verbatim. The evidence
observer verified this append-only transform and recorded the exact bytes passed
to real `WebAssembly.instantiate`, matching each compiled hash above. No
source-slice surrogate or replacement interpreter was used.

`node evidence/full-closure-identity.cjs` exited 0 (one assertion). The untouched
test compile is 1,878,934 bytes, SHA256
`03af1aa4d94cd3ccee5b757e439e76830a8ab89ee1308648235ab32947f9b818`.
Applying the **same** `appendSection` layout stamp as `tools/build-compile-wat.js`
makes it byte-identical to the shipping module; the difference is the 37-byte
`wine-region-layout` custom section, with no executable-section changes.

### Executed regressions and limits

Commands below ran from the remote staging root. Each command exited **0**;
assertion counts are dynamic counts of the original Node assertions, not source
line counts. Per-test `.exit`, `.log` and `.identity.json` files are in `logs/`.

| Command | Passing assertions |
| --- | ---: |
| `node --require ./evidence/observe.cjs test/test-mm-timer-callback.js` | 28 |
| `node --require ./evidence/observe.cjs test/test-mm-timer-thread.js` | 22 |
| `node --require ./evidence/observe.cjs test/test-wave-callback-wait.js` | 23 |
| `node evidence/canonical-wave-owner.cjs` | 26 across 3 cases |

The callback suite covers event set/pulse, one-shot retirement, periodic phase,
parked-wait entry/return, CACA000A completion, DispatchMessage argument/frame
restoration and ordinary thread-message rejection. The thread suite covers
deadlines, main-thread suppression, timer-thread callback arguments, loop ESP
pinning and idle/deadline sleeps. These two suites use explicit harness setup
exports; their return setup is not a Windows callback experiment.

The applicable audio regression is **`test/test-wave-callback-wait.js`**. It
loads the existing PE fixture, runs real guest INC/RET20 through the full
interpreter, rejects unsupported/nested injection, restores the parked wait
tuple, and preserves TLS/FS. It explicitly does not qualify Worker delivery or
real semaphore behavior.

The additional narrow `canonical-wave-owner.cjs` fixture directly reads and
instantiates the **unchanged shipping module** (no compile or added WAT). It
executes real guest INC/RET20 for normal parked wave return and two stale return
cases: changed shared root and changed process epoch. Both stale cases trap;
the callback remains active, the parked wait is not restored, and the 40-byte
saved caller frame is not popped. Guest RET20 itself first advances ESP by 24
bytes; validation is at the CACA000A continuation boundary, not before the
guest instruction's argument pop. This adds full-interpreter root/epoch evidence
without claiming the entire prior source-slice adversarial matrix was rerun.

**CACA003B's independent retained callback lifetime remains unqualified.**
The passing thread regression does not change that limitation. Compatibility
Wasm was built/validated by the canonical gates but was not used for these
runtime regressions. No Windows, browser, game, fleet or public-deployment
acceptance is claimed. No main merge was performed.

### Preserved setup and qualification failures

The first canonical attempt exited 1 because staging omitted tracked
`docs/dos-corpus/live/toyvm-bundle.js` and `toyvm-jit-bundle.js`. Exact candidate
blobs were supplied; the complete unchanged build then passed. The first
wave-wait attempt exited 1 with ENOENT for the ignored Notepad fixture, before
any assertion; supplying the existing fixture made the unchanged test pass.
No canonical gate was bypassed and no production fix was needed.

The initial identity check incorrectly required equality before adding the
shipping metadata stamp. The optional canonical fixture initially expected
`load_pe` to return 1 (it returns the entry address), then incorrectly expected
the guest RET20 argument pop to be rejected. Both fixture expectations were
corrected to the documented API/continuation boundary; all original scripts,
failed logs and exit statuses are preserved. These were evidence-harness
failures, not silently discarded production failures.

The first local archive selection accidentally included encoded DOS corpus JS
and produced 78,226,630 bytes, exceeding the 64MiB allocation. It was immediately
deleted without transfer/use. The replacement archive is 28,009,389 bytes;
`allocation.json` records this workflow violation and subsequent measurements.
Fresh free-space admission passed throughout. SCP was denied with
`api_key_action_forbidden` (SSH unavailable); staging/retrieval used the explicitly
assigned, authorized Boat exec API, without SSH/config changes.

The assigned box remains running (Boat state `idle`, health `ok`), expiry
**2026-10-22 02:53:01.742 UTC**; final measured free space was 48,878,579,712 bytes.
The coordinator retains shutdown ownership and the 02:43 UTC checkpoint.
No worker/box creation, stop, resume or snapshot action was issued by this task.

### Historical source-review resources (before canonical qualification)

The following paragraph describes only the earlier source-review task, not the
canonical qualification or integration task.

Review branch: `task/mm-timer-owner-release-review-oct22`.
Evidence: `scratch/runs/20261022-mm-timer-owner-release-review/`, including
admission, seal verification, successful and failed gate logs, result and
publication receipts. Exact non-cone manifest projection was 36,551,511 bytes
plus 16,777,216 reserved bytes, below the 64 MiB total allowance; fresh admission
was 8,321,327,104 bytes against 2,982,150,144 required. No 16 MiB checkout limit
was applied. No workers, boxes, build, browser, dependency installation, fleet,
deployment or laptop actions; no assigned box/expiry, lifecycle stays with the
coordinator. Candidate and root WIP/index/config/TODOS/STATUS were not edited.

## Independent qualification acceptance and integration — 2026-10-22

**ACCEPT within the stated scope.** Independently reviewed qualification commit
`a2afc1797ae782a4c53e1799ecc1dd12a7871c03`, reusing accepted source review
`f7cc26c5433859ebf986fff30ce4a28f7224e15a` for production candidate
`ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`. All 65 qualification seals match both
the committed and main-host evidence. The 5,623 initial manifest blobs and two
supplemental tracked blobs match the exact candidate; the ignored PE fixture
remains separately identified. All five archived module hashes match receipts.

Reviewed the actual observer, test transforms, compiler closure, canonical
owner fixture, full-closure identity check, successful logs and preserved failed
attempts. The observer delegates assertions and instantiation to the originals;
the inspected test transforms only append exports and the compile helper updates
all three VFS aliases. This observer is evidence for these inspected tests, not
a general detector of arbitrary VFS substitution. The timer suites exercise the
full compiled module with explicit harness setup and modeled RET stack advances;
the wave-wait and shipping fixtures execute real guest INC/RET20. Assertion
counts 28/22/23 describe those suites, not 73 independent end-to-end scenarios.
The unmodified full closure equals shipping bytes after the canonical 37-byte
layout stamp, so the instrumented modules are correctly distinguished from the
shipping module rather than mislabeled as identical binaries.

The corrected RET20 expectation does not conceal a producer defect: the guest
instruction pops its return address and five arguments before reaching the
CACA000A validator. Stale root/epoch rejection must preserve the remaining
40-byte saved caller frame and active owner, without restoring the parked wait.
The preserved failed expectation asked for rejection before that guest pop.
One fresh replay on the same box passed all 26 assertions across normal,
stale-root and stale-epoch cases using the unchanged shipping SHA256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7` and sealed
fixture. No build, dependency installation or packaging was repeated.

Reconciled remote main `bf99a428500d47ecacd3de2e86cc47cb0dfaacef`: its only
changes from the production base are the three ops documents, preserved exactly.
The integrated production trees remain identical to tested candidate source.
Fresh manifest, fragment-balance and diff checks pass; canonical build and
full-module results are reused at that exact source identity. Integration branch:
`task/mm-timer-qualified-integrate-oct22`; receipts and publication identity:
`scratch/runs/20261022-mm-timer-qualified-integrate/`.

This acceptance does not qualify CACA003B's independent retained lifetime,
Windows/browser/game behavior, Worker semaphore delivery or compatibility-module
execution. The API jump lock is unchanged. The prior 78,226,630-byte archive
allocation violation remains disclosed above; this task uses individual sparse
paths with a measured 41,540,061-byte projection plus 16 MiB reserve under the
64 MiB cap. No full-goal completion is claimed.

Box `bx_pfv6b6wu` remains running (idle/health ok, exec reachable), expiry
02:53:01.742 UTC, coordinator shutdown checkpoint 02:43 UTC. Shutdown ownership
is returned to the coordinator; this task issued no lifecycle mutation.

## CACA003B retained lifetime boundary — 2026-10-22

**Scoped FAIL** on exact accepted main `c26252c4a95babe583ade1d1c6e2da0c050be45c`:
executed production slices accept a callback return under an unrelated valid
child, a same-depth replacement child, or an explicitly rebound thread root.
Normal return, stale-instance rejection and CACA000A collision protection pass.
The existing stack-pinning convention tolerance is preserved, not called a
defect. No production repair or change to prior CACA000A acceptance was made.
See [focused report and reproducer](timer-thread-lifetime-boundary-oct22/report.md)
for exact commands, the failing safety assertion, controls, smallest repair
dependency and execution limits. No runtime box was used; coordinator recorded
the prior box stopped before this task.
