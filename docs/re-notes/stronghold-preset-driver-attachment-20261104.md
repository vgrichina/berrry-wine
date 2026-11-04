# Stronghold preset driver attachment — 2026-11-04

`tools/stronghold-preset-driver-attachment.cjs` is a runnable composition of the
retained original `successor-driver.cjs` and its existing route closure. It
installs the published passive observer from
`8574dfa540da10ade7ba7b5799c974d131775a38` before the owning Worker's first
instantiation. This assignment was offline: no Chrome, game, remote API,
allocated box, Start, deployment, or lifecycle operation occurred.

The sealed originals stay read-only. Their uncompressed SHA-256 identities are:

| Retained original | SHA-256 |
| --- | --- |
| `scratch/runs/20261104-stronghold-setup-preset-native-world/successor-driver.cjs` | `230a11947699af0721dc54d58c6b027f6ba21563b59bffc7d2014221ec481a10` |
| adjacent `route-driver.cjs` | `bb38b5787c277c94c2913a9ddba72a8663b9fd2fb706a88e320bcb83419633de` |

Adjacent `.gz` originals are accepted without extracting or rewriting them.
Composition requires each reviewed source seam exactly once. The result is
compiled with the original filenames, preserving relative helper resolution;
only the fresh run's evidence/review/release directory changes. The loader
hashes the retained helper closure and verifies the bytes it actually compiles
or parses, including archived JSON dependencies. It substitutes the composed
route at its existing require boundary. No replacement source archive is made.

## Runnable entrypoint

The coordinator must choose a **fresh** run directory and provide a current
`runtime-pins.json` with `commit` and `files: [{path, sha256, ...}]` for the
original served closure. Every listed file is verified before execution and
again when served. It must include `build/wine-assembly.wasm`; an old manifest
does not authorize changed bytes. The fresh directory needs the original
driver's `runtime-release.json` authorization/box/expiry/closeBy/shutdownOwner
fields and its normal operator review/mailbox inputs. The retained authorization
string remains `stronghold-split-gesture-reviews user task`, shutdownOwner must
be `coordinator`, expiry must leave ten minutes, and closeBy must leave the
original five-minute recovery reserve. This tool neither allocates a box nor
creates a runtime authorization.

From `/home/user/wine-assembly`, with those concrete fresh inputs in place:

```sh
node tools/stronghold-preset-driver-attachment.cjs \
  --run /home/user/wine-assembly/scratch/runs/FRESH_ORIGINAL_RUN \
  --pins /home/user/wine-assembly/scratch/runs/FRESH_ORIGINAL_RUN/runtime-pins.json
```

Add `--check` to perform source/pin assembly and write
`attachment-composition.json` without loading the original entrypoint, starting
HTTP, or launching Chrome. `--driver ABS_PATH` selects a retained original with
the same sealed hash, including an adjacent gzip. `--observer-off` executes the
same route with passive-observer and trace installation disabled. It does not
restore the old competing choose-callback trace.

The actual command protocol remains the original title/menu/route mailbox and
separate capture-bound personal reviews. The attachment starts immediately
before the one `route-press-preset` command, after the separately reviewed preset
hover. It ends on that command's success or first failure. Repeating activation
and restarting terminal observation are rejected. `install-native` and gameplay
gestures are unavailable in this entrypoint; stop at the preset result/handoff.

## Binding and evidence

At the existing CDP auto-attach seam, a Worker must be paused with
`waitingForDebugger === true`. The original `observe-browser.js`, published
observer UMD, and attachment bridge are evaluated before
`Runtime.runIfWaitingForDebugger`. The old callback preload, control, hover arm,
and per-ACK sample calls are removed from the composed source. One caller-owned
`set_trace_esp(1, 0, 0)` covers native blocks and dynamic saved return PCs. No
instruction watching or API logging is added. Terminal collection calls
`set_trace_esp(0, 0, 0)` and restores preload ownership; an idle terminal report
also releases tracing without another driver command.

Before start, the driver requires exactly one preloaded owning target/session,
an exact `/lib/guest-worker.js` URL, one original page compile event followed by
one send of that same hashed Module to that URL as `init`, slot 0, and one owning
Worker receipt/instantiation of the exact incoming Module. The published
installer binds the actual import object to that Module before instantiation.
Thread 1, original PE headers/instructions and original media SHA are checked by
the observer. A Module is never assigned a guessed post-transfer hash.
Target ID, session object, session ID and Worker URL remain fixed through RPC.
Wrong/ambiguous compile/send, slot, URL, target/session, late preload, changed
helper source, missing instance or native delivery is a prerequisite failure.

