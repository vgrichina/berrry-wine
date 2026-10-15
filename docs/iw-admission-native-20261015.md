# Native independent-send validation controller

Validation based on held production `9226756b3762edd5b175226f642f5d8e4de3af37`.
The final three-arm native fixture passes, as recorded below. Original Deus Ex:
Invisible War remains excluded; this does not authorize merging the held chain.

The fixture reuses the admitted PE assembler and endpoint setup, with an
optional supplied image. The new image imports real USER32 SendMessageA and
executes x86 WndProc callbacks in actual Workers. Native window registration
exports establish thread ownership and initial yield-7 parking. Two separate
512 MB process memories each hold a parked main Worker transport and two
callback Worker threads. Barriers delay transport;
they never replace an interpreter export or native SendMessageA result.

Assertions cover independent A/B chains entering real yield 10, restored
registers/ESP, round/serial local different-TID progress from ordinary code to
yield 17, early reply while another native callback is nested, same-TID Worker
replacement, stale window lifetime, and queued sender-link retirement. The
early reply case deliberately supplies transport replies 70 and 8 and checks
the x86 increment and unwind order; it is a protocol control, not a claim that
those replies came from a real remote WndProc.

The controller runs three serial arms: candidate succeeds, old cd5 broker
fails specifically at the retired-sender missing-rejection assertion, restored
candidate succeeds. Each arm has a 60-second internal guard and external
90-second timeout plus 5-second kill grace (total <=285 seconds). Unexpected
status stops further arms; final restoration and source/module/inventory
checks still run. It uses the existing canonical module SHA-256
`a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48`
at read-only `/home/user/wa-iw-native-validation/build/wine-assembly.wasm`.
There is no WAT source delta and no build is required.

Every physical host/src/lib file is checked against 922 or the exact cd5
broker control. Retained donor files are checked against a2fb032a; new runtime
paths absent from that baseline are not donor requirements. Tests/controller
are checked against their committed HEAD bytes. Evidence includes all hashes,
Node version, source commit, before/after process inventories, logs and status.

After root controller review and sole bx_9ef2wdsw grant, transfer incremental
Git objects through Boat exec/file APIs to a fresh checkout; never modify the
donor, use SSH/scp, build, launch a browser or run the original game. Command:

```
WA_ADMISSION_EVIDENCE=/home/user/iw-admission-native-evidence-UNIQUE node tools/run-admission-native-candidate.js
```

Require an independent final process inventory and physical source/module
hash check before releasing the lane. Recover and hash the evidence archive
through Boat APIs. Local checks at this checkpoint: both new scripts parse,
existing helper parses, whitespace check passes. Native assertions and actual
scheduler suitability were unproved at the initial source checkpoint.

## Retained attempts and revised transient observation

Attempt 1, PID 189995, source 33c4cf281, exited 1 at 15:21:52.534 UTC
before executing guest callbacks: the reused loader context had a local main
endpoint while production broker `callExport` requires a main Worker transport.
The correction creates a distinct actual slot-0 Worker and native thread 1,
and asserts callback threads 2/3 and the sibling's initial polling-loop EIP.
Independent 15:22:28.473 postflight verified 270 fixture/runtime/donor hashes,
canonical a948 and no active runtime process. Recovered `attempt1.tar.gz` is
54,028 bytes, SHA-256
`ec3230fc3b41052545c1398764a9cbdd82edd7ad7bb62717305e60df7546c695`.

Attempt 2, PID 194050, source f9bca2eac, exited 1 at 15:25:08.637 UTC.
Actual independent A/B x86 SendMessageA calls returned 43 and restored every
asserted register and ESP. The first actual local different-TID send also
returned 43, but the fixture's final yield snapshot was 15 rather than its
overly strict expected 17. No later scenarios or negative arms ran. Independent
15:25:42.104 postflight verified all 270 hashes, canonical a948 and no active
runtime processes, including the added main Workers. Recovered `attempt2.tar.gz`
is 54,183 bytes, SHA-256
`ac073beaa0089689733843f31f29404d0852e9278b017b8d2409140dda96a904`.
Both archives are in `scratch/runs/20261015-iw-admission-native/`, alongside
incremental bundles and API staging/postflight recipes.

Source inspection shows two timing issues with the final-yield assertion:
the ordinary scheduler can reach a legal message point before asynchronous
destination resolution publishes pending admission, and it can resume past
the transient 17 before a later export observation. The revised fixture delays
the first ordinary slice transport until the real native pending flag is
observed, then records actual returned Worker slice yields and requires a 17.
It never sets that flag or supplies the slice result. The final yield snapshot
is not an invariant of successful completion. This revised assertion is
source-only pending another root-reviewed runtime grant; the lane was released
for the Lords comparison. No production change or original-game verdict follows
from these two fixture failures.

## Final admitted validation

Root reviewed source `0a14f8455f1e950320ac45197d6092a6c1da72ec` and granted
the same bounded three arms after Lords PID 197137 completed and its owner
released the lane with independent 15:28:35.663 postflight. Fresh native
preflight at 15:31:00.931 found no active runtime process. Controller PID
199690 started 15:31:01.609 and exited 0 at 15:31:10.334, Node v24.18.1.

| Arm | Exit | Native test elapsed | Result |
| --- | --- | --- | --- |
| Candidate 922 production JS | 0 | 237 ms | All native assertions pass |
| cd5 broker control | 1 | 229 ms | Missing expected retired-sender rejection |
| Restored 922 production JS | 0 | 227 ms | All native assertions pass again |

Both positive logs report actual independent A/B x86 SendMessageA results
and full asserted register/ESP restoration; round and serial local different-TID
slices each return `[17]`; early outer reply waits for nested native callback
unwind; queued same-TID replacement and window lifetime controls reject;
retired sender link never enters the queued receiver. The old broker reaches
all preceding cases and fails precisely at `assert.rejects` for the retired
sender, demonstrating the regression is detected by real native endpoint work.

Every arm passed its before/after source/fixture/module checks and empty
process inventory. Independent 15:31:25.752 postflight reread all 270 recorded
candidate/fixture/donor hashes and canonical a948 and found `active: []`.
Root received the terminal, detailed results and explicit lane release then.
No module rebuild, browser, original game or public deployment occurred.

The verified archive is `/home/user/iw-admission-attempt3.tar.gz` remotely and
`scratch/runs/20261015-iw-admission-native/attempt3.tar.gz` locally, 123,320 bytes,
SHA-256 `272821f94a9137b4708f37d3548ed05713788b798c0e25699d1ad88cea7a0054`.
Its extracted copy in `attempt3-reviewed/` was inspected. The local sibling
files `source.bundle`, `correction.bundle`, and `attempt3.bundle` recreate the
exact tested source atop b5b69a714; `stage3.json` and `attempt3-terminal.json`
retain API receipts. The archive contains all three arm logs/statuses, physical
source snapshots, inventories, and independent postflight. The canonical binary
is deliberately retained at its original donor path instead of duplicated.

This closes the bounded native independent-send admission fixture. It does
not prove original-game progress, browser integration, pointer-message
marshalling, all lifecycle races, or the full held-chain merge decision. Earlier
native lifecycle/retirement proofs and tiny-ABI tests remain separate evidence;
this run did not rerun those suites.
