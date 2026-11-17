# Q3 debugger source inventory, 2026-11-15

The warranted source-inventory correction was published as `ac8fb9b43` on main
after actual Chrome, current native qualification and the full flock build passed.
The single authorized changed-route original demonstrated verified source reuse
but closed at a required snapshot evaluation deadline before consent. No further
original is authorized on this route. Heavy work followed personally verified
TIM smart handles and LS32 source/build/runtime releases.

Evidence: `scratch/runs/20261115-quake3-source-inventory/`.

## Demonstrated repeated source and causal limits

The previous original's actual `original/operations.jsonl` contains 412 distinct
script IDs whose source responses have the exact 47-byte controller snapshot
expression SHA-256
`000ba5e8856b8d2a95512815f84b8ee419cdcb73dbe015ee87dc832cc883f31c`.
All belong to the same render Worker session and target, with 413 matching
controller evaluator requests. There are 411 preterminal source responses and
one passive late source response, for script 423/request 1307 at 3906.575 ms.
That source request triggered the fixed three-second UNKNOWN. The pending
snapshot evaluation 1309 arrived at 6334.850 ms. No postterminal request occurred.
The previous route is closed. Queue, inspector dispatch, native occupancy and
source-body timing remain UNKNOWN; there is no evidence of an engine bug.

Historical logging retained context IDs and script IDs but omitted the actual
`scriptParsed.hash`. We cannot retroactively claim those events qualify for
reuse. Actual source-byte repetition is demonstrated independently of that gap.
Removing repeated source requests cannot guarantee that the still-required
snapshot evaluations finish within their unchanged three-second deadline.

## Identity and necessity

The primary [CDP Debugger schema](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json)
defines `scriptParsed.hash` as a SHA-256 content hash and specifies separate
source and WASM bytecode return fields for `getScriptSource`. The same schema
describes numeric context ID reuse across processes and the stronger unique
context ID. Debugger enable also reports existing uncollected scripts, so an
anonymous event alone does not establish evaluator provenance.

V8's primary [inspector implementation](https://github.com/v8/v8/blob/15.1.206.16/src/inspector/v8-debugger-script.cc)
uses `GetSha256Hash` when available and has a UTF-16 fallback. Its primary
[script hash implementation](https://github.com/v8/v8/blob/15.1.206.16/src/objects/script.cc)
hashes UTF-8 text. Fresh Chrome actually reports the UTF-8 hash for the exact
47-byte snapshot expression and the Unicode control. The helper validates the
public hash against actual fetched source using UTF-8 or the UTF-16LE fallback,
records the validated convention separately, and always retains the actual UTF-8
source-byte hash. Unrecognized conventions fall back to fetching. The initial
UTF-16-only candidate safely fetched every script and failed its reuse control;
that rejected qualification is retained. No original ran on it.

Only known controller expressions sent by the current connection can enter the
reuse cache, after a first actual fetch exactly matches the expression and
validates its metadata hash. Reuse preserves each new script ID, numeric and
unique context IDs, session and target, and identifies the first fetched script.
This establishes source equivalence, not a newly fetched bytecode proof or a
claim that every anonymous script originated with the controller.

Production URLs, modules, live edits, WASM, unknown languages, distinct or
unknown anonymous source, malformed/missing hash and missing unique contexts
still fetch. No source is inferred from URL or length alone. Session/target or
context replacement invalidates reuse; failed, stale and postterminal replies
cannot seed the cache. Cache and known-expression memory are each limited to
64 entries/256 KiB with a 60-second lifetime, connection-local only, with limits shared across Worker sessions.

## Current validation

Fifteen independent fake-protocol tests pass, including 412 repeated exact snapshot
expressions with one fetch, equal-length distinct anonymous sources, actual
module-byte hash controls, malformed metadata, context/target/session replacement,
bounded lifetime/capacity, fetch failure and sticky terminal/late replies.
The final actual Chrome control passes all 16 tests. On one Worker/context,
six unchanged snapshot evaluations caused six requests under the old per-event
policy and one under the candidate; each new script ID retains attribution.
Unknown nested anonymous scripts still fetch, two equal-size distinct WASM
modules retain actual byte hashes, and Worker replacement/two real isolated
contexts fetch independently. Actual waits/EOF and zero postterminal requests
are verified. An initial successful control and rejected fixture iterations
remain explicit; a delayed Worker bootstrap exposed and corrected a baseline
fixture assumption rather than being labeled a controller script.

The current native qualification passed queued key and Mouse1 input, independent
UP, immutable capture, complete visibility transitions and sticky UNKNOWN with
zero postterminal requests. Its direct native/watchdog/supervisor-child and Chrome
actual waits/EOF completed; all 20 recorded PIDs were absent. Eight visibility
tests, the browser helper tests and `flock /tmp/wine-build.lock bash tools/build.sh`
passed. The correction was committed and immediately strict-pulled/pushed before
original admission. The complete native fixture consent image was personally
reviewed before its finite host-only click.

## Single original: exact partial result

The fresh original used the unchanged registered arguments, real ticks and
cooperative 10000, with current source/module/media/import/TLB/font/resolved-PATH
and native closure pins. The independent 1820-second watchdog was armed around
the 1800-second native deadline; the 180-second Quit reserve remained unchanged.
No additional original was launched.

Actual original inventory records 397 scripts: 33 actual source/bytecode fetches
and 364 verified reuses. The exact 47-byte snapshot expression was fetched once
and reused for 364 later script IDs in the same live context, preserving each
script's attribution. Both actual WASM scripts were fetched: 2,209,708 bytes,
SHA-256 `47fbf18303efc59192ed3b5dbfcb48c0f27e5d70ee7ccc969fc6321f7ff72efa`.
Public WASM metadata was not substituted for those bytes.

The required render Worker `Runtime.evaluate` request 808 reached the fixed
three-second UNKNOWN. Its already-arriving response was logged passively at
3605.703 ms; it did not reopen the route. The last preterminal public GL snapshot
showed one nonsoftware WebGL2 context, zero draws and zero presents. No consent
image was produced, no host click or game input occurred, and menu, arena, frag
and native Quit are all unproved. This is a source-inspection correction with an
exact partial gameplay outcome, not a demonstrated gameplay fix. The residual
queue/body/inspector/native-occupancy cause remains UNKNOWN.

The route remained permanently closed with zero postterminal requests. Host
teardown completed and direct native (exit 1), watchdog (exit 0), supervisor child
(exit 0) and Chrome actual waits/EOF were verified; all 13 recorded original PIDs
were absent, with no pin drift or HTTP byte mismatches and no remaining profile.
Across this task, 54 named actual wait receipts and 109 recorded PIDs were checked;
historical/ancillary detached-outer gaps remain explicitly UNKNOWN. Runtime and
build locks were released before this report update. Evidence is indexed in
`result.json`, including selected screenshots and `original-terminal-analysis.json`.
No boxes, workers or deployment were created. Next work would require a new
causal investigation and authorization; this assignment stops without retry.