The original physical route validates its DOM queue sequence before emitting
DOWN/UP-enqueued, and emits consumed only after its original telemetry and
`assertReady` drain checks pass. The existing final drain snapshot is reused.
Per-event evidence carries the queue, active/last input, mask and renderer
telemetry. The original strict `assertAck` validates each existing frozen grant
before its annotation/check. Existing `freshShot` writes and renames the PNG and
its digest/state record before annotating that capture. No screenshot, command
annotation or ACK manufactures native execution evidence.

The composed mailbox begins observation before dispatch, records success only
after the unchanged exact route recognizer returns and UP is consumed, and
records the first failed command before the original terminal close. Partial
reports and pending native frames survive failures. Missing evidence remains
unknown. A detached/inaccessible session may prevent final report retrieval or
remote trace cleanup; its last reports and explicit unknown status are retained,
and the original bounded browser cleanup remains responsible for that browser.
This is not a claim of clean native completion after disconnection.

The unchanged bounds are navigation **16384**, route **4096**, arrival **3072**,
stability **768**, per ACK **64**, command **40 seconds**, Chrome **360 seconds**.
The passive observer's maximum observation window remains **10 seconds** and
the original live deadline wins. Read-only correlation adds wall-clock overhead
and can exhaust these bounds. No input, guest step, ACK, wait, capture, guest
write, relaxed recognizer or Start is added. Existing failure balancing and
browser cleanup remain part of the retained driver. Box shutdown belongs to the
coordinator.

## Offline validation and limits

Run `node test/test-stronghold-preset-driver-attachment.js`.
`STRONGHOLD_ATTACHMENT_RESULT=PATH` retains detailed fixture evidence.

The test compiles the actual composed original closure, executes its mailbox
command body for success, dispatch failure and binding failure, and exercises
the original and composed `PhysicalRoute` through production renderer mouse
enqueue and host input polling. The original and composed event payloads
(excluding wall-clock queuedAt), ACKs, aggregate steps and capture count match.
The fixture needs four unchanged 64-step ACKs for move/DOWN/UP, including the
extra original DOWN drain; consumed annotations follow those accepted drains.
The composed capture hook runs only after PNG rename and digest/state sealing;
the ACK hook runs after the original transport response, with its pre-step
counter and strict validation. Explicit observer OFF matches the original route
commands and grants. A direct invocation without `runtime-release.json` also
executes the composed entrypoint and stops at that missing prerequisite before
Puppeteer, HTTP or Chrome. Its bootstrap/cleanup records are offline failure
controls; the inherited `boxLeftRunning` field does not indicate an assigned box.

Both shipped WASM variants run through the actual shipped `lib/guest-worker.js`
with the assembled preload/import chain. A small original hover fragment with
synthetic caller/data delivers its actual dynamically saved return at
`0x58000c`, outside the old callback range. No `log_block` is hand-called.
Negative controls cover ambiguous owner, wrong Module hash/session/thread/URL,
late/duplicate installation, replacement Module, lost session, missing trace,
failed command, idle expiry, terminal restart, and an actual pending native
frame retained after failure. Trace/installer cleanup is checked where the
session remains accessible. These synthetic transport/caller tests are not a
fresh original game, actual browser DOM consumption or a preset completion.

The accepted full-memory/register/flags/command/trap parity evidence remains
[the published observer qualification](stronghold-native-preset-observer-20261104.md);
its large fragment matrix is reused, not repeated here. The ordinary untraced
control's diagnostic RPC-page difference remains explicit. This attachment
does not repair or certify original choice-1 completion, settings application,
readiness or gameplay.

Evidence is in `scratch/runs/20261104-stronghold-preset-driver-attachment/`:
focused JSON/log, offline current pin manifest and executable `--check` output,
serialized build log, Git SHA, relevant binary diff and owned new-file patches.
The manifest references retained original media at
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
No source tree, module or media copies were staged. Box ID/state/expiry are not
applicable; none was assigned. Next is a coordinator-allocated, fresh bounded
original attempt using this attachment, with lifecycle retained by coordinator.
