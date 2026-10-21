# Canonical callback census prerequisite — 2026-10-21

The census passes at the reviewed source, with ownership still `pending` and
nonlocal APIs still disabled. This repair changes nine manifest digests and
their review reasons, strengthens the existing census test, and adds a bounded
lifetime test adapter. No production JS/WAT or census enforcement code changes.

## Provenance and review

Fetched and independently verified origin/main
`4261fd93a512dd1377818c4f374addbb8aee6267`, a descendant of Hock's
`f3698d8827aa048af14e0f0cbaa733bb96801949`. It includes accepted named-event
integration. Exact Hock registration commit
`09a89489b2a417ecab5dd9eeaf291b2464abed00` was fetched separately. Scanning its
Git source reproduces precisely the reported seven changed-producer errors.
Registration itself changes only the corpus manifest, test and documentation;
it does not change any inventoried producer.

All nine previous pinned hashes match source at `14792a36a`. Reviewed the full
delta from that exact matching source, including two additional current-main
Worker producers. All WAT target lists, boundary calls, exports, ownership
writes, classifications and inventory membership remain unchanged (401 entries).
The manifest retains prior review text and adds specific lifetime obligations:

| Producer | Reviewed change and lifetime obligation |
| --- | --- |
| host.js | Process aliases reference a stable published object, including pending boot. Attachment checks cancellation before/after each await. Completion is idempotent, preserves full DWORD exit status, and owns merge/EOF even after handle close. Stop severs the host reference and clears owner tables; restart creates a new object. Closing parent handles does not terminate independent children. |
| lib/apps.js | Mad Bomber candidate metadata, paths and thread setting only; conservative lexical whole-file pin retained. |
| lib/host-imports.js | Default process_ctl errors distinguish unsupported duplication and invalid objects. No callback, allocation or restoration added. |
| lib/renderer-input.js | Same-instance hit candidates compare WS_CHILD top-level surfaces before dialog area. Cross-instance z-order and existing delivery paths preserved. This changes routing selection, not callback retention. |
| lib/thread-manager.js | Process waits use validity/access/exited state. Local nested event pumping validates original generation around dispatch and CAS consumes auto-reset signals. Named finite waits own a reservation per initiating thread/entry; continuation polls status rather than reacquiring. Close/exit/owner cleanup cancels and forgets; stale continuations and recursive remote parking fail. |
| lib/guest-thread-host.js | Forwards captured entry and namedWaitSequence without recapture. RPC cleanup remains in finally. |
| lib/guest-worker.js | Validates/consumes the named sequence before guest register/stack restoration; rejects nested thread-send frames and stale/duplicate completion. This is a named-wait contract, not general invocation-token coverage. |
| $handle_TerminateProcess | E4/E6 delegates to process_ctl op5 and pipe_ret with 12-byte stdcall cleanup. Self-exit EIP=0 and steps=0 remain unchanged. |
| $handle_CreateWindowExA | Only publication argument changes: class_publication_name resolves application atoms and wide registration names. Host synchronously copies transient ANSI scratch and binds owner generation. Callback targets and continuations unchanged. |

## Validation

`scratch/runs/20261021-hock-canonical-census-repair/tests.json` records 17 commands
with exact exits and logs: 12 successes and five intended assertion rejections.
Run `python3 ../run-tests.py` from the isolated repo to replay.

- Census CLI: all 401 boundaries pass. Extended existing census test rejects
  real-source removal of process host-reference retirement and Worker
  single-completion admission, with exact changed-producer diagnostics.
- Additional actual CLI negative control temporarily removed the host retirement
  statement in this isolated checkout: exit 1 with only the expected host.js
  diagnostic. Original bytes restored and SHA-256 verified in finally.
- Process suite: 14 boundary groups plus the 17 original groups; 11 internal
  rejecting mutations. Exercises pending cancellation, attachment awaits,
  duplicate/close/exit/restart and compiled process/wait API slices.
- New publication slice compiles the exact CreateWindow call plus production
  class_publication_name/class_wide_name_key helpers. Actual host imports test
  ANSI/W registration atoms, six USER atoms, synchronous scratch copy,
  retirement/republication and missing atoms. Stale-pointer control rejects.
- Corrected nested-event lifetime suite passes; removed lifetime gates reject.
- Named-event end-to-end and independent suites pass using actual Node Workers,
  RPC, ThreadManager and a local subprocess authority. Duplicate completion,
  stale continuation and omitted sequence forwarding controls all reject.
- Renderer component routing, modal input, host window relations, full
  source-only ThreadManager suite and eight zero-timeout contracts pass.
- `git diff --check` passes. No full build or dependency installation ran.

The older process fixture initially failed because it did not initialize the
new named-event containers. The new adapter supplies only those empty fields,
in both fixtures; it changes no production code or assertions. Historical
compiler/pipe dependencies used by that suite are byte-identical to current
source, verified in verification.json. The window integration replay could not
resolve historical commit fffb14ee9; its failed log is retained. The new current
publication test and existing host-window test are narrower than that missing
full historical acceptance replay. Neither initial failure counts as a pass.

## Custody and limits

Evidence directory contains review-base.json (old pins verified),
reviewed-producers.json (exact old/new canonical hashes), source-seals.json
(267 complete census-input file hashes), verification.json, tests.json,
*.final.log, cli-negative-control.json/log and hock-census-reproduction.json.
The manifest commits all nine new hashes; WAT hashes are canonical AST hashes,
not raw file hashes. The independent evidence seals cover raw source too.

Fresh sparse checkout projected before materialization (~28.1 MB initially,
then enumerated narrow test dependencies); total remains below the 64 MiB cap
and available bytes above 2285895680. All 267 production inputs match the
verified base. Shared production files, laptop WIP and runtimes are untouched.
No workers, runtime access, main merge, public deployment or game launch.

This is reviewable prerequisite repair for coordinator integration and build
scheduling. It is not Hock gameplay qualification, complete callback ownership,
general nonlocal-jump safety, full CreateWindow/self-termination conformance,
or native Windows behavior. Named-event entry-to-registration remains unreserved;
qualified Node clock-domain restrictions and unknown transport outcomes remain.
Concurrent final-close/acquisition races are not established by serialized
cooperative tests. Real PE/NE invocation lifecycle tests requiring the full
artifact were not run. Future producer changes require fresh review; these
pins must not be copied onto older Hock sources or a changed integration tree.

Concurrent startup integration announced further changes to host.js,
host-imports.js, browser-shell.js, process-boot.js, renderer.js and WAT sources
on the messageboard at 02:42:42 UTC. Those changes are outside this assigned
review base and have not been folded into these pins. The coordinator must
reconcile them and rerun the gate before scheduling the canonical build.
