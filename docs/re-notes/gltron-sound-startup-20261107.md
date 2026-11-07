# Cooperative GLTron sound startup, 2026-11-07

The unresolved boundary is GLTron's sound ring refill loop returning to its
caller before the first scene draw. The SDL wave callback returns and its
semaphore release reaches the auxiliary thread. No emulator repair is justified
by this run. Cooperative menu and gameplay remain unreviewed.

Evidence: `scratch/runs/20261107-gltron-sound-startup/` (ignored), following
[the presentation investigation](gltron-cooperative-presentation-20261107.md).
Only this note and owned run helpers were changed; production sources were
inspected read-only. No nested workers, input, replay, configuration, clock,
private-handler or forced-completion changes were used.

## What the fresh observation establishes

One fresh UUID allocation, `bx_cp7tgmst`, ran the registered original through
the predecessor's cooperative native-GL CLI command, adding only the existing
`--trace-callback-lifecycle` diagnostic. The normal harness deadline was 125
seconds; the child exited zero after 125.655 seconds, with no pending command.
All six compositor capture commands acknowledged. The seven personally reviewed
640×480 captures are teal at 5 seconds and uniformly black thereafter. No
gameplay input was sent because no scene was available to review.

The passive preload preserves method receivers, arguments, calls and returns.
It reads per-instance encoder getters, bounded guest stacks through the existing
sparse-memory translator, the existing callback token ring, and shared audio
queues. There are 126 actual-manager snapshots; utility-worker snapshots with
empty managers are excluded. Sampling and diagnostics have overhead. Counts
below describe this run, not equal-progress comparisons with another mode.

| Boundary | Observation |
| --- | --- |
| GL setup/publication | 172 texture uploads, one clear, one guest swap/publication, zero submitted scene spans or vertices. |
| Per-instance encoder | Main and auxiliary pending bytes/commands, spans and vertices remain zero in every snapshot. Final main counters: 342 calls, 341 flushes, zero spans/vertices. |
| Callback return | 14,336 unique retained lifecycle events include 2,128 return events. Of these, 2,023 have their admission retained too; every pair restores saved EIP, ESP, yield and wait fields exactly. No sampled incomplete-return event. |
| Semaphore handoff | 1,991 sampled grants and 1,991 grant-consumed events show auxiliary wait progress on `0xe0005`. These are deduplicated sampled events, not whole-run totals. |
| Final callback state | Active token zero, last WAT return token 136106, empty function-callback queue, two outstanding timed WAVEHDRs. A pending snapshot token at earlier times is followed by newer return tokens. |
| Actual ownership | Main opens 22050 Hz, stereo, 16-bit output with function callback `0xa3e990`; auxiliary writes/schedules 136108 buffers of 22048 bytes. Completion callbacks run on the registered main owner. |

The trace ring retains only 128 events at a time. The sampled pairs prove those
returns; they do not certify every callback or every interval between samples.
The final token is a WAT return marker, not an inference from API counts.

## Guest caller and first missing progress

The bundled `sdl_sound.dll` loads at `0x765000`, original base `0x10000000`;
SDL loads at `0xa2e000`. Read-only PE/import tables and retained `objdump`
disassembly identify these boundaries:

- GLTron `0x413258` is a sound update/refill function. At `0x4132a7` it calls
  thunk `0x423f22`, the `Sound_Decode` import; continuation is `0x4132ac`.
- `Sound_Decode`, DLL RVA `0x1b6b`, invokes the selected decoder through
  `call [eax+0x20]` at RVA `0x1bff`, returning at RVA `0x1c02`
  (runtime `0x766c02`). Decoder adapter RVA `0x492a` calls deeper decode work
  at RVA `0x4959`, returning at runtime `0x76995e`.
- The GLTron function copies decoded bytes into its ring, updates the write
  index at object offset `0x34`, and loops from `0x4133d7` to `0x41326e`.
  Its earlier index/capacity checks determine whether it exits at `0x4133dc`.
  Its sound-manager caller resumes at `0x412c52`; the next outer return is
  `0x40cbf5`.

All 112 sound-phase snapshots retain raw stack words `0x4132ac`, `0x412c52`
and `0x40cbf5`; 106 also retain `0x766c02`. Main EIP and saved callback
continuations vary through decoder instructions between callback admissions.
The stack scanner's candidate callers are heuristic; the raw stack and actual
call-site disassembly are retained separately. In particular, its simple scan
misses the three-byte indirect call preceding `0x766c02`.

