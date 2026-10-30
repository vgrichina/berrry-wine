# Enigma original input-stall runtime, 2026-10-30

One actual original Enigma 1.01 execution, 11:00:19.509–11:01:05.862 UTC,
completed normally in 46.09 s. Peak observed process-group RSS was 378531840
bytes. This is the historical pinned source 425755ee5ee9be0734c7aca187521100f5487674,
module 1880854 bytes SHA-256 af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b,
Node v24.22.1, software canvas, 640×480, `--no-threads`. It is not current main.

The exact retained runner 96aa1313… was transformed with the previously tested
observer into 61125d6937d2c0836d93146da5a2acceba0f44de1ae1b6e63ecaa7f863244312;
the unchanged helper SHA-256 is 4df352076448514f16b35dfd294a85e62381e21e1b03f613c3544fdfc0eedd2e.
See the adjacent parent test/enigma-input-stall-observer-preserved-oct30 for its
exact transform and passing boundary/mutant tests; broad groups were not repeated.
Actual deployed hashes, native filename-bearing argv and canonical mount parser
receipt are included. The supported tree mount retains comma-safe enumeration.

The ordinary reproducer was unchanged: after observed Main Menu at t29, hold
TAB t30–30.8, UP t32–32.8, Enter t34–34.8; the existing conditional ordinary
mouse move/down/up at (343,213), t39/39.2/40, also ran because the menu remained.
Only observation was added: input-stall samples around controls and UP poll tracing.
No frozen execution, guest memory/state patch, forced callback or extra game run.

The UP keydown scheduled at batch91316 was actually dequeued: poll17319 returned
packed2490624 (WM_KEYDOWN, VK_UP) at batch91317. The next poll17320 returned zero.
It remained17320 through last sample batch93430. The first post-UP sample at
batch91319 had347754 main entered/completed slices and3790414 main API calls;
the last had482198 pairs and3790793 calls, a delta of134444 completed slices and
379 calls without another input poll. Renderer depth rose0→7, retaining UP keyup
(msg257,VK38) at the head; later Enter and mouse events were not consumed there.
The reported PCs include0xec9bd0 and0xecdee0. Samples often report yieldReason1
with yieldFlag0; this is observed saved state, not proof of a live parked wait.
Main run counters remain balanced. Thread-record continuations also changed;
the record tid1 contains saved instance threadId2, reported verbatim rather than
renamed. Thread records and main counters do not establish a worker heartbeat.

I personally inspected main-menu.png: Main Menu with Start Game, Level Pack,
Options, Credits and Quit. Before/after/final frames have identical hashes; only
one389913-byte image is retained. No gameplay or successful Start Game transition
is accepted. ACKs and matching images alone were not used as input acceptance.
This run localizes loss of input-poll progress after UP consumption despite
continued completed main execution. It does not identify the responsible API or
prove scheduler starvation, a busy loop, or an unreturned synchronous slice.

Next production boundary: invocation-owned identification of the executing path
around PCs0xec9bd0/0xecdee0 and its yield/resume/next-input-poll boundary after
UP dequeue, with worker/host heartbeat coverage if needed. Current API name and
in-flight synchronous execution are unavailable in this sampler. No repair was
attempted or inferred from these observations.

Boat bx_dkb7b2mx was one finite1800-second fork of verified stopped snapshot
bx_66f2v9c8. A corrected independent deadline watchdog was armed before the first
API exec. Supported API transfer/readback smoke passed. No SSH/scp/hosting.
Explicitly delegated all-path shutdown completed: postrun snapshot verified at
11:01:52.984 UTC; actually stopped11:01:53.058 UTC. Original scheduled expiry
11:29:37.722 UTC. closeout.json is the supported info receipt; no resume needed.

Raw selected controls/startup limits are in runtime-samples.json; selected logs
are <=8192 bytes; media total389913 bytes. Parent/source/wrapper receipts and all
original denials remain retained. Local closed API exchanges are losslessly
archived with per-member hashes verified before unlink, under the task-owned
staging recovery manifest. No shared-root or Telegram edits; coordinator owns
messageboard append. Mandatory8MiB work+8MiB publication reserves were preserved.
