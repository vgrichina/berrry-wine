# Redline preceding batch continuation cause — 2026-11-08

**A fully retained preceding batch spends most of its time repeatedly polling a not-yet-signaled Flip readback fence.** This fresh passive Vehicle Training run joins that batch to the specific Clear blocking guest input. It establishes no emulator semantic mismatch, driver defect, safe synchronization removal, or validated repair. Native turning and car approach were therefore not attempted.

Evidence: ignored `scratch/runs/20261108-redline-batch-continuation-cause/`, especially `cause-correlation-no-inspector.json`, `per-command-spans.json`, `batch-summaries.json`, and the named raw traces under `retrieved/original/`. Large evidence logs are individually gzip-compressed; their original and compressed hashes are both verified. These are new invocations, not a retrospective explanation of predecessor batch18609.

## Invocation-supported interval

Guest slice6653 takes2,843.900 ms. Its `gpu_gl_call(0x20004, 0x4e2c0c, 0)`, invocation26116333, takes2,836.405 ms and returns1. The captured native return is`0x44e4d0`, receiver`0x08222040`, count1, rectangle`0x074ffb0c`, flags3. The host import, Encoder call, outgoing sequence, renderer ingress, executor and completion identities correlate.

| Boundary | UTC | Identity / measurement |
|---|---|---|
| Preceding batch begins replay | 04:04:35.605 | endpoint1, transport16838, sequence16837 |
| Clear sent | 04:04:35.612 | transport16839, sequence16838 |
| Draw records0–66 complete | 04:04:36.125 | combined command spans520.690 ms |
| Flip record67 issues readback/fence | 04:04:36.125–36.126 | surface`0x07db30a0`, DIB`0x1c49d000`,1,228,800 bytes |
| Clear reaches renderer | 04:04:36.126 |514 ms after send, wall clock |
| Final fence poll signals | 04:04:38.446 |571 TIMEOUT_EXPIRED results, then CONDITION_SATISFIED |
| Readback collected; Flip and batch complete | 04:04:38.448 | batch2,843.360 ms; COMPLETED16837 |
| Clear begins execution | 04:04:38.448 | queue2,321.805 ms, monotonic clock |
| Clear publishes completion | 04:04:38.448 | executor0.090 ms; `_clear`0.080 ms |

The batch contains68 commands, with every ordinal0–67 and record opcode retained. Draw commands occupy520.690 ms; the final Flip command occupies2,322.500 ms. Its571 source-level timer-await entry/resolution pairs total **2,314.630 ms**, median4.065 ms, maximum7.115 ms. Each timeout and the final successful poll refer to the same captured sync identity, target, endpoint, transport, sequence and ordinal. Native `getBufferSubData` takes0.995 ms; collection including writeback takes1.535 ms. Replay resumes before its ordinary completion store and before the queued Clear executes. The31,876-row batch starts at replay entry and ends at completion, with **zero dropped rows**. VK37 native polls bracket the blocked import with zero results and none inside; no left hold was needed.

There is **no logged inspector request overlapping this entire selected batch**. This does not exclude instrumentation overhead, native tracing overhead, earlier observation effects or external scheduling. Other retained batches are separately qualified: Flip-only sequence16853 takes2,203.840 ms with540 timeouts and2,184.750 ms in timer-await spans, but overlaps a2,182 ms screenshot request. Sequence16865 takes2,852.755 ms, with688 timeouts and no logged inspector overlap; its frozen batch is retained without claiming a complete host-import join. Sequence16847 also includes a571.175 ms native `getError` span. These differing intervals must not be merged into a single driver explanation.

The specific delay is therefore observed repeated pending-fence polling inside the original awaited Flip, together with the preceding draw work. The timer awaits recur throughout the interval; no single multi-second missing continuation is needed to account for this invocation. Why the browser reports the fence pending that long remains unresolved. The observations do not authorize making CPU-visible readback or publication asynchronous, changing scratch/snapshot/surface ownership, or bypassing the dependency.

