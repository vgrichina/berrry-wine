# Canonical native retirement validation — source prepared

Base b5b69a7141ed4f7a98a70de302cef9f895da30c5. No runtime execution is
authorized by this note. Root review and an explicit sole-lane grant after the
queued ArmyMen child replay are required before any remote action.

The new candidate test reuses the admitted synthetic PE endpoint fixture.
Both cases allocate actual native stacks and use real x86 WndProc →
LoadLibraryA callbacks. The pin case first executes outer and nested DllMain
to LIVE, then requests an absent module so native lookup pins those providers.
It changes the captured provider generation to make real cleanup fail, and
restores it for the retry. The other case drops retirement replies after the
actual operation. A slice transport fault drives production scheduler exit
and drop. Both assert retained host ownership, reserved tid and stack, repeated
shutdown failure, receipt-only reservation during delayed Worker termination,
then exactly one actual guest_map_free and one actual Worker.terminate.
The free observer forwards to the real canonical export.

The controller runs exactly three serial bounded arms, stopping at any
unexpected result: positive 0, old production JS control 1 specifically at
`scheduler drop retains failed owner`, restored positive 0. The control restores
both changed runtime files from 4050bacb; finally restores physical candidate
bytes even after failure. Each arm has timeout 90s plus 5s kill grace; the test
also has a 60s watchdog. Total arms budget ≤285s plus preparation/cleanup.

After grant, transfer a Git bundle using Boat exec/file APIs into a fresh
checkout on bx_9ef2wdsw, never the donor. No SSH, scp, new boxes, build,
browser, original game or public deployment. The exact execution command is:

```
WA_RETIREMENT_EVIDENCE=/home/user/iw-retirement-native-evidence-UNIQUE node tools/run-retirement-native-candidate.js
```

The controller checks every physical src/lib file against the committed
candidate or exact old control, the donor against native endpoint a2fb032a,
and the physical wasm against canonical a948 before/after every arm. Only
guest-thread-host.js and thread-manager.js differ between a2fb032a and b5b69a.
It retains process inventories, source hashes, module hash, Node version,
source commit, statuses and logs including failures. Node/guest processes must
be absent at preflight and after each arm. Parent must independently inventory
and confirm final source/module hashes before lane release; investigate and
terminate only owned survivors if any are found. Preserve failed evidence
before changing source. Archive and hash evidence through Boat APIs.

Local source checks: Node syntax and diff whitespace. The sparse checkout
cannot run the live-tree tier completeness test because unrelated explicit
test entries are absent; the new `-candidate` name is classified e2e by the
existing convention. No local native execution or full build occurred.

This is not original Invisible War execution or compatibility evidence.
Independent-chain broker deadlock remains held and separate.
