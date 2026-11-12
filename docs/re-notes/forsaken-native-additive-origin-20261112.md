# Forsaken native additive-command origin, 2026-11-12

The original application explicitly submits additive render-state commands before
the following scene Execute. The retained command bytes, instruction parsing,
natural state stores and packet state agree. No runtime mismatch was proved;
no blend, clear, texture or other runtime repair was made.

This continues [the paused-worker/raw-state investigation](forsaken-paused-worker-20261112.md)
at `eec039872`. That run's first retained white witness remains GPU30810,
10339/0, texture handle 208 with ZWRITE=1. Its snapshot/replay path is closed
by its own evidence. This fresh run does not substitute its different first
white witness for that historical one, or confer independent parent acceptance.
Parent full artifact review remains pending.

Evidence is in `scratch/runs/20261112-forsaken-native-additive-origin-1715/`.
The source base is `eec0398723f94568c7d524e9a94e791ad407651f`; exact binary
source/helper patches, pins and compressed-byte recovery hashes are retained.
Git is the source archive. No source-tree or media archive was created.

The final 1645 attach, private pinned translator/boundary, input identity,
ACK/cycle and telemetry helpers are byte-identical. The added run-local observer
reads Execute object metadata at the public API entry and command headers/state
records at existing natural Execute trace imports. It records handle, buffer,
offset, size/count, bounds, raw state bytes, parser triples and return value.
It adds no guest writes, calls, render fences or state substitutions. Its order
shares the existing natural post-store/enqueue boundary serial. Causal command
selection is bounded by **owned enqueue**, not later publication.

Controlled byte/triple/count/bounds/high-address checks pass. Actual Chrome CPU
and GPU production bootstrap controls pass, and production Encoder bytes and
messages match an unobserved Chrome control. The first CPU bootstrap control's
fixed 250 ms ready sample was premature; its Chrome closed normally. A fresh
control with a bounded readiness wait passes. Both results are retained. Prior
negative attach and identity controls are reused with their recorded hashes.
The actual local Transport.provision whole-input seam, stale-pin rejection,
safe Python imports and transitive JS imports pass before allocation. All 1,557
remote provision paths are checked, followed by remote final import/pin checks
before Chrome. Runtime, normal module and media pins match 1645.

Fresh normal original menus, NORMAL difficulty and VOLCANO briefing lead to
gameplay with five lives and SHLD128/HULL128. Native a600/a700/a300 movement
is retained. The `corridor` capture already shows four lives and respawn before
the Control1800 primary pulse; preserve that difference from the predecessor.
`post-combat-passive` shows the bright rotating death scene, and
`post-death-passive` at **17:23:54.165Z** shows the white viewport with yellow
fragments. There are eleven full PNGs with nineteen bound identity fields,
eight independently armed/released native pulses, sixteen trusted input edges
and eleven command ACKs. There is no replay.

The actual owner is WebGL2 / Intel UHD 620 through ANGLE/Mesa 23.2.1, endpoint 1.
Both owning worker bindings identify normal module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
CPU target is `BDD784E98E3F72FDA3099766B5780935`; GPU target is
`C84956A423D2752920C085168E330472`. These claims come from actual owner,
epoch, module and frame bindings, not the page's dropdown or counters alone.

The fresh run's first retained selected-pixel white after the combat-ready
fence is **GPU19828, 6504/1**, in `diagnostic-tick-94.json.gz`, drained at
17:22:20.299Z. It changes [214,211,231,255] to white using texture handle 244,
ZWRITE=0 and ONE/ONE. This precedes the corridor capture and the primary pulse.
Its public scene Execute15988 uses handle 136455784, buffer 19178716,
buffer size 32767, instruction offset 3200 / length 452, flags 1, and returns
zero. Before it, Execute15986 uses state-only handle 136458464, buffer 19799476,
size/length 48 and offset 0. Its header `08080500` explicitly requests five
8-byte records: (14,0), (27,1), (19,2), (20,2), (21,2). Parser triples, bounds,
stores, live/owned/publication/replay/workspace/description agree.

The later scene witness **GPU19857, 6518/0** changes [255,243,255,255] to white
with texture handle 210, ZWRITE=1 and ONE/ONE. Its source scene Execute16009
also enqueues texture handle 208 with precisely the predecessor's eight retained
raw state values, before the 210 draw. The 208 packet is 6517/0; it is not a
new selected-pixel white-transition witness. Its application source is handle
136458432 (`0x082230c0`), buffer 27853204 (`0x01a90194`), size 6784,
instruction offset 5184 / length 1192, viewport 136454224, flags 1.

