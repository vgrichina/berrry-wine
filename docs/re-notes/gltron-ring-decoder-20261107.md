# Cooperative GLTron ring decoder, 2026-11-07

`Sound_Decode` returns repeatedly. The original refill stays in its loop because
the ring remains far short of its fill threshold while the auxiliary consumer
continues requesting audio. No WAT/JS disagreement was demonstrated, so no
production source was changed. First menu geometry remains absent.

Evidence: `scratch/runs/20261107-gltron-ring-decoder/` (ignored), following
[sound startup](gltron-sound-startup-20261107.md). This was one bounded task,
one fresh UUID and one original cooperative execution, without nested workers.

## Natural decoder and caller boundaries

The run helper wraps instantiation and the existing `host.log_eip` diagnostic,
preserving import calls, arguments, receivers and returns. It arms the existing
WAT `set_trace_eip_range` export, reads register exports and translates original
guest memory through `lib/mem-utils.js`. It does not write guest state, execute
guest callbacks, force completions, change configuration or change clocks.
Block tracing has overhead and disables some fast execution paths; these are
observations of this diagnostic run, not an equal-progress comparison.

Runtime `sdl_sound.dll` base is `0x765000`. Natural `Sound_Decode` entry is
`0x766b6b`; its original caller return is `0x4132ac`. Each main-instance request
gets a serial number and retains its sample pointer, stack pointer, return
address, original ring object and the existing callback-token registers.
Return pairing requires the same instance/request and entry ESP + 4. Callback
tokens are independent completion-context markers, not decoder request IDs.

| Boundary | Result |
| --- | --- |
| Decoder entry/return | 6,093 refill requests entered; 6,092 returned, zero orphan returns. Request 6,093 was naturally pending at the harness deadline. |
| Decoded length and status | Every paired return has EAX = 4,096 and sample flags = 0; neither original tested error/EOF bit (`0x40000000`, `0x20000000`) is set. |
| Ownership | Producer instance 1 and consumer instance 2 share ring object `51160292` and sample `28990700`. These are observed addresses, not durable ABI constants. |
| Refill caller | One entry at `0x413258`, zero hits at its `0x4133dc` exit. All five `0x412c52` manager continuations precede this refill entry; zero occur afterward. Outer continuation `0x40cbf5` is never reached. |
| Retained detail | First 12,000 selected records cover 16,114.832–21,507.080 ms after preload, with 316 complete decoder pairs. Thereafter only whole-run aggregates continue. |

For example, request 314 enters with last-returned callback token 4752 and
returns with token 4766 after 22.930 ms. Request 315 spans tokens 4766–4785;
request 316 spans 4785–4801. These are natural repeated invocations, not one
decoder stuck beneath a reused stack return address. The bounded detail and
aggregate distinction is explicit in `ring-analysis.json` and `ring-summary.json`.

## Original ring arithmetic agrees with observed execution

Original disassembly is retained in `ring-original.asm`. The object fields are
sample `+0x20`, decode target `+0x24`, ring storage `+0x28`, capacity `+0x2c`,
read index `+0x30`, write index `+0x34`. Capacity is 163,840 and target is 8,192.

At `0x41326e`, equal indices take the decode path. Otherwise the original
computes `(read - write + capacity) % capacity` and exits only when that free
space is at most 8,192. Thus the ring needs at least 155,648 occupied bytes to
leave this refill. After decoding, the original updates
`write = (write + decodedLength) % capacity` and loops. The consumer at
`0x4130d9` advances its read index only when its requested bytes are available.

The retained detail verifies all 316 producer updates against that modulo
formula, and 4,459 consumer entry/end pairs against unchanged or 22,048-byte
read advances; 58 advance. At the 317 retained loop checks there is one initial
equal/empty case; every other free-space value is 137,760–159,744, above the
exit threshold. The observed branch agrees with the original instructions.

Whole-run aggregates independently reconcile both indices across wraparound:

