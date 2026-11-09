# Redline startup failure cleanup — 2026-11-09

Implemented an offline production startup/cleanup correction. There is no
supported startup latency fix from 0924: its actual first failure was port-file
ENOENT at 09:26:33.805Z; retained stderr later reports a listener and the actual
child wait reports SIGKILL at 09:26:44.881Z. Those observations do not prove
when the file was published or why startup was delayed. No deadline was raised.

The production caller now races its unchanged 100 × 100 ms publication poll
against the actual child wait, checks the immutable runtime deadline and
terminal gate before endpoint admission, and validates the published port/path.
A bounded diagnostic records child exit versus unpublished/invalid endpoint,
poll count, read result, and a timestamped 8192-character stderr tail. Stderr
listener text never supplies an endpoint. Shutdown separately records a final
port-file observation, so publication after failure can be distinguished from
a still-missing file without permitting later CDP input or capture.

The first caller failure now seeds cleanup after acquisition joins; cleanup
errors cannot replace it. The existing 10-second shutdown wait also bounds the
caller's actual stream reader pipelines. An inherited writer that exceeds it
causes reader destruction and joined pipeline rejection, explicitly marked
`streamsTruncated: true`, `streamEOF: false`. The actual child wait is still
joined independently. Such a failure retains the profile for independent
cleanup; absence checks are never wait or EOF evidence. Normal stream EOF
permits profile removal after actual child wait, including abnormal child exit.

The whole tracked caller is exercised with inert Node children, real port files,
real HTTP server closure and real gzip pipelines. The retained Git baseline is
00d4a4bf9a5ac30020e8434629114f37f1b9fe13. OldFAIL controls reproduce postterminal
WebSocket construction, ten-second polling after child exit, lost first-failure
metadata, and inherited-writer stream waiting beyond the scaled 250 ms cleanup
budget. NewPASS controls cover early exit, inherited writer truncation, port
publication after the unchanged ten-second poll, permanently missing file,
valid publication, malformed publication and runtime deadline. Each runner has
an observably prearmed independent process watchdog, actual waits and separate
EOF joins. The inherited writer is separately allowed to finish by the harness;
reader truncation does not claim descendant termination. A cancellation during
real HTTP acquisition also joins the server before settling and spawns no child.

Focused production guest-admission composition and retained shutdown regressions
also pass. Their endpoint service remains inert; the new startup suite tests the
actual production endpoint branch. The locked build passes. Initial test
expectation failures are retained and excluded from accepted results. Unchanged
startup admission, production/native fixture and key delivery sources match
d81e7524b exactly; accepted proof references were SHA/size rechecked and reused.
preCPU/preDLLmain identity and flags, all polling/work caps and input bounds are
unchanged. Any future pinned caller closure must include the new
`tools/redline-chrome-startup.cjs`; production refuses a missing helper pin.

Evidence: `scratch/runs/20261109-redline-startup-failure-repair-0940/`, exact Git
base plus small patches only, gzip logs from first byte. The original 0924
manifest is preserved. Its 168 matching entries and 105 gzip CRC checks were
verified; its remaining `task-result.json` entry seals 1041 bytes / SHA
828630fc… while the current file is 1152 bytes / SHA 34c46235…. The append-only
correction in this run records both complete hashes. There is no 169-all-PASS
claim. This run finalizes its metadata before sealing its own manifest.

No Chrome, guest, box, worker, agent or deployment was started. Box ID, UUID,
expiry and stop receipt are null (NOT_CREATED). Native remains REVOKED;
all-writers and edict ABA remain UNKNOWN. No Q2/Q3/client/custody/host/WAT,
Heroes II or Claude files were edited. Free `/home` stayed above 1.5 GB.
Next is a separately authorized pinned native fixture attempt; startup latency
and gameplay remain unproven. SingleTaskSTOP.
