# Re-Volt renderer readiness, 7 November 2026

The demonstrated startup failure is reproduced locally and repaired in the
owned browser driver. Startup readiness precedes binding the action identity.
There is no emulator change.

Evidence: `scratch/runs/20261107-revolt-renderer-readiness/`.
Candidate `re-volt-demo`; registered app `re_volt_demo`.

The generated local fixture uses the actual production guest and renderer
Workers. Its page wrapper exposes the running guest before allowing its
ordinary renderer endpoint callback to complete. The original driver observes
`renderEndpoint: none`, then endpoint `1`, and rejects the second page read
inside its first `readLive()`. This is before screenshot or native input.

The repaired driver uses bounded passive page reads while the endpoint is
absent, preserving exact process, guest owner, document, canvas and module
references. It then requires two complete, identical guest/module/renderer
identity readings before binding. Subsequent captures and admissions must
match that binding. Startup sampling cannot be entered after binding.
The 120-second scene freshness limit, exact ACK checks and independently
scheduled release remain unchanged.

Local controls reject a missing renderer, a process-owner replacement during
startup, actual endpoint, renderer-owner and process-owner changes after
binding, every changed reviewed identity token, and an expired scene. Negative
controls produce zero input. A personally reviewed generated caption/white
canvas precedes a trusted ArrowUp DOWN/UP pair with exact command ACK and an
independent release armed before DOWN. This is helper evidence, not gameplay.

An intermediate missing-renderer control exposed a blocked guest Worker CDP
read and closed that fixture without replay. The final pending phase avoids
Worker evaluation until the endpoint exists; fresh final qualification passes.
The earlier failed fixture and its terminal evidence remain retained.

Outlaws explicitly released its production sources after publishing
`c254a3e3ee94728124db63d32550aa44c50ee9e3`. Only then were production pins
frozen and final local qualification performed. The locked full build passed.
The original 443 installed media files and separate browser manifest match
the inherited pins. The selected closure contains 1,079 pins, including the
actual deferred observer and changed owned helpers; executed imports and the
selected renderer-attachment event's missing/present observer controls pass.
The unchanged real entry guard accepts 25 minutes and rejects 35 minutes,
an expired value and NaN before Chrome or guest execution.


The box was `bx_7sffnvyr`, created at 12:46:13Z with active expiry
13:26:13.015Z. The browser deadline was constructed once as
13:11:12.859Z and never extended. Serial staging and remote verification
matched every selected pin. The final staged production guest/render fixture
passed actual attachment, strict negative controls, a capture and exact quit
ACK with zero native input before the one original launch.

The original reached the personally reviewed shop-counter main menu. Ordinary
native Enter continued through the default player name, RC Bandit, Toys in the
Hood 1 and the one-player summary. The reviewed race captures show:

- `review/track-loading.png`: upright starting-grid car, lap 1/3,
  race 00:10.463 and 0 mph.
- `review/race-forward-one.png`: after ordinary three-second Up,
  race 00:54.695 and 4 mph, with other cars nearby.
- `review/race-forward-two.png`: after ordinary eight-second Up,
  race 01:53.743 and 8 mph, upright near the fence and dirt piles.
- `review/race-reverse.png`: after ordinary Down, race 02:57.327 and
  3 mph. This does not establish successful reverse recovery.
- `review/race-pause.png`: native Escape opened Resume / Restart Race /
  Options / Quit; the car remained upright at the mound.

These are fresh original race execution and input-response observations.
There is no new checkpoint, completed lap, successful reposition/flip or
controlled route completion. Nearby cars can confound movement attribution.
The October 31 checkpoint/lap limitations remain open.

## Exact recovery stopping point and native UI mistake

The native Options → Controller Settings screen showed Keyboard selected.
Configure Controller opened a sequential assignment wizard, initially
`Left:`, rather than a read-only mapping list. No new direction binding was
intended. The worker sent ordinary Escape intending to cancel; the game
instead displayed **`Left: ESCAPE` and `Right:` awaiting input**. This is
personally reviewed in `review/cancel-controller-wizard.png`.

That was an unintended partial native assignment. No further guest input was
sent, the wizard was not completed, and no recovery-key mapping was proved.
The browser was closed normally rather than guessing further assignments or
forcing a configuration restore. This is the exact stopping state for further
recovery, not an emulator failure. The original media and manifest remained
hash-identical. No forced guest memory, config, clock or focus write was made;
the unintended native wizard state is explicitly distinct from that claim.
A future recovery attempt should use the original default-control reference
below rather than entering this reassignment wizard.

### Original PC recovery-control reference

The coordinator retrieved the original Acclaim
[PC manual](https://www.bestoldgames.net/download/games/re-volt/re-volt-win-manual.pdf)
and visually inspected printed page 5 (PDF page index 3). Its default keyboard
chart assigns **Home** to returning the car to the track and **End** to flipping
the car; arrows drive, left Ctrl fires, and Escape pauses. This is a primary
control reference, not proof that the demo consumed a recovery key.
`scratch/runs/20261107-revolt-control-reference/source.json` records the exact
PDF size/SHA-256 and `default-controls.png` retains the rendered page. A normal
balanced Home/End input can now test recovery without changing bindings or
guessing how to cancel the configuration wizard. Review the actual game state
before input; a race capture must not be treated as a pause menu.

## Evidence, validation and lifecycle

The live guest and renderer module SHA-256 is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The recorded source checkout is
`6dcf146efbc8d726a52ca746e5de970cf6f4fd5b`, containing the released Outlaws
code. Both locked builds passed and produced that same canonical module.
`source-commit.txt`, `runtime-pins.json`, `relevant-source.patch`, the retained
`lib_wininit-boot.js.new.patch` and `owned-helper-inputs.patch` provide source
identity and relevant uncommitted/new inputs. No source or media archive was
created. Subsequent unrelated checkout changes are not this runtime's source.

The original produced 30 exact command ACKs, 20 balanced trusted key pairs,
one balanced trusted mouse pair and one mouse move. All 21 native pulses had
independent release armed before DOWN and exact DOWN/UP ACKs. There was no
original UNKNOWN command or replay. The earlier local absent-renderer
qualification failure is retained separately, as described above.

Chrome exited zero at 13:10:21.420Z, before the immutable deadline. All 264
original artifacts, totaling 14,375,194 bytes before deduplication, were
SHA-256 verified before box handoff. The post-run remote check matched all
1,079 pins, including the original 443 files and manifest. Node PID 8342 and
Chrome PID 8354 were absent; ports 44155 and 39617 closed; profile, writer and
held keys were clear. Local qualification processes, ports, profiles and
input were also cleared. Sampled free space stayed above 2 GB.

The coordinator owned box shutdown. At handoff, the API state was `idle`
(active, not stopped or archived), expiry 13:26:13.015Z. After independently
verifying the 264 recovered artifacts, the coordinator completed a normal
stop at 13:12:54.261Z with `forced:false`. `coordinator-stop-info.json` records
state `stopped`, cleared active expiry, and a completed, verified snapshot.
The worker did not stop, delete or resume a box. Unique evidence and module
identity were retained before that delegated shutdown.
