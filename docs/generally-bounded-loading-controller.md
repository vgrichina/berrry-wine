# GeneRally loading dispatch: bounded controller

This repairs controller dispatch, not the guest. Loading success, gameplay, FPS
and ordinary Quit remain unknown. No guest, compiled module, build or emulator
initialization is needed for the tests below.

The retained failed request was `{"action":"step","n":100000,"id":12}` after
inspected Player / Agari / Start. The original caller stopped at 38 seconds and
the bridge waited 40 seconds. No exact completion ACK arrived. That request is
uncertain: do not replay it, clear its cursor, reuse its mailbox, or issue input.
Canonical retained receipt SHA-256:
`931290508de71df0dd3fd9cc6402286ed152c50cbc004bb27a7aadf2801cbdd8`.

`tools/generally-loading-controller.py` uses the actual frozen stdin protocol in
`test/run.js` at source `1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`. It first
requires a live frozen-zero snapshot. Each chunk is at most 1000 batches and has
one exact-ID positive ACK: `ran == steps == n`, `frozen == true`, and the expected
batch. A new matching snapshot must confirm zero credits before another chunk,
capture or input. The sum is exactly the requested total, including a final
partial chunk. Completion progress is written to stderr only after both ACKs.

The cursor is persisted before dispatch. A pending or failed cursor refuses all
later requests, including after a new controller process starts. A locked cursor
has one writer. IDs increase once per request; no request is retried. The original
38-second caller allowance is the maximum per request, below the unchanged
40-second bridge allowance. One monotonic deadline covers the whole operation;
it is never renewed per chunk. A timeout, bad ACK, changed consumed mailbox ACK,
guest EOF/terminal, invalid frozen snapshot or global deadline poisons the lane.

## Replacing the oversized call in a future accepted runtime recipe

This is a recipe, not permission to execute it. Independent source acceptance,
fresh admission, a live assigned box, a full staging/capture/time plan, exact
filename-bearing canonical mount parsing, and coordinator lifecycle ownership
are prerequisites. The old box and old uncertain request must remain untouched.
Reuse the retained passed modules under their verified hashes; do not rebuild.

Keep `remote-v7.py`'s serial bridge and its 40-second allowance unchanged. In a
**fresh** accepted session, after the ordinarily dispatched and inspected
Player / Agari / Start sequence, replace the old call:

```sh
python3 -B ctl.py request '{"action":"step","n":100000}'
```

with the following command **on the newly assigned runtime host**, using
explicitly staged and verified helper and paths, not assumed former Boat paths:

```sh
python3 -B /ASSIGNED/source/tools/generally-loading-controller.py \
  --mailbox /ASSIGNED/session/ops \
  --state /ASSIGNED/session/ops/control-cursor.json \
  --receipt /ASSIGNED/session/ops/bounded-loading.json \
  --total 100000 --chunk 1000 --timeout-seconds 38 \
  --deadline-seconds "$remaining_original_session_seconds" \
  > /ASSIGNED/session/ops/bounded-loading.stdout \
  2> /ASSIGNED/session/ops/bounded-loading.stderr
```

`--mailbox` uses the unchanged `requests/NNNN.json` and `replies/NNNN.json`
envelopes of `remote-v7.py`. It checks both the bound request and exact reply ID.
Retained `ctl.py` maintained its cursor on the caller host, not necessarily the
runtime host: transfer the verified **fresh-session** cursor once, after its last
positive ACK, with `pending:false` and the exact next ID (12 only if requests
1..11 actually completed). Never synthesize/reset a cursor to fit this example.
Stop the old caller from writing after this explicit ownership transfer. Archive
both cursors. If the existing cursor is uncertain, refuse the transfer.

Compute `remaining_original_session_seconds` from the authoritative session
cutoff, after staging, queue waits and inspection; never from a new session
budget. The command needs an admitted supervisor/API envelope covering that
remaining interval, distinct stderr/stdout, output caps and descendant cleanup.
Do not hide a long controller behind the old caller's single 42-second API
request, detach it without a completion owner, or extend/reset a watchdog.
The bridge still waits at most 40 seconds for each individual request.

The default command sends no capture or input. Only after successful exit and
inspection of the last frozen-zero receipt may the new single owner continue
the separately authorized runtime plan, carrying forward the resulting cursor.
Alternatively, explicit `--after` JSON can authorize `png` / `input-message`
commands within the **same** global allowance. An input-message ACK means queued,
not executed. The controller does not infer loading success from batch counts.

## Targeted non-game tests

The fixture verifies the complete pinned runner SHA-256, extracts its exact
control closure and stdin adapter without transformations, and executes them.
Only observation dependencies and batch cost are stubbed. It executes the real
step waiter, credits, completion accounting, snapshots and ACK serialization;
it never fabricates a positive step completion. Fault modes mutate or withhold
that boundary's output. No compiled module is loaded. The oversized original
request reproduces ACK absence under an explicitly scaled 0.12-second allowance;
this is not a new 40-second guest runtime result.

Use the installed startup-qualified Node executable with
`--max-old-space-size=512`, no AS/DATA cap, and aggregate RSS/CPU/wall/output
supervision. Run each operation through the shared one-permit execution pool:

```sh
python3 -B test/test-generally-loading-controller.py --group repro --evidence /OWNED/repro
python3 -B test/test-generally-loading-controller.py --group acceptance --evidence /OWNED/acceptance
python3 -B test/test-generally-loading-controller.py --group hardening --evidence /OWNED/hardening
```

Use sibling fresh evidence directories. Hardening reuses the completed acceptance
traces to check one outstanding request, frozen-zero at every dispatch, and
restart rejection for every poisoned cursor; it does not replay accepted steps.
Passing groups cover mailbox and stdio entry paths, exact total 100000 and a
nonmultiple total 2501, delayed/missing/duplicate/wrong-ID/negative ACKs, wrong
counts/batches/frozen state, nonzero credits, quit/EOF, deadline exhaustion and
the historical uncertain request12. Cleanup receipts identify all child exits.

The retained final acceptance run includes one safe refusal in the nominal
100000 case under an artificial 0.5-second ACK allowance. The fixture recorded
snapshot20's ACK, but the controller did not receive it within that allowance;
it persisted uncertainty and cleaned up without replay. Only that positive
case was repeated after correcting the test to use the real 38-second response
allowance and a single 20-second synthetic global allowance; it passed. No user
CPU/wall/RSS/file/output guard was exhausted or expanded. Both results and exact
driver versions are retained; `acceptance-reconciliation.json` selects the
current-source coverage without discarding the first failure. The optional
`--group total` runs only this positive case.
