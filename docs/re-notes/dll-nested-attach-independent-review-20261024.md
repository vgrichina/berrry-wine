# Independent nested attach regression review

Verdict: PASS for the test-only change from `eb0c0a71c93c98bb2e394629e2c093bdcd4a9baf`
to producer `5711a6e03051d3876da470ba41d55e11a44e580a`.
No production defect or loader repair is established. Both production files retain
blobs `b3964ba0ec83ac447b1fd8db0b38f33485198928` (dll-loader) and
`2c8bc8c70a0297c842bf2d504f329d795e51c970` (process-boot).

The full producer range contains only the new regression and its report. I read
the fixture and actual exported callback/load paths. The ABI simulator models
mapping, guest execution, native completion and lock exports. Production JS owns
nested service dispatch, invocation contexts, path deduplication, callback gate,
generation-token capture and completion driving. This is a dynamic LoadLibrary
scenario; the console's “self/repeated import” wording does not establish PE import
binding. Native completion's generation check is a fixture assertion, not a test
of native generation validation or row reuse.

Unchanged exact main passes the new harness: synchronous and asynchronous depth
three, repeated/self loads, HMODULE/parent context restoration, original-token
completion ordering, metadata-lock release during callbacks, gate exclusion over
awaits and release afterward. FALSE/fault/unfinished callbacks assert unpublished
success and restored context. These are callback-runner cases; scoped lifecycle
rollback has its separate nearby regression. The fixture's unfinished case is not
an acceptance test for full-VM blocking waits.

Independent exact-one-statement production mutations, without changing the
harness, reject missing synchronous nested service (`DLL initializer did not
return`, original ESP 119980) and omitted register restoration (EBX 11255811 vs84).
Both controls exit1. Nearby `test-dllmain-load-context.js` and
`test-scoped-dll-lifecycle.js` pass, including the latter's real Node Worker with
simulated native exports. The new filename is automatically discovered as unit
by the current official tier classifier. It adds nested recursion coverage beyond
the nearby static/dynamic context and single-load scoped lifecycle tests.

The accepted candidate is this regression/report only, with this review note.
Baseline PASS is expected; there is no failing-baseline/repaired-source pair.
No x86/full VM/browser/native contention/unload-generation/gameplay acceptance,
production loader modification, unsupported fallback or broad TODO closure.

Evidence retained in `/tmp/dll-nested-attach-independent-integrate-oct24/`:
`producer-full.diff`, selected producer seal verification, exact baseline/candidate
and nearby logs, two rejecting mutation logs and `mutations.js`, resource/capture
receipts, publication and final seals. Recover from the published branch, run
`node --max-old-space-size=256 test/test-dll-nested-attach-current-main.js` and
the two nearby tests; private mutation runner takes `service` or `context`, each
expected to exit1. Node checks use fresh memory admission, heap256MiB,
CPU/wall60s. No native builds, packages, downloads or boxes were used.

Private explicit sparse Git uses authorized immutable object stores. The inherited
alternate chain initially exceeded Git's nesting depth; dependency-first direct
alternate paths correct this without modifying donors. That failed checkout and
the premature missing-harness invocation are retained, not test evidence. Early
instruction/full-source displays exceeded routine slicing; retained history is
conservatively charged, with smaller subsequent captures. These are bookkeeping
corrections, not platform/user resource denials. All prior charges remain.
The single-owner ledger includes task files/Git, measured session/launcher logs,
positive SQLite growth high-water, future growth and8MiB reserve within64MiB;
installed tools and inherited donor bytes are separately measured standing inputs.
Publication/final receipts record actual measured totals and remote revisions.
Coordinator retains lifecycle ownership; no box assigned (ID/state/expiry N/A).

The initial discovery-only probe used a relative fixture root from the wrong
working directory (ENOENT); the corrected absolute private root passes with the
unchanged official classifier. Both receipts are retained.
