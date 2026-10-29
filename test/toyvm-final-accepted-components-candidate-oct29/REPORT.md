# Tested accepted-component composition candidate

Base: `389745e7ea964cd0537d45ec376c6bb3f5e7686f`.
Result: **PASS_TESTED_SOURCE_COMPOSITION_CANDIDATE**. This is not independent
acceptance of the final combined pair and does not qualify runtime execution.

Production changes are limited to the exact 4,241-byte accepted adapter donor
(`e45f6f6d1eaf24a06e92ffe2521ee4026fcc1cdccf22a15be4c7e99911424acb`)
and one caller BACKEND_PINS literal from
`5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf`
to that donor SHA. No handwritten adapter rewrite occurred.
Caller SHA changes from `bcc2ea9b51d3f4857b0fa9fd7ee67dee506c14e52ac07ae5eb5211058c981470`
to `fd87f1a4c211d70daf60b2b201cf2f7b3665b1dc7b631de66baa263c491cac77`.
The backend remains `75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822`;
confine and pinned supervisor are byte-identical. Full five-file pins are recorded
before and after in provenance.json and results.json.

The focused composition.py test passed donor equality, exact sole caller delta,
three unchanged files, and actual caller.load_backend on the final five files.
The returned function's compiled code, filename, module origin, complete globals
key set, imported module identities, owned globals and supervisor pin match the
accepted adapter. Altered adapter/backend/supervisor bytes are rejected at the
caller boundary before any of those sources execute. The original stale caller
pin rejects the migrated adapter as a distinguishing control. Trace and audit
guards recorded zero adapter invocations, subprocess/exec/fork/socket attempts.

Independent evidence was verified before migration and retained without replay:
the canonical pair acceptance at base389745e7 (41 caller checks / 52 backend
operations); adapter acceptance `513f22d8db9fc9b7d65d0c224b25d6439268b9e8`;
and exact seven-guard production-wire receipt
`c2352606f65b6d7aa51d036f524b87f378620301`. Copies of all three receipts,
the accepted adapter and baseline caller make the provenance reviewable.
Pair test artifact hashes were verified against the canonical pair receipt;
no predecessor oracle, supervisor or component suite was executed.

Retained evidence keeps its original scope. The historical wire receipt covers
its b8201b2c backend, 83 local serve requests and seven-request control. The final
backend is the separately accepted 75842ffa combined namespace/selector backend.
This source composition does not claim a fresh wire acceptance for their pairing.
An optional historical Git source read found that the wire commit does not
contain that production path; its exit128 evidence is preserved, with no retry,
fetch or alternate expansion. This did not affect supplied receipt verification.

Validation used /usr/bin/python3 through the exact dispatched ops.py and limits.
See focused-operation.json for actual admission and inherited limits. No Node,
guest, adapter invocation, mount, kernel, CLI, browser, Boat, shared main or public
deployment was used. No test box is assigned; lifecycle ownership remains with
the coordinator. Independent final composition acceptance and mounted/kernel,
CLI/browser/guest and broader resource qualification remain separate gates.
