# Recoil verified Software and exact motion counts, 2026-11-08

Run: `scratch/runs/20261108-recoil-software-native/`.

**New native result: Software was visibly selected before game load.** The
current startup PNG was personally reviewed; the tested `reviewed-point.cjs`
witness used that PNG's hash, captured canvas rectangle, and radio target
`(190,450)-(203,464)` to reach `(196,457)`. A second reviewed click on the
Software label left the radio unobscured. In `software-clear.png`, Accelerator's
center `(196,423)` changed from black to white and Software's center `(196,457)`
changed from white to black. That unobscured capture was personally reviewed
before OK. Its SHA-256 is
`5d1c600fdfbdb05c41bb1d8b7e287c1d5d2ad43659abee8b3c136a0c0e03f795`.
The old normalized point was not reused.

**First new causal integration repair: preserve every requested relative mouse
count across DOM events.** The actual native driver divided each requested delta
by ten and constructed ten `MouseEvent`s. Chrome's integer `movementX/Y`
conversion truncated every fractional step separately. Native passive events
prove `[0,-13]` became `[0,-10]`, `[-130,-34]` became `[-130,-30]`, and
`[20,-15]` became `[20,-10]`. This is a host input integration defect, independent
of guest sensitivity. It made small corrections inaccurate or disappear.

`motion-steps.cjs` distributes cumulative integer counts, carrying each remaining
count into later steps. The driver uses this helper and records both the steps
and their delivered total. Fractional requests now fail before input instead of
silently losing counts. The test uses the real driver's motion branch; it also
checks that an intermediate UNKNOWN stops without dispatching later steps.
The original runtime remains pinned to its attempted bytes; the repair was
integrated locally after shutdown and is not claimed as new original-game input.

The same owned native Chrome independently tested both old and repaired event
construction. The exact new helper also dispatched real DOM events on a detached
canvas in that Chrome: eight cases preserve exact signed totals, including
`[1,-1]` and `[-299,297]`, and six invalid inputs produce no effects. This does
not dispatch to the game, create another browser, or rerun custody fixtures.
The initial helper-test script had a nested-template syntax error; its failed
attempt is retained separately from the corrected passing test.

The native route retained `user` and Medium. Reviewed relative positioning and
an independently released 600 ms native button hold activated Start. Earlier
100 ms clicks did not activate it; their captures are retained. Both movement
and duration differed, so these observations do not isolate a click-positioning
or button-duration defect. Separate captures show Island Storm mission loading,
the native tank with timer `00:00:09`, and the In Game menu after independently
released Escape500 (537 ms measured dispatch-to-release). No skip, guest write, forced scene, private handler,
configuration change, clock change, or seed change was used.

The final Software Resume PNG was personally reviewed: visible guest hotspot
`(459,249)` is inside `(380,247)-(504,279)`. Its exact hash and original capture
metadata are in `resume-current-png-proof.json`. Resume/M was **not dispatched**.
This actual Software route has empty D3D statistics, no live render endpoint,
and no owning D3D render-worker target; the transient second guest worker had
retired. Treating that absence as four complete guest/render module responses
would weaken the requested contract. No temporal pair, qualified M consequence,
reviewed gameplay movement, or power-control progress is claimed.

Before allocation, all 850 selected providers, 28 owned startup files, syntax,
the hermetic phase/helper closure, and the explicit startup contract including
`reviewed-point.cjs` passed. The full physical upload passed again before queue
creation and atomic consumption. Ten point negatives, five custodian controls,
and the accepted 36 probes/144 module responses were independently hash-verified
and reused, without standalone reruns. Retained timing review established that
guest and renderer identity lanes already started together, with one target
each. Their 1069/1245 ms and 515/626 ms evaluations therefore did not establish
a serial-lane defect to repair speculatively. The old 301/318 ms samples remain
unknown; the previous accelerator's single fresh candidate remains insufficient.

Gate4500, M500, exact identities/epochs, complete uncached response requirements,
`Promise.allSettled`, final co-located owner/pixels, 250 ms freshness, the changed
timer pair, independent releases, and sticky UNKNOWN/no replay were not relaxed.
The phase sink remains persistent and fsynced. The native Node/Chrome start
identities, same boot/network namespace, profile, and Chrome-owned loopback
listener were independently verified. No local heavy-runtime lock was held;
the parent remote lock covered provisioning, startup, runtime, and descendant
drain. Seven keys and mouse buttons were independently observed released.

The repaired **851-pin** provider closure and **29-file** owned startup closure
pass syntax, the hermetic loader, and the startup contract, which now explicitly
requires `motion-steps.cjs`. The actual attempted 850-pin manifest is preserved
as `actual-position-runtime-pins.json`. All **361,201** bounded integer delta
pairs sum exactly; the real driver branch delivers `[20,-15]`, six invalid
commands have zero effects, and the injected intermediate UNKNOWN stops without
later events. The repair was not uploaded and no second original was run.

Before delegated normal shutdown, **369 artifact references / 395,122,266 bytes /
302 unique hashes** were retrieved and independently reread. Forty-two unique
PNGs pass CRC validation. All **31** recorded parent/descendant/custody PID/start
identities were independently absent; ports, profile, writer, held inputs and
the remote lock were drained. Earlier failed helper syntax remains retained.
Final box **`bx_kvzp7fye`: archived, expiry null**. Normal stop
**`stop_44fc7f9835ab35f3`** completed **13:19:39.391Z**, forced=false/error=null.
The normal/watchdog children exited0 and their supervisor recorded no remaining
children. The observable independent watchdog was armed before creation, with
immutable deadline **13:25:58.041Z**; initial box expiry was **13:26:58.266Z**.

Recovery records checkout SHA `31e394e55cb2abd7e0b65dac6c2d08f4256fe418`, selected
source Git `49874a81c5ae180c20a15c6bb169d9041f028cae`, relevant binary diffs,
small owned input/repair patches, and existing media paths/hashes. The actual
native module is
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
No source/media archive, peer WIP, old-box resume/delete, public deployment,
subworker, or local heavy runtime was used. Launch disk exceeded5GB.

Only this note is committed; the tested driver/helper and evidence remain in
the owned run directory. The task closes on the first new tested generic motion
integration repair and newly verified Software route, not a qualified M claim.
Next work must establish the actual Software rendering-owner proof without
inventing a D3D endpoint or weakening the four-response contract, then qualify
ordinary M with visible consequence before reviewed movement toward power
control. Full27, parity, audio and FPS remain open.
