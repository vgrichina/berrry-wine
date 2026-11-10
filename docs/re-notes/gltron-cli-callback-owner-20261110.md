# CLI waveOut ownership with a worker backend, 2026-11-10

The CLI now binds main-thread waveOut registrations to its local instance even
when guest workers exist. Per-thread RPC tables explicitly bind registrations
to the active backend slot and worker link. A slice-boundary pump offers each
notification to that owner, retains busy callbacks, and preserves interrupted
wait bookkeeping through callback return. Cooperative worker tables use their
actual instance rather than the exports proxy's main-instance fallback.

The before/after test uses production host audio, the synchronous RPC broker,
`guest-worker.js`, real WAT waveOutOpen and x86 callback execution/return. It
covers main with/without the backend, suspended/in-flight workers, immutable
registration/link identity, header flags, callback ABI, saved registers and
wait state, exactly-once delivery, and zero main-export access for worker
callbacks. Baseline main registration with a backend strands the notification.
The old per-worker table also lacks explicit routing and can bind its shadow
exports proxy; the guarded baseline exposes that incorrect main access.

One private box ran original GLTron serially for 40 seconds cooperative and
90 seconds with workers. Original clocks, budgets, audio format and settings
were preserved; there were no diagnostic guest writes or game inputs. Main
callbacks were accepted 33,696 and 94,608 times respectively. Each mode's first
10,000 synthetic milliseconds contained 50 pumps and 40 eligible completions,
with no early completion; final function queues were empty. Both originals
uploaded 172 textures, published an initial black clear and submitted zero
scene geometry. Their final 640x480 compositors were personally reviewed as
black. The earlier worker-backend menu depended on stranded sound callbacks;
this repair does not establish menu or gameplay progress. The remaining startup
question is the CLI CPU-service/device-clock model described in the earlier
clock-budget investigation.

Evidence is ignored under
`scratch/runs/20261110-gltron-cli-callback-owner-repair-1710/`: source SHA plus
patches, before/after tests, locked build, runtime pins, causal analysis and
56 recovered references / 44 unique compressed objects, all hash-verified.
Run-local allocation JSON now publishes atomically with create-only semantics;
concurrent-reader and actual supervised normal/watchdog fixtures passed.
`bx_7uzw75qn` was normally archived after recovery; independent box/stop GETs
confirm `stop_a33b5db84b82f114` completed at 17:15:40.771Z, forced false,
error null, expiry null. Actual parent waits and separate stdout/stderr EOF
passed for original runs and lifecycle delegates. No public deployment.
