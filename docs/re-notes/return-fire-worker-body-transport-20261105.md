# Return Fire Worker body transport prerequisite — 2026-11-05

The browser prerequisite exposed by Return Fire0940 (published `43525070f`)
is repaired for the generated dedicated-Worker case below. No original or
gameplay retry occurred; this is not a gameplay result.

Evidence: `scratch/runs/20261105-return-fire-worker-body-transport/`.
The retained0940 transcript, first failure and seal are unchanged (initial
path/size/SHA ledger and final cleanup verification). Its first-failure SHA is
`befa084bc27b5438d9bfbbf984b2899b10486f61a296e3fb1db27bf963777a7d`.

## Actual capability reproduction before remedy

`real-reproduce/` executes the unchanged startup, attachment and receipt block
from the actual selected composition on generated loopback HTML and a dedicated
Worker. It loads the selected module and observation preload, but never invokes
the original guest flow. The selected source is the existing
`scratch/runs/20261105-return-fire-system-data-audio/used-composed-driver.cjs`,
SHA `90f4d8f6d182b28aefe07744148452d5deb8590aaf12801a0313e137ca13b008`.
Per-case entry seals identify the composed source, extracted block and collector;
amendment patches preserve the composition relative to this existing input.

Chrome `151.0.7922.108` with Puppeteer `25.7` reproduced the paused Worker
`Fetch.enable` method-not-found error before any remedy. The generated baseline
first-failure SHA is
`6997b6b9b347c5c76e09fa37f78b992ee935fa4546685f8a389ca61910bf4251`.
`capability-v2/` then established actual owning-Worker `Network.getResponseBody`
bytes: startup script153 bytes and binary4097 bytes, with exact hashes.
The initial capability fixture incorrectly expected only one response; that
failed assertion and normal browser exit remain in the root capability records.

The Worker startup response uses a special identity: its request ID equals its
target ID, but its GET request event arrives in the parent session. The Worker
session emits the response and loading-finished events and can return its own
script bytes. This is established by actual recorded events, not URL matching.

## Implemented collection contract

Pages retain paused Fetch capture and continue only after body policy accepts.
A paused dedicated Worker may select Network only for the exact Fetch method
absence and a successful Network capability check. The sentinel missing-request
body probe must return the exact known no-resource ProtocolError. Puppeteer
omits numeric protocol codes here, so exact exception type and original message
are checked; any supplied numeric code must also match. Denial, timeout, an
unsupported Network method or a later body read failure never selects another
channel or re-fetches bytes. Unsupported capability fails before observation
installation and Worker resume.

Network rows bind the owning target/session, request ID, GET method, URL,
resource type and nonredirected request sequence. Body reads happen in that
session after loading-finished, with bounded buffers, canonical decoding,
length/hash checks and the existing required-byte policy. Startup additionally
requires the explicitly named parent session, exact target/request ID and one
verified parent Fetch receipt. The Worker retrieves its own bytes and checks
them against that receipt; parent bytes are never substituted. Network-parent
nested startup shapes without this binding remain fail closed and are not
qualified by this work.

Completed Network rows are marked `collected`; they do not claim Fetch pause or
continuation. Pending transfers, reads and policies prevent completeness.
Non-200 absence acknowledgement remains synchronous, exact and immutable, so
only the existing permitted optional classic-script404 abort is tolerated.
Required bytes, POST, redirects, other failures and unacknowledged absences
remain fatal. Attachment enables/checks transport before installing observation
and resuming. Detach and deadlines cancel collection; first failure is immutable.
The composed adapter now propagates policy rejection to the collector while
preserving the original failure boundary.

## Verification and limits

- `collector-worker.log`:91 focused collector cases pass, including capability
  negatives, startup binding, method/redirect/session identity, pending-read
  completeness, absence, detach and deadlines.
- `composition-final.log`:33 composed-entry cases pass using real FS/HTTP and
  synthetic CDP, including Worker Network transport and existing no-spawn guards.
- `real-controls-result.json`:12 real-browser generated-page cases pass: plain,
  positive, required404, missing body, corrupt bytes, truncated bytes, failed
  loading, redirect, POST, wrong session, actual parent-directed detach during a
  pending body read, and default body timeout. Every negative remains incomplete
  with its first failure retained. Positive and plain return the same8193 bytes
  and checksum1044497; the collected body SHA is
  `1957d7ce85b55a7ff170dfed436b312548733d8525029f1a36c82ad29a4c4524`.
- `real-optional-script404-scope-fixed/result.json`: actual Worker importScripts
  optional404 is acknowledged without claiming a body, then required binary
  bytes complete normally.
- `full-build.log` / `full-build.exit.json`: required
  `flock /tmp/wine-build.lock bash tools/build.sh` passes.
- `final-cleanup.json`: recorded Chrome exits are0/null; owned identities and
  profiles are absent, owned server/DevTools ports refuse connections, both
  locks are free, and free disk exceeds1.5GB. No test box was assigned; box
  lifecycle remains coordinator-owned.

Failed fixture attempts remain separately named and are not passing evidence:
missing extracted `assert` scope; redirect oracle expecting the Worker guard
although the existing page guard rejected first; detach sent through the browser
root instead of the attaching parent; optional404 scope missing `fs`/`path`;
and the aggregate wrapper that stopped on the first detach fixture failure.
Corrected cases use fresh names, preserving each error and browser exit. No
production failure was relabeled complete. Serialized preload/API-table command
expressions were replaced by size/SHA references in generated command logs,
recorded in `command-expression-redaction.json`; retained original transcripts
and first failures were not edited.

Git is the source archive: `tested-git-sha.txt`, `final-source-provenance.json`,
`relevant-uncommitted.diff` and owned new-file patches identify the tested source
and run-specific reproduction scripts. Existing inputs are referenced by path
and SHA; no source tree, media or module snapshot was made. Runtime began after
Strong0950, D3Dclip1010 and the coordinator-required CPU1120 final releases plus
independent cleanup/free-lock verification. This work authorizes no original
retry, public deployment or generalized nested-Worker/gameplay claim.
