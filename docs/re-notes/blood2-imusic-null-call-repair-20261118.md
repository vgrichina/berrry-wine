# Blood II music NULL call: object lifetime narrowed, repair blocked

Run: `scratch/runs/20261118-blood2-imusic-null-call-repair/`.
This task did not repair Blood II or reach world/gameplay/Quit. No fresh
original was launched: the authorization was conditional on a published,
applicable repair, and the retained evidence does not establish one.

## Retained fault and module correspondence

The preceding original stopped at batch 112287 with previous EIP
`0x00cd1c61`, return address `0x00cd1c81`, and first argument
`0x00c189ec`. Pinned IMUSIC25.DLL RVA `0x1c7f` is `call *(%ebx)`.
This is QueryInterface on the interface obtained from `[this+0x28]+4`,
with requested IID at IMUSIC25 RVA `0x1c850`.

The IMUSIC mapping has several independent retained address correspondences:
DllMain `0x00cdff49` minus entry RVA `0xff49`, the return address minus
`0x1c81`, the IID argument `0x00cec850` minus `0x1c850`, and the two
`this` vtables `0x00cec030`/`0x00cec010` minus `0x1c030`/`0x1c010`
all give base `0x00cd0000`. This confirms the static/native fault-site
correspondence beyond the prior single-entry inference. No original live
DLL_TABLE dump was retained; that distinct proof remains unavailable.

The bad interface belongs to IMRT25's real-time object, rather than a
missing DirectMusic API implementation. IMRT25 DllMain `0x00d43ae8`
minus RVA `0x2ae8` gives base **`0x00d41000`**, not `0x00d40000`.
The bad object's secondary words `0x00d440e0` and `0x00d440b8` match
that module's secondary vtables at RVAs `0x30e0` and `0x30b8`.
Its constructor installs primary vtable RVA `0x30f8` and reference count
at +12. The fault has primary word zero and reference count zero.
Released/reused storage is a hypothesis, not a measured final Release or
invalidating store. The allocator may overwrite the first payload word
with its free-list link, so restoring that word would conceal the failure.

Earlier T2/T3 faults expose the same numeric interface pointer
`0x00c189ec`; their disassembly reads the engine's +4 field before
AddRef. This is shared pointer identity evidence. It does not show which
thread invalidated the object or establish a causal chain from either
worker's termination to the later main-thread failure.

## Focused actual native contract test

The run-local test uses the exact published `4808701de` frozen manifest:
1404 inventory rows, the unchanged 99 media pins (EXE plus 98 files), and
module SHA-256
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`.
It executes authentic, unmodified IMRT25 and IMUSIC25 guest code in the
native Node/Wasm interpreter with the existing sealed source view. It
does not execute Client.exe or run a game original.

Seven assertions passed: real-time allocation rejects NULL output;
IUnknown QueryInterface preserves identity and AddRefs; Release of a
retained object leaves its vtable live; unsupported QueryInterface returns
E_NOINTERFACE, clears output and preserves the count; the real IMUSIC
constructor and SetRealTime retain the real IMRT object; releasing the
producer's reference leaves the transferred object live; and QueryInterface
for the exact IID at the loading fault succeeds after that transfer.
The final retained reference count is 1.

This is a bounded constructor/ownership test. It does not run full engine
initialization, create the music guest Workers, load a level, or establish
thread-scheduling equivalence. It supplies no oldfail/newpass repair claim.
Initial harness errors (unsealed entry, omitted COM-thunk initialization,
and callback wrapper stack cleanup) were corrected in the authored harness;
they were not Blood II defects. The final native test uses the unchanged
durable launcher and native-supervise containment with independent finite
and disk watchdogs. Native and watchdog actual waits are 0, separate EOFs
are true, drain errors empty, and containment reports `leaked:false`.

## Concrete blocker and closure

The retained original lacks the write/free history of `0x00c189ec`, its
allocation header, and a live module table. Its passive observer kept API
counters and register getters, not the relevant AddRef/Release/free
arguments or memory writes. Its UNKNOWN scope is closed and was not
reopened. The focused ownership sequence passes on the old runtime.
Changing an API, pinning a reference, or patching a NULL call on this evidence
would be an unsupported workaround. There is no applicable repair to
publish, so the conditional fresh-original authorization remains unused.
The missing evidence is the first invalidating write or final release of
the real-time object during actual music initialization, with its native
caller and allocation/lifetime context. A Windows reference is not required
to interpret the observed standard COM ownership sequence; no Wine was used.

Only this report is committed. Runtime sources, tests, media, config,
input/identity/UNKNOWN guards and other workers' files are unchanged.
The selected retained level-card PNG was personally reviewed again; it
shows the loading card and supplies no world/gameplay claim. Evidence
records exact Git, relevant unapplied binary diffs, run-helper patches,
module/media identities, actual waits and cleanup. `result.json` is last.

No workers or boxes were created. Box ID null, state NOT_CREATED, expiry
null, stop receipt null. Ownership is released and this single task stops.
