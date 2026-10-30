# Tux Racer post-title input observation

The retained original-game run dequeued and dispatched Enter at batch21787,
rendered the main menu, then host-delivered keyup/click/Enter without another
observed dequeue before SIGXCPU at90CPU. This does not prove a renderer,
coordinate, SDL callback, cached-message or scheduler defect. No causal behavior
correction is justified from those observations alone. Practice/race remain
unqualified. No new guest run, compilation, Boat allocation or resume occurred.

The opt-in `--trace-main-scheduler` observer now records returned/thrown main
slices and poll attribution, plus at most128 cumulative summaries independent
of the existing256 detail-record cap (default cadence1000 batches). Summaries
remain window-local and count import entries, not consumed MSGs or SDL events.
Compare their deltas with `--trace-input-dispatch` dequeues:

* Runnable/returned slices rising with mainPolls unchanged: admitted guest
  execution has stopped calling the host poll; inspect guest execution next.
* Suspended decisions rising with no runs: the recorded reason/yield identifies
  the actual scheduler gate to investigate, rather than assuming restoration.
* Main/worker polls rising with no dequeues: polling continues without an event;
  inspect host/cached queues using the existing frozen `input-state` control.
* Worker polls are counted separately; they do not establish main consumption.
* `threw` identifies an exception even if an outer interleaved caller catches it.

No renderer, shared input plumbing, guest WAT, clock, CPU budget or accepted
vertex/color source is changed. The observer reads no guest exports or queues.
It is constructed only under the existing explicit flag. It preserves run
return values, thrown objects and nested worker attribution. No summaries are
emitted without that flag. Counts saturate at UINT32_MAX and declare saturation.
128 summaries bound the default coverage; later silence is not evidence of a
stopped guest. A main-run without a finish is not proof of a hang if detail was
already capped or output was interrupted.

## Verification

`node --max-old-space-size=512 test/test-tuxracer-main-menu-poll-observer.js`
executes byte-exact sections of production initialization, host check_input,
scheduler admission and ordinary run/worker-import call sites with controlled
exports. This is a source-boundary test, not the complete runner or guest SDL
execution. Both the actual retained packet runner(blob30b8b056) and current-main
runner(blob579bca6f) pass; all four extracted spans are byte-identical, hashbound
in boundary receipts. The unmodified observer fails the persistent-summary
assertion. Removing the actual production poll hook fails attribution. Disabled
mode, exception/return identity, restoration and independent summary caps pass.

The retained packet source and current-main runner differ outside these spans;
neither is silently substituted for the other. Module5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb
and all141 accepted canonical compiler inputs remain unchanged. Their earlier
accepted vertex/color tests and original title/menu runtime are reused, without
new gameplay or individual-call claims.

## Next actual observation (coordinator assignment required)

Use the exact retained157-file app manifest, software GL/no-threads, Node24.22.1
with `--max-old-space-size=512`, accepted1881806-byte module above, and retained
runnerSHA256f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d,
changing only test/main-scheduler-observer.js to this tested diagnostic blob.
Keep the original remote-worker.py/control.py contract (CPU90, wall120,
stdout512KiB separate from generated-file12MiB) and current owner allocation.
Validate Node startup and filename-bearing mount in the assigned environment.
No CPU increase or compile for diagnosis. The stopped snapshot contains the
accepted module; coordinator must supply an authorized execution location and
verify its module identity before executing. Never resume a denied box.

Proposed command within the retained closure (not executed here):

```sh
node --max-old-space-size=512 test/run.js --app=tuxracer_original_061a --no-build --wasm=build/wine-assembly.wasm --gl-renderer=software --no-threads --max-seconds=100 --max-batches=1000000 --quiet-api --quiet-blocks --quiet-fs --png=capture/after.png --gl-census --input=17000:png:capture/title.png,18000:keydown:13,26000:keyup:13,30000:png:capture/before.png,31000:mousemove:320:260,32000:click:320:260,38000:png:capture/practice.png,40000:keydown:13,44000:keyup:13,49000:png:capture/course.png,51000:keydown:13,55000:keyup:13 --trace-input-dispatch --trace-main-scheduler --trace-from=21700 --trace-to=56000
```

This adds diagnostic observations to the unchanged reproducer. Preserve the
first denial, raw output and final queue/scheduler state when available. The
next decision must follow measured poll/run deltas, not another unchanged replay.
Callback completion, guest instruction location and coordinates/state remain
unknown until an actual guest observation distinguishes them.

## Recovery and retained evidence

Local evidence: `/tmp/tuxracer-main-menu-race-progression-oct30/input-consumption`.
Original receipt and `capture/runtime.stdout` remain in the parent unchanged;
runtime stdoutSHA256e7fa512ea59ae8a9ea98b3ce4fd03349ea41e421943e196cb52770da24e6009b.
Recover the retained runner from exactly `test/run.js` in the hashverified
standing packet `/tmp/tuxracer-software-render-msvcrt-retest-oct30/packet.tar.gz`
(archiveSHA2560c1b282fcb6f720c78090dce8156b2d321f9ee5839f414b09a068d033961629b).
Recover current-main runner with `git show 52de1079f2ce7f89e082b033e80d01231fc53d5f:test/run.js`;
verify blob579bca6fb9b6ab117a403dead93eddd6ca0e2338. Both can be passed as the
test's first argument; an optional second argument selects an observer control.

No test boxes were touched: bx_jdx249hm retained snapshot-stopped07:44:30UTC;
bx_7ky4nfwq stopped, never resumed. Lifecycle remains coordinator-owned, no live
expiry assigned to this task. Root/donor worktrees and indexes remain unchanged.
