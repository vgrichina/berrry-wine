# Native independent-send validation controller

Source-only checkpoint based on held production `9226756b3762edd5b175226f642f5d8e4de3af37`.
No runtime has been executed. Original Deus Ex: Invisible War remains excluded.

The fixture reuses the admitted PE assembler and endpoint setup, with an
optional supplied image. The new image imports real USER32 SendMessageA and
executes x86 WndProc callbacks in actual Workers. Native window registration
exports establish thread ownership and initial yield-7 parking. Two separate
512 MB process memories each hold two Worker threads. Barriers delay transport;
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
scheduler suitability remain unproved until the granted execution.
