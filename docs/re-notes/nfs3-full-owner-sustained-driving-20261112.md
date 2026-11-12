# NFS3 full private binding and independently released driving, 2026-11-12

Full nonnull owner/module/instance/CPU and renderer binding and bounded native
key release passed. Sustainable driving through successive bends, a lap
transition, and a race result did **not** pass. One original launch was attempted;
it reached 82 MPH but repeatedly left the road. No runtime or physics fix was
made. The historical timer-abort cause remains UNKNOWN.

Evidence: `scratch/runs/20261112-nfs3-full-owner-sustained-driving-1815/`.
`evidence-check.json` verifies 309 recovered run files, 98 provider-log paths,
40 complete 1024×712 PNGs, 33 command ACKs, 16 native key commands, and 48
trusted key edges. Recovery used two downloads and SHA-256 comparison for each
remote artifact before normal shutdown. Parent evidence and its limitations are
in [the 1740 report](nfs3-qualified-caller-lap-20261112.md), commit `4420b35b5`;
its guessed NULL CPU epoch is not qualified by this report retroactively.

## Binding before allocation

The run-local `bound-input.cjs` derives its fields from the established Half-Life
strict22 private binding, recorded in `binding-source.json`, and actual production
lifecycle objects. It uses page-private UUID/WeakMap object identities, the actual
CPU Worker instance token, actual renderer endpoint/instance tokens, CDP target
identities, and captured module hashes. It does not guess `_workerEpoch` fields.
The existing `epoch` field is the private document epoch; CPU instance identity
is in `workerInstance`, and renderer endpoint/instance epochs in `rendererEpoch`.

All 22 established fields are required nonnull and compared before input and
around frame capture: processId, processObject, endpoint, endpointObject,
workerObject, workerTarget, workerInstance, moduleObject, moduleSha256, epoch,
renderEndpoint, renderEndpointObject, renderWorkerObject, rendererTarget,
rendererEpoch, rendererModuleSha256, pageRendererObject, canvasObject,
memoryObject, bufferObject, nativeWindowSet, glBackendSet. An empty backend set
is serialized `[]`, not a fabricated backend. SoftwareD3D is established by the
actual legacy/software renderer endpoint and positive completion counters.

Local actual Chrome controls used current production CPU and Software renderer
Workers with registered Boids (a control-only selector entry exposed the existing
sample). `control/production-controls.json` passes all 22 changed-identity
refusals, two distinct-script module ambiguity refusals, and an actual
stop/reload/relaunch stale-owner refusal: 25 refusals before any input dispatch.
Duplicate Debugger notifications for one scriptId are deduplicated; distinct
scripts are refused even if their hashes match. Original driving retained one
stable full identity, CPU target `3653A141D9705EFE4B121C15C86DFEA0`, renderer
target `B721C52C1BA1FC219E849CC239F2E7A7`.

## Release controls and physical timing

Each command forks a separate Node release process with its own CDP connection.
Every key deadline is armed before DOWN. Up to 30 physical seconds are allowed;
steering can have a shorter deadline than throttle. Controller IPC loss releases
keys and closes Chrome normally. DOWN is recorded before awaiting its ACK;
partial or UNKNOWN submission is terminal and is not replayed. Sampling does not
own release timers. This bounds physical key holding, not simulated game time,
guest polling latency, or game distance traveled.

Before allocation, actual emitted-consumer controls passed an eight-second Up
with independently released one-second Left, a held full PNG, a slow sampler
that outlived the deadline, hidden-ACK UNKNOWN, partial-chord UNKNOWN, and actual
controller disconnect cleanup. Release ACKs and physical key state zero were
observed; final control parents recorded actual exit zero and both EOFs.
Earlier local attempts remain in `control-attempt1..5`: missing selector, an
outer join that stayed UNKNOWN despite release/Chrome exit, stale profile, and
disk-floor refusal. The caller join and fresh-profile checks were corrected and
the complete control passed before the sole allocation. No original action was
replayed after uncertainty.

