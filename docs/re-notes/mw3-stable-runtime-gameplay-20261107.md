# MW3 stable composed runtime and Digit5 boundary — 2026-11-07

The released composed runtime reached the original MW3 cockpit. One documented
ordinary top-row **5** pulse did **not** establish movement: speed remained
zero, OP Able remained **449 m** away, and terrain alignment did not change.
Actual keyboard consumption by MW3 remains **UNKNOWN**. The qualified observer
recorded **zero keyboard-state completions**, 11 non-keyboard completions,
zero drops and zero diagnostic errors. Trusted DOWN/UP events and transport ACKs
do not fill that consumption gap. No turn or fire followed this first boundary.
This does not demonstrate an emulator defect, so no production repair was made.

Evidence is retained in `scratch/runs/20261107-mw3-stable-runtime-gameplay/`.
This note is the only committed change. The predecessor keyboard-throttle and
headroom-gameplay notes, retained driver, observer and ordinary route were read.
One original and one fresh UUID allocation were used; no accepted input matrix,
private input handler, forced capture/profile, guest binding/settings/clock or
memory write, guard relaxation, UNKNOWN replay or nested worker was used.

## Exact composed local qualification and staging

Preparation followed published MIDI fix **eee2adf57**, at checkout
**994008917622964e3ae9768c0bf3e6802607c480**. The retained Digit5/VK53 driver,
keyboard observer, production guest/render Workers and runtime closure were
qualified together through the generated public-COM keyboard fixture.
It returned **839** successful 256-byte keyboard states, including DIK slot 6
pressed (`0x80`) during the 1,500 ms pulse and zero after independent UP.
The device was **149037112**, output buffer **16968580**, caller **16968896**,
type 7 / keyboard kind 1. This proves generated-fixture consumption, not MW3's
keyboard path. Both native events were trusted. Exact local ACKs 0–3 covered
observer arm, Digit5, observer removal and normal quit.

Focused controls refused wrong Worker instance/endpoint, changed module bytes,
wrong completion location, wrong device/request/format/HRESULT/buffer/caller,
mouse-only evidence, replacement of every one of the 18 identity fields, and a
120,001 ms expired capture with zero input effects. A stalled DOWN ACK still
independently attempted UP and returned sticky UNKNOWN. Observer restoration,
closed-child refusal and normal local Chrome exit passed. The unchanged native
motion helper's focused regression passed. Its conservative complete menu/Launch
simulation passed at blank acquisition anchor **(350,430)**, with physical bounds
**(50,210)..(630,650)** inside canvas **(10,194)..(694,674)**. This simulation is
headroom evidence, not original navigation or consumption.

All **308** pins were checked before allocation, before uploading any file,
individually when uploaded, at remote boot and after execution. No pin changed
or was relaxed. The published `lib/host-audio.js` was 210,748 bytes, SHA-256
`bb89e4e95190b7db98390e5d67f1c99fdcdf7e7e77f0388aa0126cd256869365`.
Only the qualified runtime/helper closure and recorded media were staged,
individually, without a source or media archive. All **210** successful HTTP
responses matched their pins, covering **165** unique paths.

Both executing guest and renderer modules were measured through CDP as
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
**2,182,493 bytes**. The observer verified the 470-byte GetDeviceState handler
body and executable completion **887941**, owning Worker instance/endpoint,
module and current owner/epoch/freshness before installation. Its condition
returned false, wrote diagnostic JavaScript buffers only, and was removed with
its globals. This does not claim a module rebuild at the recorded checkout SHA.
The manifest's inherited `commit` field names its historical baseline;
`source.json` records this task's actual preparation SHA.

## Current ordinary navigation and cockpit result

Startup pixels showed the Zipper logo; a passive capture then established the
current main menu. The reviewed blank-anchor click acquired Pointer Lock on
`screen`, with automatic selection true, no explicit profile, cooperative flags
5 and unchanged sensitivity approximately 1.3. No acquired session was reanchored.
The acquisition click's returned mouse-button state was not observed in this
task; an asynchronous zero snapshot is not a completion claim.

Bounded ordinary motion and current consumed cursor reads placed the cursor on
Instant Action, created pilot `a` with ordinary `a`/Enter, and accepted default
Bushwacker / Operation 1A / Battle Progression / Wave 1. Live cursor positions,
renderer coordinates and tracked native coordinates were kept separate. At
Launch the consumed software cursor was **(575,432)** and tracked physical point
**(554,584)**. Settled current pixels showed the highlighted lower-right
deployment icon matching the proved predecessor control; a readable tooltip is
not claimed. One click opened the cockpit.

