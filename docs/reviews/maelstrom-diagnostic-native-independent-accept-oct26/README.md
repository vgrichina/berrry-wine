# Independent native evidence acceptance — 2026-10-26

**ACCEPT the supported controlled subset.** Publication
`7caee0b80b6645808e1e2bc2f246f48d6fdeb8f5` accurately qualifies 40 canonical
native cases for production candidate `44e344fdb26daab9a07210656597902ba27cb5f7`.
This is sufficient evidence to proceed with **one bounded original-game
diagnostic capture on the supported default dispatch route**, subject to its
separate runtime authorization, resource admission and lifecycle controls.
It establishes eligibility for observation, not an original-game result.
No new correctness blocker was found within this subset.

The failed supplemental `completion-code16-tail` route remains unqualified.
Its ready-select fixture never invoked the expected `socket_event` transition:
expected callback count 1, actual 0, process exit 1. The unchanged reproducer,
1024-byte stderr and expected/actual receipt are retained. This was already
disclosed by the publication; it neither establishes a production defect nor
qualifies diagnostic rejection reasons 1–3 or 5–9. No retry or repair occurred.

## Independent derivation

The pinned fixture bytes encode `MOV EBP,EAX; CALL EDI` at `0x7a3362`.
Successful select returns EAX=1 and pops six words from `0x7412000`, leaving
ESP=`0x7412018`. CALL EDI pushes `0x7a3366`, sets EBP=1 and enters
CRT `0x522000+0xc430`. Authentic `_errno` bytes
`e82274ffff83c008c3` call `0x522000+0x3857`, pushing CRT+`0xc435`.
The controlled provider returns thread data at `0x451000`; its nested RET
restores ESP=`0x7412014` and reaches CRT+`0xc435` without capturing errno.
ADD EAX,8 produces `0x451008`; outer C3 restores ESP=`0x7412018` and
PC=`0x7a3366`, before the CMP successor. The capture must then contain the
configured errno (0, 4 or 37), caller `0x40e12a`, socket set `0x4103000`,
timeout 1000, thread 1 and REGFILE `0x523c000`.

The verifier derives these values without loading the production transform,
fixture, compiler or Wasm. For successful cases it also constructs every recorded
normalized register, lazy-flag, stack/fd/timeval/thread-data word, counter, budget,
API/import delta and yield state. OFF and ON must match that independent model;
matching corruption of both lanes fails. This equivalence covers the recorded
fixture state, not all linear memory or unobserved execution.

## Coverage

| Evidence | Tail-call backend | Compat backend |
| --- | --- | --- |
| errno 0 / 4 / 37, full recorded OFF/ON equivalence | 3 accepted; errno4 reused | 3 accepted |
| wrong select return, diagnostic reason 4 | accepted | accepted |
| wrong native target / return PC / EBP | 3 rejected correctly | 3 rejected correctly |
| unsafe errno / unsafe caller / postframe / unowned RET / nested CALL | 5 rejected correctly | 5 rejected correctly |
| unsupported block / uop / code16 starts and stale start | 4 rejected correctly | 4 rejected correctly |
| foreign thread / register bank at CALL and outer RET | 4 leave owner capture unchanged | 4 leave owner capture unchanged |

Total: 6 successful captures, 26 rejecting controls, 8 foreign-owner inertness
controls; 40 records. Of these, 39 are newly published records and one is the
unchanged prior tail errno4 result from qualification parent
`606fa069a71920597a29764b27bd57b02fe7e5dd`. Its small native result, process
receipt, attempt and stdout are preserved under `prior/`; its checkpoint binding
is reconstructed explicitly from accepted candidate/fixture/module identities,
then checked against the independently derived expectations.

Retained module SHA-256 identities:

* tail: `aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1`
* compat: `85eaf35e803a55b18992ac6a717ba0fe937e92aa65e71d40f675a5ccec6fa3ab`

Both module identities, scenario/backend, capture/status, phase, return PC,
errno, initialized spans, owner progression and process receipts are checked.
Native stdout must agree with the stored result; attempt argv must agree with
the actual process argv. API failures, truncation, OOM, signal, missing receipts,
failed exits and unreaped/surviving processes reject.

