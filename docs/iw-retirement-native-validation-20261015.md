# Canonical native retirement validation

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

## Granted execution and retained result

Root granted the sole bx_9ef2wdsw lane after ArmyMen Next controller 158653
exited and its independent 14:29:11.885 postflight found no survivors. Fresh
14:31:06.956 inventory was also empty. The existing scoped endpoint repository
supplied objects for a new `/home/user/wa-iw-retirement-native` checkout;
14 KB of new Git objects were transferred through Boat exec. No donor writes,
SSH, scp, build, browser or original game execution occurred.

The first controller, PID 160449, exited 1 at 14:32:32.143 before any native
arm: Node's default 1 MiB git-output buffer could not hold the generated
dispatch table. Its evidence directory contains only preflight and independent
postflight, plus the preserved error log. The independent 14:33:15.350 check
verified all 265 src/lib candidate and donor files, physical canonical a948,
and empty process inventory. Root approved the narrow 16 MiB bounded-buffer
correction and a fresh three-arm grant. The controller also recognizes Node's
actual `MainThread` process name in inventories.

Final source f45888186d9e205a8896226f33b612d5baad3850, Node v24.18.1,
PID 162304 ran at 14:33:54.956 and exited 0 at 14:34:03.929 UTC:

| Arm | Status | Elapsed | Result |
| --- | --- | --- | --- |
| Positive | 0 | 824 ms | Native timeout and generation-pin cases pass |
| Original 4050bacb production JS | 1 | 349 ms | `AssertionError: scheduler drop retains failed owner` |
| Restored | 0 | 800 ms | Both native cases pass again |

Each arm passed its before/after physical source and canonical checks. At
14:34:24.368 a separate postflight re-read all 265 physical candidate/donor
files and canonical a948 against the recorded hashes, and found no active
Node/guest/build/browser process. The runtime lane was released to root then.
The positive fixture observes actual guest_map_free and Worker.terminate once
each, after receipt and delayed termination complete. It does not claim
retirement during executing DllMain or ordinary simultaneous scheduler slices;
the slice transport failure is intentionally injected after native lookup.

Evidence is retained remotely as
`/home/user/iw-retirement-native-evidence.tar.gz` and recovered locally at
`scratch/runs/20261015-iw-retirement-native/evidence.tar.gz`: 155,310 bytes,
SHA-256 `22140338c794795536c124019079412943316e4a879b24014b4d51ea763f04fe`.
Extract into a new directory with tar. The archive preserves both attempts,
source/donor snapshot sets, statuses/logs, independent postflights, exact
incremental Git bundles and controller. Recreate from the prior a2fb032a object
store and apply the two bundles in order; the canonical binary stays at the
read-only donor path rather than being duplicated in this archive.
