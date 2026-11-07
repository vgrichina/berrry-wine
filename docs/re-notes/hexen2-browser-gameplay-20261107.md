# Hexen II browser startup: worker MIDI callback blocker, 2026-11-07

The current-main registered original reached the reviewed GLHexen2 informational
notice. One trusted, balanced Enter dismissed it. The application then exited
on `midi_stream_open`, before a reviewed menu or gameplay scene:

```
MIDI callback requires cooperative owning VM; worker delivery unsupported
```

**Browser movement, turning, attack, hit and kill remain unproved.** Historical
October 11 CLI Paladin movement remains accepted separately. No model-meshing
progress was reached or inferred. No FPS, audio, full-playability or parity
claim is made.

Evidence: `scratch/runs/20261107-hexen2-browser-gameplay/`.

## Inputs and execution identity

All 16 coordinator-pinned paths matched byte lengths and SHA-256 before box
allocation: the browser manifest, its 14 original files, and original registered
root `installed/glh2.exe`. The manifest union with the root executable matched
exactly. Original root and GLRoot executables both hash to
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The registered layout, bundled DLL location and game bytes were preserved.
No replacement engine/DLL, guest edits, media archive or guest code inspection
was used. Runtime/API behaviour and our own emulator sources were the only
basis for investigation, respecting the bundled no-reverse-engineering licence.

Source commit `56d316d34a7d7dba871fe48e1bb9629e51a621a8` and relevant binary
Git diff are retained. The locked standard build passed; the actual recovered
live guest and render-worker module is 2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
All 651 staged runtime/input pins matched at launch and terminal inspection.
Git remains the source archive; owned driver inputs are retained as patches.

Chrome 151.0.7922.108 used native CDP with no viewport emulation
(`defaultViewport:null`), inner viewport 1024×712, outer 1024×855.
The notice canvas was 1024×712. Actual scheduling was a threaded guest Worker,
endpoint 1, slot 0, with a page `Win98Renderer`. No GL owner existed at the
reviewed notice. A `d3d-render-worker.js` Worker subsequently appeared with the
same recovered module, then detached when the app exited. Its live GL provider,
backend and owning endpoint were **not captured** before exit and remain unknown;
selector labels do not qualify those facts.

Ordinary controls were read from the existing `lib/apps.js` registration:
arrows walk/turn, MOUSE1 attacks, slash jumps, Space crouches, Enter uses an
inventory item, Escape opens the menu. Only Enter was delivered to the original.

## Qualified helper and observed failure

Before allocation, actual Chromium controls passed five zero-effect identity
replacement cases (process, endpoint, Worker, module and document epoch), stale
and slow-capture rejection, partial delivery, UNKNOWN/late-ACK closure, trusted
balanced arrow input, passive progress and independent release under a slow
reader. Generated fixture captures are helper evidence, not game scenes.

A scratch-driver deadline guard initially rejected the 33-minute browser window
before Chrome creation. The empty output contained only `commands/`; the parent
PID was verified absent. Both the failure and failed empty-output assertion were
retained. The guard was adjusted to admit the task's window; the empty directory
was renamed, not overwritten. There was one actual Chrome/game runtime and no
replay of guest input or UNKNOWN commands.

`original/startup.png` was personally reviewed: native notice, OK focused, no
menu/gameplay. Enter keydown at 09:31:27.625 UTC and keyup at 09:31:27.772 UTC
were both trusted. Independent release began exactly 150 ms after hold start.
The log records native ShowWindow events and a transient 640×480 canvas, then
at 09:31:29.684 the host MIDI exception. By 09:31:39.777 `runningApps` was empty
and both guest and render Workers had detached. The next capture refused
`one isolated registered app required`; the transport closed without a success
ACK or replay. That ownership assertion is secondary to the MIDI failure.

The explicit rejection is documented in our `lib/host-audio.js` registration
comment and guard: worker/thread MIDI function delivery requires authenticated
transport that does not yet exist. `test/test-midi-stream-lifecycle.js` also
expects this worker-open rejection. This is an implemented fail-fast limitation,
not evidence of an arithmetic, GL or guest-instruction semantic divergence.
No emulator change or bypass was made. The standalone lifecycle test was tried
but its generated WAT fixture failed parsing (`Unexpected ) — extra closing
paren`, line 174); no test pass is claimed. The full standard build passed.

Only the idle/before full-frame notice capture exists. Held/released gameplay
captures, health/ammo/enemy responses and a post-notice screenshot are unavailable:
the guest exited before the next bound capture. Counters do not substitute for
those images.

## Retrieval and shutdown

Fresh UUID-idempotent box `bx_s2cm8zah` was created at 09:29:34 UTC, initial
expiry 10:14:34.238 UTC. The overall task deadline was 10:09:33.995 UTC.
The browser closed normally, exit 0 with no signal, at 09:31:40.270 UTC.
Terminal checks verified controller/Chrome PIDs absent, no remaining Chrome
processes, both ports refused, profile/writer lock absent, one balanced Enter
pair, zero held input and the last observed empty input queue.

All 50 terminal files (2,539,165 bytes), including the unique live module,
were recovered and SHA-verified before the explicitly delegated normal,
nonforced stop. A local pretty-printed cleanup copy initially differed in
formatting; it was retained separately and the exact remote bytes recovered.
Shared `/home` temporarily dropped below 2 GB during unrelated shared activity;
an alert was appended without deleting peer files. It recovered above 2 GB
before evidence retrieval and completion. Final box status is recorded in the
run's lifecycle artifacts; no resume or deletion was performed.

Next: implement authenticated worker-owned MIDI callback transport with focused
ownership/lifecycle regressions, then authorize a fresh browser gameplay attempt.
The tested threaded route cannot currently progress through this startup call.