Immediately before that scene:

- Execute16006/16007 submit the opaque state buffer, handle 136458456,
  buffer 21090964, size/length 72, header `08080800`. Natural readbacks at
  boundary rows 282921/282924/282926 retain (27,0), (14,1), (20,1).
- Execute16008, at boundary 282934, submits handle **136458472**
  (`0x082230e8`), buffer **16734700** (`0x00ff59ec`), allocation size 48,
  instruction offset 0 / length 40. Header **`08080400`** agrees with parser
  (opcode 8, record size 8, count 4), within both command and buffer bounds.
- Its record bytes are `1b00000001000000`, `1300000002000000`,
  `1400000002000000`, `1500000002000000`: respectively (27,1), (19,2),
  (20,2), (21,2). These explicitly request ALPHABLENDENABLE=1,
  SRCBLEND=ONE, DESTBLEND=ONE and legacy texture blend 2. ZWRITE is inherited
  as 1 from the preceding restore; this command does not change it.
- Natural readbacks 282940/282942 retain (27,1), (20,2). Execute16008
  returns zero at 282943. Scene Execute16009 begins at 282944, sets texture
  208 from the raw record at offset 5216, and enqueues at 282955/282956.
  It later sets texture 210 at offset 5876, enqueues at 282967/282968,
  and returns zero at 282970. No intervening opaque restore was lost.

The runtime's `src/09aa-handlers-d3dim.wat` Execute walker reads those same
header triples and forwards opcode 8 to `d3dim_exec_state_walk`. The latter
reads consecutive (state,value) pairs at 8-byte stride and calls
`d3dim_set_render_state` in `src/09ab-handlers-d3dim-core.wat`. For these
observed commands bSize is exactly 8; enums and values agree through lowering.
All **33,723 retained changed-state applications** match an explicit source
record. There are zero retained command/parser/application mismatches and zero
observer errors. This excludes that parser/state-store path for the witnessed
inputs; it does not prove the application intended the final rendered image.

Coverage limits are material. There are 158 drains, 510,689 boundary rows,
385,754 CPU rows and 8,607 GPU events. A long command-8 passive capture causes
3,803 boundary drops (serial gap 403314 to 407118), fifteen GPU event drops,
and one missing Execute24023 return in that gap. No return is inferred for it.
There are 203 unjoined replay keys, including later tail keys. Eleven ground
drains reach the existing 32-record limit, **including tick94**. Its boundary
and GPU event streams have no recorded drops, but its capped ground records
still preclude an exact/global first-white claim. Native texture samples remain
observation-time level-zero candidates, not an exact sampled-texel or original
asset/writer oracle. Existing predecessor startup drops and its own trace/tail
limits remain unchanged. The selected-pixel observation does not timestamp the
first instant the entire viewport turns white.

The next specific unobserved producer boundary is the original guest path at
`0x469275` (observed return `0x46928e`) selecting the state-only buffer
`0x00ff59ec` before the scene path at `0x4417f2` (return `0x44182f`). Why it
selects that additive pass, and the preceding texture/vertex/asset production,
remain unproved. White output is not evidence that those native requests are
wrong. No mandatory fix follows from these results; further work needs a
specific producer or texture/state mismatch rather than a rendering workaround.

Chrome and browser runner have actual zero parent waits and both EOFs. The
outer API process 8238 is independently observed exited/known with exitCode=0
and untruncated streams. All **302 unique remote outputs** were downloaded twice
independently and reread/hash-verified locally before delegated normal stop.
Box **bx_vkm7au3e** initially expired at 19:15:39.178Z; its final state is
**archived / expiry null**. Stop **stop_2ff25b68c4c915cb** completed at
**17:24:59.215Z**, forced=false, error=null. Local lifecycle client, actual
owning parent and independent deadline watchdog all have zero waits and EOF
evidence. No missing runtime wait is filled from another process's result.
Do not resume or delete the box. Sampled actual local disk stayed above 1.5 GB;
no RAM gate was used.

Only this note is committed. Runtime code and original binaries are unchanged;
there is no changed-original before/after or locked-build claim, and no parity,
FPS, audio, enemy-defeat, level-completion, full-27 or broad crash-free claim.
