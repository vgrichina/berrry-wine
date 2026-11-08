# Forsaken current native progress, 8 November 2026

Current owning WebGL **movement and primary-fire ammo response are verified**.
The broader task is **incomplete**: this run did not establish current look,
identify an enemy/objective, or progress beyond the initial Volcano corridor.
The worker spent the fixed execution window on reviewed menu navigation and
short thrust pulses, leaving look too late. This is an execution limit, not a
demonstrated emulator defect or a newly discovered gameplay cause.

Evidence: `scratch/runs/20261108-forsaken-current-native-progress/`.
The accepted November 7 movement/fire sequence, **PULS 2000→1918**, remains
accepted. This is current-module evidence, not first-ever Forsaken gameplay.
The previous `c1ab23eec` diagnostic did not reproduce the old Start timeout;
that failure remains unresolved. Its measured owning-guest waits were state
flags **4.031 s**, identity before image **7.991 s**, and identity after image
**3.531 s**. Unrelated-thread selection was refuted as their cause and was
removed from this run's active bound helper.

## Qualified observation composition

The run-local helper combines the GPU-enable flag read with the owning guest's
instance/endpoint/slot read **inside the capture-before observation**. That
same observation supplies the CPU portion of the associated state record.
It does not save an identity observation for another capture or admission.
The page and owning renderer state remain current reads. Before and after
each screenshot, separate live guest-instance, guest module-byte, renderer
owner/module/context and page-reference checks remain mandatory. Readiness
still requires two stable complete readings; admission independently rereads
the live binding and checks the reviewed image hash and freshness.

Preallocation tests used actual current production guest/render Workers and
module `7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`:

- `local-old/` and `local-combined/` execute the real numbered command,
  admission, independent hold release, settle, state and image composition.
  Controlled **4.8-second host receipt delays on guest evaluations** make the
  released composition exceed its unchanged **21-second** work window.
  Its already-started work eventually drains at **21.879 s**, without a success
  ACK; sticky UNKNOWN rejects follow-up input. The combined composition finishes
  in **17.030 s** with the exact ACK. These are controlled host-service tests,
  not a reproduction or explanation of the old original Start failure.
- Both controls release Enter at about **750 ms**, independently of delayed
  observations. Separate slow-sampler and injected-UNKNOWN release tests pass.
- `local-final-identity/passing-after.json` covers missing-renderer timeout,
  process replacement before binding, endpoint/render-owner/process-owner
  replacement, every reviewed identity field, stale-scene rejection, and
  trusted native DOWN/UP. Negative controls dispatch zero input. Additional
  replacements inside the observation callback and after screenshot return
  are detected by the distinct after-image proof. Changed returned live module
  bytes are rejected. Generated caption/white-canvas pixels were personally
  reviewed solely as helper evidence.
- Final native key/type/combo preflight passes. All eight existing capture
  deadline tests and the GPU fallback-counter test pass. Fifteen helper syntax
  checks pass. Five local browsers exit zero and their resources drain.

WORK=20 s, CDP deadlines, ACK rules, immutable runtime/cleanup limits, exact
identity and 120-second freshness rules were not increased or relaxed.
No guest scheduling, renderer or production emulator implementation changed.
Only this note is committed; helper changes are preserved as run-local inputs
and patches. A new locked build is not claimed for this documentation change.

## Personally reviewed original results

One fresh box and one original browser followed native Single Player → Start
→ Level Volcano → briefing/loading → player world. Early `singleplayer.png`
actually shows the attract tunnel and is excluded from gameplay/menu-transition
claims. Escape returns to the copyright notice; subsequent reviewed images
show the Probe intro, native main menu, submenu and Volcano selection.

All named images below are in `review/`, with originals in `retrieved/original/`.

- `volcano-ready.png`: textured teal starting room, central doorway and player
  HUD: Lives 5, shield/hull 128, POWER 1, PULS 2000, MUG 5.
- `primary-fire.png`: after one independently released **1-second Ctrl** pulse,
  PULS is **1998**. This is visible ammunition response. The held image precedes
  that change; no projectile impact, damage or enemy kill is claimed. No further
  fire was sent.
