# Process boundary repair acceptance — 2026-10-20

**ACCEPT the bounded A1–A3 repair at
`53b4132878e86fc5afdf5f4fd6c64cd60925c9af`, with full candidate parent
`659a2c6d6974c447a21dd2905cd7a2c2c1e23382`.** No blocking defect found in
these boundaries and no attached D1–D3 regression observed. This is not
runtime acceptance or main integration. The review branch contains only
this report and its JS helper atop main
`a54049d11955307d06309e146e85c1aca3196657`.

Reviewed the exact two-production-file delta, full parent production diff,
repair report/receipt/helper, and previous independent review
`70f39cc2471fbc8fcaea6be460527800a3ec17d4`. The acceptance helper reads
sealed Git blobs; it cannot accidentally test an ambient production checkout.

## Decisions

| Boundary | Result and evidence |
| --- | --- |
| A1 authoritative failure | Actual beforeRun rejection, complete shell failLaunch and complete host stop preserve failure1 in the shared object and record. Existing and newly allocated E6 and E4 report the same failure; repeated notifications do not replace it with success. |
| A2 pending identity/cancellation | Pending E4 publishes the object before asynchronous attachment. Compiled duplicate, close, terminate and query operate on it; late attachment retains the identity, stops and rejects. Full DWORD exits, including259 and0xffffffff, remain results rather than lifetime sentinels. |
| A3 guest error | Complete compiled WaitForSingleObject/Ex execute actual host adapter and ThreadManager paths: invalid handles return WAIT_FAILED/error6 and missing SYNCHRONIZE returns error5. Successful/timeout/nonprocess and valid cooperative failures preserve prior error behavior. |
| Attached D1–D3 | Submitted and independent regression assertions preserve NULL-output allocation, NULL-target close-only success, source-owner close even with equal numeric aliases, independent E4/E6 close, rights, full-width exit query, wait validation and host-reference release. |

## Tests and negative controls

Run from a repository containing the exact commits:

```sh
node docs/reviews/process-boundary-repair-acceptance-20261020.js
```

The submitted **14 independent groups plus17 original groups** replay
successfully. All **14 reported controls** reproduce: eight original
mutations, three independent mutations, and three exact-parent A1/A2/A3
acceptance failures. The parent fails the corresponding assertions while
the repair passes them.

The new helper adds **17 independent boundary cases**:

- Cancellation at each of five awaited calls: set_vlan_local_ip,
  pipe_detach_console, both distinct pipe_attach_std calls, and shared-port
  pipe_set_std. Each is tested with subsequent promise resolution and
  rejection. The E4 is closed while E6 retains ownership; completion remains
  0xffffffff, no later call occurs, identity remains stable, the child stops,
  the callback/host references clear, and EOF happens exactly once despite
  repeated stop/failure/exit notifications.
- Four normal attached-exit cases execute the **complete actual VirtualFS**
  implementation. Child replacement and deletion reach the parent's real
  file map through create/write/delete/close. The merge runs exactly once
  with E4 retained or closed, including an observer that throws after the
  actual merge. Subsequent failLaunch and stop do not repeat it or replace
  authoritative exit259.
- Three pending nonpipe cancellations, exit0/259/0xffffffff, reject late
  attachment and never merge files from a child that has not run.

Two additional rejecting mutations make **16 controls total**. Removing the
post-await cancellation guard fails the final pipe_set_std cancellation
assertion with a missing rejection. Removing the callback completion guard
produces six EOF notifications instead of one. These demonstrate that the
new tests exercise the edited boundaries rather than only fixture responses.

Fixtures reuse the submitted extraction framework but the added assertions
are independently authored. Actual process_spawn, process_ctl, alias methods,
beforeRun/onExit, shell failLaunch, host stop, VFS and compiled APIs execute.
Controlled callGuest promises deliberately represent each asynchronous
boundary; they do not claim real guest scheduling. DOM, renderer, audio and
Worker cleanup dependencies are explicitly inert because those resources
are not created. EOF is an observed peerGone call, not an end-to-end network
or pipe-reader test. No tested process boundary is replaced by a success stub.

Exact wait module:482 bytes, SHA-256
`e8c2f461864627bc8778ee57e1a7c4ce1b39aedffde2057cec31e96c555e700f`.
Process API module:603 bytes, SHA-256
`81cc57dc6bb58083461f9cfcbd46b997baf0eaa502c2b651585f28b20c26c66e`.
Exact host.js SHA-256:
`87fd7b2a8a7bb0d508a2e4fba5e7bf1dd5f3ae460e3bc46fdbb4d688dd365f31`.
Exact wait-source SHA-256:
`65b108f43813c4a9ac1eac9ccffec132ca34dabe6b35c570ab28a50dc4bc758d`.
All other consumed blob hashes are recorded in tests.json.

## Limits and custody

The unchanged DXSETUP successful skip still never calls beforeRun/onExit;
its process remains pending. This is separately reproduced and preexisting,
not an A1–A3 repair regression.

Worker RPC, native execution/OS child IPC, full VM, scheduler resumption,
alertable APC delivery, asynchronous retirement, inherited handles,
pre-attachment remote handle-table owners and heap reclamation remain
unqualified. Exit publication precedes the existing synchronous merge hook.
The tested merge-once result does not qualify concurrent wait/merge ordering.
No generic API redesign is proposed.

No production edits, main integration, full build, runtime/Boat/SSH runtime
commands, browser, benchmark, deployment, Claude, held diagnostics or
workers ran. Runtime403 remains binding; laptop HeroesII/WarcraftIII were
untouched. Git transport is solely for the requested report publication.

Evidence: `scratch/runs/20261020-process-boundary-repair-acceptance-oct20/`
contains setup.json, gate.js, tests.json, validation.json, receipt.json,
remote.txt and SHA256SUMS.json. All21 prior repair/review evidence seals
verify unchanged. Exact two-file sparse patterns were configured before
checkout; object alternates are read-only. Numeric prewrite gates enforce
`2210398208 + 33554432 + 25165824 + remaining` within the8MiB total cap.
Shared HEAD/index/config remain unchanged. JS syntax and diff checks pass.
An initial quoting typo in this new helper was fixed before successful
execution; no production change or cleanup retry was needed.
