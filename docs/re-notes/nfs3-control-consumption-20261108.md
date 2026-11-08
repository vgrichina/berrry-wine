# NFS3 control consumption: static queue boundary; original attempt blocked

Run: `scratch/runs/20261108-nfs3-control-consumption/` (ignored evidence).
**Task incomplete.** This run does not establish the current configured
binding, active player identity, input-caused acceleration/steering, or retained
road displacement. The sole fresh original attempt failed in the diagnostic
harness before catalogue completion, with sticky transport UNKNOWN. No emulator
mismatch or emulator fix follows from it. The earlier cockpit race and delivered
scan `0x48` evidence remain as described in
[the previous investigation](nfs3-numeric-endpoint-race-20261108.md).

## Original control path identified statically

Read-only `objdump -d -Mintel` of the original `game/nfs3demo.exe` is retained
as `original-disassembly.txt`. EXE SHA-256:
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.
These addresses describe the original executable, not emulator-private memory.
They identify where observations are needed; they are not execution traces.

| Boundary | Original code and data |
| --- | --- |
| Native default bindings | `0x48f720` copies defaults from `0x48ef10`; the first four words are `0x4d04`, `0x4b04`, `0x4804`, `0x5004`. These are defaults, not measured current settings. |
| Configured table selection | `0x48efb0` selects `0x6fb240` when mode `0x6fb3b0 == 1`, otherwise `0x6fb20c`. `0x48dcd0` installs bindings through `0x48e420`; `0x6fb4c4` can swap the first two assignments. |
| Binding to key array | `0x4314e0` extracts `(binding >> 8) & 255`, reads `0x562f28 + scan`, and returns 0 or 255. The type dispatch table starts at `0x553ab4`. `0x431510` also handles encoded keyboard bindings and additional fallback branches. |
| Poll to control packet | `0x48e030` reads installed bindings at `0x79a340`, produces a signed axis byte at `0x79a338` and the next two channels at `0x79a339/33a`, then packs button bits. `0x79a4ac` is incremented by the poll routine; it is not a simulation-frame counter. |
| Packet admission | `0x48e4f0` has gates at `0x6fb3a0`, `0x7d16a0`, `0x7d16a8`, and `0x55e818`. Depending on mode it calls `0x4c4a30` with a player/input index, or `0x4c45c0`. |
| Queue | `0x4c4a30` copies four bytes into `0x7d1714 + index*512 + (sequence & 127)*4`; availability flags are based at `0x7d2714`, sequences at `0x7d3718`. It has explicit early-return/queue-full branches. `0x4c4d70` reads this queue. |
| Simulation-side snapshot | `0x4c4d40` copies four bytes from `0x7d16f0 + index*4`; `0x48e180` uses it to populate `0x79a4a8..ab`. This is a separate boundary from merely seeing a key held. |
| Car and playback selection | `0x42c110` installs callback `0x431140` at car offset `0x600` and `0x4bb880` at `0x5fc`, with alternate callbacks selected by car flags at `0x200` and other mode tests. `0x4bb880` uses car input index `0x1f4`; selector `0x7cba58` chooses `0x4bb500` for values 0/1 and `0x4bb590` otherwise. The former calls `0x48e180`. The semantic names of other selector values remain unverified. |
| Car control fields | `0x431140` calls the car's `0x5fc` callback, then copies `0x79a4a9/aa` to car offsets `0x504/505`, plus other control state. Car pointers are read from `0x5edac8`; `0x5eda48` is also used by the selected-player path. |

The shipped readme lines 140–146 documents arrow/numpad equivalence; lines
289–290 uses Up acceleration and Left turning as its example. Static defaults
agree with those scans. Neither establishes the actual configured table or
which callback controls the visible car in a particular run.

