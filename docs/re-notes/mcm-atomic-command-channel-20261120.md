# MCM atomic operator channel

Run: `scratch/runs/20261120-mcm-atomic-command-registered-quarry/`.

`tools/atomic-json-channel.cjs` publishes JSON to an exclusive, randomly named
same-directory pending file. It handles short writes, fsyncs and closes that
file, links it to the complete name without replacement, unlinks the pending
name and fsyncs the directory. Duplicate IDs fail with EEXIST. A failure after
linking is ambiguous to the publisher and must never cause command replay.
Serialization and flush failures before linking expose no complete file.

The reader opens only `command-N.json` (or `reply-N.json`). Missing files are
pending. Malformed complete JSON, wrong IDs and other read errors permanently
close that reader. Parse errors are neither retried nor downgraded.

The run-local human operator uses this exact publisher for every command; the
actual registered-original driver uses the same publisher for every reply and
the shared reader for every command. Its test runs a real child reader against
the exact publisher in another child with deliberately delayed 17-byte writes.
It also checks duplicate refusal, abandoned pending files, malformed complete
files, terminal reader state, reply IDs and failed flushes. Tests use temporary
directories and have no retained-run dependencies.

Preflight verified 183 source files, 305 imports, 311 media references and the
f5ae 2,420,767-byte module. The unchanged 62d GPS native eight/PUBLISHED and
f606 context 52/authored 18 proofs were verified by SHA and reused only for
their original scope. Full locked builds passed. Text probes exercised actual
capture, IPC, native output and owned tmpfs directories before browser work.

Admission deviation: a new shared report at 12:37:28Z recorded actual /home
free space of 1,250,816,000 bytes. This task was already active, but the inherited
watcher began its board offset at 12:37:31Z, so it missed that report. The
original was incorrectly launched after the floor. This is the first applicable
blocker; later local samples above the floor do not reopen admission. All
requests after that report are explicitly counted as a deviation. No original
gameplay qualification is claimed.

The attempted original consumed commands 0 through 11 without partial JSON
errors. Startup/name dialogs and quarry setup were personally reviewed;
preparation returned PREPARED, endpoint null, qualified false. The first
post-prepare MENU capture then failed before review or Start. Its full identity
comparison includes `owner.slice` execution counters, which changed across
the screenshot. The actual error shows sequence, EIP, ESP, timing and RPC
counters changing. The adapter remains unchanged; a later authorized task
must test an explicit stable identity projection while preserving all required
owner/HWND/generation/endpoint/epoch/viewport/module checks and whole RGBA gates.
An authored fixture pass does not qualify this live-original integration.

Zero endpoint requests followed the actual MENU failure/closure. There was no
Start, GPS ARMED/PUBLISHED, quarry gameplay, current-display, Escape or Quit
credit. All owned children joined and the profile was removed. Localhost box
ID null, NOT_CREATED, expiry null, stop receipt null; root shutdown delegated
owned cleanup. Final receipts, exact Git/diffs, module/media references and
recovery recipes are retained in the run, with result.json published last.