All 80 remote supervisor receipts were inspected: 79 exit zero and exactly one
exits 1 for the disclosed supplemental fixture. All are reaped with empty
remaining groups and no supervisor guard reason. The reused local native
process is also reaped. Coordinator's unchanged 535-payload and earlier
455-payload zero-mismatch audits are reused; the final compressed archive
identity and canonical checkpoint raw payload hashes are independently bound.
This is evidence inspection, not a fresh runtime health check.

## Independent verification

The executable `test/maelstrom-diagnostic-native-independent-accept-oct26.cjs`
accepted all 40 supported records and rejected all **25 adversarial record
mutants**. They cover wrong module, backend, errno, return, phase, status,
missing/failed process receipt, failed API, unreaped/surviving process, incorrect
process case/attempt/output, inconsistent OFF/ON and paired corrupted memory,
span identity, lazy flags, executed CMP, premature nested-RET capture, wrong
rejection reason/return/phase and a falsely labelled wrong-return control.
No native compilation or instantiation occurred. Final verification ran with
256 MiB Node heap, 60-second CPU/wall limits, 131072-byte aggregate stdout/stderr,
2 MiB capture and 24 MiB file limits; exit zero, no stderr, about 0.06 seconds.

Reproduce using retained donor ops and this committed prior evidence directory:

```sh
mkdir -p /tmp/maelstrom-independent-recheck
node --max-old-space-size=256 test/maelstrom-diagnostic-native-independent-accept-oct26.cjs \
  /tmp/maelstrom-diagnostic-native-remaining-api-oct26/ops \
  docs/reviews/maelstrom-diagnostic-native-independent-accept-oct26/prior \
  /tmp/maelstrom-independent-recheck
```

For durable recovery, the first argument can instead be the prior publication's
`docs/reviews/maelstrom-diagnostic-native-remaining-api-oct26` directory restored
from exact revision `7caee0b8…`: it contains `remote-evidence.json.gz` and
`api-native-*.json`. No network/runtime access is needed for verification.
Use the task's retained `ops/supervise.py` recipe to reproduce the exact bounded
execution controls. `independent-tests.json`, group checkpoints and
`evidence-manifest.json` retain machine-readable results and hashes.

## Limits and ownership

UNKNOWN/unexecuted: diagnostic reasons 1–3 and 5–9, cap exhaustion, private stale
token mutation, owner resume after foreign hook, disabled getter-call inertness,
full original `_getptd`, loader-proven original CRT placement, original errno,
original caller and gameplay. Unsupported-start rejection does not qualify
completion-time mode rejection. The synthetic CRT mapping/provider is expressly
not original-loader evidence. A later original capture must report its actual
mapping and outcomes, including a noncapture/rejection if that is what occurs.
These unknowns are not additional acceptance requirements for this bounded
controlled subset.

No production source was reviewed again or changed. No box, native module,
original game, build, importer, main branch, donor refs/index or root tracked
files were touched. Exact Git SSH identity/strict known-hosts configuration and
the canonical parser's empty actual mount argv were validated in this task.
Root initial ref-digest receipt was reused as instructed. Enigma guest and
visual importer reviewer ownership were preserved; Claude stayed idle.
No test box was assigned, so state/expiry were not queried; the coordinator
retains lifecycle ownership of other lanes.

Resource admission counts new checkout/Git/evidence, own session/events, positive
shared DB/WAL growth and future allowances plus the 8 MiB reserve. Standing
readonly donors/modules/tools and preexisting WAL are identified separately.
Final-tests projection: 42,594,904 / 67,108,864 bytes, projected host free
3,893,632,424 bytes and projected cheap-test RAM 1,940,848,640 bytes; all gates
pass. Bootstrap excessive search/excerpt output incidents are retained in
`incidents.json`; no runtime denial, guard waiver or candidate failure occurred.
Task publication is isolated; no merge to main is authorized by this result.