The next useful observation is the first differing boundary along this chain:
current binding and player/callback identity, held key at an actual binding
read, generated packet, queue acceptance, simulation snapshot, and selected
car control fields. Capture the input index, queue sequences/flags and
`0x7cba58` alongside car flags/callbacks; the prepared observer does not yet
cover every newly identified field. A moving opponent, attract/playback image,
or unrelated packet is insufficient. No focus, endpoint or missing-EXE theory
is revived here.

## Local qualification and the concrete blocker

The released bound/observer helpers and complete registration closure were
reused as run-owned inputs. Guest and renderer module pin remains
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`.
`local-diagnostic-qualification.json` records generated x86 returning 0 with
the scan released and 255 held. Diagnostics on/off matched all nine recorded
registers and 128 output words; the original trace import ran exactly once per
observed event. This is a bounded synthetic semantic check, not proof of zero
runtime overhead or whole-game passivity.

`local-generated-controls.json` records actual Chrome trusted Up+Left events
through the exact eight-second bound helper, with independent reverse-order
key releases. A deliberately slow sampler separately passed release timing
and outside-hold labelling. Chrome exited 0 and its profile was removed.
Numeric/string endpoint rejection controls and all three registered-EXE
HTTP/SHA checks passed. There was no complete local staged-browser rehearsal
of the newly added observer attachment; that coverage gap mattered.

The worker's `prepare.py` incorrectly added `control-observer.js` to the
manifest with an absolute path. Upload and the browser's concatenated pin
check agreed on that wrong nested location, while the attachment code loaded
the intended run-relative path. The first attached guest Worker consequently
logged ENOENT at 06:39:04.348 UTC and remained paused before
`Runtime.runIfWaitingForDebugger`. At 06:39:24.028 the pending startup
`Runtime.evaluate` timed out with sticky UNKNOWN. Chrome closed automatically
and exited 0. This was my harness error; no configured binding, race-player
snapshot or original consumption trace was obtained. No input command was
issued, and the UNKNOWN was never replayed.

The failed `runtime-pins.json` is retained unchanged. The local preparation
path is corrected; `staging-check.cjs` and `test-staging.cjs` reject that exact
failed manifest and traversal/noncanonical paths and verify every byte in
`runtime-pins-corrected.json`. These checks passed after the failed run. The
corrected manifest was not launched. A future attempt must run this path
validation and rehearse the actual attachment path locally before allocation.

## Evidence and normal shutdown

Shared production edits encountered during transfer were pinned back to the
recorded published blobs, rather than copying an inconsistent closure. The
runtime source commit is `0a38cf48438096482d059c5d8f27c048474c83b9`;
`base-commit.txt`, `relevant-source.patch`, runtime pins and new-file patches
retain recovery inputs. Only small run-specific inputs were staged; media
was referenced by existing path/SHA. No source/media archive was made.

Both independent normal-stop and watchdog children were observably armed
before UUID-idempotent creation of `bx_8ydmg3km` at 06:38 UTC, with an immutable
25-minute deadline of 07:03 UTC. One heavy browser runtime was launched.
All 27 runtime artifact references (26 unique SHA values) were retrieved and
independently size/SHA-verified before normal stop.

The first drain assertion failed while resolving the same absolute pin.
A separate settled assertion checked the actual staged locations and passed:
727 unchanged pins, controller and Chrome PIDs absent, both ports closed,
profile and writer absent, and no matching processes. Its complete stdout
was retained before stop. A second inventory request was refused locally
because its attempt filename already existed; the standalone remote settled
drain JSON was not fetched. No second remote inventory execution occurred.

Normal stop completed at **06:40:27.252 UTC**, receipt
**`stop_0cfacaca207e1a87`**, `forced: false`, error null. Final box state is
**archived**, expiry **null**. Supervisor and both children terminated cleanly.
Disk stayed above 5 GB. No second box, resume/delete, guest patch, private game
call, clock/scene/config forcing, emulator source change or deployment occurred.

Full27, parity, audio and unmeasured FPS remain open.
