# AoWII natural send frames and Scenario progress

Run: `scratch/runs/20261118-aow2-send-callback-frame-cause/`.

Published observer `3c8abb104` adds opt-in tracing to the existing receiver
callback driver. It preserves the 10,000-iteration bound, admission, wait,
resume, nested dispatch, result, error and abort behavior. No causal runtime
repair is claimed. The fresh original passed Scenario and Single, reached
Inioch's Legacy setup, and displayed Julia's “Let the game begin / Click to
begin” dialog with the Day 1 HUD after ordinary Start. Actual map/army movement
and terrain producer evidence remain unproved.

## Observer and controls

`GuestThreadHost.threadSendFrameTrace` is an optional synchronous sink. At most
256 admitted receiver frames per host retain first-eight/last-eight scalar
samples, branch/yield counts, endpoint generation, receiver frame/wait epochs,
request and parent identity, message, nested progress and completion. Request
IDs use weak keys. The sink receives a copied record; sink exceptions cannot
replace real callback results or errors. Unarmed execution retains nothing.
It performs no extra guest reads, commands, polling, focus or clock changes.

Real Worker and local fixture controls cover nested result/failure, observer
failure, unarmed behavior, bounded retention, blocked progress and stale owner
rejection. Existing frame ownership, wait identity/reservation, process broker
and admission suites pass. The existing scoped-yields suite initially failed
its removed yield-16 render-hook assumption. Coordinator `acdd2648d` repaired
that test independently; the replacement Worker/local suite also passes here.
The locked full build passed before observer publication. The initial build
review-anchor failure and subsequent passing build are retained separately.

Only the owned callback-driver hunks were staged in the shared host file.
An explicit-path interactive commit was quit without staging further bytes;
the foreign retirement/start/stop overlay remained uncommitted. Coordinator
updated its separate pending review metadata, without including it in this
commit. Observer publication immediately completed strict pull and push.

## Immutable graph and original

The tested published graph is
`3c8abb104597588133a11a7504967f6c446b9e6d`, module SHA256
`1504acf2ea5cac3ec3b8c627f4edc64c564e62ad37c06928f288bd8ae83b4f37`.
Sources were reconstructed in memory from Git; foreign runtime overlays were
excluded. The registered `age_of_wonders2_demo`, its real Borland/MSS bodies
and 1,083 media pins were fixed before launch. Actual original application
readers authenticated 442 completed bodies. Canceled Network events remain
separate from these actual consumer receipts; no Fetch interception or body
substitution was used.

Native Device7/software controls passed covering/noncovering red geometry and
seven whole-memory hash checks. The first authored browser control closed at
a GPS-owner admission exception. Offline source review identified manager
port publication before `Bridge._openWorker` assigns `bridge.endpoint` after
`endpoint.ready`. A fresh corrected control waits only for this exact initial
PREBIND state; later owner mismatch still fails. Its reviewed white window
became a maroon/yellow triangle after independently released Space; ordinary
Escape reached actual ExitProcess(0). All control receipts were sealed before
the original. The closed first control was never queried again.

Original budgets were fixed at startup 900s, total 1800s, final Quit reserve
180s, with an independent 1820s cleanup backstop. There were no extensions.
The native original began at 08:54:51.924 UTC. Its first whole capture showed
the real launcher. A later reviewed whole capture showed the actual menu.
Tracing armed there before the sole Scenario gesture. Subsequent reviewed
ordinary gestures selected Single and Start with default setup options.
Each gesture has independent UP delivery and actual release-child wait/EOFs.

Scenario opened its submenu; Single opened Inioch's Legacy setup. Start
produced the whole Julia/Day 1 dialog PNG. That screenshot was written before
the capture's post-check failed, so there is no completed `map-admission.json`
or command-10 completion receipt. Its filename is not proof of the map.

## Frame evidence and limits

The observer emitted exactly 256 frame records for 252 owning requests, all
message `0x8fff` to hidden HWND `65543`, sender endpoint 4 to receiver endpoint
1 in process 1000. No recorded frame threw or exhausted its drive bound.
Deferred attempts retain the same request ID across different receiver frame
tokens. The first record is frame 271; the allowance ends at frame 526.

Request 6/frame 280 demonstrates natural blocked progress: yield 12/epoch 6
resumed to yield 1/epoch 7, handle `0xe0001`, infinite timeout. It accumulated
204 blocked-pending branches, then resumed and returned result 0; 207 response
observations contain 205 yield-1 observations and one yield-12 observation.
Request 11/frame 285 accumulated 163 pending branches at wait epoch 9 on the
same handle, then returned 0. These are actual successful waits, not evidence
that a prior failed request used either frame or branch. No nested branch was
needed by these recorded original frames; authored controls exercise nesting.

The allowance was consumed before Start and was not extended. Consequently
the prior callback-limit fault remains unreproduced and unlocalized. This
diagnostic limit must not be mistaken for complete coverage of later sends.
The next diagnostic design should reserve bounded retention for a failed
frame instead of consuming all records on early successful sends.

At 08:59:11.399, the actual post-capture check failed with
`Runtime.callFunctionOn timed out` after its fixed 3000ms transport allowance.
The retained stack identifies `worker-identity.read -> worker.evaluate` of
the pure slot/endpoint/location expression. The exact outstanding target was
not recorded, so a particular CPU Worker, callback, or guest PC cannot be
assigned as its cause. Future admission diagnostics need exact command target,
start and completion receipts before drawing a runtime conclusion from this
boundary. Increasing either timeout or callback bound is not justified here.

The controller closed UNKNOWN at 08:59:11.440. Queued filesystem commands
11/12 for Begin/capture were submitted after closure and never executed:
there is no Begin delivery, no completion file and no later endpoint request
or original replay. No actual army selection/movement, points change, original
Device7/backend execution, terrain repair or ordinary original Quit is claimed.

## Custody and recovery

All three scopes retain actual Chrome, driver, independent watchdog and
enclosing-owner child waits and both EOFs. Native-supervise reports no leaked
owned processes or poll error. Watchdogs did not trigger; the original minimum
free /home space was 1,981,247,488 bytes. Owned profiles were removed only after
wait/EOF retention. The outer original exec returned 143 despite its retained
enclosing child exit 1/EOF receipt; the board watcher also returned 143 with
tool EOF unavailable. These gaps remain explicit; complete cleanup is not
claimed. No unassigned process was stopped.

Exact Git, relevant binary diffs, the owned published patch, run-helper patches,
module/media pins, selected personally reviewed whole PNGs, hashes and recovery
instructions are retained. `result.json` is written last. No agents, workers,
boxes, Python, Wine, deployment, held-title work, media copies or source-tree
archives were used. Box ID null; state NOT_CREATED; expiry null; stop receipt
null. Ownership is released after sealing.
