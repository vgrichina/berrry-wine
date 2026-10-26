# Maelstrom observer mode transition: guard retained

Outcome: **GUARD_CORRECT_RUNNER_ARM_ORDER_PREREQUISITE**. No production helper,
adapter, game, loader or CRT source was changed. The authentic observer was
armed before the runner finished setting its execution mode. Reason 15 correctly
rejects a changed mode after that boundary; permitting all pre-select changes
would also permit changes during an owned, active or parked select.

Pinned production source: `55f9724ef127100c3bb54aebca73e5cda5472c5f`.
Authentic capture: `aebf9bbf4401bb13cbc782c9c168afdae2ac6099`, evidence base
`62b15e94e8898bc5d855392cf7ff639229177e7d`. The coordinator previously verified
all eleven raw payloads. The copied observation and diagnostic source remain
byte-identical to that immutable capture. Prior two builds, thirty native test
groups and 119 controls are reused; none was replayed.

## Causal sequence

The exact adapted runner was recovered from the immutable capture archive, not
retired `/runner` paths. `runner-diff.json` binds its SHA-256 to the standing
runner and observer-only patch. `causal-source.json` records bounded excerpts:

1. Adapted runner line 5763 calls `nativeAdapter.start()`; the adapter calls
   `mne_start`, which snapshots the current `uop_enabled` (initially zero).
2. Adapted runner line 6589 calls ordinary `experiments.applyMain(...)`.
   Exact production `test/runner-experiments.js` defaults uop on and calls
   `set_uop(1)` with the runner's nonnull context. Earlier `recordInherited`
   records configuration for workers; it does not set the main instance mode.
3. The instrumented setter calls `mne_uop_switch` **before** writing the mode.
   Snapshot zero versus requested one rejects with reason 15, mode bits zero,
   event zero, phase/token/entries/completions zero. This precedes the first
   `instance.exports.run` at line 10398, whose subsequent batch-zero observation
   reports the already-latched rejection.

This is a source-backed inference about the requested mode and host call site.
The authentic diagnostic ABI did not export the requested mode or rejecting
instruction PC. Later live PC `0x41787c` is not that instruction. Authentic errno
and caller remain unknown; zero-filled capture fields are not errno zero.

## Focused offline evidence

Run from the repository with Node 24:

```sh
node --max-old-space-size=192 test/test-maelstrom-mode-transition.cjs
```

The test pins its exact compiler/runner/helper inputs. A small synthetic module
executes the unchanged generated native observer and select storage, with the
actual instrumented mode setter, actual runner `applyMain`, and actual adapter.
Only the direct mapping bound is reduced for four pages of synthetic memory;
unused uop flush/hot-gate helpers are inert fixture stubs. Explicit fixture
exports drive select/CALL/RET hooks and synthetic registers. They execute no
guest instructions and establish no authentic errno/caller or gameplay.

29/29 cases pass. The original early-start ordering reproduces every persisted
native, select and rejection field of the authentic observation. A comparison
sequence initializes first, then arms: mode one and mode zero synthetic owned
invocations both complete. Both directions of changed mode still reject while
awaiting select, in active/parked select, after completion, and in the native
invocation. Same-mode requests preserve status/event. Tests also cover rejected
and captured no-reset/no-rearm behavior, fresh-instance recovery, duplicate
ownership rejection, and closure before reentrant/throwing terminal callbacks.
`test-result.json` contains module/source hashes and actual peak RSS.

The first fixture preparation failed its internal 40,000-byte source estimate;
admission was recomputed at 131,072 bytes within the existing allowance. The
compiler then rejected unsupported inline memory export syntax; the fixture
uses its supported top-level export. Neither failure changed production source
or guard predicates. An initial instruction excerpt exceeded the read allowance;
two checkout issues (missing root revision and missing root-tree object in the
first flat closure) were resolved locally through the supplied pinned donor.
Full retained diagnostics are in the task ops directory. One successful group
was rerun after adding peak-RSS output, without replaying prior qualification.

## Exact remaining prerequisite

Under a future authorized runner-integration assignment, recover the same
adapted runner and relocate observer arming from the loader-validation block to
after ordinary main mode initialization (`experiments.applyMain`) and before
any guest execution. Keep loaded-anchor verification before arming and retain
all three post-run observation sites. Review the entire intervening setup and
ensure every mode-affecting initialization is complete at the chosen boundary;
arm once, without resetting or reusing a rejected instance. Do not force uop
off/on, ignore reason 15, or accept an active invocation's mode change.

That runner is outside this task's owned production paths. No runner or module
repair was published here. No changed production module exists, so no new
module qualification is claimed or needed for this evidence-only outcome. Any
later helper/module change requires affected canonical/static/native gates.
The unchanged accepted module may be reused for a runner-only correction after
review, but authentic original select/native errno/caller and gameplay still
require a separately authorized runtime attempt. None is authorized or consumed
here. No test box was assigned or contacted; coordinator retains box lifecycle.

Only the task branch is published. MAIN and unrelated corpus changes remain
untouched. No workers, acquisition, services, deployment, full build or full
WASM/native qualification were run. Claude remained idle.
