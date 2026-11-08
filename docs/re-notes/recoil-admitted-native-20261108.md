# Recoil admitted native phase measurements, 2026-11-08

Run: `scratch/runs/20261108-recoil-admitted-native/`.

**First new tested generic integration repair: require exact reviewed screenshot
coordinates for unlocked native clicks.** Actual before/after pixels prove the
inherited Software click missed its radio: `(0.258,0.514)` mapped to
`(186.472,452.98)`, outside the radio at `(196,457)`. The accelerator radio
remained selected. The native route therefore did **not** satisfy the requested
Software selection. This defect was discovered during final pixel review;
earlier run commentary incorrectly called it Software and is superseded here.

`reviewed-point.cjs` derives input from the exact current reviewed PNG, hotspot,
target rectangle and captured canvas geometry. The browser driver now requires
this witness for unlocked clicks and checks live geometry before sending input.
The actual native captures reproduce the old miss; the corrected mapping reaches
`(196,457)` at normalized `(0.2719298246,0.5210526316)`. Ten negatives reject
missing/stale witnesses, target misses, ambiguous normalized points, changed
geometry, invalid dimensions/bounds and changed PNG bytes. These focused tests
use retained native captures, no new browser, game or custody fixture. The
repaired **850-pin** closure passes provider and local hermetic checks, and its
startup contract explicitly requires the new helper. It was not uploaded or
native-tested. The actual **849-pin** attempted manifest is preserved separately
as `actual-position-runtime-pins.json` and in recovered immutable evidence.

The single Resume gate obtained only one fresh active HUD candidate before its
immutable deadline. M was never dispatched; no reviewed movement followed.
The requested gameplay goal remains incomplete. No new production repair is
claimed. This run also supplies new native phase evidence and native validation
of the previously accepted capture-boundary repair.

The repaired startup closure successfully launched Chrome. All **849 selected
provider pins** passed local checks; the full physical upload passed remote
admission before the request was written, and again before atomic consumption.
`launch-position.py`, the repaired admission/contract and parent custodian were
present. The attempted remote closure from the previous failure was not used.
The five accepted actual custodian integration controls, including changed and
missing pins and the detached-child stop/lock/drain case, were hash-verified and
reused. No new custody fixture or original retry was run.

The actual native route retained the default accelerator, `user`, and Medium. Separate captures
show loading, scripted arrival, active health100/timer00:00:01, and the native
In Game menu after an independently released **502 ms** Escape. The exact current
Resume PNG was personally reviewed before clicking: SHA-256
`727ac1fd5cdb847583c4730c82aa1772791462941a5a7e623e6189ed065883f4`,
1024x768, visible guest hotspot `(459,249)` inside `(380,247)-(504,279)`.
Initial title-bar and Start-edge clicks had no activation; their captures and
subsequent reviewed coordinate corrections are retained.

The one Resume/M500 transaction retained gate4500, four complete uncached
guest/render module responses per HUD probe, exact instances/epochs,
`Promise.allSettled`, final co-located owner/pixels, 250 ms freshness, the changed
timer pair, independent releases and no replay. No observer was disabled.

The first active HUD candidate was captured at **12:45:26.354Z**, showing
health100/timer00:00:03. Its final evaluation took **333.704 ms**, split into
**269 ms request-to-entry**, **0.185 ms owner work**, **50.905 ms PNG work**, and
**13 ms exit-to-response**. The same-host pre-snapshot boundary made its checked
age **82 ms**, correctly fresh despite the request's 334 ms round trip. This
classifies this new native sample; the old 301/318 ms samples remain unknown.
The phase sink was persistent and fsynced. Owned Node/Chrome PID/start identities,
boot, network namespace, profile and the Chrome-owned loopback listener were
independently verified before the Resume measurement.

The full two-read probe took **2792.528 ms**, including read68/read69 at
1688.450/1103.236 ms. Worker identity evaluations took 1068.953/1244.981 ms in
read68 and 515.440/625.864 ms in read69; byte transport was approximately
94-107 ms per response in those reads. These observations locate substantial
delay outside PNG encoding; they do not identify its deeper scheduling cause.
The next probe took **2031.441 ms** and completed after the independent gate
Escape had restored MENU. There was no second fresh changed-timer candidate,
`gateQualified=false`, `attempted=[]`, and no M/C/arrows/fire DOWN. A single
fresh candidate is insufficient. No threshold or deadline was relaxed.

Remote startup and runtime remained under the parent-owned remote lock; no
local heavy runtime lock was held. Before delegated normal shutdown, **404
artifact references / 283,598,772 bytes / 345 unique hashes** were retrieved and
independently reread. All **28** recorded parent/descendant/custody identities
were absent, the remote lock was independently free, both ports were closed,
and profile/writer/held-input state was drained. The seven-key observer release
record is retained. Initial premature startup retrieval and missing local
collector-helper failures are retained; the accepted collector helper was
restored without runtime replay. The first local point test was refused by the
hermetic loader because its test entry was not declared; the explicit local
test manifest fixes that refusal and the focused test passes.

Final box **`bx_2y99hk7g`: archived, expiry null**. Stop
**`stop_e72f230e4919cf59`** completed **12:46:54.340Z**, forced=false/error=null.
Normal/watchdog processes exited0 and their supervisor recorded no children.
The independent watchdog was observable before creation; its immutable deadline
was 13:01:29.239Z and box expiry was 13:02:29.407Z. No old box was resumed or
deleted, no deployment or subworker occurred, and launch disk exceeded5GB.

Recovery records the exact checkout SHA, selected source Git
`49874a81c5ae180c20a15c6bb169d9041f028cae`, relevant inherited binary diffs,
small owned helper patches, and existing media paths/hashes. No source/media
archive or peer WIP was included. Only this note is committed; production code
was unchanged. Next work is to use the tested coordinate witness, visibly verify
Software selection, and retain analysis of the worker-evaluation entry delays
before any separately authorized fresh native run. The accelerator-route
measurements cannot qualify the requested Software route. Qualified M consequence
and reviewed movement remain open, as do full27,
parity, audio and FPS.
