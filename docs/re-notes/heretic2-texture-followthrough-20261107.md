# Heretic II texture followthrough, 2026-11-07

The registered original reaches a textured, playable Silverspring docks world
with the published GL CPU allocator repair. Ordinary movement reaches a view of
the waterside passage, but health falls from 100 to 26 near a visible rat and
the next capture shows the native Load Game book. Doorway traversal, an attack
hit, enemy defeat and objective interaction remain **unverified**. No attack
input was sent before that boundary. The original was not reloaded or replayed.

Run: `scratch/runs/20261107-heretic2-texture-followthrough/` (ignored).
Only this note is committed; no emulator change or new build is claimed.

## Lifecycle prerequisite

Work began after graphics-storage-gameplay-2131 released its files and published
`4e9e3fe17`. Its watchdog was initially alive but absent at final inspection
without an exit record. That original disappearance time and cause remain
unknown; this task does not retroactively claim continuous coverage for it.

Before allocating a box, local qualification terminated a launcher process
group with SIGTERM. An inherited-group sleeping helper ended without a terminal
record, while a supervisor started with `start_new_session=True`, closed standard
input and file-backed output survived. Inspection occurred in a later tool
session. Its separate watchdog reached a six-second deadline, requested exactly
one **mock normal stop**, and both lifecycle children exited zero with durable
terminal and supervisor exit records. A second detached mock fixture passed the
verified-retrieval/requested-stop path. These reproduce a possible session-lifetime
failure mechanism, not the predecessor's established cause. They allocate no box.

The run-local implementation retains the AVP2 model of separate normal-stop and
immutable 1500-second watchdog processes, adding a detached supervisor, frequent
heartbeats and observable child exit records. Both delegates were alive before
allocation, during the original and before stopping. Recorded watchdog heartbeat
gaps never exceed 0.901 seconds after allocation; its final heartbeat is after
the confirmed normal stop. The supervisor records both child exits as zero and
then records its own terminal state. This supplies substantially more lifetime
evidence than an initial PID alone. The real normal-stop API path subsequently
passed on the one authorized box.

## Pinned composition and controls

Source base: `229a03ddf0b3be01badaaa8150400ef989b78344`, containing allocator repair
`ef2709a76` and `fece02eca`. All overlapping runtime pins match the released
Hexen II predecessor. Native functional dependency pins match too; the existing
passed stdin/capture/balanced-input and pin-gate checks are reused. The changed
composition is the registered Heretic II app/media, a bounded forty-checkpoint
review loop and the supervised lifecycle. No broad historical qualification was
repeated.

All 1,825 originals match retained independent SHA-256/size references and exact
installed-tree membership. The 1,824-entry browser manifest retains SHA-256
`b9b1e85ceeb2daedb056f6299a057be4ef2c8601f0e999ab98ddaa467cfd2e3a`.
Before boot, 2,283 staged runtime/helper pins match; native WGL/red-readback and
headless GL checks pass remotely, and the functional pin gate passes again
immediately before launch. Both local and remote launch floors exceed 5 GB.
Postflight runtime/native pin checks pass. The loaded-read observer verifies
125 runtime reads and two native JavaScript reads against their pins.

The actual compiled/instantiated standard module is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
Its bytes and the compatibility module were recovered. Git SHA, relevant tracked
binary diff, new runtime-file patches, owned helper patches, module identities
and existing media path/hash references preserve recovery. No source or media
archive, substituted media or public deployment was made.

The original uses production `test/run.js --app=heretic2_demo --no-build
--control-stdin --max-seconds=600 --batch-size=50000 --headless-gl --threads`
plus the predecessor's logging/capture flags; full argv is in
`retrieved/actual/threads/launch.json`. Native renderer: Mesa llvmpipe LLVM 20.1.2,
WebGL 1.0, 640×480; Node v24.22.1. The worker thread backend is enabled, but the
retained scheduler observations contain **no secondary guest threads**. This
run therefore does not establish simultaneous guest-worker gameplay coverage.
Registered arguments, original settings/media and the registered 1998 wall clock
are unchanged. The existing headless clock advances 200 ms per batch; it is not
real-time pacing. No binding/config/clock changes, private handlers or guest
code inspection were used.

