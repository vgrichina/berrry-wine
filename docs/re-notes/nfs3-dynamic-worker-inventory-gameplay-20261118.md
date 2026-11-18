# NFS3 dynamic normal Worker inventory, 2026-11-18

The previous original closed before input because the harness queried historical
CDP sessions, including a normally returned Worker. Its cleanup could mask the
first request failure; an unreached assertion also expected the authored
fixture's three modules. This is a preparation defect, not an emulator diagnosis.
See `nfs3-normal-worker-scheduling-gameplay-20261118.md` and published
`994aa3a20`/`e20e01667` for those unchanged measurements.

`tools/nfs3-worker-inventory.cjs` inventories actual current main, auxiliary,
starting and retiring owners and the actual render manager. A harness-only
Worker constructor observer tags initialization messages with a unique actor
incarnation. A Worker message listener publishes that tag through an ordinary
console event, binding each CDP session to its actual actor. This changes no
native module, guest memory, clock, input, bindings, scheduling or debug dispatch.
It does add bounded initialization observation; neutrality is not claimed.

The page observer compares actual Worker/module/memory identities and records
backend, process, link, manager, visible window and endpoint generations. Module
inventory recovers actual Wasm bytes using CDP only for current owners, checks
their SHA256, then checks the entire owner snapshot again. It never substitutes
an import count or a claimed module hash for byte recovery. A conclusively
terminated nonowner retains lifecycle provenance and explicitly null retired
byte identity. An unexplained nonowner, unexpected disconnect, retired required
owner, changed generation or byte mismatch closes UNKNOWN. The first failing
request is retained; no cleanup endpoint request follows that UNKNOWN.

The focused test runs an actual native Worker with a native Wasm return of 127
and exit 0, then actual Chrome Workers with native Wasm instances. The old
closed-session inventory fails. The corrected inventory accepts a transient
retirement (two to one active owners), followed by a new incarnation reusing the
same slot and endpoint (one to two). It rejects wrong module bytes, replaced
module identity, wrong endpoint, retired required owner, changed window and an
actual unexpected Worker close. The first-error control confirms no later
Debugger.disable request. The test reads no retained run artifacts.

Evidence: `scratch/runs/20261118-nfs3-dynamic-worker-inventory-gameplay/`.
The exact pressure off/on 120-second/60-frame/pixel proofs, passive 16-field
native reader and legacy input/native 127ms/independent-UP proofs are reused
unchanged with hash references, not rerun as new findings. Original preparation
pins frozen c9, module 7d347, the same 135 media files and genuine chooser,
published 994 binder, unchanged passive sampler, and only the tested inventory
observation additions. The 500ms/15-second/independent-UP/operation and native
identity guards remain unchanged. Preparation was published as `2ae95831c`
after focused tests and the locked build, before the authorized fresh original.

## Fresh original and remaining blocker

Dynamic inventory passed on the actual game: seven current guest Workers
(slots 0, 1, 3, 4, 5, 6, 7) and one render Worker yielded actual bytes with
SHA256 `7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`.
The returned slot-2 endpoint-3 incarnation remains in provenance with null
retired byte identity; it was never queried to meet a fixture count. The actual
console confirms ThreadProc return followed by native thread-ID reuse in
slot 5. Actor tags, live references and the before/after inventory snapshots
agreed. This is stronger game-route coverage than the authored fixture's
deliberately constructed owner map; that fixture is not a Windows reference.

Three whole frames were personally inspected. Initial and servicing-checkpoint
frames were white; they were byte-identical despite presents rising from 5
to 104. The final named frame shows the real cockpit, steering wheel, forest
road, opponents and rain, countdown **3**, **0 MPH**, timer **0:00.00**, and
position **8th of 8**. It proves visible race-start rendering, not driving.

The concrete remaining blocker is the unchanged public native input guard's
readiness. At capture scene time `1794974637062`, its last native scene
observation was `1794974543583`: **93,479ms old**, exceeding the unchanged
250ms native scene fence. It reported healthy=true, ready=false, bound=false,
with slot 1 and scene `[2,1000,98305,98305,0,0,1,0,1,0]`. No physical input or
binding attempt followed this stale scene. The game freshness and confirmation
limits were not extended, and no guest poll was forced to refresh readiness.
Thus input-caused movement, steering, Pause and ordinary game Quit remain
unproved. The driver closed the owned browser normally; that exit is cleanup,
not game Quit. No additional original or replay was used.

The passive sampler recovered real game operands with debug dispatch off:
mode=0, player selector=0, simulation cursor=177, sequence0=180, lookahead=4
at the last main GPU boundary; poll counter=314 and command-consumer cursor=312.
Zero control/command words are consistent with no physical inputs. The offline
mode-zero comparison gives `177+4 > 180` at that sample, but asynchronous shared
memory reads do not witness the internal branch or prove an input rejection.
These values advanced from the initial zero state; the game was executing.

The main host recorded a maximum synchronous `gpu_stream_kick` wait of
**7,095.28ms** and maximum native run duration **7,202.885ms**; its accumulated
native time includes **66,053.18ms** in GPU imports. Slot 1's maximum between-run
gap was **6,654.81ms**. Other retained gaps include startup/intentional waits,
so they do not establish starvation of runnable work. These measurements
demonstrate multi-second normal-route servicing delays without the old debug
block observer. They do not isolate observer cost, identify a defective
emulator branch, or establish why the scene was not refreshed. No shared
runtime change is justified by this evidence alone.

All supervised controls and the original have actual native/watchdog waits,
both EOFs, no leaked processes, and finite independent disk/deadline guards.
Chrome's original close receipt is exit 0 with both EOFs. No box was created;
box ID, expiry and stop receipt are null. Evidence is Git plus owned patches,
retained unique logs and selected named PNGs, with existing module/media/chooser
paths and SHA256 recovery references; no source archive or media copy was made.
