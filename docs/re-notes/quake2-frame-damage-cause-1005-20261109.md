# Q2 open-frame damage diagnostics, 1005

Offline investigation adds bounded passive **damage feedback** to the actual
Q2 observation path in `tools/quake2-passive-attack.cjs`. Capture and progress
now return `attackInput.damageFeedback`: signed HUD health, screen blend,
kick angles and raw pmove flags, plus up to 16 received frames and adjacent-frame
health decreases. `cause` remains explicitly UNKNOWN. Existing first-HP-loss
halt, input policy, startup flags, caller pins and native lifetime rules remain.

Evidence: `scratch/runs/20261109-quake2-frame-damage-cause-1005/`.
No runtime, box, Chrome, guest input or retry was performed.

## Retained original0940 review

Personally inspected `review/frame-edge.png` (HP100, open pane) and
`review/frame-cross-result.png` (HP98, nearer open frame). Their SHA256 values
match the retained capture records. Examined both binding/motion records,
all 14 numbered action records, and frame_step/cross_frame hold records.

| Observation | Received frame | Origin | Velocity | Raw flags |
| --- | --- | --- | --- | --- |
| frame-edge after capture, 09:49:46.101Z | 1373 | 44,-32,24.125 | 0,0,0 | 4 |
| cross_frame held, 09:50:18.247Z | 1653 | 45.25,-31.375,24.125 | 0,0,0 | 4 |
| frame-cross-result after capture, 09:50:19.196Z | 1660 | 36.75,-2.375,24.125 | 0,0,0 | 4 |

The final command requests ArrowUp for 100ms. Its receipt has one wholly-held
physical-high sample and release ACK (started 09:50:18.244Z, release timestamp
09:50:18.343Z). The preceding frame_step requests 150ms and releases ACK.
These are physical input and received-state observations, not damage callbacks.
Crucially, the two HP screenshots are about 33 seconds apart, and their after
snapshots differ by **287 server frames / 28.7 simulated seconds**. No HP field
was retained at the final action's start. Therefore the HP loss cannot even be
localized to that 100ms action: incoming damage while waiting remains possible.
Constant sampled Z/velocity/flags neither proves continuous ground contact nor
excludes a transient fall, environmental/contact event or incoming attack.
The screenshots do not identify a damaging actor. Room entry remains unproved.

Root's original0940 audit was 1790 SHA/size rows and 435 valid gzip streams.
The separate `offline-orderly/before/controller/stdout.log.gz` is truncated;
its decompression failure, size and SHA are retained in `retained-review.json`.
It is explicitly excluded from complete-stream claims and was not repaired.

## Exact shipped binary support and bounds

The existing canonical EXE SHA256 is
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
No external source or different Q2 release supplies offsets. Retained exact
disassembly and executable-byte assertions establish:

- ParsePlayerstate at 0x402eb0 uses frame+0x30 as playerstate. The parser writes
  kick at playerstate+0x34, blend at +0x60 and 32 signed-short stats at +0x78.
- The shipped HUD `hnum` branch reads signed health from 0xa9cf42, stats[1],
  hence health at frame+0xaa. Tests verify the actual `hnum` string and operands.
- Existing publication checks compare the full 240-byte current frame with
  its ring slot. Added signature windows cover the remaining parser and HUD
  read. The observer reads only the fixed 16*240-byte executable-owned ring,
  twice, through the same owner's shared memory. It follows no DLL/edict pointer.

Owner/memory/code checks remain active. Any torn ring rejects damage feedback;
inactive/unpublished current frames reject it. Old, mismatched, missing or
malformed historical slots are omitted; no decrease is inferred across gaps.
Current blend must be finite and in [0,1], kick finite. Health stays signed.
No RPC/export, hook or guest-memory write is introduced. The existing production
composition already hashes this reader, so its generated provider pin changes
automatically without changing shared callers or another game.

These fields retain useful causal inputs, **not causality**. Blend combines
visual effects; kick does not identify a shooter; health decreases are not
T_Damage events. Neither attacker, means-of-death, water contents nor contact
entity is present in this bounded client reader. Ring wrap and sampling gaps
can lose events; repeated equal reads are not atomic history or lifetime proof.
Nothing is retrospectively reconstructed for original0940.

## Validation and next use

Actual new regression against the old production reader fails because
`damageFeedback` is absent; the changed reader passes. The serialized actual
capture/progress reader is tested with authored health100->98, blend/kick,
signed health, bounded wrap, gaps, malformed values, current/history races,
owner retirement and zero shared-memory writes. Authored data is not original
game evidence. Existing passive reader tests pass. Focused real composition
normal/held-UNKNOWN/torn/wrong-module/unpublished cases pass, including exact
caller drift refusals and unchanged caps. Locked `tools/build.sh` passes.
An initial composition invocation omitted its required output argument and
failed before scenarios; its log is retained separately from the passing run.

Next separately authorized runtime can consume the new pinned reader and retain
health/feedback before, during and after the first loss. This task authorizes no
new runtime or route. Box ID/state/expiry/stop receipt: null, NOT_CREATED.
SingleTaskSTOP.