## Reviewed route and texture observations

Every numbered composited capture was inspected before permitting the next
ordinary input. Main → Game → Down to Easy → Enter reaches Loading and then the
docks naturally; no intro-skip input was needed. Captures under
`retrieved/actual/threads/` establish:

| Capture | Observation and subsequent ordinary input |
| --- | --- |
| `notice.png`, `post.png`, `menu-1.png`, `menu-2.png` | Textured startup and original book menus; separately released Enter, Down, Enter |
| `menu-3.png`, `menu-4.png` | Illustrated loading map; passive waits |
| `menu-5.png` | Corvus on the pier, health 100, textured roofs, sky, stone arch and HUD; Up 600 ms |
| `menu-6.png` | Corvus reaches waterfront paving, crate/closed arch ahead-right; Right 600 ms |
| `menu-7.png` | Opposite pier gate, rat beside Corvus, health 100; Left 250 ms corrects toward waterside route |
| `menu-8.png` | Fallen figure and lit passage ahead-left, textured wall/roof/water, health 26; Up 900 ms attempts approach |
| `menu-9.png`, `terminal.png` | Native Load Game book, ENTERING / Silverspring Docks; stop without reload |

The final screen is consistent with death, but neither a zero-health frame nor
death animation was captured. The rat's presence does not independently prove
the source of damage. No doorway entry, targeted hit, kill, narrative trigger or
native objective interaction was established. The dark lighting alone is not a
demonstrated emulator mismatch. All thirteen recovered PNGs decode with valid
chunk CRCs and IDAT streams; the twelve numbered composited captures were
inspected. The final raw PNG duplicates the book view.

The unchanged passive texture observer retains its first 50,000 records. Within
that prefix are 3,002 CPU image exits and 3,002 frontend image uploads, with no
nonzero context error at those exits. Sampled DIB occupancy stays at 600 pages
through image 3,000, where 2,890 DX records are live. **The observer hits its
record cap**; later image/error coverage and the original's total definitions
are unknown. This app does not cross the earlier Hexen II 3,550-image boundary
in the retained prefix. Its app-specific texture names were not qualified by
the predecessor's Hexen-specific selected-name observer. The reviewed world
artwork is the direct rendering evidence; counters alone are not visual proof.

Forty contiguous successful protocol replies include 39 helper submissions and
the separately acknowledged quit. Seven ordinary key pulses all have independent
UP armed before DOWN and matching release acknowledgments; no UNKNOWN or input
replay occurred. Final ledger has no held keys; guest post-queue consumption is
not independently observed. An initial evidence assertion incorrectly expected
quit in the helper submission ledger; the retained failed assertion was corrected
against the actual protocol log without another runtime action.

## Exit, retrieval and handback

Guest exit is zero at 21:48:55.998Z after 212.107 seconds. No escaped Wasm trap,
unhandled exception, out-of-bounds error or reported WebGL error appears in the
retained guest log. The bounded observer limitation still applies to graphics
error coverage; absence of a log message is not full crash coverage.

All 95 remote references / 91 unique contents, 11,831,544 referenced bytes,
including unique logs, captures, actual modules and cleanup, were retrieved and
SHA-256/size verified **before** requesting shutdown. The normal-stop delegate
then completed `stop_51b41bcc58ac0d39` at 21:51:03.656Z, forced=false, error=null.
Box `bx_zepet544` is **archived**, initial expiry 22:09:25.018Z, current expiry
null and retention unknown. Its immutable watchdog deadline was 22:09:24.842Z.
Shutdown was explicitly delegated by this task; no box resume/delete occurred.
Ownership returns to the coordinator. Owned guest/supervisor/delegate processes
and local board watcher have ended; no browser, profile or control port was
created, and no input remains held by a live owned process.

This single attempt ends at the native load screen. Next is a separately
authorized attempt to survive the rat encounter with ordinary attack/movement
and reach the open doorway. Enemy defeat and objective progress remain open.
No historical-27 membership, D3D coverage, backend parity, audio quality or FPS
claim follows from this one GL app.