- `thrust-door.png`, `doorway-advance.png`, `enter-corridor.png` and
  `corridor-forward.png`: separate **2-second A** pulses move the viewpoint
  toward and through the doorway. Enlarged doorway framing and changed wall,
  grating and ceiling geometry persist in the released-input captures.
- `corridor-center.png` through `far-junction.png`: continued translation
  along the initial metal corridor and past its first ceiling vent. Eleven
  thrust pulses total **22 seconds** of physical A holds. PULS stays 1998;
  Lives 5 and shield/hull 128 remain readable. The final image still shows the
  initial corridor. Its label is not proof of reaching a new room or junction.

There are **20 exact numbered success ACKs**, **19 completed independent-release
receipts**, **21 bound captures / 22 original PNGs**, and **zero UNKNOWN**.
Current original command durations are **2.452–15.743 s**, including their
settles and capture composition; the passive loading command takes 11.124 s.
The maximum observed guest identity evaluation is **8.810 s**. No command work
or CDP deadline fired. The combined helper is usable for these tested commands;
this does not explain the historical uninstrumented failure.

At **06:25:53.625 UTC**, the separate `look-right` request failed the unchanged
prepublication budget check: **“command cannot fit immutable run/cleanup
deadlines; not queued.”** The browser deadline was **06:26:45.625 UTC**, leaving
about 52 seconds, versus the client's 50-second ACK minimum plus 30-second
cleanup reserve. There is no numbered look command, key dispatch, or ambiguous
ACK. Input was closed and the refusal was not replayed with altered budgets.
Chrome closed at the original cap. The remaining dependency is a current,
reviewed turn/navigation sequence exposing and aiming toward an actual enemy
or objective beyond this corridor. No missing emulator behavior was proved.

## Identity, recovery and stop

Recorded source identity is main
`c98ab8486fb03eebf67e5f24bf4875e24a965570` plus `relevant-source.patch`,
`new-lib_wininit-boot.js.patch` and owned helper patches. Git is the source
archive. All **1,488 staged pins** remain unchanged; **737 successful served
responses** match their pinned bytes. All **873 original media references**
remain unchanged, including executable SHA-256
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`
and manifest SHA-256
`587ce145ab73a3fed2c7136425bb6a7bcf28def312d430c8bf7d1be802b2260b`.
No source/media archive was created.

Actual route: `index.html?candidates&no-log&threads&app=forsaken_demo&d3d-renderer=webgl`,
Chrome **151.0.7922.108**. Actual guest/render module SHA-256 is the `7ec49…`
value above. The bound owning legacy endpoint **1** uses a **640×480 WebGL 2.0**
context observed in its actual Worker, reporting ANGLE / Intel UHD Graphics
620 / Mesa 23.2.1. All retained state checkpoints report zero renderer errors,
GPU fallbacks, inline software draws and fallback software draws.
**Physical GPU remains unknown**; the reported renderer string is not hardware
attestation. Full 27, parity, audio, FPS, enemy interaction and level completion
remain open.

All **271 remote references / 250 unique contents**, **16,930,434 reference
bytes**, were retrieved and independently size/SHA-256 verified **before**
normal stop. PNG chunk CRC/decompressed-row checks and binding checks pass.
The verifier's initial assumptions about an omitted success-only release-error
field and nullable trace expression metadata were corrected locally; no runtime
data or execution was changed. Chrome exited **0**; controller/browser PIDs,
all processes naming the owned runtime, HTTP/CDP ports, profile and writer lock
are absent. Free local disk remained above **5 GB**; no RAM gate was used.

The independently supervised, observable 25-minute watchdog was prearmed before
UUID-idempotent allocation. Box **`bx_46m2ysxp`** is **archived**, current expiry
**null**, original expiry **2026-11-08T06:42:20.242Z**. Normal stop
**`stop_eecc71f1ea2c9050`** completed **2026-11-08T06:28:35.415Z**,
`forced:false`, error null. Both lifecycle delegates exited zero; the supervisor
has no children. No box was resumed/deleted, no second original ran, and no
deployment occurred. This single-task worker releases ownership and stops.
