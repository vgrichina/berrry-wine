# StarCraft: reviewed mission follow-through (2026-11-15)

Status: route qualified for publication. No fresh original has been launched, and no new
gathering, production, objective progress, completion or native Quit is claimed.
Heavy qualification followed the explicit actual source, build and runtime
releases: Sims Win4 implementation at 03:37:50Z, then Q3 original task at
03:51:02Z. Their actual waits, both EOFs and absent recorded PIDs were personally
verified. Historical Supply Depot and enemy-Marine originals stay closed.

## Route and evidence boundaries

`tools/starcraft-mission-controller.py` extends the released finite StarCraft
transport with personally chosen native gather, train, build and combat orders.
It does not interpret game pixels, track units, read private state, choose
strategy, or queue actions. Every gameplay choice requires a complete current
world and visible-objective review, a five-second scene, and one left click.
Native menus have thirty seconds. Selection, command, target, attributable
result and mission completion are separate reviews.

The permanent native PID/start-token/window binding must use an actual native
bootstrap title/menu. UNKNOWN remains terminal with no replay or rebind. Each
gesture has a prearmed independent 1750 ms UP fallback. This route permits
80–1499 ms gestures: the inherited 1500 ms route captures while held, so that
duration is refused here. No held capture or thinking is required. The final
180 seconds belong irreversibly to Quit. Native pause must have personally
observed evidence; otherwise reviews explicitly state that pause was not
observed. The clock remains real.

Human result assertions require visible before/after/persistent evidence and
attribution. Gathering needs worker delivery and resource changes. Production
needs a visible new unit identity and resource changes. Native objective
progress requires its own evidence; incidental combat is insufficient. A
separate completion record needs native mission-completion evidence. Transport
ACKs establish input consumption, never gameplay success.

## Preparation and pending qualification

Validation: 40 policy tests, 15 actual HTTP tests, and 10 actual CLI/child
controls passed, followed by the full locked build. These use
synthetic metadata and isolated fixtures, not an original game. Actual CLI
consumer dequeue, identity, late/dropped ACK, parent-death release and no-pause
controls used the current shared module, SHA-256
`6872c84daf073f76a4c2b7f1a54e2b3f7051129c1bc38d12ed03c145889dcaa4`,
2,203,094 bytes. The locked build retained these exact bytes. Explicit
publication and complete prelaunch pin verification remain prerequisites to
the single fresh registered original.

The two own-route HTTP cases initially refused the test fixture's 35-second
recipe because it could not provide the mandatory 180-second Quit reserve.
The isolated fixture recipe was corrected to 240 seconds; all fourteen cases
then passed. The failure and corrected actual waits are retained separately.
An additional HTTP parent-death control passed with a real subreaper wait of
the independent UP child and both inherited pipes drained to EOF.

Evidence belongs in
`scratch/runs/20261115-starcraft-reviewed-mission-objective/`. Exact current
source recovery uses Git SHA and binary patches, including relevant foreign
WIP and owned new files. Media, fonts, imports, TLBs, resolved Node/Python,
mapped host dependencies and the then-current WASM must be pinned by path and
hash before launch. No source archive, media copy, downloaded override or WASM
bundle is part of this task.

Historical secondary Storm-thread EIP=0 and abandoned critical-section enters
remain unresolved diagnostics. Native Exit Program and process exit would not
establish clean shutdown of every emulated thread. No application-specific
normal-return suppression is introduced.

Box state: NOT_CREATED; ID and expiry null; stop receipt not applicable.
