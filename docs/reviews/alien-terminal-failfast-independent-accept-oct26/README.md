# Independent Alien controller acceptance: REJECT

Exact candidate `f4455d87f011890622b76c846e342492b2bdcfda`, tree
`d4d5c1a7b95e93fe2a093a4b02bf40764ee5c8e3`, branch
`task/alien-controller-terminal-failfast-repair-oct26`, base
`ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd`. Trusted Git verifies the
remote ref, tree and tested source blob identities (`source-wiring.json`).

The production entry sends a PNG after a supervisor terminal receipt has become
durable. `Controller.run` checks the terminal file, then fsyncs the uncertain
intent, then calls transport without another check. The reproducer hooks only
`os.fsync`: after the genuine pending-PNG directory fsync, it publishes and
fsyncs the external terminal receipt before returning. No production source,
HTTP transport or runner is substituted. This deterministically models a
supervisor scheduled during that filesystem boundary.

Observed real HTTP sends: snapshot, **PNG**. Expected: snapshot only. The actual
tracked CLI main returns failure only on the following iteration. Ledger next=2
records PNG success; terminalObserved batch4650, returncode0. Restart sends zero.
No guest, PNG generation, browser, Wasm, compile or Boat operation runs: the
real unchanged control server uses an injected callback returning production
response shapes. The defect is controller dispatch, regardless of whether an
ended guest would service that extra request. See `dispatch-boundary-receipt.json`
and the original failing assertion in `dispatch-boundary-output.log`.

The new focused test is `test/alien-terminal-failfast-independent-accept-oct26.py`.
Under the retained pool/supervisor recipe run modes `historical`, `early-terminal`,
`dispatch-boundary`, `omit-terminal-check`. The last two intentionally retain
assertion failures and return success only when the oracle rejects. The omission
control removes the loaded terminal-check method, leaving disk source untouched;
the same early-terminal zero-send assertion fails, proving oracle sensitivity.

First behavioral group was the unchanged historical reproducer through actual CLI
subprocess, real HTTP and ledger: snapshot4650, uncertain step256, no later sends
or restart replay. Terminal4754 is partial progress, never a completion ACK.
Early-terminal and relevant CLI default refusal pass. Existing 11 tests/120
failure combinations/four omissions are reused after all retained manifest hashes
and sizes match; they are not rerun wholesale. Default-off receipt is reused only
after exact runner/hook hash and candidate Git blob verification. No duplicate
renderer/schedule/default-off acceptance. Eval null compatibility is unchanged;
input ACK is queued input, never gameplay.

Stop at this counterexample. No broad suite loop, repair or integration occurred.
Independent concurrent-lock/crash-window exhaustive qualification was not completed:
`review.json` distinguishes observed fsync/restart behavior and retained author
evidence from new concurrency guarantees. Sampling limits and measured resources
are in execution/admission receipts. Original incidents remain in the inherited
`docs/reviews/alien-controller-terminal-failfast-repair-oct26` manifest, including
physical-memory failures, WAL correction and exhausted historical guest failure.

All tests use one of two128MiB execution permits; Git uses both permits and mutex,
256MiB physical and512MiB DATA only on Git child processes. CPU90/wall120/file24MiB/
output2MiB/excerpt8192 unchanged. Node24.18.1 heap64 startup succeeds with DATA/AS
unlimited. Recheck allocation/admission before publication. No enforced limit raised.

Publish rejection evidence on own task branch only. A separate owner must repair
source, obtain independent exact-tree acceptance and then source integration.
Fresh guest gates require separate authorization, new invocation and complete
resource/readiness/lifecycle admission; no historical allowance reset. No assigned
test box or lifecycle action. Enigma/GL ownership and root worktree unchanged;
coordinator owns shutdown. Claude remains idle and HeroesII remains laptop-owned.

Packaging initially rejected a mismatched optional standing runner read and an ordinary
commit with missing inherited evidence blobs. Both stopped before publication;
exact input-map recovery and the retained selective-tree Git recipe resolved them.
See `packaging-incident.json`; no missing blobs were broadly recovered.
