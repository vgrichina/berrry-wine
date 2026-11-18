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
identity guards remain unchanged. No original has yet been launched for this
correction at this preparation checkpoint.
