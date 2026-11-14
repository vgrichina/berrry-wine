# GLTron current-display capture, 2026-11-14

The distinct current-display API passed real Chrome and focused regression
checks plus the locked full build. A conditional original remains pending.
Evidence belongs to
`scratch/runs/20261114-gltron-current-display-capture/result.json` when final.

The predecessor findings remain distinct: `requestImmutableCapture` waits for
the **next ordinary publication**, so an idle unchanged visible scene stayed
at publication 15 and timed out after 3,011 ms. The historical default
`Page.captureScreenshot` stall was **not reproduced**. Neither finding is
changed by introducing a separate current-display API. The two predecessor
runs and all closed sessions remain closed and intact.

## Supported API

`WineAssembly.requestCurrentDisplayCapture({hwnd})` derives process/instance
ownership from the host. The renderer keeps weak identity references to the exact selected window objects,
their geometry/ownership, the source/output objects and dimensions, the actual
composition and presentation viewport, and the original canvas display-call
completion time after an ordinary successful display. No bytes are cached in
that receipt. A request reads the actual output canvas and retains its own
immutable bytes; every public read returns copies.

An unchanged display may be current. Its metadata explicitly says
`observation: current-display` and `content: already-displayed`; publication
and display timestamps remain those of the original ordinary display.
Request/readback start and completion are recorded separately. These are
canvas display-call/readback observations, not an engine-frame certificate or
a physical monitor scanout timestamp. Engine, player-viewport and worker-slice
completion remain unknown.

Known renderer damage stays pending until its ordinary publication. Capture
does not schedule a repaint or flush guest surfaces. The pending result is
labelled `ordinary-publication-after-request` only when that publication
actually happened. Held/in-flight paint is refused. Pending host surface
publication is an explicit refusal. Cancellation removes only the ticket,
preserving ordinary damage, and a failed or cancelled read never returns an
older ticket's pixels.

The supported geometry is an opaque desktop with the entire owner inside it,
or a single exclusive owner whose **actual production viewport** proves a
zero-offset full-source crop and a destination wholly inside the same output.
Trimmed/zoomed/ambiguous geometry, hidden or clipped output, changed owner,
window reuse, output replacement/resizing, overlap and transparent desktop
composition are refused. Display-only updates invalidate the ordinary receipt.
No hold is released, publication incremented, render/swap forced, raw slot read
or deadline widened by capture.

The manual browser chain keeps permanent process/window/output/module tokens,
one-use request nonces, and the existing 3,000 ms capture deadline and 5/30-second
precision/menu limits. Observation age starts at request time; it never
relabels old display content as a newly rendered frame. UNKNOWN/cancellation
closes input, and late replies cannot reopen the chain. A 600-second original,
if qualified, keeps a mechanical 180-second Quit reserve, finite 1,500 ms
pulses and independent prearmed 1,750 ms release.

## Validation

All sixteen endpoint tests pass, including all ten original next-publication
cases. The five focused renderer files pass (20 test entries). The loopback
transport and actual independent-child release tests pass, including late
capture, late EOF, replacement, UNKNOWN and no replay. Real Chrome blank-page
trusted DOWN/UP controls pass for every allowed key, a 1,500 ms pulse, and an
independent 1,750 ms EOF fallback. These are transport controls, not game proof.

Real Chrome 151 / WebGL2, actual production compositor, synthetic producer:

| Observation | Actual result |
| --- | --- |
| Old next-publication ticket on idle, no hold/damage | Pending after 3,004 ms, publication 21 unchanged; cancelled |
| New current-display ticket on that same scene | 68 ms; publication 21→21; original display timestamp retained |
| Complete idle output | Exact RGBA match with output canvas **and Chrome compositor screenshot** |
| Changed WebGL pixels | Publication 4→13; PNG changed; normal pending publication admitted |
| Full exclusive production viewport | Whole 480×360 source, actual contained destination; output pixels match |
| Pending damage | Remained pending; ordinary publication 21→22 completed it, explicitly labelled |
| Cancellation | Damage survived; cancelled ticket remained cancelled after publication |
| Held paint | Refused in 4 ms; hold depth stayed 1; no capture ticket left |
| Hidden/clipped/replaced output and replaced owner | Refused, no guest input |
| Default Page screenshot | Completed in 102 ms; historical stall still not reproduced |

The four selected raw full-scene fixture PNGs were personally reviewed:
`real-chrome/{complete-scene,changed-scene,exclusive-scene,idle-scene}.png`.
The two normal gradients visibly differ; the idle scene preserves the changed
gradient and the exclusive scene contains the whole gradient with its actual
black letterbox. No fixture key events occurred.

`flock /tmp/wine-build.lock bash tools/build.sh` passed (35.54 seconds), as did
the callback ownership gate (437 boundaries). These checks ran on the exact
shared tree recorded by `checks/pins.json` and `real-chrome/pins.json`, Git
54a55803780c418c6029960de72c832aef611fed plus the relevant binary patches.
Foreign uncommitted source is disclosed by those pins/patches. Publication
includes only owned paths and the host/renderer census rows; six foreign census
rows are preserved in the shared tree and excluded from this commit. Their
pending review status is unchanged.

Taipei and FreeCell actual native/watchdog/supervisor waits, both EOFs and heavy
release were inspected before these heavy checks. Taipei's ancillary caller
wait remains explicitly unknown (invoking tool 143); it is not fabricated into
a completed wait. FreeCell recorded actual native, watchdog, outer-child and
outer waits, all zero with both EOFs. See `prior-terminal-gate.json`.

The conditional sole 600/620-second original will use the published fix,
exact 92 existing local media files, launch-only 1,000-block default and real
clock. No original has launched by this task at this publication. No gameplay,
corners, natural outcome, native Quit, FPS/audio/parity/full-27 or physical GPU
claim follows from these capture fixtures. No box was created.
