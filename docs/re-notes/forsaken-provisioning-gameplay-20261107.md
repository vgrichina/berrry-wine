# Forsaken serial provisioning and startup guard, 7 November 2026

Serial uploads successfully provisioned all **1,490 unchanged pins**, including
**873 original Forsaken fixture paths**, on one fresh box. The previous nine
parallel upload-URL HTTP 500 responses did not recur. Original gameplay beyond
the accepted Volcano corridor/death/respawn remains unproved: the first ordinary
input was refused when the live render endpoint changed after the reviewed
startup capture. No emulator mismatch or production change was established.

Evidence: `scratch/runs/20261107-forsaken-provisioning-gameplay/`.
Candidate: `forsaken-demo`.

## Provisioning diagnosis and successful workaround

Read the sandbox skill, recovery note and current WebGL combat note. The
installed CLI is `boat`; `boat-dev` is absent. CLI help confirms the supported
SCP/SSH transfer route. On the fresh box, the SSH prerequisite returned
**403 `api_key_action_forbidden`: "This API key cannot perform ssh."** No remote
mkdir ran and no SCP request was attempted. That permission refusal was not
bypassed.

The existing authorized upload-URL route was then used strictly serially, with
one POST/PUT pair completed before the next file. `serial-ledger.jsonl` records
all 1,490 successful transfers; `serial-upload.log` and `provisioned.json`
preserve completion. Remote verification before the one original launch and
the terminal census both match all hashes. This demonstrates a serial workaround
for this attempt. It does **not** establish the server-side root cause of the
earlier parallel HTTP 500 responses. Those remain infrastructure failures,
not emulator failures. The prior archived `bx_ckvbfva4` was never resumed.

Initial free space was 1,909,854,208 bytes; allocation waited until the unchanged
2,000,000,000-byte floor passed. Coordinator cleanup restored headroom; this
worker did not clean peer evidence. Allocation and each serial transfer checked
the floor. No RAM gate, source/media archive or duplicate media staging occurred.

## Qualified closure and one original runtime

All 1,490 retained pins matched before allocation, so the previously passing
actual Chromium closure, 28 release controls and identity/ACK/deadline controls
were reused without repetition. `runtime-pins.json`, `fixture-identity.json`
and `preflight.json` retain the exact identities. The qualified source remains
`1f831717cd0dec63265ff0cde43eec4d81c8da9f` plus its recorded untracked
`lib/wininit-boot.js` patch; the current checkout SHA and relevant diff are also
recorded. Git supplies source recovery, not a tree snapshot.

A UUID was persisted before creation of **bx_36ztfqcm** at
**11:42:54.331Z**, TTL **2,400 seconds**, original expiry **12:22:54.197Z**.
The browser deadline was fixed before allocation at **12:07:53.980Z** and never
extended. After provisioning, one original browser launched at **11:56:26Z**.
The executing guest module recovered through CDP is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`, matching
the qualified module. No original WebGL gameplay or rendered-frame claim follows
from this startup-only attempt.

## Reviewed startup and concrete terminal blocker

`review/startup.png` was personally inspected: readable original copyright and
demo licensing text on black. Its capture at **11:56:38.457Z** bound the actual
guest identity with render endpoint **`none`**. Before Enter admission at
**11:57:07.146Z**, ordinary startup had created render endpoint **1**. The
unchanged identity guard rejected **`1 !== 'none'`** before native dispatch.
`retrieved/first-browser-failure.json`, `first-failure.json`, the numbered command
and sticky `transport-closed.json` retain the exact boundary. There is no exact
success ACK for Enter. It was never replayed, and the guard was not relaxed.

The runtime closed on this first fault; Chrome exited **0**. The saved native
event list is empty and no input pulse was created. Thus the independent-UP
input implementation was retained but no DOWN/UP pulse ran on the original.
One subsequent read-only capture retrieval found the unchanged startup name and
refused to overwrite its existing local file; that local retrieval error is
recorded separately and is not a guest fault.

Next attempt: preserve this serial transfer route, observe startup passively
until the live renderer exists, then take and review a fresh owning capture
before ordinary input. Do not replay this closed command, relaunch this runtime,
resume either archived box or weaken identity/ACK/deadline admission. A new room,
damage, enemy defeat or objective through ordinary controls remains the target.

## Recovery and delegated shutdown

**27 unique runtime artifacts, 2,416,507 bytes**, including the live module,
were retrieved and SHA-256 verified before the explicitly delegated normal
nonforced stop. `terminal-clearance.json` confirms both recorded process IDs
absent, no owned runtime processes, both ports closed, profile and writer absent,
no native input events, and all 1,490 pins unchanged. No held input was created.

Stop completed **11:58:07.686Z**, **forced:false**. The CLI reports state
**stopped**, retained snapshot verified, active expiry **null**. This is the
archived terminal box; there is no running assigned box to hand back.

No guest code/config/save/clock/memory edits, replacement DLLs, emulator fix,
full build, FPS/audio/parity claim or new gameplay consequence. Documentation
only is published; run artifacts remain ignored, with `result.json` written last.
