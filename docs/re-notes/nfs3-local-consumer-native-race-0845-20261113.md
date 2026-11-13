# NFS III CLI consumer contract: original launch refused, 2026-11-13

The required finite input contract is missing from the ordinary CLI queued
consumer. This run ends at that concrete prelaunch blocker. **No new NFS III
original was launched**, so renderer selection, race, native Pause/Continue and
reviewed driving remain unproved. Parent `b8ac865a5` still supplies the exact
native catalogue → setup registration → chooser registry-transfer route;
nothing here replaces those native exports with fabricated installation state.

Evidence is `scratch/runs/20261113-nfs3-local-consumer-native-race-0845/`.
The actual production CLI, using Solitaire as an explicitly labelled consumer
fixture, demonstrated these results:

* Unknown action parsing returned `ok:false`, without a DOWN call.
* Frozen input returned `queued:true` before any renderer input call. The
  fixture replaced the **actual** `renderer.inputQueue` before `step:1`.
  The scheduled real `handleKeyDown(65)` then ran against the replacement
  queue and set the physical state to `32768`. Supplied `owner`, expired
  `deadline:1`, `nonce` and `reviewed` fields were ignored.
* A second fixture request with that same known nonce executed another real
  DOWN against the replacement queue. This was a deliberate duplicate-input
  test with known replies, not a replay of an UNKNOWN transaction.
* The run-scoped read-only identity check refused an actual queue replacement
  and succeeded after restoration. That separate check does **not** guard
  production's later scheduled consumer.
* An independently armed Python subprocess issued a later ordinary UP after
  a full 640×480 composed-canvas capture. The real DOWN returned at
  `1794533983335`ms; capture brackets were `1794533984851` and
  `1794533984867`ms (1516–1532ms held). Both brackets had physical state
  `32768`, unchanged bound owners and an empty input queue. Real UP entered
  at `1794533985285`ms and returned with state zero; actual `takeInput`
  observed DOWN and UP. This proves this fixture's held-frame/release
  ordering only. The personally reviewed image is Solitaire, **not NFS
  Pause or driving**.

The negative qualification is about the requested envelope, not an advertised
CLI feature regression: these extra JSON fields are not supported by the
current interface. `test/run.js` parses `cmd`, enqueues plain actions and
later calls renderer input methods without carrying owner/deadline/intent
predicates into that consumption. `lib/control-server.js` times out replies
without cancelling pending actions. Consequently a read-only check followed
by a separate ordinary input request cannot establish the requested freshness,
one-use and UNKNOWN-terminal guarantees. Independent UP alone does not stop a
still-pending DOWN from applying later. This run did not manufacture a timeout
or claim to prove that last ordering dynamically.

The actual actor was the Node main-thread CLI interpreter, PID `972045`,
kernel start ticks `258119213`, HWND `0x10001`. The observer retained actual
instance/exports, memory and shared buffer, renderer, window, canvas, input
queue, D3DIM encoder/module/adapter/control and command-buffer references.
No guest-main Worker or browser trusted-DOM identity was invented. The
production D3DIM adapter owns a real Node Worker but does not expose its
underlying thread ID; that limitation remains explicit. The fixture did not
exercise a game D3D device or claim encoder readiness as race rendering.

`freeze.json` rereads all 138 parent path/SHA pins unchanged, including the
133 media files and original EXE `0defab3e…548ad`. The on-disk production
module remains `04c53419…f0a17`; it was checked after this fixture, not
independently hashed inside the live instantiated module. Source identity is
`base-commit.txt` plus `relevant-source.patch`; new helpers and this note have
individual patches. Media are referenced by existing paths and hashes, with
no copy or source archive. Earlier browser 1500ms HELD proof is retained by
reference and hash; browser full22/1024×712 assumptions and old 200ms UNKNOWN
results were not transplanted or replayed.

The capacity dependency's actual `recovery-result.json` was observed after
controls were prepared. Its worker remained live and its recovery outcome is
recorded by path/SHA in `dependency-observation.json`; no independent cleanup
or repeated floor decision occurred here. Root0115/0120 recovery data and
Pawn/LMarbles work were untouched. Capacity recovery cannot satisfy the
missing consumer contract, so no original-effect admission was attempted.

The independent 120-second watchdog was observably armed before fixture
launch. The fixture acknowledged ordinary `quit`; interpreter, watchdog and
UP subprocess all have actual parent waits, exit0 and separate stdout/stderr
EOFs, with all three PIDs absent. Box ID **NONE**, state **NOT_CREATED**,
expiry **null**, stop receipt **N/A**. No production source changed, so a
locked build was not required. No agents, other workers or public deployment
were launched.

Next work must supply and qualify a CLI consumer adapter or production action
that carries the actual owner references, deadline and consumed reviewed intent
through the final scheduled action and queue delivery, cancels stale pending
DOWNs on release/error/UNKNOWN, and gives independent UP its own bound receipt.
Use focused real-consumer tests for changed ownership, expiry, duplicate intent,
error and UP-before-pending-DOWN ordering. Only after that passes may a fresh
capacity decision admit the unchanged native registry route, personally reviewed
renderer selection/race, two settled native Pause/Continue frames with stable
world timer, and one finite reviewed drive with held frame before UP/Escape.
