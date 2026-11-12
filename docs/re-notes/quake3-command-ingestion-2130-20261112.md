# Quake III: run-local command publication repair, 2026-11-12 2130

The run-local command publication race is reproduced and repaired locally.
There is no new original encounter or gameplay completion. Major frag remains
unearned. This follows [the recovered 2055 encounter](quake3-major-frag-2055-20261112.md)
(`910a2607e`); all inherited UNKNOWNs remain unchanged and Quit 21 was never replayed.

Evidence and the scoped harness repair are in
`scratch/runs/20261112-quake3-command-ingestion-2130/`.
`repair.py` checks four exact inherited helper SHA values before generating
owned variants of `drive.py`, `operate.py`, and `local-drive.py`. The browser
consumer is reused unchanged by SHA
`b2d5cf37135c93c6b753081d4649f28213b12d2fa0e191b5854c03b586495794`.
Production upload helpers and production source were not edited.

## Evidence and causal limit

The recovered `step-normal-stop-on-floor-attempt.json` contains the actual
emitted Python command: `Path.write_text(json.dumps(c))` writes directly to
`commands/<n>.json`. The browser's actual line 100 first tests existence and
then immediately parses that file. Its parser is outside the per-action
`try`. The recovered `commands/21.json` is valid Quit JSON, but the terminal
`failure.json` records `Unexpected end of JSON input` at `browser.cjs:100:143`.
There is no command-21 attempt or ACK. These are separate observations, not
proof that the eventual recovered bytes were the bytes parsed at failure.

The regression captures the actual emitted payloads from both remote-command
producers without importing the API control module or calling an API. For the
local producer it executes the actual AST statements from numbering onward.
Each payload runs against the extracted actual browser command loop. The
consumer uses fixture actions and output paths; no browser, game, guest state,
native input or remote operation is involved.

A controlled scheduling barrier pauses the real Python file open after
creation/truncation and before the first write. With each old producer, the
consumer sees the final path, raises the same JSON parser error, performs no
action and emits no ACK. The producer subsequently finishes writing valid
Quit JSON. This reproduces both the error and the valid-afterward file through
the actual emitted functions. It establishes a concrete partial-visibility
race, rather than requiring a permanently malformed final file or a game defect.
The failing historical read bytes and scheduling were not captured; its exact
cause remains **UNKNOWN**. Other transient truncation/corruption cannot be
excluded from the historical evidence.

## Scoped repair and regression

Each owned producer serializes once, opens a unique sibling `.tmp` exclusively,
writes, flushes, fsyncs and closes it, then publishes with `os.link(tmp, final)`
and unlinks the temporary name. The final numbered `.json` path becomes visible
only after the complete payload is closed. A same-directory hard link supplies
atomic no-overwrite publication on the local filesystem. Unsupported linking
or an existing final name fails; there is no overwrite fallback or retry.
Temporary files do not match the numbered `*.json` sequencing glob.

The consumer still parses strictly, awaits one action at a time, writes ACK only
after action success, and terminates on malformed input or action failure.
Producer ACK handling additionally parses the response and requires `ok is True`;
file existence alone cannot pass. Review, identity, freshness, input release,
containment, deadlines and the strict transport cap remain unchanged. This
does not extend publication guarantees to the separate review/ACK files or
claim crash recovery or support for a different filesystem.

`python3 -B scratch/runs/20261112-quake3-command-ingestion-2130/regression.py`
passes 15 actual producer/consumer cases across all three producers: old empty
visibility, repaired complete publication, terminal malformed input, action
failure without ACK, and rejection of a false semantic ACK. Three additional
publication-collision cases prove existing commands survive unchanged and no
ACK appears. The repaired visibility cases observe no final command and no
action while the temp file is open; after publication exactly one action and
a successful ACK occur. Each consumer subprocess has an actual wait and
separate stdout/stderr EOF. Test-only scheduling and shortened no-ACK fixture
polling do not change harness or transport timeouts.

The locked repository build also passed; see `build.log`. This qualifies a
run-local repair, not a production runtime or matched-original before/after fix.
`source-commit.txt`, `relevant-working-tree.diff`, `owned-harness.patch`,
`owned-new-files.patch`, and `evidence-sha256.json` retain Git identity, relevant
binary diff, reproducible owned helpers and evidence hashes. Git remains the
source archive; no source tree, media or binaries were bundled. Existing media
and module references remain in the linked 2055 note and its SHA records.

## Hold and next action

Actual `/home` checks remained below 1,500,000,000 bytes, including
1,483,796,480 before repair and 1,479,999,488 during validation. No one-shot API,
allocation, upload, original launch or native input was submitted. No new box
exists; box state, expiry and stop receipt are **not applicable**. Inherited
`bx_xs7tuh8z` remains historical archived/expiry null with stop receipt
`stop_1db408bb4cf799fe`; it was not resumed or otherwise touched. No cleanup of
other workers' data, cache/RAM change, reserve change or worker launch occurred.

Next requires actual disk headroom, then fresh private lifecycle/watchdog,
frozen final helper hashes and actual joined provisioning before the original.
Reuse unchanged qualified controls by SHA. Require reviewed native I Can Win
white with cursor away before Fight, actual pointer lock, full-22/current04
owning WebGL and a visually aimed living-Major action with independent release
and full consequence. Only native Major kill text or player score increase can
earn the frag. Shotgun pickup, ammo 10→8 and attack pose remain insufficient.
Fullpaused constraints, unobserved Popen waits and every inherited UNKNOWN
remain in force; no full-27, parity, FPS, audio or general crash claim is made.