`mission.png` shows terrain, cockpit framing and HUD, initially OP Able 448 m
at clock 00:00:00. The immediately pre-input `throttle-armed.png` shows **449 m**
at 00:00:01, speed zero, ER Laser selected and ammunition **100,100,24,24,20**.
The written throttle review repeated the earlier 448 m value; the retained
pre-input pixels establish 449 m and are authoritative for the comparison.

The keyboard observer was armed at **16:17:08.153Z**, before the only cockpit
input. Ordinary **Digit5/VK53** DOWN was attempted **16:17:19.577Z**, acknowledged
.579Z, with a trusted native DOWN at .578Z. Independent UP was armed before
DOWN, attempted **16:17:21.576Z**, acknowledged .579Z, and produced a trusted
native UP at .577Z. This was one 2,000 ms pulse of the demo's documented 50%
throttle key, not ArrowUp or a changed binding.

`after-throttle.png` completed **16:17:27.120Z** and `throttle-final.png`
**16:17:41.002Z**. Both retain speed zero, OP Able **449 m**, the same terrain
alignment and ammunition. The mission clock advanced to 00:00:02 and 00:00:03;
that is not movement or an uninstrumented performance claim. The final PNG's
SHA-256 is `1965d71ce8cf57bfc457b733b08dfab65bc71769326d3276596173d1fab4af40`.

The observer reported no keyboard states, so it cannot demonstrate either
pressed or released Digit5 in MW3's returned input. Eleven other-device
completions do not substitute for that evidence. The first reproducible blocker
is therefore **the original keyboard-consumption path is not established**, with
no useful throttle consequence. No LeftArrow turn or Space fire was attempted.
The next separately scoped diagnostic should identify MW3's actual keyboard
API/message path and qualify observation of that path locally before another
original. No failure in the emulator's key semantics has been established here.

## Recovery and lifecycle

`source.json`, `relevant-tracked.patch` (empty at qualification),
`relevant-new-source.patch` (the qualified untracked `lib/wininit-boot.js`),
owned-helper/document patches, runtime pins, actual loaded module and existing
media path/size/SHA references preserve recovery. Git remains the source archive.
Unique logs/captures/modules were retrieved without bundling source trees or
repeated game media. Exact original ACKs **0–16** and **56 trusted native events**
were retained. All **217** remote artifact references (**9,663,472 bytes**)
were SHA/length verified before the normal-stop request; these represent **198**
unique hashes (**9,652,642 bytes**).

One persisted UUID Idempotency-Key allocated **bx_ga6esek2**, original expiry
**17:12:32.414Z**. Normal shutdown was explicitly delegated to one OS subprocess;
an independent watchdog was armed before allocation. Its immutable 1,500-second
deadline was **16:37:32.566Z**, derived from the persisted allocation receipt,
not an assertion of exact API creation time. Both delegates retained half-second
heartbeats, maximum sampled gaps 0.504 / 0.506 seconds. The watchdog was proved
alive immediately before and after confirmed normal stop, then exited normally.

Delegated stop **stop_efa6583bfdbccaa5** completed **16:19:07.631Z**,
`forced:false`. The box is **archived**, current `archiveAfter:null`, retained-data
expiry unknown. No lifecycle ownership remains. Chrome exited normally with
code 0 at **16:18:02.289Z**. The first custody check caught the Node driver still
exiting; that failed assertion and observation were retained. A later read
confirmed its absence without a signal or input replay. Both remote ports
**39095/43739** were closed, profile/writer lock absent, and held inputs empty.
Local driver/Chrome, ports **36285/37631**, profile and writer lock were also
absent. Lifecycle processes and the messageboard watcher were closed. Sampled
free disk stayed above 2 GB; no continuous minimum is claimed.

Focused composed qualification, independent-release/refusal controls, headroom,
exact ACK, served-pin, module, custody, retrieval-hash and owned-evidence checks
passed. No production code changed, so a locked build was not required.
The global evidence checker still reports unrelated existing Alice and
Tunnel/Twist containment errors. MW3 has no corpus candidate; task metadata is
retained as `investigation.json` without attaching an unrelated dashboard entry.