## Exact remaining observation gap

**Original timer scheduling and firing were not successfully joined in the actual game run.** Source probes retain every await entry/resolution and every fence-status result, but actual browser snapshots contain zero `timer.scheduled` rows. Chrome acknowledges `Tracing.start` and `Tracing.end`; no `Tracing.dataCollected`, native TimerInstall/TimerFire log, or tracingComplete artifact was retained before browser shutdown. The driver waited eight seconds after the end ACK before closing Chrome. There is consequently no timer-ID mapping or independent scheduling → firing → continuation split. Do not infer the reason for this instrumentation failure from the local controls. `completedValue` is outside the selected legacy-batch path.

The next observer qualification must exercise the production paused Worker startup/injection lifecycle and the actual browser driver's complete tracing drain, with independently controlled fence/timer delays. It must fail on missing timer rows or missing tracingComplete before another original allocation. VM replay and an ordinary native Worker timer test alone did not establish that lifecycle coverage here.

## Controls, provenance and shutdown

Run-local server transforms place probes beside the existing replay, command, Flip/fence, await and collection operations. The extension adds no Promise reactions or replacement scheduling; ordinary calls retain receivers, return values/promises and thrown objects. Production replay and `fenceFlip`, using an emitted WASM fixture for the flip hook and controlled native GL/timers, pass separate controlled115 ms timer and28-timeout fence fixtures with complete command/completion retention. Native Chrome Worker TimerInstall/TimerFire qualification, production RPC/Encoder, receiver/result/exception identity, exactly-once completion, unchanged fixture memory, bounded rings and independent key-up controls pass. These controls did not resolve the actual timer-observation gap above. No tracked emulator code changed; no failing-before/passing-after emulator repair or locked-build claim is made.

Personally reviewed native menu selections, `vehicle-start.png` and `passive-work.png`: original Vehicle Training, on-foot weapon, health100, car ahead. All11 numbered commands have exact successful ACKs, zero UNKNOWN/replay. Final physical keys are up and the input queue is empty. Turning, driving, approach, vehicle entry, FPS, audio, parity and full playability remain open.

Tested Git SHA`afbfbc1b69011938e5ad938318757dd2e58a3f98`; relevant tracked/new runtime patches, final run-input patches and recovery instructions are retained. All694 non-run runtime/media pins equal the predecessor; all65 original media paths/sizes/SHA-256 values recheck unchanged. Actual guest/renderer module remains`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`. All18 owner identity fields remain stable. Provider: WebGL2,640×480, ANGLE Intel UHD620 / Mesa23.2.1, context intact, fallback0.

One oversized71.8 MB media upload timed out, and an early pin check exited before any browser launch because that file was absent. Nine bounded runtime-only segments subsequently assembled the original SHA-verified media; segments were removed, and the final launch checked all710 pins. No input was replayed. Local evidence verification passed **179 references /167 unique original hashes /252,602,681 reference bytes**,11 PNG CRC/IDAT checks,11 ACKs, original media, owner identities and browser/process drain **before normal box stop**. Individually compressed evidence occupies about15.5 MB. Git remains the source archive; no source/media archive was created.

Fresh box **`bx_mrerm9kd`**, with independent observable25-minute watchdog and normal-stop delegates prearmed before allocation, was normally **archived04:08:31.206Z**, receipt **`stop_f4857158987597ff`**, completed04:08:31.229Z, `forced:false`. Final expiry **null**; initial expiry04:23:46.935Z. Chrome exited0 at04:06:13.284Z; controller8458/Chrome8470 are absent, HTTP44089/CDP38231 closed, profile/writer absent. Both delegates exited0; supervisor remaining children is empty. Disk stayed above5,000,000,000 bytes. No RAM gate, old403 action, resume/delete, nested worker or public deployment occurred.
