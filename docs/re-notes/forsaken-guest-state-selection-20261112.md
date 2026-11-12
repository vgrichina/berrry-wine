# Forsaken: original guest state-buffer selection, 2026-11-12

The original guest deliberately selects the additive buffer at `0x469275`
when its float at `[0x795048]` differs from zero. All 620 retained selected
calls agree with the original compare, x87 condition bits, integer TEST
result, caller arguments, global handle and actual Execute object. No CPU or
runtime defect was proved, so there is no production patch. Static float
writers and vertex-color consumers support a death/respawn fade effect;
texture provenance, exact sampling and target history remain unproved.

This advances the producer boundary left by
[the accepted 1715 result](forsaken-native-additive-origin-20261112.md)
(`a51eacd69`) and retains the
[paused-worker constraints](forsaken-paused-worker-20261112.md) (`eec039872`).
The root accepted the 1715 artifact review on the messageboard at 17:34:43Z.
The old 1645 and 1715 pixel witnesses remain historical records, not numeric
address or causal-input templates for this fresh run.

## Original instructions and observed caller

Run: `scratch/runs/20261112-forsaken-guest-state-selection-1735/` (ignored).
Source base: `700fbb1ec61fbbea6f27fdcbed74b81bd2cd4522` plus the exact relevant
binary patches in that run. Original media remained at
`test/binaries/candidates/forsaken-demo/installed/ForsakenDemo.exe`, SHA-256
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`.
Both actual CPU/GPU owners used normal module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

Read-only original disassembly gives:

```asm
469262  fld   dword [0x795048]
469268  fcomp dword [0x4ee398]   ; observed bits 0, float zero
46926e  fnstsw ax
469270  test  ah,0x40           ; x87 C3
469273  jne   46928e            ; equality/unordered skips additive Execute
469275  push  1
469277  mov   eax,[ebp+0xc]
46927a  push  eax               ; viewport
46927b  mov   ecx,[0xa9d04c]
469281  push  ecx               ; selected Execute-buffer handle
469282  mov   edx,[ebp+8]
469285  push  edx               ; device
469286  mov   eax,[ebp+8]
469289  mov   ecx,[eax]
46928b  call  [ecx+0x20]         ; public Execute, return 46928e
```

The immediately preceding opaque Execute returns at `0x469262`. After the
selected call the guest calls `0x4d63f0`; at `0x4692ab` it compares the same
float again and restores opaque state for equality/unordered (return `0x4692d6`).
Thus nonzero intentionally leaves additive state around this scene pass.
Observed frame return `0x467147` led to original `0x467142 call 0x46909d`;
the caller supplies device and viewport. All 620 selected frames have that
return, not an inferred historical caller.

The first retained selection is Execute **19907**, boundary **357971**, in
`diagnostic-tick-71.json.gz`: float **8.236000061035156** (bits `1090766504`),
matching the sampled frame delta, versus zero. Actual EIP/previous EIP are
`0x469275`; previous-previous EIP is `0x469262`. x87 SW `0x84` has C0/C2/C3
clear; TOP/tags are zero. Lazy integer flags are TEST (`flag_op=3`,
`flag_sign_shift=7`, `flag_res=0`): JNE is not taken. Stale lazy flag operand
slots are not interpreted as AH. EBP `122682468` contains caller `0x467147`,
device `136454216`, viewport `136454224`. Stack arguments are return
`0x46928e`, device, **136458472**, viewport, **1**, exactly matching the API.
The actual code operand `[0xa9d04c]` contains **136458472**: object slot541,
entry131822496, buffer**16734700**, size48, instruction range0..40. Its raw
header `08080400` contains `(27,1),(19,2),(20,2),(21,2)`.

`selection-analysis.json` retains 7,520 relevant snapshots: **620 selected**
and **1,142 equal opaque-restoration** calls, zero comparison/flags/branch/
argument/handle mismatches and zero observer errors. Equal restoration has
float0, SW `0x4084`, TEST result64. Later selected values reach float512.
Flags are assessed at the selected/equal-restoration calls, where the
argument pushes/moves preserve TEST, not at unrelated scene entries.

## Why this state exists, and what remains unresolved

Original `0x4a46cb` clears the float. `0x4a4cc3..0x4a4ccf` and
`0x4a4e75..0x4a4e81` add frame delta `[0x794d20]`; `0x4a4ce2` and
`0x4a4e94` clamp to512. Nearby `0x4a4d6a` decrements lives `[0x54c144]`,
with a respawn path resetting the float at `0x4a4daa`. Vertex generation at
`0x439e29` converts the float to intensity and folds values at256 using
512-minus-intensity; `0x43a531..0x43a558` adds/clamps/packs vertex color.
`0x43a565` also branches on this float. This is static evidence of deliberate
fade-related additive rendering, not a live trace proving every writer or
the exact intended visual duration.

Two separate fresh witnesses are preserved completely in
`remaining-witness.json`, including original Execute, state transitions,
owned/public/replayed state, triangles, texture candidates and target:

| Witness | Actual source / producer | Texture and target | Pixel |
| --- | --- | --- | --- |
| First retained sampled white after combat-ready fence4825 | GPU24138; source **7608/1**; Execute19824, return `0x40502a`; preceding state Execute19822 return `0x4693e9`, handle136458464 | texture244, entry131812992, DIB476602368, 256×128; target131805408, DIB471527424, 640×480 16bpp format1; ZWRITE0, ONE/ONE | `[41,166,189,255]` → white |
| Scene after the requested selector | GPU24337; source **7680/0**; Execute20012 return `0x44182f`; selected Execute20011 return `0x46928e`, handle136458472, buffer16734700 | texture210, entry131811904, DIB473559040, 256×256; target131805408, DIB472166400; ZWRITE1, ONE/ONE | `[255,223,231,255]` → white |

The first witness is in capped tick70 and precedes the first retained
`0x469275` selection in tick71. Its event envelope says legacy-fence7609;
the correct draw join is the record's **7608/1**. The preceding sampled
scene Execute19818 has float0. Do not attribute that first witness to this
selector or to primary fire.

For the requested scene, Execute20009 completes opaque restoration,
Execute20011 selects additive with float**97.76699829101562**, correct
SW/TEST/caller/handle, then Execute20012 observes the same float. Triangle8
has interpolated UV `(0.22651625968240824,0.15406722707995493)` and vertex
RGBA `(183,245,221,183)`, `(145,100,78,145)`, `(183,100,78,183)`. Native
level-zero candidates at `(57,38),(58,38),(57,39),(58,39)` decode to
`(140,97,82)`, `(132,81,66)`, `(165,105,90)`, `(132,97,74)` respectively.
These are candidates, not an exact GPU sampling oracle.

The concrete remaining boundary is original texture asset/writer provenance
into those actual DIB bytes, their uploaded/sampled texels, and ordered
prior target contents for these particular source commands. The first
witness's triangle13 samples a different texture near UV
`(0.3645227393621847,0.20933279251005968)` with vertex RGB64; its candidates
include white and `(255,255,214)`. Texture/target/order correctness is not
established by a white pixel or by matching additive state. No speculative
blend override is justified.

## Observer qualification and natural original run

The new run-local selection reader executes only at the existing Execute
API observer. It validates actual original opcodes and derives their data
operands, reads the actual owner's translator/memory/register exports and
stack, and performs no guest call/write or getter that materializes flags.
Inherited final1715 attach, pinned translator, Execute/return observer,
identity, ACK cycle, readiness and independent release helpers are reused.

Before allocation, the emitted reader passed five bounded original-code
cases (0,1.25,512,-1,NaN): observed/control whole 512MiB SHA, registers and
block/control events match. The adapter preserves arguments, receiver,
return and thrown-error identity even when observation fails. The actual
Chrome production CPU/GPU bootstrap controls and updated CPU Encoder
fixture passed; Encoder bytes/messages match the unobserved baseline.
Unchanged negative controls are enumerated with hashes in
`reused-controls.json`. Local provision/import and stale-pin negative
controls passed before allocation; helpers/pins were frozen and hashed.
All 1,559 remote provision paths and the final actual import gate passed
before original execution. API provision batches remain separately capped.

The private original ran normal menus, Normal VOLCANO, four native Enter
pulses, `a`600/700/300ms, then Control1800ms: eight prearmed independently
released pulses, sixteen trusted edges, eleven full PNGs and eleven ACKs
including ordinary quit. All captures match all 19 owner/module/epoch fields.
Chrome's actual CPU target is `909CB5AA3E9445591331498E91FD0FE6`; GPU target
`11555E9168C4EBA6EF638454565D5236`, endpoint1 WebGL2 Intel UHD620 ANGLE/Mesa.
The corridor frame shows lives4/respawn before primary fire; primary combat
still renders a room. Both later passive captures show a white viewport,
first complete at **17:45:00.415Z**. This differs from historical selected
pixels and establishes no causal input attribution.

The retained 153 drains contain 607,813 boundary rows, 427,973 CPU rows and
9,233 GPU events. All 39,932 state applications agree;34,306 Execute entries
have 34,306 returns. Limits: 12,696 startup CPU drops, 29 ground record caps
(including first retained white tick70), three unjoined tail replay keys
at 12448/0,12449/0,12449/1. Boundary rows have no gaps/drops/errors; GPU events
have no reported drops. These limits preclude a global-first-white claim.

## Recovery and shutdown

A fresh observable independent two-hour watchdog was armed before creation.
`bx_cjkc84d4` was created17:37:44Z with initial expiry19:37:43.027Z.
Actual free /home was sampled above1.5GB during input; there was no RAM gate.
Shared growth consumed the32MiB reserve; no more gameplay input followed the
17:45:19Z near-floor report. Later shared-tree floor crossings are retained
on the messageboard, not represented as a continuous storage guarantee.

All 297 unique remote artifacts passed two independent GETs plus local SHA
verification before stop. Source recovery is exact Git SHA plus binary
patches, media path/hash; no source/media archive was created. Closed large
logs/patches are losslessly gzip-packed with both hashes; duplicate PNGs are
hardlinked only after independent retrieval and verification.
`validate-closeout.py` rechecks retrieved SHA, frozen helpers, lossless
recovery, eleven complete PNG CRC/inflate/hash checks,19-field identities,
input/ACKs, selection results, actual parents and normal archive.

Ordinary quit completed17:46:12Z. Actual Chrome parent and browser parent
returned0 with separate stdout/stderr EOF; outer8048 is known exited0 with
untruncated output. Local lifecycle client/owner/watchdog actual waits are0
with captured EOF where piped. Separately, the unified exec session68586
reported143; `lifecycle-exec-return.json` preserves this unexplained wrapper
status. Its cause is UNKNOWN; no all-local-parents-zero claim is made.

Final box state **ARCHIVED**, expiry null. Stop **stop_22369c81dbcc8442**
completed **17:47:15.111Z**, forcedfalse, errornull, after verified recovery.
No box was resumed/deleted. No production code changed, hence no production
regression/build or matched patched-original claim. The useful next work is
the specific texture/target/order witness above, retaining normal timing,
actual-owner address discovery and the bounded read-only observer controls.
