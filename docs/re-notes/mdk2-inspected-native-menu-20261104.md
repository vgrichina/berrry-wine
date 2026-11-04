# MDK2 inspected native menu attempt — 2026-11-04

The run-only input observer integration passed, but this attempt stopped at an
**operator observation-sequencing error**. New Game was not activated, Medium
was not inspected or selected, and neither comic nor tutorial was reached.
There is no demonstrated production defect and no production change.

Evidence and executable run-only helpers are retained in
`scratch/runs/20261104-mdk2-inspected-native-menu/` (ignored). Read the cause
note published at `632639d35`, the per-command route and the grenade notes
before this attempt. The predecessor's original failure remains Enter on the
unready 3,136-step copyright/title capture; an ACK did not establish New Game.
Old step counts were not used as selection readiness in this attempt.

`browser-driver.cjs` now imports the tested selector's exported
`inputSnapshot(renderer)`, installs its standalone function with
`page.evaluateOnNewDocument`, and spreads its result for `sharedRenderer` into
the actual main state observation. The original renderer's absent/undefined
inactive input becomes explicit null; the public `getMouseButtons()` supplies
the zero mask. There is no renderer write or modification of old evidence.
The actual driver state callback was tested in a VM with the installed
adapter: absent, undefined and null inactive state normalize correctly;
missing renderer, getter or valid mask fails.

Before Chrome, all **25 selector controls** passed, including freshness,
readiness, wrong selection, ACK, trusted event, aggregate 512-step / 64-command /
240-second bounds and stable post-close recovery negatives. The selector itself
was copied unchanged and never invoked live. ACK mocks passed delayed startup,
mismatched/failed/absent receipt rejection; transport mocks passed independent
per-command deadlines and stopping after the first failure. Syntax, imports,
all 432 remote runtime pins and an actual small-file upload/download recovery
probe passed. Initial `boat-dev` lookup failed because it is not installed;
the installed `boat` CLI was used before runtime, as in the predecessor.

One browser launched at **04:02:58.999Z**. Initial startup observation had its
own explicit bound: at most 4,096 steps and deadline **04:05:58.999Z**. Each
advance command requested 64 steps and waited for its matching ACK. Eight-step-
command observation chunks were interleaved with captures. The startup bound
was not the selector budget and did not authorize bypassing its protocol.

Every listed image was personally viewed by the worker:

| Actual steps | Capture | Visible result |
| --- | --- | --- |
| 0 | `startup` | Registered MDK2 runtime log; no native scene. |
| 512 / 1,024 | `startup-512`, `startup-1024` | Gray application surface. |
| 1,536 / 2,048 / 2,560 | Corresponding `startup-*` | Black native surface. |
| 3,072 | `startup-3072` | MDK2 copyright/title, legal overlay, closed icon wells; no New Game label. |
| 3,584 | `startup-3584` | Controller with red highlight and readable **New Game**, legal overlay absent. Viewed after the sequencing error; no activation followed. |

The error was submitting another eight acknowledged 64-step startup advances
**in the same tool invocation displaying the 3,072 capture**, before personally
viewing the first native title and switching to the tested selector's inspected
16-step observation protocol. The extra 512 steps had no selector ledger and
cannot be represented as compliance with its aggregate containment bounds.
`first-failure.json` records this operator error. The already-submitted sequence
finished; the only subsequent browser command was orderly quit. No source-
backed Escape attempt, game click, Enter, movement, firing, reload, retry or
second launch occurred. The final visible New Game label does not excuse the
sequencing error or establish New Game selection. No held game key was created.

Validation establishes **65 matching successful ACKs**, contiguous commands,
every next command timestamp at or after the previous receipt, and **56 step
commands / 3,584 completed steps / maximum 64**. All eight captures match their
recorded full PNG SHA-256. Every observed input queue is empty, active input
null and mouse mask zero. The only two DOM input events are the initial trusted,
balanced Launch-toolbar mousedown/up, with an empty target id; no game-control
event occurred. An initial validation assertion incorrectly expected zero DOM
events; its failure is preserved and the assertion was corrected to account
for these toolbar events, without changing evidence. No browser first-failure
artifact appeared; all 200 recorded HTTP pin checks matched.

Original execution source remains
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.

| Retained module | Full SHA-256 |
| --- | --- |
| Canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Both modules were referenced from the per-command run's retained paths,
verified and staged once with the pinned Git blobs and original media. Media
path/size/full SHA references are in `staged-path-references.json`; no media is
stored in this run's evidence. Canonical compilation and instantiation with
2,261 exports were observed. Companion execution was not attempted. Exact
checkout Git SHA, relevant binary diff, retained accepted-to-execution patch
and owned new-file patches identify source; no source archive or rebuild was
made. No guest write, cheat, console command or configuration edit occurred.

Chrome **8410** exited normally at **04:04:49.135Z**; driver **8388** is absent
and server port **39361** is closed, verified before stable inventory. The
browser segment was **110.136 seconds**, below 15 minutes. Two identical
post-close directory hash passes passed. All **220 recovered unique files /
6,655,875 bytes**, including both actual modules, match size and full SHA-256;
all **432 runtime pins** remain unchanged. Recovery finished before 04:49Z.
No production build was required for a documentation-only commit and ignored
run-only integration.

Hand back **bx_wnjq4738 / RUNNING, API idle, health ok, hydrated / expiry
2026-11-04T04:59:39.962Z**, with owned browser/helpers closed, to
**shutdownOwner=coordinator**. No lifecycle action or public deployment ran.
Next unresolved work is a separately authorized attempt that personally views
each startup capture before submitting any dependent advance, switches to the
tested selector on the first inspected title, and separately inspects selected
New Game and highlighted Medium. This single task stops at the preserved error;
no successor is launched.
