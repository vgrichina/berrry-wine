# Re-Volt native recovery, 8 November 2026

Home/End coverage is qualified, and native Home recovery is visibly demonstrated.
Checkpoint/lap progress and an actual End flip remain unproved. This is a partial
result, not a playability pass. Evidence is in
`scratch/runs/20261108-revolt-native-recovery/`.

## Qualified helper

Before allocating the single box, the owned `input.cjs` gained Home/VK36 and
End/VK35. The actual browser adapter also accepts a bounded Up+Left or Up+Right
pair through the same prearmed independent-release pulse; arbitrary combos
remain rejected. The production DOM bridge, renderer input, host RPC and full
module Guest Worker were exercised in a generated local DirectInput fixture.
Trusted Home and End DOWN/UP produced actual buffered device records
`[(0xC7,128),(0xC7,0)]` and `[(0xCF,128),(0xCF,0)]`, respectively. Physical
states cleared, both independent UP receipts passed, and the steering pairs
also passed balanced trusted delivery and buffered-code checks.

See `local-key-qualification.json`, `combo-key-qualification.json` and
`helper-control-verification.json`. Released readiness/identity controls were
reused after hash comparison. The pulse's deadline, independent UP and UNKNOWN
closure logic was unchanged. No production emulator source was changed.

The original PC manual reference is the released
`20261107-revolt-control-reference/` capture of printed pages 4–5 (PDF page 3),
SHA-256 `95d66366b893df94174111ee7db37dff652fc7a4dd1ede303a1433f3f89fc311`.
It documents Home for return to track and End for flip. The Configure Controller
wizard was never entered; all original defaults were retained.

## Original race evidence

The registered original followed default PLAYER, RC Bandit and Toys in the Hood
1 into a reviewed race, with the actual legacy WebGL2 render Worker and default
guest Workers. Guest and renderer both used module
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The selected source commit is `c7da83223fd559cb85bf92538102c792f94c1ff9`;
`runtime-pins.json` identifies 1,068 runtime/media/helper inputs. Original media
is referenced by path and hash, not copied into evidence.

| Personally reviewed capture | Player result |
| --- | --- |
| `review/forward-observed.png` | Player/camera displaced toward curb; 1 mph after release; late held capture shows 7 mph |
| `review/end-two.png` | Upright, visible car at right curb, 0 mph; no observed overturn/flip |
| `review/road-left-fresh.png` | Car tilted and partly below curb edge, 5 mph |
| `review/home-from-curb.png` | After one-second Home, car fully on road and upright, 0 mph: visible native recovery |
| `review/road-right.png` | Player turned on road, 8 mph |
| `review/road-forward.png` | Forward pulse ended against tall curb, 0 mph |
| `review/curb-left.png` | Short left/throttle did not establish curb clearance |
| `review/reverse-curb.png` | After eight-second reverse, 2 mph but no demonstrated curb clearance |

Every listed race image still shows lap **1/3**. Opponent distances and advancing
timers are not checkpoint evidence. Home recovery is established by identifiable
curb/road geometry before and after the balanced native pulse; transient car
ghosting alone was not counted as recovery.

## Delivery and diagnostic boundary

Read-only observations connect physical input, published Worker bitmap and the
original executable's keyboard buffer at `0x6C5F28`. Home appeared as C7 in 45
samples, End as CF in 67, and forward as C8 in 56. Device slot 3 was acquired
with its 256-byte data format. Both stored and active original mappings matched
the documented defaults. A read-only car-list observation found the original
player callback `0x418C50` and changing adjacent steering/throttle control bytes.
No guest state, clock, configuration, bindings or private handlers were edited.

Static original disassembly identifies GetDeviceState at `0x439D80`, default
mapping setup at `0x4193B0`, and native End/Home control flag generation at
`0x418CB1`/`0x418CC6`. The input mapping omission is therefore resolved. No first
emulator disagreement was established beyond that boundary, so a generic
physics/input fix would be speculative. The remaining concrete route boundary
is native curb clearance and alignment near the start line; checkpoint/lap
completion and an overturned-car End test remain open.

One End pulse was followed by black captures. A later passive refresh restored
the race; render work continued without reported errors or lost context. This
does not establish a persistent renderer failure. Two stale-scene requests were
refused before dispatch with zero effects; fresh captures preceded subsequent
input. Their attempted retrievals found an existing prior image and failed
locally without replaying input. The retained logs distinguish these from an
UNKNOWN outcome.

## Custody and next work

The run retains exact source SHA, relevant binary diffs, owned helper patches,
module, original-media identities and manual references. No source archive or
media archive was made. Terminal evidence and lifecycle results are recorded in
`retrieval-verified.json`, `native-command-verification.json`,
`normal-stop-confirmed.json` and `candidate-result.json`.

Terminal verification passed: 30 exact ACKs (including two zero-effect stale
refusals), 21 independently released balanced pulses, 24 trusted key DOWN/UP
pairs, zero held keys/buttons, zero UNKNOWN and zero replay. All 1,068 selected
runtime pins remained unchanged. The browser/launcher PIDs disappeared, both
ports closed, and temporary browser profile and writer lock were removed.
The initial custody assertion caught the launcher still draining immediately
after Chrome exit; the later read-only check passed without repeating input.

All 336 terminal evidence references (273 unique hashes, 17,311,397 referenced
bytes) were retrieved and SHA-256 verified before normal stop.
Box `bx_86zgy92g` stopped at **2026-11-08 00:30:30.420 UTC**, final API state
`archived`, expiry `null`. Normal stop receipt `stop_2e4c09c79e7ad42d` completed
at 00:30:30.438 UTC with `forced:false`. No archive operation was requested.
The observable detached 25-minute watchdog had deadline 00:32:30.327 UTC;
normal stop occurred first and both supervised lifecycle children exited.

Next work should use short native reverse/steering pulses with reviewed road
alignment, then establish a real checkpoint/lap transition. An actual overturned
position is required to qualify End's visible flip effect. A causal emulator
fix requires a demonstrated disagreement after the now-proven keyboard path.
