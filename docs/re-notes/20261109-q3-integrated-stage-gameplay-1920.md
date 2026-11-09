# Q3 native GL stages and terminal screenshot failure, 1920

The published `d77be3a6199a1e4df2c42296e6833fcf83c5ef65` integration now has
native stage evidence. Gameplay remains unverified: original command 2,
`singleplayer-aim`, hit the unchanged work deadline while screenshot request
352 was pending. No causal repair was established or production code changed.

Evidence: `scratch/runs/20261109-q3-integrated-stage-gameplay-1920/`.
Runtime Git base: `6e99b8d93d4ddb1f3a59683af63fb5333e11a530`.
The exact sealed 942-provider manifest hashes to
`7267812df557a7ed2ac012f865623f2f3c0dcb427c7186e2e4d88169c668b83c`.
The selected module remains `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
Compared with 1816, only the three published `c6094c4ed` GL providers and the
published current-module integration differ; all 327 media pins match.
The generated caller SHA remains
`25acfe27a8160d4a8b396f71636e41ae4d172b3cb7e8b011cb283ce8ae7764f1`,
including the `2b945315a` stdin fix. No provider was edited or repinned after
admission; ownership, closure authentication and deadlines were preserved.

## Native stage observations

The original delivered 243 independent page-owner ring samples, plus existing
partials. `stage-audit.json` pairs 71 retained enter/exit intervals by exact
sequence linkage and endpoint/frame/owner/opcode/context/window/offset/size/aux
identity, using only the render-owner `performance.now()` clock:

| Stage | Retained pairs | Maximum duration, ms |
| --- | ---: | ---: |
| Context activation | 18 | 0.020 |
| Pending draw flush | 18 | 0.010 |
| Frontend error handling | 18 | 0.015 |
| Backend error query | 17 | 1.860 |

These opcode-12 records identify endpoint 1, owner 0 and context handle 1 on
the authenticated original renderer. Its target is
`63E9ED7CCFDED12FF7870A58888E9D88`, session
`A0A71570368CB5DF8D0B444982B55D9C`, epoch
`d732dcd3-ed2f-41af-952e-dc386b0dbacf:1/d732dcd3-ed2f-41af-952e-dc386b0dbacf:2`.
Producer evidence identifies the corresponding WebGL owner and context handle.
The retained backend-enter sequence 1038496, frame 172848, at renderer time
69700.580 ms has no retained linked exit: its completion/duration is **UNKNOWN**.
The bounded ring is lossy. The short completed samples neither reconstruct the
previous 12-second boundary nor rule out unobserved slow work. No native
GPU/driver cause is inferred, and the error query was never bypassed.

## Capture failure remains separate

The actual fixture passed; planned cancellation, physical-state proof, kernel
drain and separate parent waits/EOF passed before the conditional original.
Its red WebGL fixture image was hash-verified and reviewed in a separate tool
call before starting the original. Original startup and successful ACK0/ACK1
captures were likewise verified and individually reviewed before each next
input. They show the main menu, with no alive gameplay HUD.

Command 2 used bounded ordinary relative mouse input toward SINGLE PLAYER.
Its capture-state renderer read took 1,858 ms; `binding.before` then completed
in 534 ms. Renderer identity request 348 executed for 1.415 ms on its own clock
with matching owner tokens. Screenshot request 352 was sent at
19:36:25.805 UTC and remained pending 16,839 ms when the work deadline fired at
19:36:42.644 UTC. The recorded first failure is 19:36:42.646 UTC.
Send return and successful independent owner replies do not establish compositor
entry or screenshot completion. The post-navigation raw transport observer
retains its existing stop; missing transport timing remains unavailable.

No ACK2 or command-2 PNG was published. No later input, capture, retry, fire,
W movement, original restart or deadline relaxation occurred. Firing, alive HUD
and useful movement remain **UNVERIFIED**. This run provides no death-camera
movement claim. A next investigation should address actual screenshot
completion/transport evidence under the same guards; these observations do not
justify a GL or capture bypass.

## Lifecycle and verification

Both ReturnFire1910 and Nox1915 finalpublished `RELEASE STOP` gates were read
before final pins or runtime. ReturnFire's allocated predecessor was independently
verified archived with a completed unforced stop; Nox1915 allocated no box.
One fresh box was created only after observing the independent UUID watchdog,
its process identity, immutable configuration hash and fresh heartbeat.

Box `bx_723dmktw`, UUID `411a56f0-63b6-4418-8b6e-b5165374719b`, is independently
API-confirmed **ARCHIVED**. Initial expiry was 19:57:48.027 UTC; fixed watchdog
deadline was 19:57:48.715 UTC. Final `archiveAfter` is null; the API does not
return `expiresAt`. The sole delegated normal stop,
`stop_2ddc655a0d4b60bf`, completed unforced at 19:37:15.551 UTC, after retrieval
and independent SHA/size/gzip-CRC verification of 76 fixture and 88 original
unique artifacts. The actual watchdog wait returned 0 with separate stdout and
stderr EOF. Original caller/controller and remote parents actually joined with
status 1 and separate EOF; both kernel drains and independent absence/port/profile
checks passed. Terminal browser termination is not claimed as ordinary Chrome
close. No billing-idle box remains.

Passed: actual integrated GL stage/provider tests (six drift refusals, bounded
independent ring, exact stdin transform), foreign closure/generated caller
(27 refusals), existing GL diagnostics, local stdin controller regression,
actual generated prelaunch/custody lifecycle, and locked build. The native
fixture passed; the original failed as stated. `analyze-native.py` independently
checks retained bytes, commands, captures, deadlines, stage linkage and lifecycle.
Routine offline invocation/extraction/audit mistakes were corrected and recorded;
they did not trigger native retries. Git SHA plus small run-input patches provide
source recovery; no source tree or media archive was created. Free `/home`
remained above 1.5 GB. No local Chrome, nested agent or Codex worker was launched.
