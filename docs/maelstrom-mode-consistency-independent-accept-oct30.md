# Maelstrom decoder consistency: independent acceptance, 2026-10-30

Accepted within the host decoder/adapter scope: candidate
`18f9f827f5a83885b90c8eb1489356ccf389a3d3`, whose actual
`tools/maelstrom-original-errno-adapter.cjs` SHA-256 is
`cbe04fef7e98c1ff607251812225b8314fc0aaff2c289331b95839cfe2df2b49`
(Git blob `3e8ba249fb31aece02341c046e5675df4cece1fa`).
No production source was changed by this acceptance.

The independent test imports the actual production decoder and createAdapter.
Its first behavioral check starts the adapter, supplies the exact OFF-latch/UOP-bit
contradiction, and requires the mode-switch diagnostic error before persistence.
It also verifies that an invalid snapshot seals the adapter. Export scalar inputs
are synthetic; the decoder and adapter are never replaced by a model.

Run from the repository:
```sh
/usr/bin/node --max-old-space-size=192 test/maelstrom-mode-consistency-independent-accept.test.cjs
```
Task execution used the owned ops.py/limit_contract.py supervisor with recorded
admission, Node startup limits, CPU/wall/file/output limits and physical RSS gates.
The heap flag is not a total-process memory limit.

New passing coverage:

- 24 valid direct decodes and 24 contradictory direct decodes: both switch
  directions, statuses 1/2/3 (events 0/1/2), and other packed bits 0/1/2/3.
- 24 valid adapter rejection records and 25 invalid adapter observations,
  including the first production-boundary check. Invalid diagnostics never
  reach persist; valid switch rejections persist and then raise status rejection.
- 37 partial-diagnostic checks: missing direct fields, missing/nonfunction
  export members, and mode exports without the base diagnostic family.
- 24 legacy checks: undefined/null optional decoder context, absent mode exports,
  and absent diagnostic families. Legacy contexts cannot establish bit/latched
  consistency and intentionally keep their additive compatibility behavior.
- Seven range/event checks. High unsigned PC/register values remain intact.

Three distinguishing controls mutate only the exact consistency predicate in an
in-memory copy of the actual production module; production files stay unchanged.
All exit 1:
```sh
/usr/bin/node --max-old-space-size=192 test/maelstrom-mode-consistency-independent-accept.test.cjs --control=remove
/usr/bin/node --max-old-space-size=192 test/maelstrom-mode-consistency-independent-accept.test.cjs --control=off-only
/usr/bin/node --max-old-space-size=192 test/maelstrom-mode-consistency-independent-accept.test.cjs --control=on-only
```
Removal and ON-only enforcement fail at the first adapter assertion: they emit
the generic native status rejection instead of the required mode-switch diagnostic
error, having accepted the malformed diagnostic into persistence. OFF-only
enforcement fails with Missing expected exception at the reverse-direction direct
decode (`from=1 status=1 other=0`). This distinguishes both halves of equality.

The first independent run reached a harness range-check assertion that expected
the later packed-range error even though its contradictory UOP bit correctly
triggered the earlier consistency guard. The range fixture now keeps bit/latch
agreement to isolate upper packed bits. The original failure is retained; this
was a test-input correction, not a production counterexample or repair.

Reused evidence, without wholesale replay: coordinator-reviewed canonical receipt
`/tmp/maelstrom-mode-diagnostic-consistency-repair-oct30/completion-receipt.json`
SHA-256 `5afda1acd302fa7a61fbb4ed92e25ec4db63ccbd48ff29c3c436b92d89330674`.
It binds the unchanged original counterexample, focused compiled native fixture
regression (6 switches, 24 contradictions, 4 adapter cases), repair-removal control,
recovered source pins, tested repair patch and remote repair publication.
The 13 materialized candidate files were independently checked against dispatch
byte/SHA-256 pins and exact candidate tree blob identities. The remote repair ref
was also freshly checked at the candidate SHA.

New raw invocation/output evidence, recovery patch, source pins and canonical
acceptance completion receipt are retained separately under:
`/tmp/maelstrom-mode-consistency-repair-independent-accept-oct30/`.
See `completion-receipt.json` there for exact acceptance commit/ref and remote
verification. The task-owned messageboard note is handed to the coordinator for
one append because the standing board exceeds the worker file-size cap.

Full production WAT transformation, full build/binary qualification, guest
execution, original-game runtime and gameplay remain UNQUALIFIED. No Boat was
allocated or used; no mount argv or guest launch exists to validate. The original
causal instruction remains UNKNOWN. This acceptance does not integrate main or
authorize deployment.