This places the missing observed exit in the sound refill/update path, rather
than a callback stuck at its entry or buffered geometry awaiting publication.
It does **not** establish that a single `Sound_Decode` invocation never returns:
the same refill loop can call it repeatedly with the same sample and stack
addresses. Decoder-call completion and ring read/write indices were not tracked
individually. That is the precise remaining discriminator.

## Completion semantics and timing

Microsoft documents [waveOutWrite](https://learn.microsoft.com/en-us/previous-versions/dd743876(v=vs.85))
as submitting a prepared block and setting `WHDR_DONE` on completion;
[waveOutProc](https://learn.microsoft.com/en-us/previous-versions/dd743869(v=vs.85))
receives `WOM_DONE` when the driver finishes a block. These signals establish
buffer ownership transfer, not completion of the caller's decoder or scene.
The original SDL callback tests `WOM_DONE` and releases its semaphore. Its
behavior was preserved, including its existing choice of synchronization API.

The inspected JS completion path marks DONE, clears INQUEUE and queues an
immutable registration/header submission. WAT admission saves the interrupted
register/wait context; the authenticated callback continuation restores it and
records the return token. The scheduler grants the released unit to the parked
auxiliary waiter, which then consumes its grant. The observed records agree
with those paths; no wrong owner, lost sampled return, wait corruption or
unconsumed sampled grant was demonstrated.

The unchanged CLI uses its synthetic batch clock (default 1000-block main
budget, 200 ms per batch). At exit the audio clock reads 47,930,800 guest ms;
this is not elapsed wall time. Timed completions remain queued ahead of that
clock, and the function queue is empty at exit. The disparity makes producer /
consumer pacing against decoder work a concrete hypothesis. It does not by
itself prove starvation or an incorrect Windows primitive. No clock or budget
was changed to make startup pass. A next investigation should passively pair
decoder entry/return and ring-index changes with these existing completion
tokens, distinguishing slow/incomplete decode from repeated refills that fail
to reach the loop's exit condition.

## Source, checks and handoff

Runtime source is main `1db931c53342c3bfc6b088fed1cecdf4fd238aa6`, with exact
runtime pins, relevant tracked diff and the existing untracked
`lib/wininit-boot.js` patch retained. The actual standard module remains
2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
All 129 observed runtime reads match their staged pins. Pre/postflight match
545 staged inputs and 162 native dependency pins. Existing passed controls
were reused; headless GL and actual WGL context/current/readback checks pass.
All 92 original-media paths are referenced with size/hash, without media or
source archives. Node is v24.22.1, display `:0`, GLFW 7.4.1 / WebGL 6.0.3.

`analyze.cjs` passes byte/hash checks for every recovered artifact, callback
restoration pairs, sampled grants, per-instance encoder state, all seven PNG
pixel inventories, six acknowledgements and normal termination. Helper syntax
and note whitespace checks pass. No production code changed, so there is no
repair regression or new locked-build claim. This unregistered app's evidence
stays with the investigation, not another app's dashboard entry. No historical
census, parity, FPS or audio-quality result is claimed.

43 artifact references / 38 unique contents, 15,638,268 referenced bytes,
were recovered and SHA-256/size verified, including complete compressed logs,
stacks, captures and both modules. Git SHA plus relevant tracked/new/helper/note
patches provide source recovery. Remote cleanup found no owned runtime
processes, ports, profiles or held input. Launch free disk exceeded 5 GB
locally and remotely (remote 57.27 GB).

The detached 25-minute watchdog and separate normal-stop delegate were armed
and observed before allocation. Lifecycle ownership belongs to the coordinator:
the inherited allocation helper's `shutdownDelegated:true` metadata is corrected
by `lifecycle-ownership.json`; no normal stop was requested. After retrieval and
cleanup the local delegates/watchers are retired for handoff, leaving the box
running (API state **idle**), with original expiry **2026-11-07 22:51:06.810Z**.
No stop, resume, delete or public deployment occurred. Coordinator receives box
ownership and the remaining expiry window. This bounded task ends with the
sound-refill exit unresolved, not a menu/gameplay pass.
