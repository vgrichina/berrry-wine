# Diablo II current-main renderer attempt — 2026-11-06

**Town movement remains unverified on this version.** The one authorized
original browser run ended after its first Escape input, with a clean guest
`ExitProcess(0)` and a personally reviewed empty desktop. There was no second
original, backend arm, ground click, Den exploration or generated gameplay.
No emulator defect or emulator cause was established. This is a harness route
failure, not a regression claim about the accepted historical gameplay.

Evidence: `scratch/runs/20261106-diablo2-current-backend/`. This continues
`GLD3D-CORPUS-27-20261006`, not a new title or a full-27 qualification. Historical
town movement, field combat and native checkpoint restoration remain as recorded
in [the accepted notes](diablo2-demo.md); none was reproduced here.

## Inputs and transport

The 25 installed files match `diablo2-fixtures-20261019.json`, totaling
135,378,002 bytes. The unused `DiabloIIDemo.exe` is absent, so the existing
26-file readiness tool correctly reports one ENOENT. The installed registered
`diablo2_demo` route requires none of those installer bytes. No installation,
media recovery download, guest configuration/save/memory edits or source/build
changes occurred. The shared browser resolver's existing optional unserved
SHELL32 fallback was retained; declared game DLLs were present.

Nine tiny generated transport controls passed. The run-local wrapper reuses
`tools/gltron-logical-fps-local.cjs`'s atomic JSON publisher and numbered ACK
client. Controls cover temporary partial-file invisibility, rejection of a
malformed final file before dispatch, duplicate writer/consumer IDs, ordered
ACKs, sequential requests, child-exit cleanup, post-exit rejection and no replay
after an unknown ACK. The generated child exited zero and was reaped. These
controls prove host transport behavior, not guest input or gameplay. An initial
relative-require typo and two preparation assumptions were corrected before
any original launch; preparation logs retain the latter failures.

The selected main commit is `e2b79dba8fb85cc51cc1593a5fdefff0b68f3688`.
`runtime-pins.json` records 589 exact individual runtime inputs; the remote
prelaunch hash check and post-run local check both pass. Git plus
`relevant-source.patch`, the untracked `lib/wininit-boot.js` patch and owned
input patches preserve source identity. No source/media archive was created.
The existing final production build from the Lords2 worker supplies:

| Module | SHA-256 |
| --- | --- |
| standard, actually loaded | `6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac` |
| compat, provisioned only | `41b0c704c91ba6fc7e4a6645d9421bf7fd3a23139b0b538b576e1e1b85527dd6` |

Four live Worker targets, including the owning renderer, expose standard Wasm
bytecode matching that hash. The unique module was retrieved. Of 201 actual HTTP
responses, all 194 static/bundle successes match pinned bytes, including the
normal dev-server index injection and the bundled original renderer DLLs.
Four responses are dynamic agent/auth traffic; three are expected 404s for
build-info/favicon. Remote media were fully hashed before launch; a second
remote post-run media hash was not collected before shutdown. Local media
remained unchanged.

## Observed original and actual backend

Chrome `151.0.7922.108`, V8 `15.1.206.16`, ran on one fresh separate boat.
The page used cross-origin isolation, default guest Workers and the unchanged
registered Direct3D selection. Startup shows the authentic Diablo II logo and
Blizzard logos in the game canvas. The viewport is 1024×768; startup game
buffer is 640×480 with a 684×536 presentation rectangle.

The live render owner is target `EC728EA4F0ED24C90BDBEF75A6464CFB`, endpoint 1,
API `legacy`, backend `webgl`. Existing natural-barrier stats advance from
1,721 to 6,932 submitted WebGL draws and fence sequence 1,119 to 2,320.
Both completed software counters remain zero, with zero backend errors.
The owning Worker's endpoint/control observations agree with the page's
endpoint and loaded module. These are actual adapter draw submissions:
`D3DIMGpu._submit` increments `draws` after `t.device.draw`, rather than merely
reporting a requested renderer or a presentation. They concern startup only.
The context reports ANGLE/Mesa Intel UHD Graphics 620; physical GPU completion,
GPU timing and town consumption remain unverified.

Startup pixels were captured at approximately 22:48:22 UTC. The first ordinary
Escape was submitted at approximately 22:48:47 UTC, after a state/owner read.
That preinput read has no pixels; the reviewed startup state is 24.945 seconds
older. The transport guard checked the capture hash and review reference but
did not establish that the animated guest remained on the same screen.
At 22:48:47.860 UTC the log records `ExitProcess code: 0`; the 22:48:52 capture
shows the empty desktop and no running app. Escape may have reached a later
menu, but the exact screen at input is unknown. No crash, trap or missing API
was observed. A stale scene review is the demonstrated harness limitation;
assigning an emulator cause would exceed the evidence.

## Cleanup and recovery

Original start: 22:48:04.164 UTC. Chrome exited zero without a signal at
22:49:08.483 UTC. Unique logs/captures/module were retrieved by 22:49:33;
the recorded controller/Chrome PIDs were absent, both private ports refused
connections, and the browser profile and writer lock were gone. No shared
local runtime locks, ports, browser or source/build files were owned.

Fresh boat `bx_8vanavxu` was created with a persisted UUID Idempotency-Key,
initial expiry 23:45:19.723 UTC. Delegated normal stop
`stop_c183402b1d198c0e` completed at 22:49:50.572 UTC, `forced=false`,
`error=null`; API state is `archived`, stopped at 22:49:50.552 UTC, active
expiry null. Total execution, review, retrieval and stop took under two minutes,
within the 35-minute limit. No access403, automated flag or lifecycle retry
occurred. Local free disk remained above 2 GB.

Recover from the recorded Git commit plus exact patches and the existing
path/hash media references in `runtime-pins.json`; retain the recovered unique
module and both reviewed captures. `recovery.txt` records the detailed recipe.
No production fix or build was warranted, and no second original was attempted.
Next work requires a separately authorized original with state-driven menu
admission and fresh scene review before input, then the requested reviewed
before/idle/ground-click/settled town captures. Audio, FPS, native Windows,
software-backend gameplay and full-corpus completion are not qualified here.