Seven original commands have full PNGs captured while throttle was held before
its deadline: drive01–06 and drive09. Shorter steering may already have released
in these images. Nine shorter commands (two brakes, three R recoveries,
drive07/08/10, Escape) have physical samples, trusted edges, release ACKs and
released full frames, but **no held full PNG**. They do not meet that stronger
capture requirement. Each separate command followed review of a fresh released
full frame; there was no blind input chain.

## One original attempt

The exact original EXE SHA-256 was
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`;
all 133 media hashes passed. CPU and renderer both loaded unchanged normal04,
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Native setup selected Direct3D Device 1 and acknowledged its warning, then the
original launched once. This fresh run naturally offered Single Race with
Aggressive AI, not the parent's Hot Pursuit mode. No configuration, RNG, clock,
health, AI, position, or guest-memory writes were used.

The first eight-second throttle reached 82 MPH and grass near the first bend.
After native braking and separately reviewed R recovery, five- and three-second
throttle/steering commands reached 30/36 MPH but left the road. Another recovery
and three/four-second commands reached 41/21/36 MPH with shoulder/tree contacts.
After a final recovery, drive07/08 held throttle 1.5 seconds with a 100 ms Left
correction on drive08; drive09 held four seconds with 100 ms Left and reached
47 MPH on asphalt approaching the bend. Drive10's two seconds plus 200 ms Left
ended at 2 MPH against the right guardrail. Braking stopped the car.

All retained race frames still show 1/1 Laps. Native R relocation is not earned
bend progress. Review/command gaps of roughly 10–45 physical seconds still let
the car coast, travel or collide. Longer throttle demonstrates acceleration;
it does not isolate earlier low-speed causes or prove a physics bug. The concrete
remaining blocker is observation/control cadence and road alignment, plus held
full-frame coverage of short commands. Sustainable on-road driving is unproved.

Escape opened Single Race Paused. The native Quit click received a protocol ACK
but the menu remained, so guest ExitProcess is not claimed. Normal Browser.close
then terminated Chrome and the controller with actual zero exits and both EOFs.

## Observer, recovery, and closure

The exact qualified1725 timer observer and unchanged expensive proofs were reused
by 20 SHA checks, rechecked after shutdown; the full matrix was not rerun.
`timer-analysis.json` has 1,063 main-worker rows (first sequence 922), zero main
cumulative drops, paired timer entry/returns and no historical abort branch
`0x48dc84`. Other worker rings overflowed; this is not all-worker losslessness.
Raw trace SHA is `d2cfb8e26e1c4b2e507f6fc6c40a5cf4761abd85ed0b15f5e8253b09294b6964`;
its lossless gzip and compression metadata are retained. No new timer fix or
matched-original before/after claim is made.

All helper edits/import checks and 609 runtime pins were completed before
allocation; final remote hashes still match. Source recovery uses base Git
`5ed39acacdf6a48e2eda7e2efb864f5e229d1aac`, relevant binary diff, and owned helper
patches (`final-run-helpers.patch.gz`), with media referenced by path/hash.
No source-tree or media archive was made. Run-local helper controls and
`verify-final.py` passed; no production code changed and no build was rerun for
this documentation-only publication.

The private two-hour independent watchdog was observed alive before creation.
Box `bx_wfuxee3a` was created 18:25:47Z, initially expiring 20:25:46Z. After unique
evidence verification it was normally stopped at 18:40:47.282Z: state `archived`,
expiry `archiveAfter: null`, completed stop `stop_4487b8f6b911e5f3`, forced false,
error null. An independent final GET confirms this. Manager and watchdog actual
waits are zero with both EOFs. Runtime/Chrome/launcher PIDs are absent, profile
removed and server port closed. Actual `/home` free space alone gated work;
earlier local floor refusal is retained. No RAM gate or reserve proposal applied.

Next work should reduce the physical observation/control gap and cover short
held frames, then qualify a fresh bend sequence before claiming sustainable
driving or another lap/result attempt. No additional allocation was made here.