| Progress | Bytes / final index |
| --- | --- |
| 6,092 producer returns × 4,096 | 24,952,832 produced; modulo capacity = write 49,152. |
| 1,131 successful consumer paths × 22,048 | 24,936,288 consumed; modulo capacity = read 32,608. |
| Produced minus consumed | 16,544 occupied bytes, exactly the final original ring difference. |

There are 90,018 consumer entries; success-path counts are not interchangeable
with output submissions or attempted reads. SDL submits 90,271 output blocks
of 22,048 bytes while this ring supplies only the successful reads above. No
unobserved successful read or lost producer update is needed to explain the
final indices. There is no observed error/EOF reset.

The remaining boundary is the scheduling/timing relationship between decoding,
SDL read attempts and timed output servicing: why the cooperative route keeps
consuming the available ring before its producer can fill to 155,648 bytes.
The final synthetic audio clock is 36,929,000 guest ms over a 125.537-second
harness run. That disparity and the interleaved token/read progression locate
the next discriminator; they do not establish a violated primitive or justify
changing the clock, skipping audio or forcing completion as a semantic repair.
A further source change needs an exact incorrect scheduling/completion decision
against the original request and clock domain, then a focused failing regression.

## Checks, source recovery and lifecycle

The unchanged callback evidence also retains 1,987 admission/return pairs with
exact saved-context restoration and 1,955 grants consumed. All 126 per-instance
samples have zero pending encoder bytes/commands and zero scene spans/vertices.
GL reports 172 texture uploads, one clear/publication and zero scene draws.
All six capture commands acknowledge, with no UNKNOWN or replay. Seven PNGs
have verified pixel inventories: teal at five seconds, black at ten seconds
through final. The distinct image contents were visually reviewed. No gameplay
input was sent before a reviewed menu, so no held DOWN required an UP.

Runtime pins record Git `dff50f0c1839a66bd09e076af46587490b2c895e`, relevant
tracked diffs and the existing untracked `lib/wininit-boot.js` patch. Standard
module SHA-256 remains
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`
(2,182,500 bytes). All 129 observed runtime reads match staged pins; 546 staged
inputs and 162 native dependency pins match before/after. Existing passed
controls were reused, with fresh-box headless GL and WGL context/readback checks
passing. The 92 original-media paths have size/hash references. Source/media
archives were not created; Git SHA plus relevant source/helper/note patches and
the retained modules provide recovery.

`test-probe.cjs`, `analyze-ring.cjs` and `analyze.cjs` pass the diagnostic-call
preservation/pairing checks, ring arithmetic, callback restoration, capture ACKs,
pixel inventories, loaded-input pins and retrieval hashes. Helper syntax and
note whitespace checks pass. No production repair, regression or new locked
build is claimed. The global evidence checker still reports seven unrelated
containment errors; this owned investigation has none. No menu/gameplay, audio quality, parity, FPS or historical
coverage claim is made. This unregistered app remains in investigation notes.

46 artifact references / 41 unique contents, 18,348,385 referenced bytes, were
retrieved and SHA-256/size verified before requesting normal stop. Launch free
disk exceeded 5 GB locally and remotely. The independent detached 25-minute
watchdog and normal-stop delegate were armed and observed before allocation;
watchdog maximum heartbeat gap is 1.073 seconds. Explicit delegated normal stop
`stop_2f799a4f463a3f25` completed at `2026-11-07T22:52:57.438Z`, forced=false,
error=null. Box `bx_urhra99r` is **archived**, current expiry null; its original
expiry was `2026-11-07T23:14:38.726Z`. Stop request/result and final state are
retained in `lifecycle-stop-result.json` and `normal-stop-confirmed.json`.
Both delegates exit zero, supervisor remaining children are empty, and owned
runtime processes, ports, profiles, held input and local watchers are closed.
No resume, delete or public deployment occurred. This bounded task ends here.
